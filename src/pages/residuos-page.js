// ── Resíduos (v2) ───────────────────────────────────────────────────────────
// Clientes da Liberação de Margem Master com resíduo a pagar. Tela interna
// (admin / setor financeiro) e LISTA DE CONTROLE PURA — sem documentos: os
// PDFs de boletos/faturas vivem na Quitação de Boleto.
//
// Fluxo: cliente entra pela Liberação (botão "Resíduo →") como PENDENTE →
// SOLICITADO → PAGO. Ao pagar, volta automaticamente para a Liberação com a
// observação "RESÍDUO PAGO em dd/mm/aaaa" e some desta tela (histórico fica
// no banco). Regras garantidas na migration 012; grava direto no Supabase
// (sem snapshot) e revalida a cada 30s — padrão Esteira de Conteúdo.
import { toast, handleError } from '../utils/ui.js';
import { perm } from '../services/permissions.js';
import { showConfirm } from '../utils/confirm.js';
import { loadResiduos, mudarStatusResiduo, excluirResiduo } from '../services/residuos-svc.js';

// ── State do módulo ─────────────────────────────────────────────────────────
let _residuos     = [];
let _page         = 1;
let _search       = '';
let _statusFiltro = '';
let _pollTimer    = null;
let _listeners    = false;

const PAGE_SIZE = 25;

const STATUS_META = {
  residuo_pendente:   { label: 'Resíduo Pendente',   cls: 'res-st-pen' },
  residuo_solicitado: { label: 'Resíduo Solicitado', cls: 'res-st-sol' },
};
const STATUS_ORDER = ['residuo_pendente','residuo_solicitado'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const isAdmin    = () => perm.isAdmin();
const podeEditar = () => perm.residuosEditar();

const fmtBRL = v =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = v => {
  if (!v) return '—';
  const d = new Date(String(v).slice(0,10) + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

const fmtCpf = c => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (c || '—');
};

const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _msgErroBanco(error) {
  const m = error?.message || '';
  if (m.includes('RESIDUO_SEM_PERMISSAO'))      return 'Sem permissão para esta ação.';
  if (m.includes('RESIDUO_TRANSICAO_INVALIDA')) return 'Mudança de status não permitida nesta fase.';
  if (m.includes('RESIDUO_NAO_ENCONTRADO'))     return 'Resíduo não encontrado — atualize a tela.';
  return m || 'Erro inesperado.';
}

function _filtered() {
  let list = _residuos;
  if (_search) {
    const digits = _search.replace(/\D/g,'');
    const lower  = _search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.includes(digits))
    );
  }
  if (_statusFiltro) list = list.filter(r => r.status === _statusFiltro);
  return list;
}

// ── Entry point ─────────────────────────────────────────────────────────────
export async function renderResiduos() {
  const el = document.getElementById('sec-residuos');
  if (!el) return;
  _page = 1; _search = ''; _statusFiltro = '';
  el.innerHTML = `<div style="padding:48px;text-align:center;color:var(--gray)">Carregando…</div>`;
  await _loadData();
  _render(el);
  _startPolling();
}

async function _loadData() {
  try {
    const all = await loadResiduos();
    // Pago some da tela (fica no banco como histórico)
    _residuos = all.filter(r => r.status !== 'residuo_pago');
  } catch (e) {
    handleError('Erro ao carregar Resíduos.', e);
    _residuos = [];
  }
}

// Revalidação: a cada 30s e ao voltar o foco para a aba (padrão Esteira)
function _secVisivel() {
  const el = document.getElementById('sec-residuos');
  return !!el && el.offsetParent !== null;
}

async function _revalidar() {
  if (!_secVisivel()) return;
  await _loadData();
  if (_secVisivel()) _updateTable();
}

function _startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(_revalidar, 30000);
  if (!_listeners) {
    _listeners = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') _revalidar();
    });
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function _render(el) {
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Resíduos</h1>
          <p class="lib-count res-count"></p>
        </div>
      </div>

      <div class="bol-status-chips" id="res-status-chips"></div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="res-search" type="text" placeholder="Buscar por nome ou CPF…" oninput="resSetSearch(this.value)" />
          <button class="lib-search-clear" id="res-search-clear" onclick="resSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CPF</th>
              <th>Nome</th>
              <th>Convênio</th>
              <th>Produto</th>
              <th>Saldo Devedor</th>
              <th>Troco</th>
              <th>Entrada</th>
              <th>Status</th>
              <th>Obs</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="res-tbody"></tbody>
        </table>
      </div>
      <div id="res-ver-mais-wrap"></div>
    </div>

    <div class="res-modal" id="res-modal"><div class="res-modal-box" id="res-modal-content" style="max-width:480px"></div></div>
  `;
  _updateTable();
}

function _updateTable() {
  const editar   = podeEditar();
  const admin    = isAdmin();
  const filtered = _filtered();
  const visible  = filtered.slice(0, _page * PAGE_SIZE);
  const hasMore  = filtered.length > visible.length;

  const countEl = document.querySelector('.res-count');
  if (countEl) {
    countEl.textContent = _search || _statusFiltro
      ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} de ${_residuos.length} total`
      : `${_residuos.length} cliente${_residuos.length !== 1 ? 's' : ''} em resíduo`;
  }

  const chipsEl = document.getElementById('res-status-chips');
  if (chipsEl) {
    const saved = _statusFiltro;
    _statusFiltro = '';
    const base = _filtered();
    _statusFiltro = saved;
    const countBy = s => base.filter(r => r.status === s).length;
    chipsEl.innerHTML = `
      <button class="bol-chip${!_statusFiltro ? ' active' : ''}" onclick="resSetStatusFiltro('')">Todos <span>${base.length}</span></button>
      ${STATUS_ORDER.map(s => `
        <button class="bol-chip ${STATUS_META[s].cls}${_statusFiltro === s ? ' active' : ''}" onclick="resSetStatusFiltro('${s}')">
          ${STATUS_META[s].label} <span>${countBy(s)}</span>
        </button>`).join('')}
    `;
  }

  const tbody = document.getElementById('res-tbody');
  if (tbody) {
    tbody.innerHTML = visible.length === 0
      ? `<tr><td colspan="11" class="lib-empty">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <div>Nenhum cliente em resíduo.</div>
           <div style="font-size:.8rem;margin-top:4px">Clientes entram pela tela Liberação de Margem, botão "Resíduo →".</div>
         </td></tr>`
      : visible.map(r => _renderRow(r, editar, admin)).join('');
  }

  const vmWrap = document.getElementById('res-ver-mais-wrap');
  if (vmWrap) {
    if (hasMore) {
      const rest = filtered.length - visible.length;
      const next = Math.min(PAGE_SIZE, rest);
      vmWrap.innerHTML = `
        <div class="lib-ver-mais-wrap">
          <button class="lib-ver-mais" onclick="resVerMais()">
            Mostrar mais ${next} cliente${next !== 1 ? 's' : ''}
            <span class="lib-ver-mais-sub">${rest} restante${rest !== 1 ? 's' : ''}</span>
          </button>
        </div>`;
    } else {
      vmWrap.innerHTML = '';
    }
  }

  const clearSearch = document.getElementById('res-search-clear');
  if (clearSearch) clearSearch.style.display = _search ? '' : 'none';
}

function _renderRow(r, editar, admin) {
  const meta = STATUS_META[r.status] || STATUS_META.residuo_pendente;

  const statusDate =
    r.status === 'residuo_solicitado' ? fmtDate(r.data_solicitado) : fmtDate(r.data_pendente);

  let stepBtn = '';
  if (editar && r.status === 'residuo_pendente') {
    stepBtn = `<button class="bol-btn-step" onclick="resSolicitar('${r.id}')" title="Marcar como Resíduo Solicitado">Solicitado →</button>`;
  } else if (editar && r.status === 'residuo_solicitado') {
    stepBtn = `<button class="bol-btn-quit" onclick="resMarcarPago('${r.id}')" title="Marcar resíduo como pago — o cliente volta para a Liberação de Margem">✓ Pago</button>`;
  }

  const delBtn = admin
    ? `<button class="lib-btn-del" onclick="resExcluir('${r.id}')" title="Excluir — o cliente volta para a Liberação sem observação">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : '';

  return `
    <tr class="lib-tr" data-id="${r.id}">
      <td><span class="lib-empresa-badge">${_esc(r.empresa_parceira || '—')}</span></td>
      <td>${fmtCpf(r.cpf)}</td>
      <td class="lib-nome" title="${_esc(r.nome || '')}">${_esc(r.nome || '—')}</td>
      <td class="lib-trunc" title="${_esc(r.convenio || '')}">${_esc(r.convenio || '—')}</td>
      <td class="lib-trunc" title="${_esc(r.produto || '')}">${_esc(r.produto || '—')}</td>
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      <td>${fmtDate(r.data_pendente || (r.created_at || '').slice(0,10))}</td>
      <td>
        <span class="bol-badge ${meta.cls}">${meta.label}</span>
        <span class="bol-badge-date">${statusDate}</span>
      </td>
      <td class="lib-obs" title="${_esc(r.obs || '')}">${_esc(r.obs || '—')}</td>
      <td class="lib-td-actions bol-td-actions">${stepBtn}${delBtn}</td>
    </tr>`;
}

// ── Filtros ─────────────────────────────────────────────────────────────────
export function resSetSearch(val) {
  _search = val || '';
  _page   = 1;
  const inp = document.getElementById('res-search');
  if (inp && inp.value !== _search) inp.value = _search;
  _updateTable();
}

export function resSetStatusFiltro(val) {
  _statusFiltro = val;
  _page = 1;
  _updateTable();
}

export function resVerMais() {
  _page++;
  _updateTable();
  document.getElementById('res-ver-mais-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function _revalidarAgora() {
  await _loadData();
  _updateTable();
}

// ── Pendente → Solicitado ───────────────────────────────────────────────────
export function resSolicitar(residuoId) {
  const r = _residuos.find(x => x.id === residuoId);
  if (!r) return;
  showConfirm(
    'Marcar como Resíduo Solicitado',
    `Confirma que o resíduo de "${r.nome}" foi solicitado?`,
    'Confirmar',
    async () => {
      try {
        await mudarStatusResiduo(residuoId, 'residuo_solicitado');
        toast('Resíduo marcado como solicitado.');
        await _revalidarAgora();
      } catch (e) { toast(_msgErroBanco(e), 'err'); }
    }
  );
}

// ── Solicitado → Pago (volta automática para a Liberação) ───────────────────
export function resMarcarPago(residuoId) {
  const r = _residuos.find(x => x.id === residuoId);
  if (!r) return;

  const content = document.getElementById('res-modal-content');
  const modal   = document.getElementById('res-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Marcar Resíduo como Pago</h2>
    <p style="font-size:.88rem;color:var(--gray);margin:0 0 6px">
      Cliente: <strong style="color:var(--white)">${_esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
    </p>
    <p style="font-size:.8rem;color:var(--gray-light);margin:0 0 16px">
      Ao confirmar, o cliente volta para a Liberação de Margem com a observação
      "RESÍDUO PAGO" e sai desta tela.
    </p>
    <div class="lib-form-row">
      <label>Valor pago (opcional)</label>
      <input type="text" id="res-f-valor" placeholder="R$ 0,00" inputmode="decimal">
    </div>
    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="resFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="res-btn-pago" onclick="resConfirmarPago('${r.id}')">Confirmar pagamento</button>
    </div>
  `;
  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) resFecharModal(); };
  document.getElementById('res-f-valor')?.focus();
}

export async function resConfirmarPago(residuoId) {
  const btn = document.getElementById('res-btn-pago');
  const raw = document.getElementById('res-f-valor')?.value || '';
  const num = parseFloat(raw.replace(/[^\d,]/g, '').replace(',', '.'));
  const valor = Number.isFinite(num) && num > 0 ? num : null;

  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  try {
    const ret = await mudarStatusResiduo(residuoId, 'residuo_pago', valor);
    toast(ret?.voltou_liberacao === false
      ? 'Resíduo pago. (A linha original não existe mais na Liberação.)'
      : 'Resíduo pago — cliente devolvido à Liberação de Margem.');
    resFecharModal();
    await _revalidarAgora();
  } catch (e) {
    toast(_msgErroBanco(e), 'err');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar pagamento'; }
  }
}

export function resFecharModal() {
  const modal = document.getElementById('res-modal');
  if (modal) modal.classList.remove('open');
}

// ── Excluir (admin) ─────────────────────────────────────────────────────────
export function resExcluir(residuoId) {
  const r = _residuos.find(x => x.id === residuoId);
  if (!r) return;
  showConfirm(
    'Excluir resíduo',
    `Excluir "${r.nome}" da tela de Resíduos? O cliente volta a aparecer na Liberação de Margem, sem observação.`,
    'Excluir',
    async () => {
      try {
        await excluirResiduo(residuoId);
        toast('Resíduo excluído — cliente devolvido à Liberação.');
        await _revalidarAgora();
      } catch (e) { handleError('Erro ao excluir o resíduo.', e); }
    }
  );
}
