import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { getHierarchy } from '../core/calcKPIs.js';
import { filteredData } from '../core/calcKPIs.js';
import { calcFunilByVendedor, calcFunilByTime, ESTAGIOS } from '../core/calcFunil.js';
import { normStr } from '../utils/string.js';
import { filterButtonsHTML } from '../components/FilterButtons.jsx';

export function renderRanking(entries) {
  const v = state.rankView;

  if (v === 'funil') { _renderFunil(); return; }

  const map = {};

  // Mapa de leads do Smart por vendedor (para % conversão e coluna Leads)
  const funilData    = calcFunilByVendedor();
  const leadsByOp    = {};
  for (const f of funilData) leadsByOp[f.operador] = f.totalLeads;

  for (const r of entries) {
    if (r.statusCat === 'reprovado' || r.statusCat === 'desconhecido') continue;
    const hier    = getHierarchy(r.loja);
    const keyName = v === 'seller' ? (r.vendedor || '—')
                  : v === 'team'   ? (r.loja     || '—')
                  : v === 'sup'    ? hier.supervisor
                  : hier.gerente;
    if (!map[keyName]) map[keyName] = {
      name: keyName, loja: r.loja || '—',
      supervisor: hier.supervisor, gerente: hier.gerente,
      paid: 0, approved: 0, value: 0, mktPaid: 0,
    };
    const e = map[keyName];
    if (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') e.approved++;
    if (r.statusCat === 'pago') { e.paid++; e.value += r.valor; }
    if (r.isMarketing && r.statusCat === 'pago') e.mktPaid++;
  }

  const rows = Object.values(map).sort((a, b) => b.paid - a.paid || b.value - a.value);

  // Colunas extras por view — Supervisor removido da view de Vendedor
  const extraCols = v === 'seller'
    ? '<th>Time</th><th>Gerente</th>'
    : v === 'team'
    ? '<th>Supervisor</th><th>Gerente</th>'
    : v === 'sup'
    ? '<th>Gerente</th>'
    : '';

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--gray)">Nenhum dado disponível</td></tr>`
    : rows.map((row, i) => {
        const ri     = i + 1;
        const rc     = ri === 1 ? 'r1' : ri === 2 ? 'r2' : ri === 3 ? 'r3' : '';
        const ticket = row.paid ? row.value / row.paid : 0;

        // % Marketing = Aprovadas ÷ Leads × 100
        const leads  = leadsByOp[normStr(row.name)] || 0;
        const pMkt   = leads > 0 ? (row.approved / leads) * 100 : 0;

        const extra = v === 'seller'
          ? `<td class="muted">${row.loja}</td><td class="muted">${row.gerente}</td>`
          : v === 'team'
          ? `<td class="muted">${row.supervisor}</td><td class="muted">${row.gerente}</td>`
          : v === 'sup'
          ? `<td class="muted">${row.gerente}</td>`
          : '';

        const leadsCol = v === 'seller'
          ? `<td>${leads > 0 ? leads : '—'}</td>`
          : '';

        return `<tr>
          <td><div class="rank-num ${rc}">${ri}</div></td>
          <td><strong>${row.name}</strong></td>
          ${extra}
          ${leadsCol}
          <td><span class="badge badge-green">${row.paid}</span></td>
          <td>${row.approved}</td>
          <td>${fmtBRL(row.value)}</td>
          <td>${fmtBRL(ticket)}</td>
          <td><span class="badge ${pMkt >= 50 ? 'badge-green' : 'badge-gray'}">${fmtPct(pMkt)}</span></td>
        </tr>`;
      }).join('');

  const colLabel  = v === 'seller' ? 'Vendedor' : v === 'team' ? 'Time' : v === 'sup' ? 'Supervisor' : 'Gerente';
  const leadsHead = v === 'seller' ? '<th>Leads</th>' : '';

  document.getElementById('ranking-body').innerHTML = `
    <div class="section-title"><span class="bar"></span>Ranking de Vendas</div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">Ordenado por vendas pagas</div>
        <div class="table-filters">
          ${filterButtonsHTML([
            { value: 'seller', label: 'Vendedor',   onclick: "setRankView('seller')" },
            { value: 'team',   label: 'Time',        onclick: "setRankView('team')" },
            { value: 'sup',    label: 'Supervisor',  onclick: "setRankView('sup')" },
            { value: 'ger',    label: 'Gerente',     onclick: "setRankView('ger')" },
            { value: 'funil',  label: 'Funil',       onclick: "setRankView('funil')" },
          ], v)}
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>${colLabel}</th>${extraCols}
          ${leadsHead}
          <th>Pagas</th><th>Aprovadas</th><th>Valor Total</th><th>Ticket Médio</th><th>% Conversão</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>`;
}

// ── Funil ─────────────────────────────────────────────────────────────────
const FUNIL_COLORS = {
  'Novo Lead':       { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6' },
  'Negociação':      { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#d97706' },
  'Venda':           { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  text: '#059669' },
  'Pago':            { bg: 'rgba(5,150,105,0.10)',   border: 'rgba(5,150,105,0.30)',   text: '#047857' },
  'Desqualificado':  { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.20)',   text: '#dc2626' },
};

function _convBadge(pct) {
  if (!pct) return '<span style="color:var(--gray)">—</span>';
  const cls = pct >= 30 ? 'funil-conv-green' : pct >= 15 ? 'funil-conv-yellow' : 'funil-conv-red';
  return `<span class="funil-conv-badge ${cls}">${pct}%</span>`;
}

function _renderFunil() {
  const hasLeads  = (state.result?.smartLeads?.length || 0) > 0;
  const showAnd   = state.funilShowAnd || false;
  const v         = state.funilView || 'vendedor';

  const _tabs = `
    <div class="table-filters">
      ${filterButtonsHTML([
        { value: 'seller', label: 'Vendedor',  onclick: "setRankView('seller')" },
        { value: 'team',   label: 'Time',       onclick: "setRankView('team')" },
        { value: 'sup',    label: 'Supervisor', onclick: "setRankView('sup')" },
        { value: 'ger',    label: 'Gerente',    onclick: "setRankView('ger')" },
        { value: 'funil',  label: 'Funil',      onclick: "setRankView('funil')" },
      ], state.rankView)}
    </div>`;

  if (!hasLeads) {
    document.getElementById('ranking-body').innerHTML = `
      <div class="section-title"><span class="bar"></span>Funil de Conversão</div>
      <div class="table-card">
        <div class="table-header"><div class="table-header-title">Funil por vendedor</div>${_tabs}</div>
        <div style="padding:48px;text-align:center;color:var(--gray)">
          Importe o arquivo Smart para visualizar o funil de conversão.
        </div>
      </div>`;
    return;
  }

  const data     = v === 'time' ? calcFunilByTime() : calcFunilByVendedor();
  const colLabel = v === 'time' ? 'Time' : 'Vendedor';

  // Ordena por % conversão decrescente
  const sorted = [...data].sort((a, b) => b.convPct - a.convPct);

  const estagioHeaders = ESTAGIOS.map(est => {
    const c = FUNIL_COLORS[est] || {};
    return `<th class="funil-th-est" style="background:${c.bg};border-bottom:2px solid ${c.border};color:${c.text}">${est}</th>`;
  }).join('');

  const rowsHtml = sorted.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--gray)">Nenhum dado no período</td></tr>`
    : sorted.map((row, i) => {
        const cols = ESTAGIOS.map(est => {
          const e = row.estagios[est] || { total: 0, emAndamento: 0, pct: 0 };
          const c = FUNIL_COLORS[est] || {};
          const andEl = showAnd && e.emAndamento > 0
            ? `<div class="funil-cell-and">${e.emAndamento} em and.</div>` : '';
          return `<td class="funil-cell" style="background:${c.bg}">
            <div class="funil-cell-total">${e.total || '—'}</div>
            ${e.pct > 0 ? `<div class="funil-cell-pct" style="color:${c.text}">${e.pct}%</div>` : ''}
            ${andEl}
          </td>`;
        }).join('');

        return `<tr>
          <td><div class="rank-num">${i + 1}</div></td>
          <td><strong>${row.operador}</strong></td>
          <td class="funil-cell-leads">${row.totalLeads}</td>
          ${cols}
          <td class="funil-cell-apr">${row.aprovadas || '—'}</td>
          <td class="funil-cell-conv">${_convBadge(row.convPct)}</td>
        </tr>`;
      }).join('');

  document.getElementById('ranking-body').innerHTML = `
    <div class="section-title"><span class="bar"></span>Funil de Conversão</div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">Funil por ${colLabel.toLowerCase()}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${_tabs}
          <div style="display:flex;align-items:center;gap:6px;margin-left:8px;border-left:1px solid var(--border);padding-left:8px">
            <span style="font-size:.78rem;color:var(--gray)">Agrupar:</span>
            ${filterButtonsHTML([
              { value: 'vendedor', label: 'Vendedor', onclick: "setFunilView('vendedor')" },
              { value: 'time',     label: 'Time',     onclick: "setFunilView('time')" },
            ], v)}
          </div>
          <button class="funil-toggle-and" onclick="toggleFunilAndamento()">
            ${showAnd ? '▲ Ocultar andamento' : '▼ Ver andamento'}
          </button>
        </div>
      </div>
      <div class="table-wrap"><table class="funil-table">
        <thead><tr>
          <th>#</th>
          <th>${colLabel}</th>
          <th>Leads</th>
          ${estagioHeaders}
          <th>Aprovadas</th>
          <th>% Conversão</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>`;
}

export function setRankView(v) {
  state.rankView = v;
  const fd = filteredData();
  if (fd) renderRanking(fd.entries);
}

export function setFunilView(v) {
  state.funilView = v;
  _renderFunil();
}

export function toggleFunilAndamento() {
  state.funilShowAnd = !state.funilShowAnd;
  _renderFunil();
}
