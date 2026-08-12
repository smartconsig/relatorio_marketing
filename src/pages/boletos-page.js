// ── Quitação de Boleto ─────────────────────────────────────────────────────
// Acompanhamento das fases do boleto por parceiro. Regras críticas (visibilidade
// por empresa, bloqueio de CPF, transições de status) são garantidas no banco
// (migration 006_quitacao_boletos.sql) — esta tela é a conveniência por cima.
import { sb } from '../services/supabase.js';
import { state } from '../state.js';
import { toast, handleError } from '../utils/ui.js';
import { perm } from '../services/permissions.js';
import * as XLSX from 'xlsx';
import { showConfirm } from '../utils/confirm.js';
import { parseBRL } from '../utils/currency.js';

// ── State ──────────────────────────────────────────────────────────────────
let _registros = [];
let _page          = 1;
let _search        = '';
let _dateFrom      = null;
let _dateTo        = null;
let _preset        = null;
let _empresaFiltro = '';
let _statusFiltro  = '';

const PAGE_SIZE = 25;

// ── Status ─────────────────────────────────────────────────────────────────
const STATUS_META = {
  solicitar_boleto:  { label: 'Solicitar Boleto',  cls: 'bol-st-sol'  },
  boleto_solicitado: { label: 'Boleto Solicitado', cls: 'bol-st-ped'  },
  boleto_enviado:    { label: 'Boleto Enviado',    cls: 'bol-st-env'  },
  boleto_quitado:    { label: 'Boleto Quitado',    cls: 'bol-st-quit' },
  boleto_reprovado:  { label: 'Boleto Reprovado',  cls: 'bol-st-rep'  },
};
const STATUS_ORDER = ['solicitar_boleto','boleto_solicitado','boleto_enviado','boleto_quitado','boleto_reprovado'];

// ── Helpers ────────────────────────────────────────────────────────────────
const isAdmin = () => perm.isAdmin();

function _empresaParceira() {
  if (isAdmin()) return 'Smart Consig';
  return state.currentUser?.grupoNome || '';
}

const fmtBRL = v =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = v => {
  if (!v) return '—';
  const d = new Date(v + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

const fmtCpf = c => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (c || '—');
};

const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Traduz os erros levantados pelos triggers/RPC do banco
function _msgErroBanco(error) {
  const m = error?.message || '';
  if (m.includes('BOLETO_CPF_OUTRA_EMPRESA')) {
    const emp = m.split('BOLETO_CPF_OUTRA_EMPRESA:')[1]?.split(/[\n"]/)[0]?.trim();
    return emp ? `CPF já cadastrado pela empresa ${emp}.` : 'CPF já cadastrado por outra empresa.';
  }
  if (m.includes('BOLETO_CPF_JA_LIBERACAO'))   return 'CPF já está na Liberação de Margem.';
  if (m.includes('BOLETO_CPF_INVALIDO'))       return 'CPF inválido.';
  if (m.includes('BOLETO_MOTIVO_OBRIGATORIO')) return 'Informe o motivo da reprovação.';
  if (m.includes('BOLETO_TRANSICAO_INVALIDA')) return 'Mudança de status não permitida nesta fase.';
  if (m.includes('BOLETO_SOMENTE_ADMIN'))      return 'Apenas o admin pode executar esta ação.';
  if (m.includes('BOLETO_SEM_PERMISSAO'))      return 'Sem permissão para agir neste registro.';
  if (m.includes('BOLETO_REGISTRO_FINALIZADO'))return 'Registro finalizado — somente admin pode editar.';
  if (m.includes('BOLETO_STATUS_SOMENTE_RPC')) return 'Status não pode ser alterado diretamente.';
  return m || 'Erro inesperado.';
}

// ── Date presets ──────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'hoje',    label: 'Hoje' },
  { key: 'ontem',   label: 'Ontem' },
  { key: '7d',      label: '7 dias' },
  { key: '15d',     label: '15 dias' },
  { key: '30d',     label: '30 dias' },
  { key: '60d',     label: '60 dias' },
  { key: '90d',     label: '90 dias' },
  { key: 'mes',     label: 'Este mês' },
  { key: 'mes_ant', label: 'Mês passado' },
];

function _presetRange(key) {
  const t = new Date(); t.setHours(0,0,0,0);
  const fmt = d => d.toISOString().slice(0,10);
  switch (key) {
    case 'hoje':    return { from: fmt(t), to: fmt(t) };
    case 'ontem':   { const d=new Date(t); d.setDate(d.getDate()-1); return { from:fmt(d), to:fmt(d) }; }
    case '7d':      { const d=new Date(t); d.setDate(d.getDate()-6); return { from:fmt(d), to:fmt(t) }; }
    case '15d':     { const d=new Date(t); d.setDate(d.getDate()-14); return { from:fmt(d), to:fmt(t) }; }
    case '30d':     { const d=new Date(t); d.setDate(d.getDate()-29); return { from:fmt(d), to:fmt(t) }; }
    case '60d':     { const d=new Date(t); d.setDate(d.getDate()-59); return { from:fmt(d), to:fmt(t) }; }
    case '90d':     { const d=new Date(t); d.setDate(d.getDate()-89); return { from:fmt(d), to:fmt(t) }; }
    case 'mes':     return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmt(t) };
    case 'mes_ant': return {
      from: fmt(new Date(t.getFullYear(), t.getMonth()-1, 1)),
      to:   fmt(new Date(t.getFullYear(), t.getMonth(), 0)),
    };
    default: return { from: null, to: null };
  }
}

// ── Filter ────────────────────────────────────────────────────────────────
function _filtered() {
  let list = _registros;
  if (_search) {
    const digits = _search.replace(/\D/g,'');
    const lower  = _search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.includes(digits)) ||
      (digits && String(r.contrato || '').includes(digits))
    );
  }
  if (_dateFrom)      list = list.filter(r => (r.created_at || '').slice(0,10) >= _dateFrom);
  if (_dateTo)        list = list.filter(r => (r.created_at || '').slice(0,10) <= _dateTo);
  if (_empresaFiltro) list = list.filter(r => r.empresa_parceira === _empresaFiltro);
  if (_statusFiltro)  list = list.filter(r => r.status === _statusFiltro);
  return list;
}

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderBoletos() {
  const el = document.getElementById('sec-boletos');
  if (!el) return;
  _page = 1; _search = ''; _dateFrom = null; _dateTo = null; _preset = null;
  _empresaFiltro = ''; _statusFiltro = '';
  el.innerHTML = _spinner();
  await _loadData();
  _render(el);
}

// ── Data ──────────────────────────────────────────────────────────────────
async function _loadData() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('quitacao_boletos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { handleError('Erro ao carregar dados.', error); _registros = []; return; }
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  _registros = all;
}

// ── Render shell ──────────────────────────────────────────────────────────
function _render(el) {
  const admin = isAdmin();
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Quitação de Boleto</h1>
          <p class="lib-count bol-count"></p>
        </div>
        <div class="lib-topbar-actions">
          ${admin ? `<button class="lib-btn-limpar" onclick="bolLimparBase()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Limpar Base
          </button>` : ''}
          ${admin ? `<button class="lib-btn-export" onclick="bolExportar()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>` : ''}
          <a class="lib-btn-modelo" href="/template_boletos.xlsx" download="TEMPLATE_BOLETOS.xlsx" title="Baixar modelo de planilha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Modelo
          </a>
          <button class="lib-btn-import" onclick="bolImportarPlanilha()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Planilha
          </button>
          <input type="file" id="bol-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="bolOnImportFile(this)" />
          <button class="lib-btn-add" onclick="bolAddCliente()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Cliente
          </button>
        </div>
      </div>

      <div class="bol-status-chips" id="bol-status-chips"></div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="bol-search" type="text" placeholder="Buscar por nome, CPF ou contrato…" oninput="bolSetSearch(this.value)" />
          <button class="lib-search-clear" id="bol-search-clear" onclick="bolSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>

        ${admin ? `<div class="lib-empresa-filter-wrap">
          <select class="lib-empresa-select" id="bol-empresa-select" onchange="bolSetEmpresaFiltro(this.value)">
            <option value="">Todas as empresas</option>
          </select>
        </div>` : ''}

        <div class="lib-date-row">
          <div class="lib-presets">
            ${PRESETS.map(p => `<button class="lib-preset" data-key="${p.key}" onclick="bolSetPreset('${p.key}')">${p.label}</button>`).join('')}
            <button class="lib-preset-clear" id="bol-preset-clear" onclick="bolClearDate()" style="display:none">× Limpar</button>
          </div>
          <div class="lib-date-inputs">
            <input type="date" class="lib-date-input" id="bol-date-from" onchange="bolSetDateManual()" />
            <span class="lib-date-sep">até</span>
            <input type="date" class="lib-date-input" id="bol-date-to" onchange="bolSetDateManual()" />
          </div>
        </div>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              ${admin ? '<th>Empresa</th>' : ''}
              <th>Contrato</th>
              <th>CPF</th>
              <th>Nome</th>
              <th>Convênio</th>
              <th>Produto</th>
              <th>Parcela</th>
              <th>Saldo Devedor</th>
              <th>Troco</th>
              <th>Cadastro</th>
              <th>Status</th>
              <th>Obs</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="bol-tbody"></tbody>
        </table>
      </div>
      <div id="bol-ver-mais-wrap"></div>
    </div>
  `;
  _updateTable();
}

// ── Update dinâmico ───────────────────────────────────────────────────────
function _updateTable() {
  const admin    = isAdmin();
  const filtered = _filtered();
  const visible  = filtered.slice(0, _page * PAGE_SIZE);
  const hasMore  = filtered.length > visible.length;
  const cols     = admin ? 13 : 12;

  // Contagem
  const countEl = document.querySelector('.bol-count');
  if (countEl) {
    countEl.textContent = _search || _dateFrom || _dateTo || _statusFiltro || _empresaFiltro
      ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} de ${_registros.length} total`
      : `${_registros.length} cliente${_registros.length !== 1 ? 's' : ''} cadastrado${_registros.length !== 1 ? 's' : ''}`;
  }

  // Chips de status (contadores respeitam os demais filtros, exceto o próprio status)
  const chipsEl = document.getElementById('bol-status-chips');
  if (chipsEl) {
    const savedStatus = _statusFiltro;
    _statusFiltro = '';
    const base = _filtered();
    _statusFiltro = savedStatus;
    const countBy = s => base.filter(r => r.status === s).length;
    chipsEl.innerHTML = `
      <button class="bol-chip${!_statusFiltro ? ' active' : ''}" onclick="bolSetStatusFiltro('')">Todos <span>${base.length}</span></button>
      ${STATUS_ORDER.map(s => `
        <button class="bol-chip ${STATUS_META[s].cls}${_statusFiltro === s ? ' active' : ''}" onclick="bolSetStatusFiltro('${s}')">
          ${STATUS_META[s].label} <span>${countBy(s)}</span>
        </button>`).join('')}
    `;
  }

  // Tbody
  const tbody = document.getElementById('bol-tbody');
  if (tbody) {
    tbody.innerHTML = visible.length === 0
      ? `<tr><td colspan="${cols}" class="lib-empty">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <div>Nenhum cliente encontrado.</div>
         </td></tr>`
      : visible.map(r => _renderRow(r, admin)).join('');
  }

  // Ver mais
  const vmWrap = document.getElementById('bol-ver-mais-wrap');
  if (vmWrap) {
    if (hasMore) {
      const rest = filtered.length - visible.length;
      const next = Math.min(PAGE_SIZE, rest);
      vmWrap.innerHTML = `
        <div class="lib-ver-mais-wrap">
          <button class="lib-ver-mais" onclick="bolVerMais()">
            Mostrar mais ${next} cliente${next !== 1 ? 's' : ''}
            <span class="lib-ver-mais-sub">${rest} restante${rest !== 1 ? 's' : ''}</span>
          </button>
        </div>`;
    } else {
      vmWrap.innerHTML = '';
    }
  }

  const clearSearch = document.getElementById('bol-search-clear');
  if (clearSearch) clearSearch.style.display = _search ? '' : 'none';

  const clearDate = document.getElementById('bol-preset-clear');
  if (clearDate) clearDate.style.display = (_preset || _dateFrom || _dateTo) ? '' : 'none';

  document.querySelectorAll('#sec-boletos .lib-preset[data-key]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === _preset);
  });

  const fromEl = document.getElementById('bol-date-from');
  const toEl   = document.getElementById('bol-date-to');
  if (fromEl) fromEl.value = _dateFrom || '';
  if (toEl)   toEl.value   = _dateTo   || '';

  const empSelect = document.getElementById('bol-empresa-select');
  if (empSelect) {
    const empresas = [...new Set(_registros.map(r => r.empresa_parceira).filter(Boolean))].sort();
    empSelect.innerHTML = `<option value="">Todas as empresas</option>` +
      empresas.map(e => `<option value="${_esc(e)}"${e === _empresaFiltro ? ' selected' : ''}>${_esc(e)}</option>`).join('');
  }
}

function _renderRow(r, admin) {
  const meta      = STATUS_META[r.status] || STATUS_META.solicitar_boleto;
  const grupoNome = state.currentUser?.grupoNome || '';
  const dono      = admin || r.empresa_parceira === grupoNome;
  const final     = r.status === 'boleto_quitado' || r.status === 'boleto_reprovado';

  // Botões de status conforme fase e papel (o banco revalida tudo)
  let statusBtns = '';
  if (admin && r.status === 'solicitar_boleto') {
    statusBtns = `<button class="bol-btn-step" onclick="bolMudarStatus('${r.id}', 'boleto_solicitado')" title="Marcar como Boleto Solicitado">Solicitado →</button>`;
  } else if (admin && r.status === 'boleto_solicitado') {
    statusBtns = `<button class="bol-btn-step" onclick="bolMudarStatus('${r.id}', 'boleto_enviado')" title="Marcar como Boleto Enviado">Enviado →</button>`;
  } else if (dono && r.status === 'boleto_enviado') {
    statusBtns = `
      <button class="bol-btn-quit" onclick="bolMarcarQuitado('${r.id}')" title="Marcar como Boleto Quitado">✓ Quitado</button>
      <button class="bol-btn-rep" onclick="bolAbrirReprovar('${r.id}')" title="Reprovar boleto">✕ Reprovar</button>`;
  }

  const canEdit = admin || (dono && !final);
  const editBtn = canEdit
    ? `<button class="lib-btn-edit" onclick="bolEditarCliente('${r.id}')" title="Editar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>` : '';
  const delBtn = admin
    ? `<button class="lib-btn-del" onclick="bolDeletarCliente('${r.id}', '${_esc(r.nome).replace(/'/g, "\\'")}')" title="Excluir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : '';

  const statusDate =
    r.status === 'boleto_quitado'    ? fmtDate(r.data_quitado)    :
    r.status === 'boleto_reprovado'  ? fmtDate(r.data_reprovado)  :
    r.status === 'boleto_enviado'    ? fmtDate(r.data_enviado)    :
    r.status === 'boleto_solicitado' ? fmtDate(r.data_solicitado) : '';

  const motivoBtn = r.status === 'boleto_reprovado' && r.motivo_reprovacao
    ? `<button class="bol-motivo-link" onclick="bolVerMotivo('${r.id}')" title="Ver motivo da reprovação">motivo</button>`
    : '';

  return `
    <tr class="lib-tr bol-tr-${meta.cls}" data-id="${r.id}">
      ${admin ? `<td><span class="lib-empresa-badge">${_esc(r.empresa_parceira)}</span></td>` : ''}
      <td>${_esc(r.contrato || '—')}</td>
      <td>${fmtCpf(r.cpf)}</td>
      <td class="lib-nome" title="${_esc(r.nome || '')}">${_esc(r.nome || '—')}</td>
      <td class="lib-trunc" title="${_esc(r.convenio || '')}">${_esc(r.convenio || '—')}</td>
      <td class="lib-trunc" title="${_esc(r.produto || '')}">${_esc(r.produto || '—')}</td>
      <td class="lib-val">${fmtBRL(r.valor_parcela)}</td>
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      <td>${fmtDate((r.created_at || '').slice(0,10))}</td>
      <td>
        <span class="bol-badge ${meta.cls}">${meta.label}</span>
        ${statusDate ? `<span class="bol-badge-date">${statusDate}</span>` : ''}
        ${motivoBtn}
      </td>
      <td class="lib-obs" title="${_esc(r.obs || '')}">${_esc(r.obs || '—')}</td>
      <td class="lib-td-actions bol-td-actions">${statusBtns}${editBtn}${delBtn}</td>
    </tr>`;
}

const _spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;

// ── Filtros ───────────────────────────────────────────────────────────────
export function bolSetSearch(val) {
  _search = val || '';
  _page   = 1;
  const inp = document.getElementById('bol-search');
  if (inp && inp.value !== _search) inp.value = _search;
  _updateTable();
}

export function bolSetPreset(key) {
  _preset = key;
  const range = _presetRange(key);
  _dateFrom = range.from;
  _dateTo   = range.to;
  _page     = 1;
  _updateTable();
}

export function bolSetEmpresaFiltro(val) {
  _empresaFiltro = val;
  _page = 1;
  _updateTable();
}

export function bolSetStatusFiltro(val) {
  _statusFiltro = val;
  _page = 1;
  _updateTable();
}

export function bolClearDate() {
  _preset = null; _dateFrom = null; _dateTo = null;
  _page   = 1;
  _updateTable();
}

export function bolSetDateManual() {
  _dateFrom = document.getElementById('bol-date-from')?.value || null;
  _dateTo   = document.getElementById('bol-date-to')?.value   || null;
  _preset   = null;
  _page     = 1;
  _updateTable();
}

export function bolVerMais() {
  _page++;
  _updateTable();
  document.getElementById('bol-ver-mais-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Mudança de status (via RPC — o banco valida papel e transição) ────────
export async function bolMudarStatus(id, novo, motivo = null) {
  const { error } = await sb.rpc('boleto_mudar_status', { p_id: id, p_novo: novo, p_motivo: motivo });
  if (error) { toast(_msgErroBanco(error), 'err'); return false; }

  await _loadData();
  _updateTable();
  toast(`Status atualizado: ${STATUS_META[novo]?.label || novo}.`);
  return true;
}

export function bolMarcarQuitado(id) {
  const r = _registros.find(x => x.id === id);
  if (!r) return;
  showConfirm(
    'Marcar como Boleto Quitado',
    `Confirma que o boleto de "${r.nome}" foi quitado? Essa é a fase final do processo.`,
    'Confirmar quitação',
    () => bolMudarStatus(id, 'boleto_quitado')
  );
}

// ── Reprovação (motivo obrigatório) ───────────────────────────────────────
export function bolAbrirReprovar(id) {
  const r = _registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Reprovar Boleto</h2>
    <p style="font-size:.88rem;color:var(--muted);margin:0 0 16px">
      Cliente: <strong style="color:var(--text)">${_esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
    </p>
    <div class="lib-form-row">
      <label>Motivo da reprovação <span style="color:var(--red)">*</span></label>
      <textarea id="bol-f-motivo" placeholder="Explique por que o boleto foi reprovado (obrigatório)"></textarea>
    </div>
    <div id="bol-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>
    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="bol-btn-reprovar" onclick="bolConfirmarReprovar('${id}')">Reprovar Boleto</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
  document.getElementById('bol-f-motivo')?.focus();
}

export async function bolConfirmarReprovar(id) {
  const motivo = document.getElementById('bol-f-motivo')?.value.trim();
  const err    = document.getElementById('bol-modal-err');
  const btn    = document.getElementById('bol-btn-reprovar');

  if (!motivo) {
    if (err) { err.textContent = 'O motivo da reprovação é obrigatório.'; err.style.display = ''; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  const ok = await bolMudarStatus(id, 'boleto_reprovado', motivo);
  if (ok) {
    bolFecharModal();
  } else if (btn) {
    btn.disabled = false; btn.textContent = 'Reprovar Boleto';
  }
}

export function bolVerMotivo(id) {
  const r = _registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Motivo da Reprovação</h2>
    <p style="font-size:.88rem;color:var(--muted);margin:0 0 12px">
      Cliente: <strong style="color:var(--text)">${_esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
      · Reprovado em ${fmtDate(r.data_reprovado)}
    </p>
    <div class="bol-motivo-box">${_esc(r.motivo_reprovacao || '—')}</div>
    <div class="lib-modal-actions" style="margin-top:20px">
      <button class="lib-btn-save" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}

// ── Exportar Excel (admin) ────────────────────────────────────────────────
export function bolExportar() {
  const data = _filtered();
  if (!data.length) { toast('Nenhum dado para exportar.', 'err'); return; }

  const headers = ['CONTRATO','NOME','CPF','EMAIL','VALOR PARCELA','SALDO DEVEDOR','TROCO','CONVÊNIO','PRODUTO','EMPRESA','STATUS','DATA SOLICITADO','DATA ENVIADO','DATA QUITADO','DATA REPROVADO','MOTIVO REPROVAÇÃO','OBS','CADASTRO'];
  const rows = data.map(r => [
    r.contrato || '', r.nome, fmtCpf(r.cpf), r.email || '',
    r.valor_parcela, r.saldo_devedor, r.troco,
    r.convenio || '', r.produto || '', r.empresa_parceira,
    STATUS_META[r.status]?.label || r.status,
    r.data_solicitado || '', r.data_enviado || '', r.data_quitado || '', r.data_reprovado || '',
    r.motivo_reprovacao || '', r.obs || '', (r.created_at || '').slice(0,10),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quitação de Boleto');
  XLSX.writeFile(wb, `quitacao_boleto_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`${data.length} clientes exportados.`);
}

// ── Limpar Base (admin) ───────────────────────────────────────────────────
export function bolLimparBase() {
  const total = _registros.length;
  showConfirm(
    'Limpar toda a base',
    `Isso vai excluir TODOS os ${total} clientes da Quitação de Boleto permanentemente. Essa ação não pode ser desfeita.`,
    'Excluir tudo',
    async () => {
      const { error } = await sb
        .from('quitacao_boletos')
        .delete()
        .not('id', 'is', null);

      if (error) { handleError('Erro ao limpar a base.', error); return; }

      _registros = [];
      _page = 1;
      toast('Base limpa com sucesso.');
      const el = document.getElementById('sec-boletos');
      if (el) _render(el);
    }
  );
}

// ── Deletar Cliente (admin) ───────────────────────────────────────────────
export function bolDeletarCliente(id, nome) {
  showConfirm(
    'Excluir cliente',
    `Tem certeza que deseja excluir "${nome}"? Essa ação não pode ser desfeita.`,
    'Excluir',
    async () => {
      const { error } = await sb
        .from('quitacao_boletos')
        .delete()
        .eq('id', id);

      if (error) { handleError('Erro ao excluir cliente.', error); return; }

      _registros = _registros.filter(r => r.id !== id);
      _updateTable();
      toast('Cliente excluído.');
    }
  );
}

// ── Importar Planilha ─────────────────────────────────────────────────────
export function bolImportarPlanilha() {
  document.getElementById('bol-import-input')?.click();
}

export async function bolOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const admin           = isAdmin();
  const empresaParceiro = _empresaParceira();

  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return;
  }

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  const normStr = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s/]/g, '').trim();

  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v ? normStr(cell.v) : '');
  }

  const colIdx = (...names) => {
    for (const n of names) {
      const idx = headers.indexOf(normStr(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // Aceita os cabeçalhos do template novo E os da planilha original de boletos
  const iContrato = colIdx('contrato');
  const iNome     = colIdx('nome', 'nome completo');
  const iCpf      = colIdx('cpf', 'cpf/cnpj');
  const iEmail    = colIdx('email', 'e-mail', 'proposta');
  const iParcela  = colIdx('valor parcela', 'valor da parcela');
  const iSaldo    = colIdx('saldo devedor', 'saldo');
  const iTroco    = colIdx('troco');
  const iConvenio = colIdx('convenio', 'convênio', 'promotora');
  const iProduto  = colIdx('produto');
  const iObs      = colIdx('obs', 'observacoes', 'observações', 'observacoes ultimo status', 'observações ultimo status');
  const iEmp      = colIdx('empresa', 'empresa parceira');

  if (iCpf < 0 || iNome < 0) {
    _mostrarErroModelo();
    return;
  }

  const getVal = (r, colI) => {
    if (colI < 0) return undefined;
    return ws[XLSX.utils.encode_cell({ r, c: colI })]?.v;
  };

  const parseMoney = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const padCpf   = v => String(v).replace(/\D/g, '').padStart(11, '0');
  const cleanTxt = v => String(v ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  const seen  = new Set();
  const valid = [];
  const invalidos = [];

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cpfRaw = getVal(r, iCpf);
    const nome   = cleanTxt(getVal(r, iNome));
    if (!cpfRaw && !nome) continue;

    const cpf      = padCpf(cpfRaw);
    const contrato = cleanTxt(getVal(r, iContrato)) || null;
    const email    = cleanTxt(getVal(r, iEmail)) || null;
    const parcela  = parseMoney(getVal(r, iParcela));
    const saldo    = parseMoney(getVal(r, iSaldo));
    const troco    = parseMoney(getVal(r, iTroco));
    const convenio = cleanTxt(getVal(r, iConvenio));
    const produto  = cleanTxt(getVal(r, iProduto));
    const obs      = cleanTxt(getVal(r, iObs)) || null;
    const empresa  = admin ? (cleanTxt(getVal(r, iEmp)) || 'Smart Consig') : empresaParceiro;

    let motivo = null;
    if (!cpf || cpf === '00000000000') motivo = 'CPF ausente ou inválido';
    else if (!nome)                    motivo = 'Sem nome';
    else if (saldo <= 0)               motivo = 'Sem saldo devedor';
    else if (!convenio)                motivo = 'Sem convênio';
    else if (!produto)                 motivo = 'Sem produto';

    if (motivo) { invalidos.push({ cpf: cpfRaw || '—', nome: nome || '—', motivo }); continue; }

    const dupKey = `${cpf}|${contrato}|${produto}|${saldo}`;
    if (seen.has(dupKey)) { invalidos.push({ cpf, nome, motivo: 'Linha duplicada na planilha' }); continue; }
    seen.add(dupKey);

    valid.push({
      cpf, nome, email, contrato,
      valor_parcela: parcela, saldo_devedor: saldo, troco,
      convenio, produto, obs, empresa_parceira: empresa,
    });
  }

  if (valid.length === 0 && invalidos.length === 0) {
    toast('Nenhum registro encontrado na planilha.', 'err');
    return;
  }

  // Insere UM POR UM: o trigger de CPF pode recusar linhas específicas e
  // as demais precisam entrar mesmo assim, com relatório do que foi pulado
  let inserted = 0;
  const rejeitados = [];
  toast(`Importando ${valid.length} cliente${valid.length !== 1 ? 's' : ''}…`);

  for (const reg of valid) {
    const { error } = await sb.from('quitacao_boletos').insert(reg);
    if (error) rejeitados.push({ cpf: reg.cpf, nome: reg.nome, motivo: _msgErroBanco(error) });
    else inserted++;
  }

  await _loadData();
  const el = document.getElementById('sec-boletos');
  if (el) _render(el);

  _mostrarResultadoImport(inserted, [...rejeitados, ...invalidos]);
}

function _mostrarErroModelo() {
  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Planilha fora do modelo</h2>
    <p style="font-size:.9rem;line-height:1.5;color:var(--text)">
      Esta planilha não contém as colunas mínimas <strong>CPF</strong> e <strong>NOME</strong>.
      A importação foi cancelada.
    </p>
    <p style="font-size:.9rem;line-height:1.5;color:var(--muted);margin-top:8px">
      Baixe o <strong>modelo</strong>, preencha os dados dos clientes e importe novamente.
    </p>
    <div class="lib-modal-actions" style="margin-top:20px">
      <a class="lib-btn-save" href="/template_boletos.xlsx" download="TEMPLATE_BOLETOS.xlsx" style="text-decoration:none">Baixar modelo</a>
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}

function _mostrarResultadoImport(inserted, pulados) {
  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) {
    toast(`${inserted} importado${inserted !== 1 ? 's' : ''}, ${pulados.length} pulado${pulados.length !== 1 ? 's' : ''}.`);
    return;
  }

  content.innerHTML = `
    <h2 class="lib-modal-title">Resultado da Importação</h2>
    <div style="margin-bottom:16px">
      <span class="lib-badge-ok" style="font-size:.9rem">✓ ${inserted} importado${inserted !== 1 ? 's' : ''}</span>
      ${pulados.length ? `&nbsp;<span class="lib-badge-pen" style="font-size:.9rem">${pulados.length} pulado${pulados.length !== 1 ? 's' : ''}</span>` : ''}
    </div>
    ${pulados.length ? `
      <div style="margin-bottom:8px;font-size:.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Pulados</div>
      <div style="max-height:260px;overflow-y:auto;font-size:.82rem;border:1px solid var(--border);border-radius:6px">
        <table style="width:100%;border-collapse:collapse">
          ${pulados.map(p => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px 10px;font-family:monospace">${_esc(p.cpf)}</td>
              <td style="padding:6px 10px;color:var(--muted)">${_esc(p.nome || '—')}</td>
              <td style="padding:6px 10px;color:var(--muted)">${_esc(p.motivo)}</td>
            </tr>`).join('')}
        </table>
      </div>` : ''}
    <div class="lib-modal-actions" style="margin-top:20px">
      <button class="lib-btn-save" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}

// ── Modal Adicionar / Editar Cliente ──────────────────────────────────────
function _modalForm({ titulo, r, onSaveFn }) {
  const empresa = r ? r.empresa_parceira : _empresaParceira();

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">${titulo}</h2>

    <div class="lib-form-row-2">
      <div>
        <label>CPF</label>
        <input type="text" id="bol-f-cpf" value="${_esc(r ? fmtCpf(r.cpf) : '')}" placeholder="000.000.000-00" maxlength="14" />
      </div>
      <div>
        <label>Contrato</label>
        <input type="text" id="bol-f-contrato" value="${_esc(r?.contrato || '')}" placeholder="Nº do contrato" />
      </div>
    </div>

    <div class="lib-form-row">
      <label>Nome Completo</label>
      <input type="text" id="bol-f-nome" value="${_esc(r?.nome || '')}" placeholder="Nome do cliente" />
    </div>

    <div class="lib-form-row">
      <label>E-mail <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <input type="text" id="bol-f-email" value="${_esc(r?.email || '')}" placeholder="email@cliente.com" />
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Convênio</label>
        <input type="text" id="bol-f-convenio" value="${_esc(r?.convenio || '')}" placeholder="Ex.: GOV-SÃO PAULO" />
      </div>
      <div>
        <label>Produto</label>
        <input type="text" id="bol-f-produto" value="${_esc(r?.produto || '')}" placeholder="Ex.: CARTÃO BENEFÍCIO" />
      </div>
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Saldo Devedor (R$)</label>
        <input type="text" id="bol-f-saldo" value="${r ? (r.saldo_devedor || 0) : ''}" placeholder="0,00" />
      </div>
      <div>
        <label>Troco (R$)</label>
        <input type="text" id="bol-f-troco" value="${r ? (r.troco || 0) : '0'}" placeholder="0,00" />
      </div>
    </div>

    <div class="lib-form-row">
      <label>Valor da Parcela (R$) <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <input type="text" id="bol-f-parcela" value="${r ? (r.valor_parcela || 0) : ''}" placeholder="0,00" />
    </div>

    <div class="lib-modal-auto">
      Empresa: <span>${_esc(empresa)}</span>
      ${r ? '' : ' &nbsp;·&nbsp; Status inicial: <span>Solicitar Boleto</span>'}
    </div>

    <div class="lib-form-row">
      <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <textarea id="bol-f-obs" placeholder="Deixe em branco se não houver observações">${_esc(r?.obs || '')}</textarea>
    </div>

    <div id="bol-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="bol-btn-save" onclick="${onSaveFn}">Salvar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
  document.getElementById('bol-f-cpf')?.focus();
}

function _lerFormulario() {
  const err = document.getElementById('bol-modal-err');
  const show = msg => { if (err) { err.textContent = msg; err.style.display = ''; } };

  const cpf      = (document.getElementById('bol-f-cpf')?.value || '').replace(/\D/g, '');
  const nome     = document.getElementById('bol-f-nome')?.value.trim();
  const contrato = document.getElementById('bol-f-contrato')?.value.trim() || null;
  const email    = document.getElementById('bol-f-email')?.value.trim() || null;
  const convenio = document.getElementById('bol-f-convenio')?.value.trim();
  const produto  = document.getElementById('bol-f-produto')?.value.trim();
  const saldo    = parseBRL(document.getElementById('bol-f-saldo')?.value);
  const troco    = parseBRL(document.getElementById('bol-f-troco')?.value) || 0;
  const parcela  = parseBRL(document.getElementById('bol-f-parcela')?.value) || 0;
  const obs      = document.getElementById('bol-f-obs')?.value.trim() || null;

  if (!cpf || cpf.length !== 11) { show('Informe um CPF válido (11 dígitos).'); return null; }
  if (!nome)                     { show('Informe o nome.');           return null; }
  if (!saldo || saldo <= 0)      { show('Informe o saldo devedor.');  return null; }
  if (!convenio)                 { show('Informe o convênio.');       return null; }
  if (!produto)                  { show('Informe o produto.');        return null; }

  if (err) err.style.display = 'none';
  return { cpf, nome, contrato, email, convenio, produto, saldo_devedor: saldo, troco, valor_parcela: parcela, obs };
}

export function bolAddCliente() {
  _modalForm({ titulo: 'Novo Cliente', r: null, onSaveFn: 'bolSalvarCliente()' });
}

export async function bolSalvarCliente() {
  const dados = _lerFormulario();
  if (!dados) return;

  const btn = document.getElementById('bol-btn-save');
  const err = document.getElementById('bol-modal-err');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const { error } = await sb.from('quitacao_boletos').insert({
    ...dados,
    empresa_parceira: _empresaParceira(),
  });

  if (error) {
    if (err) { err.textContent = _msgErroBanco(error); err.style.display = ''; }
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }

  bolFecharModal();
  toast('Cliente salvo com sucesso!');
  await _loadData();
  const el = document.getElementById('sec-boletos');
  if (el) _render(el);
}

export function bolEditarCliente(id) {
  const r = _registros.find(x => x.id === id);
  if (!r) return;
  _modalForm({ titulo: 'Editar Cliente', r, onSaveFn: `bolSalvarEdicao('${id}')` });
}

export async function bolSalvarEdicao(id) {
  const dados = _lerFormulario();
  if (!dados) return;

  const btn = document.getElementById('bol-btn-save');
  const err = document.getElementById('bol-modal-err');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const { error } = await sb
    .from('quitacao_boletos')
    .update(dados)
    .eq('id', id);

  if (error) {
    if (err) { err.textContent = _msgErroBanco(error); err.style.display = ''; }
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }

  bolFecharModal();
  toast('Cliente atualizado!');
  await _loadData();
  const el = document.getElementById('sec-boletos');
  if (el) _render(el);
}

export function bolFecharModal() {
  document.getElementById('bol-modal')?.classList.remove('open');
}
