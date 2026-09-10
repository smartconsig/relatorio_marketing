// Propostas de Marketing — orquestrador. Filtros/helpers puros vivem em
// src/pages/propostas/propostas-filtros.js e o modal de exportação em
// propostas-export.js. Sem estado de módulo: tudo em state.propostas*.
import { state }        from '../state.js';
import { icon }         from '../utils/icons.js';
import { filteredData } from '../core/calcKPIs.js';
import { fmtBRL, fmtN } from '../utils/currency.js';
import { sectionTitle } from '../components/ui.js';
import { statusBadge, fmtDate, fmtCPF, applyFilters, uniqueProducts, uniqueOrigens, uniqueAudiencias } from './propostas/propostas-filtros.js';

export { openExportModal, closeExportModal, doExportCSV } from './propostas/propostas-export.js';

const PAGE_SIZE = 12;

// ── Card ───────────────────────────────────────────────────────────────────
// Tooltip do status (data/autor/observação, quando existem)
function _statusTipHTML(e) {
  if (!(e.statusObs || e.statusUpdatedAt)) return '';
  return `
            <div class="status-tip">
              ${e.statusUpdatedAt ? `<div class="status-tip-date">${icon('calendar', 10)} ${fmtDate(e.statusUpdatedAt)}${e.statusUpdatedBy ? ' · ' + e.statusUpdatedBy : ''}</div>` : ''}
              ${e.statusObs ? `<div class="status-tip-obs">${e.statusObs}</div>` : ''}
            </div>`;
}

function propostaCard(e) {
  const badge = statusBadge(e.statusCat);
  return `
    <div class="proposta-card">
      <div class="proposta-header">
        <div class="proposta-identity">
          <span class="proposta-name">${e.cliente || '—'}</span>
          <span class="proposta-cpf">${fmtCPF(e.cpf)}</span>
        </div>
        <div class="proposta-header-right">
          <div class="status-tip-wrap">
            <span class="badge ${badge.cls}">${e.rawStatus || badge.label}</span>
            ${_statusTipHTML(e)}
          </div>
          <span class="proposta-valor">${e.valor ? fmtBRL(e.valor) : '—'}</span>
        </div>
      </div>
      <div class="proposta-body">
        <div class="proposta-field"><span class="pf-label">Data</span><span>${fmtDate(e.saleDate)}</span></div>
        <div class="proposta-field"><span class="pf-label">Banco</span><span>${e.banco || '—'}</span></div>
        <div class="proposta-field"><span class="pf-label">Produto</span><span>${e.produto || '—'}</span></div>
        <div class="proposta-field"><span class="pf-label">Loja</span><span>${e.loja || '—'}</span></div>
      </div>
      <div class="proposta-footer">
        <span class="pf-item">${icon('user', 11)} <strong>${e.vendedor || '—'}</strong></span>
        <span class="pf-item">${e.ecorbanOrigem || '—'}</span>
        ${e.origem ? `<span class="pf-item">${e.origem}${e.audiencia ? ' / '+e.audiencia : ''}</span>` : ''}
      </div>
    </div>`;
}

// ── Options dos filtros (mesmo escape de aspas de sempre) ──────────────────
function _statusOptsHTML(status) {
  return [
    { v: 'all',          l: `Todos os status` },
    { v: 'pago',         l: 'Pago'            },
    { v: 'quase pago',   l: 'Quase Pago'      },
    { v: 'aprovado',     l: 'Aprovado'        },
    { v: 'reprovado',    l: 'Reprovado'       },
    { v: 'desconhecido', l: 'Desconhecido'    },
    { v: 'sem status',   l: 'Sem Status'      },
  ].map(o => `<option value="${o.v}" ${status === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
}

function _optsDe(lista, atual, labelTodos) {
  return [
    `<option value="all" ${atual === 'all' ? 'selected' : ''}>${labelTodos}</option>`,
    ...lista.map(x => `<option value="${x.replace(/"/g,'&quot;')}" ${atual === x ? 'selected':''}>${x}</option>`),
  ].join('');
}

// Valor combinado col_dir — o mesmo formato que sortPropostas() recebe e divide.
const _SORT_OPTS = [
  ['cliente_asc',   'Nome A→Z'],
  ['cliente_desc',  'Nome Z→A'],
  ['valor_desc',    'Maior valor'],
  ['valor_asc',     'Menor valor'],
  ['saleDate_desc', 'Mais recente'],
  ['saleDate_asc',  'Mais antigo'],
  ['rawStatus_asc', 'Status A→Z'],
];

function _sortOptsHTML() {
  const atual = `${state.propostasSort.col}_${state.propostasSort.dir}`;
  return _SORT_OPTS.map(([v, l]) => `<option value="${v}" ${atual === v ? 'selected' : ''}>${l}</option>`).join('');
}

function _toolbarHTML(entries, filtered, pageStart, pageEnd) {
  const prods    = uniqueProducts(entries);
  const origens  = uniqueOrigens(entries);
  const auds     = uniqueAudiencias(entries);
  const { status, produto, origem, audiencia } = state.propostasFilter;

  const statusOpts = _statusOptsHTML(status);
  const prodOpts   = _optsDe(prods,   produto,   'Todos os produtos');
  const origemOpts = _optsDe(origens, origem,    'Todas as origens');
  const audOpts    = _optsDe(auds,    audiencia, 'Todas as audiências');

  const selectStyle = `background:var(--surface);border:1px solid var(--border);color:var(--white);
    padding:8px 12px;border-radius:7px;font-size:13px;font-family:var(--font-b);cursor:pointer;outline:none`;

  return `
    <div class="propostas-toolbar">
      <div style="position:relative;flex:1;min-width:200px;max-width:320px">
        <input type="text" placeholder="Buscar por nome ou CPF…"
          value="${(state.propostasFilter.search||'').replace(/"/g,'&quot;')}"
          oninput="setPropostasSearch(this.value)"
          style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--white);
                 padding:8px 12px 8px 34px;border-radius:7px;font-size:13px;font-family:var(--font-b);outline:none"
          onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--gray);pointer-events:none"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <select onchange="setPropostasStatus(this.value)" style="${selectStyle}">${statusOpts}</select>
      <select onchange="setPropostasProduto(this.value)" style="${selectStyle}">${prodOpts}</select>
      <select onchange="setPropostasOrigem(this.value)" style="${selectStyle}">${origemOpts}</select>
      <select onchange="setPropostasAudiencia(this.value)" style="${selectStyle}">${audOpts}</select>
      <select onchange="sortPropostas(this.value)" style="${selectStyle}">${_sortOptsHTML()}</select>
      <span style="color:var(--gray);font-size:13px;white-space:nowrap">
        ${filtered.length ? `${pageStart}–${pageEnd} de ${fmtN(filtered.length)}` : '0 resultados'}
      </span>
      <button class="btn-sm btn-primary" onclick="openExportModal()">${icon('download', 12)} Exportar CSV</button>
    </div>`;
}

// Gera no máx 5 páginas visíveis ao redor da atual
function _pageButtonsHTML(page, totalPages) {
  if (totalPages <= 1) return '';
  let btns = '';
  const range = 2;
  const lo = Math.max(1, page - range);
  const hi = Math.min(totalPages, page + range);
  if (lo > 1) btns += `<button class="pg-btn" onclick="goToPropostasPage(1)">1</button>${lo > 2 ? '<span class="pg-dots">…</span>' : ''}`;
  for (let i = lo; i <= hi; i++)
    btns += `<button class="pg-btn ${i === page ? 'pg-active' : ''}" onclick="goToPropostasPage(${i})">${i}</button>`;
  if (hi < totalPages) btns += `${hi < totalPages - 1 ? '<span class="pg-dots">…</span>' : ''}<button class="pg-btn" onclick="goToPropostasPage(${totalPages})">${totalPages}</button>`;
  return `
    <div class="propostas-pagination">
      <button class="pg-btn" onclick="goToPropostasPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹ Anterior</button>
      ${btns}
      <button class="pg-btn" onclick="goToPropostasPage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>Próxima ›</button>
    </div>`;
}

// ── Paginação (clampa a página atual e grava de volta no state) ────────────
function _paginar(filtered) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page       = Math.min(Math.max(1, state.propostasFilter.page || 1), totalPages);
  state.propostasFilter.page = page;
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { page, totalPages, pageItems };
}

// ── Render ─────────────────────────────────────────────────────────────────
export function renderPropostas(entries) {
  const el = document.getElementById('propostas-body');
  if (!el) return;

  if (!entries?.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${icon('clipboard')}</div>
      <div class="empty-title">Nenhum dado processado</div>
      <div class="empty-desc">Importe os arquivos e processe os dados primeiro.</div></div>`;
    return;
  }

  const filtered = applyFilters(entries);
  const { page, totalPages, pageItems } = _paginar(filtered);

  const cards = pageItems.length
    ? pageItems.map(propostaCard).join('')
    : `<div class="empty" style="margin-top:24px">
        <div class="empty-icon">${icon('search')}</div>
        <div class="empty-title">Nenhuma proposta encontrada</div>
        <div class="empty-desc">Tente ajustar os filtros.</div>
       </div>`;

  const pageStart = (page - 1) * PAGE_SIZE + 1;
  const pageEnd   = Math.min(page * PAGE_SIZE, filtered.length);

  el.innerHTML = `
    ${sectionTitle('Propostas de Marketing')}

    ${_toolbarHTML(entries, filtered, pageStart, pageEnd)}

    <div class="propostas-grid">${cards}</div>
    ${_pageButtonsHTML(page, totalPages)}

    <!-- Export Modal -->
    <div id="propostas-export-modal" style="display:none;position:fixed;inset:0;z-index:1000;
         background:rgba(0,0,0,.6);align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;
                  padding:28px;width:500px;max-height:80vh;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,.4)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--white)">Selecionar Colunas para Exportar</div>
          <button onclick="closeExportModal()" style="background:none;border:none;color:var(--gray);cursor:pointer;line-height:1">${icon('x', 16)}</button>
        </div>
        <div id="export-cols-list"
             style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow-y:auto;max-height:340px;padding-right:4px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:14px">
          <button class="btn-sm btn-ghost" onclick="closeExportModal()">Cancelar</button>
          <button class="btn-sm btn-primary" onclick="doExportCSV()">${icon('download', 12)} Exportar</button>
        </div>
      </div>
    </div>
  `;
}

export function setPropostasSearch(v) {
  state.propostasFilter.search = v; state.propostasFilter.page = 1;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasStatus(v) {
  state.propostasFilter.status = v; state.propostasFilter.page = 1;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasProduto(v) {
  state.propostasFilter.produto = v; state.propostasFilter.page = 1;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasOrigem(v) {
  state.propostasFilter.origem = v; state.propostasFilter.page = 1;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasAudiencia(v) {
  state.propostasFilter.audiencia = v; state.propostasFilter.page = 1;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function sortPropostas(val) {
  const [col, dir] = val.split('_');
  state.propostasSort = { col, dir };
  state.propostasFilter.page = 1;
  const fd = filteredData();
  if (fd) renderPropostas(fd.entries);
}

export function goToPropostasPage(p) {
  state.propostasFilter.page = p;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
  document.getElementById('propostas-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
