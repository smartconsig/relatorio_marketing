// ── Resíduos ────────────────────────────────────────────────────────────────
// Clientes da Quitação de Boleto que têm resíduo a pagar. Tela interna
// (admin / setor financeiro). Regras críticas garantidas no banco
// (migration 011_residuos.sql) — esta tela é a conveniência por cima.
//
// Documentos (boletos/faturas) chegam em ZIP e são casados com os clientes
// na conferência do modal de importação; nada é gravado antes do clique
// final. Arquivos vivem no Storage; grava direto no Supabase (sem snapshot)
// e revalida a cada 30s — padrão Esteira de Conteúdo.
import { state } from '../state.js';
import { toast, handleError } from '../utils/ui.js';
import { perm } from '../services/permissions.js';
import { showConfirm } from '../utils/confirm.js';
import {
  loadResiduos, loadResiduoDocs, marcarResiduoPago, excluirResiduo,
  uploadResiduoDoc, getResiduoDocUrl, deleteResiduoDoc,
  analisarZip, executarImport,
} from '../services/residuos-svc.js';

// ── State do módulo ─────────────────────────────────────────────────────────
let _residuos     = [];
let _docs         = new Map();   // residuo_id -> [docs]
let _page         = 1;
let _search       = '';
let _statusFiltro = '';
let _pollTimer    = null;
let _listeners    = false;
let _plano        = null;        // resultado da análise do ZIP (conferência)
let _importando   = false;
let _anexoAlvo    = null;        // residuo alvo do anexo manual

const PAGE_SIZE = 25;

const STATUS_META = {
  residuo_solicitado: { label: 'Resíduo Solicitado', cls: 'res-st-sol' },
  residuo_anexado:    { label: 'Resíduo Anexado',    cls: 'res-st-anx' },
  residuo_pago:       { label: 'Resíduo Pago',       cls: 'res-st-pag' },
};
const STATUS_ORDER = ['residuo_solicitado','residuo_anexado','residuo_pago'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const isAdmin   = () => perm.isAdmin();
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
  if (m.includes('RESIDUO_SEM_PERMISSAO'))        return 'Sem permissão para esta ação.';
  if (m.includes('RESIDUO_JA_EXISTE'))            return 'Este cliente já está na tela de Resíduos.';
  if (m.includes('RESIDUO_FASE_INVALIDA'))        return 'Só é possível enviar para Resíduos nas fases Boleto Solicitado ou Enviado.';
  if (m.includes('RESIDUO_TRANSICAO_INVALIDA'))   return 'O resíduo precisa ter documentos anexados antes de ser marcado como pago.';
  if (m.includes('RESIDUO_BOLETO_NAO_ENCONTRADO'))return 'Registro de boleto não encontrado.';
  if (m.includes('RESIDUO_NAO_ENCONTRADO'))       return 'Resíduo não encontrado.';
  return m || 'Erro inesperado.';
}

function _filtered() {
  let list = _residuos;
  if (_search) {
    const digits = _search.replace(/\D/g,'');
    const lower  = _search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.includes(digits)) ||
      (digits && String(r.contrato || '').includes(digits))
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
    const [residuos, docs] = await Promise.all([loadResiduos(), loadResiduoDocs()]);
    _residuos = residuos;
    _docs = new Map();
    for (const d of docs) {
      if (!_docs.has(d.residuo_id)) _docs.set(d.residuo_id, []);
      _docs.get(d.residuo_id).push(d);
    }
  } catch (e) {
    handleError('Erro ao carregar Resíduos.', e);
    _residuos = []; _docs = new Map();
  }
}

// Revalidação: a cada 30s e ao voltar o foco para a aba (padrão Esteira)
function _secVisivel() {
  const el = document.getElementById('sec-residuos');
  return !!el && el.offsetParent !== null;
}

async function _revalidar() {
  if (!_secVisivel() || _importando) return;
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
    document.addEventListener('click', _popFechar);
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function _render(el) {
  const editar = podeEditar();
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Resíduos</h1>
          <p class="lib-count res-count"></p>
        </div>
        <div class="lib-topbar-actions">
          ${editar ? `<button class="lib-btn-import" onclick="resAbrirImport()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar lote (.zip)
          </button>` : ''}
        </div>
      </div>

      <div class="bol-status-chips" id="res-status-chips"></div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="res-search" type="text" placeholder="Buscar por nome, CPF ou contrato…" oninput="resSetSearch(this.value)" />
          <button class="lib-search-clear" id="res-search-clear" onclick="resSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Contrato</th>
              <th>CPF</th>
              <th>Nome</th>
              <th>Produto</th>
              <th>Saldo Devedor</th>
              <th>Entrada</th>
              <th>Status</th>
              <th>Documentos</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="res-tbody"></tbody>
        </table>
      </div>
      <div id="res-ver-mais-wrap"></div>
    </div>

    <div class="res-modal" id="res-modal"><div class="res-modal-box" id="res-modal-content"></div></div>
    <div class="res-pop" id="res-pop" style="display:none"
      onmouseenter="resPopEnter()" onmouseleave="resPopLeave()"></div>
    <input type="file" id="res-zip-input" accept=".zip" style="display:none" onchange="resOnZipFile(this)" />
    <input type="file" id="res-anexo-input" accept=".pdf" style="display:none" onchange="resOnAnexoFile(this)" />
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
      ? `<tr><td colspan="10" class="lib-empty">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <div>Nenhum cliente em resíduo.</div>
           <div style="font-size:.8rem;margin-top:4px">Clientes entram pela tela Quitação de Boleto, botão "Resíduo →".</div>
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
  const meta = STATUS_META[r.status] || STATUS_META.residuo_solicitado;
  const docs = _docs.get(r.id) || [];
  const nBol = docs.filter(d => d.tipo === 'boleto').length;
  const nFat = docs.filter(d => d.tipo === 'fatura').length;

  const statusDate =
    r.status === 'residuo_pago'    ? fmtDate(r.data_pago)    :
    r.status === 'residuo_anexado' ? fmtDate(r.data_anexado) : fmtDate(r.data_solicitado);

  const docChips = docs.length
    ? `<span class="res-doc-chips" onmouseenter="resPopShow(event,'${r.id}')" onmouseleave="resPopLeave()" onclick="resPopShow(event,'${r.id}',true)">
         ${nBol ? `<span class="res-chip res-chip-ok">📄 ${nBol}</span>` : ''}
         ${nFat ? `<span class="res-chip res-chip-ok">🧾 ${nFat}</span>` : ''}
       </span>`
    : `<span class="res-chip res-chip-none">sem documentos</span>`;

  const anexBtn = editar
    ? `<button class="res-btn-anexo" onclick="resAbrirAnexo('${r.id}')" title="Anexar documento avulso">＋</button>`
    : '';

  const pagoBtn = editar && r.status === 'residuo_anexado'
    ? `<button class="bol-btn-quit" onclick="resMarcarPago('${r.id}')" title="Marcar resíduo como pago">✓ Pago</button>`
    : '';

  const delBtn = admin
    ? `<button class="lib-btn-del" onclick="resExcluir('${r.id}')" title="Excluir (volta a marca no boleto)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : '';

  const valorPago = r.status === 'residuo_pago' && r.valor_pago
    ? `<span class="res-valor-pago">${fmtBRL(r.valor_pago)}</span>` : '';

  return `
    <tr class="lib-tr" data-id="${r.id}">
      <td><span class="lib-empresa-badge">${_esc(r.empresa_parceira || '—')}</span></td>
      <td>${_esc(r.contrato || '—')}</td>
      <td>${fmtCpf(r.cpf)}</td>
      <td class="lib-nome" title="${_esc(r.nome || '')}">${_esc(r.nome || '—')}</td>
      <td class="lib-trunc" title="${_esc(r.produto || '')}">${_esc(r.produto || '—')}</td>
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_devedor)}</td>
      <td>${fmtDate(r.data_solicitado || (r.created_at || '').slice(0,10))}</td>
      <td>
        <span class="bol-badge ${meta.cls}">${meta.label}</span>
        <span class="bol-badge-date">${statusDate}</span>
        ${valorPago}
      </td>
      <td>${docChips}${anexBtn}</td>
      <td class="lib-td-actions bol-td-actions">${pagoBtn}${delBtn}</td>
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

// ── Popover de documentos (hover / clique) ──────────────────────────────────
let _popTimer = null;
let _popFixo  = false;

export function resPopShow(ev, residuoId, fixo = false) {
  clearTimeout(_popTimer);
  const pop = document.getElementById('res-pop');
  const r   = _residuos.find(x => x.id === residuoId);
  if (!pop || !r) return;
  _popFixo = fixo;

  const docs   = _docs.get(residuoId) || [];
  const editar = podeEditar();
  const linha  = d => `
    <div class="res-pop-file">
      <span class="res-pop-nm" title="${_esc(d.nome_arquivo)}">${d.tipo === 'boleto' ? '📄' : '🧾'} ${_esc(d.nome_arquivo)}${d.contrato ? ` <em>· ${_esc(d.contrato)}</em>` : ''}</span>
      <span class="res-pop-ops">
        <a onclick="resVerDoc('${d.id}')">ver</a>
        <a onclick="resBaixarDoc('${d.id}')">baixar</a>
        ${editar ? `<a class="res-pop-del" onclick="resExcluirDoc('${d.id}')">excluir</a>` : ''}
      </span>
    </div>`;

  const bols = docs.filter(d => d.tipo === 'boleto');
  const fats = docs.filter(d => d.tipo === 'fatura');
  pop.innerHTML = `
    <div class="res-pop-title">${_esc(r.nome)}</div>
    ${bols.length ? `<div class="res-pop-grp">Boletos</div>${bols.map(linha).join('')}` : ''}
    ${fats.length ? `<div class="res-pop-grp">Faturas</div>${fats.map(linha).join('')}` : ''}
    ${!docs.length ? `<div class="res-pop-grp">Nenhum documento</div>` : ''}
  `;

  const rect = ev.currentTarget.getBoundingClientRect();
  pop.style.display = 'block';
  const popW = Math.min(380, window.innerWidth - 24);
  pop.style.width = popW + 'px';
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - popW - 12));
  let top  = rect.bottom + 6;
  const popH = pop.offsetHeight || 200;
  if (top + popH > window.innerHeight - 12) top = Math.max(12, rect.top - popH - 6);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}

export function resPopEnter() { clearTimeout(_popTimer); }

export function resPopLeave() {
  clearTimeout(_popTimer);
  _popTimer = setTimeout(() => {
    if (_popFixo) return; // fixado por clique: fecha só clicando fora
    const pop = document.getElementById('res-pop');
    if (pop) pop.style.display = 'none';
  }, 300);
}

function _popFechar(e) {
  if (e.target.closest('.res-pop') || e.target.closest('.res-doc-chips')) return;
  _popFixo = false;
  const pop = document.getElementById('res-pop');
  if (pop) pop.style.display = 'none';
}

// ── Ver / baixar / excluir documento ────────────────────────────────────────
export async function resVerDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  const win = window.open('', '_blank');
  try {
    const url = await getResiduoDocUrl(doc.storage_path);
    if (win) win.location = url; else window.open(url, '_blank');
  } catch (e) {
    if (win) win.close();
    handleError('Erro ao abrir o documento.', e);
  }
}

export async function resBaixarDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  try {
    const url = await getResiduoDocUrl(doc.storage_path, doc.nome_arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nome_arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    handleError('Erro ao baixar o documento.', e);
  }
}

export function resExcluirDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  showConfirm(
    'Excluir documento',
    `Excluir "${doc.nome_arquivo}" deste cliente? O arquivo é removido do Storage.`,
    'Excluir',
    async () => {
      try {
        await deleteResiduoDoc(doc);
        toast('Documento excluído.');
        await _revalidarAgora();
      } catch (e) { handleError('Erro ao excluir o documento.', e); }
    }
  );
}

function _findDoc(docId) {
  for (const docs of _docs.values()) {
    const d = docs.find(x => x.id === docId);
    if (d) return d;
  }
  return null;
}

async function _revalidarAgora() {
  await _loadData();
  _updateTable();
}

// ── Anexo avulso (um PDF direto na linha) ───────────────────────────────────
export function resAbrirAnexo(residuoId) {
  _anexoAlvo = _residuos.find(x => x.id === residuoId) || null;
  if (!_anexoAlvo) return;
  document.getElementById('res-anexo-input')?.click();
}

let _anexoFile = null;

export function resOnAnexoFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file || !_anexoAlvo) { _anexoAlvo = null; return; }
  _anexoFile = file;

  // Nome do arquivo já denuncia o tipo? Anexa direto; senão, pergunta.
  if (/fatura/i.test(file.name)) return resAnexarComo('fatura');
  if (/boleto/i.test(file.name)) return resAnexarComo('boleto');

  const content = document.getElementById('res-modal-content');
  const modal   = document.getElementById('res-modal');
  if (!content || !modal) return;
  content.innerHTML = `
    <h2 class="lib-modal-title">Anexar documento</h2>
    <p style="font-size:.88rem;color:var(--gray);margin:0 0 6px">
      Cliente: <strong style="color:var(--white)">${_esc(_anexoAlvo.nome)}</strong>
    </p>
    <p style="font-size:.82rem;color:var(--gray-light);margin:0 0 16px">"${_esc(file.name)}" é um boleto ou uma fatura?</p>
    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="resFecharModal()">Cancelar</button>
      <button class="lib-btn-save" onclick="resAnexarComo('boleto')">📄 Boleto</button>
      <button class="lib-btn-save" onclick="resAnexarComo('fatura')">🧾 Fatura</button>
    </div>
  `;
  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) resFecharModal(); };
}

export async function resAnexarComo(tipo) {
  const alvo = _anexoAlvo, file = _anexoFile;
  _anexoAlvo = null; _anexoFile = null;
  resFecharModal();
  if (!alvo || !file) return;
  try {
    await uploadResiduoDoc(alvo, tipo, file, { nomeArquivo: file.name });
    toast(`Documento anexado em ${alvo.nome}.`);
    await _revalidarAgora();
  } catch (e) { handleError('Erro ao anexar o documento.', e); }
}

// ── Marcar pago ─────────────────────────────────────────────────────────────
export function resMarcarPago(residuoId) {
  const r = _residuos.find(x => x.id === residuoId);
  if (!r) return;

  const content = document.getElementById('res-modal-content');
  const modal   = document.getElementById('res-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Marcar Resíduo como Pago</h2>
    <p style="font-size:.88rem;color:var(--gray);margin:0 0 16px">
      Cliente: <strong style="color:var(--white)">${_esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
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
    await marcarResiduoPago(residuoId, valor);
    toast('Resíduo marcado como pago.');
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
  _plano = null;
}

// ── Excluir resíduo (admin) ─────────────────────────────────────────────────
export function resExcluir(residuoId) {
  const r = _residuos.find(x => x.id === residuoId);
  if (!r) return;
  const docs = _docs.get(residuoId) || [];
  showConfirm(
    'Excluir resíduo',
    `Excluir "${r.nome}" da tela de Resíduos? ${docs.length ? `Os ${docs.length} documento(s) anexados serão removidos do Storage. ` : ''}A marca "Em resíduo" some do boleto de origem.`,
    'Excluir',
    async () => {
      try {
        await excluirResiduo(r, docs);
        toast('Resíduo excluído.');
        await _revalidarAgora();
      } catch (e) { handleError('Erro ao excluir o resíduo.', e); }
    }
  );
}

// ── Importação em lote ──────────────────────────────────────────────────────
export function resAbrirImport() {
  if (!_residuos.length) {
    toast('Não há clientes em resíduo — envie clientes pela tela Quitação de Boleto primeiro.', 'err');
    return;
  }
  document.getElementById('res-zip-input')?.click();
}

export async function resOnZipFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;

  const content = document.getElementById('res-modal-content');
  const modal   = document.getElementById('res-modal');
  if (!content || !modal) return;

  modal.classList.add('open');
  modal.onclick = null; // durante análise/upload não fecha clicando fora
  content.innerHTML = `
    <h2 class="lib-modal-title">Importar lote de documentos</h2>
    <p style="font-size:.85rem;color:var(--gray);margin:0 0 14px">${_esc(file.name)} · ${(file.size/1048576).toFixed(1)} MB</p>
    <div class="res-progress"><div class="res-progress-bar" id="res-prg-bar" style="width:2%"></div></div>
    <p class="res-prg-txt" id="res-prg-txt">Abrindo o arquivo…</p>
  `;

  const bar = () => document.getElementById('res-prg-bar');
  const txt = () => document.getElementById('res-prg-txt');

  try {
    const todosDocs = [...(_docs.values() || [])].flat();
    _plano = await analisarZip(file, _residuos, todosDocs, (n, total, etapa) => {
      const b = bar(), t = txt();
      if (b && total) b.style.width = Math.max(2, Math.round((n/total)*100)) + '%';
      if (t) t.textContent = etapa || `Analisando ${n}/${total}…`;
    });
  } catch (e) {
    console.error(e);
    content.innerHTML = `
      <h2 class="lib-modal-title">Importar lote de documentos</h2>
      <p style="color:var(--red-hover);font-size:.9rem">Não consegui ler o ZIP: ${_esc(e?.message || 'erro desconhecido')}</p>
      <div class="lib-modal-actions"><button class="lib-btn-save" onclick="resFecharModal()">Fechar</button></div>`;
    return;
  }

  _renderConferencia(file.name);
}

function _renderConferencia(zipName) {
  const content = document.getElementById('res-modal-content');
  const modal   = document.getElementById('res-modal');
  if (!content || !modal || !_plano) return;
  modal.onclick = null;

  const { itens, orfaos, jaAnexados, clientesSemArquivo } = _plano;
  const clientesCasados = new Set(itens.map(i => i.residuo.id)).size;

  const amostra = itens.slice(0, 60);
  const linhas = amostra.map(i => `
    <div class="res-mrow">
      <span class="res-mfile" title="${_esc(i.nomeArquivo)}">${i.tipo === 'boleto' ? '📄' : '🧾'} ${_esc(i.nomeArquivo)}</span>
      <span class="res-mto">→</span>
      <span class="res-mwho" title="${_esc(i.residuo.nome)}">${_esc(i.residuo.nome)}</span>
      <span class="res-mtag ${i.metodo === 'nome' ? 'res-mtag-nome' : 'res-mtag-cpf'}">${i.metodo === 'nome' ? 'nome ≈' : 'CPF ✓'}</span>
    </div>`).join('');

  const orfLinhas = orfaos.map((o, idx) => `
    <div class="res-orow">
      <span class="res-mfile" title="${_esc(o.path)}">${o.tipo === 'boleto' ? '📄' : '🧾'} ${_esc(o.nomeArquivo)}<em class="res-omotivo">${_esc(o.motivo || '')}</em></span>
      <select class="res-osel" onchange="resAtribuirOrfao(${idx}, this.value)">
        <option value="">Ignorar este arquivo</option>
        ${_residuos.map(r => `<option value="${r.id}">${_esc(r.nome)} · ${fmtCpf(r.cpf)}</option>`).join('')}
      </select>
    </div>`).join('');

  const semArq = clientesSemArquivo.length
    ? `<div class="res-sumchip res-sum-warn" title="${_esc(clientesSemArquivo.map(c => c.nome).join(', '))}">${clientesSemArquivo.length} cliente(s) aguardando sem arquivo neste lote</div>`
    : '';

  content.innerHTML = `
    <h2 class="lib-modal-title">Conferência do lote</h2>
    <p style="font-size:.85rem;color:var(--gray);margin:0 0 12px">${_esc(zipName)} — nada foi gravado ainda. Confira e confirme.</p>

    <div class="res-sumchips">
      <div class="res-sumchip res-sum-ok">${itens.length} documento(s) para anexar em ${clientesCasados} cliente(s)</div>
      ${jaAnexados.length ? `<div class="res-sumchip">${jaAnexados.length} já anexado(s) antes — serão pulados</div>` : ''}
      ${orfaos.length ? `<div class="res-sumchip res-sum-warn">${orfaos.length} sem correspondência</div>` : ''}
      ${semArq}
    </div>

    ${itens.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Casamentos propostos${itens.length > amostra.length ? ` (mostrando ${amostra.length} de ${itens.length})` : ''}</div>
        <div class="res-mbody">${linhas}</div>
      </div>` : ''}

    ${orfaos.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Sem correspondência — atribuir manualmente ou ignorar</div>
        <div class="res-mbody">${orfLinhas}</div>
      </div>` : ''}

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="resFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="res-btn-conf" onclick="resConfirmarImport()" ${itens.length + orfaos.filter(o => o._residuoId).length === 0 ? 'disabled' : ''}>
        Confirmar e anexar
      </button>
    </div>
  `;
  _updateConfBtn();
}

function _updateConfBtn() {
  const btn = document.getElementById('res-btn-conf');
  if (!btn || !_plano) return;
  const extra = _plano.orfaos.filter(o => o._residuoId).length;
  const total = _plano.itens.length + extra;
  btn.disabled = total === 0;
  btn.textContent = `Confirmar e anexar ${total} documento(s)`;
}

export function resAtribuirOrfao(idx, residuoId) {
  if (!_plano?.orfaos?.[idx]) return;
  _plano.orfaos[idx]._residuoId = residuoId || null;
  _updateConfBtn();
}

export async function resConfirmarImport() {
  if (!_plano || _importando) return;
  const content = document.getElementById('res-modal-content');
  if (!content) return;

  const atribuidos = _plano.orfaos
    .filter(o => o._residuoId)
    .map(o => ({
      residuo: _residuos.find(r => r.id === o._residuoId),
      nomeArquivo: o.nomeArquivo, tipo: o.tipo, contrato: o.contrato,
      blob: o.blob, metodo: 'manual',
    }))
    .filter(i => i.residuo);

  const fila = [..._plano.itens, ...atribuidos];
  if (!fila.length) return;

  _importando = true;
  content.innerHTML = `
    <h2 class="lib-modal-title">Anexando documentos…</h2>
    <div class="res-progress"><div class="res-progress-bar" id="res-prg-bar" style="width:2%"></div></div>
    <p class="res-prg-txt" id="res-prg-txt">Enviando 1/${fila.length}…</p>
    <p style="font-size:.78rem;color:var(--gray)">Não feche esta janela até terminar.</p>
  `;

  const { ok, falhas } = await executarImport(fila, (n, total, item) => {
    const b = document.getElementById('res-prg-bar');
    const t = document.getElementById('res-prg-txt');
    if (b) b.style.width = Math.max(2, Math.round((n/total)*100)) + '%';
    if (t) t.textContent = item ? `Enviando ${n+1}/${total} — ${item.nomeArquivo}` : 'Finalizando…';
  });

  _importando = false;
  await _revalidarAgora();

  content.innerHTML = `
    <h2 class="lib-modal-title">Importação concluída</h2>
    <div class="res-sumchips" style="margin-top:8px">
      <div class="res-sumchip res-sum-ok">${ok.length} documento(s) anexado(s)</div>
      ${falhas.length ? `<div class="res-sumchip res-sum-err">${falhas.length} falha(s)</div>` : ''}
    </div>
    ${falhas.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Falhas (o restante foi gravado normalmente)</div>
        <div class="res-mbody">${falhas.map(f => `
          <div class="res-mrow">
            <span class="res-mfile">${_esc(f.nomeArquivo)}</span>
            <span class="res-mto">·</span>
            <span class="res-mwho" style="color:var(--red-hover)">${_esc(f.erro)}</span>
            <span></span>
          </div>`).join('')}</div>
      </div>
      <p style="font-size:.8rem;color:var(--gray)">Importe o mesmo ZIP de novo para tentar só as falhas — o que já foi anexado é pulado automaticamente.</p>` : ''}
    <div class="lib-modal-actions">
      <button class="lib-btn-save" onclick="resFecharModal()">Fechar</button>
    </div>
  `;
  _plano = null;
}
