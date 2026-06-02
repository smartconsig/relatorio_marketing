import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { getHierarchy } from '../core/calcKPIs.js';
import { filteredData } from '../core/calcKPIs.js';
import { calcFunilByVendedor, calcFunilByTime, ESTAGIOS } from '../core/calcFunil.js';
import { normStr } from '../utils/string.js';

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
          <button class="filter-btn ${v === 'seller' ? 'active' : ''}" onclick="setRankView('seller')">Vendedor</button>
          <button class="filter-btn ${v === 'team'   ? 'active' : ''}" onclick="setRankView('team')">Time</button>
          <button class="filter-btn ${v === 'sup'    ? 'active' : ''}" onclick="setRankView('sup')">Supervisor</button>
          <button class="filter-btn ${v === 'ger'    ? 'active' : ''}" onclick="setRankView('ger')">Gerente</button>
          <button class="filter-btn ${v === 'funil'  ? 'active' : ''}" onclick="setRankView('funil')">Funil</button>
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
function _renderFunil() {
  const hasLeads = (state.result?.smartLeads?.length || 0) > 0;

  if (!hasLeads) {
    document.getElementById('ranking-body').innerHTML = `
      <div class="section-title"><span class="bar"></span>Funil de Conversão</div>
      <div class="table-card">
        <div class="table-header">
          <div class="table-header-title">Funil por vendedor</div>
          <div class="table-filters">
            <button class="filter-btn" onclick="setRankView('seller')">Vendedor</button>
            <button class="filter-btn" onclick="setRankView('team')">Time</button>
            <button class="filter-btn" onclick="setRankView('sup')">Supervisor</button>
            <button class="filter-btn" onclick="setRankView('ger')">Gerente</button>
            <button class="filter-btn active" onclick="setRankView('funil')">Funil</button>
          </div>
        </div>
        <div style="padding:48px;text-align:center;color:var(--gray)">
          Importe o arquivo Smart para visualizar o funil de conversão.
        </div>
      </div>`;
    return;
  }

  const v         = state.funilView || 'vendedor';
  const data      = v === 'time' ? calcFunilByTime() : calcFunilByVendedor();
  const colLabel  = v === 'time' ? 'Time' : 'Vendedor';

  const estagioHeaders = ESTAGIOS.map(e =>
    `<th colspan="3" class="funil-th-estagio">${e}</th>`
  ).join('');

  const estagioSubHeaders = ESTAGIOS.map(() =>
    `<th class="funil-sub">Total</th><th class="funil-sub">And.</th><th class="funil-sub">%</th>`
  ).join('');

  const rowsHtml = data.length === 0
    ? `<tr><td colspan="20" style="text-align:center;padding:40px;color:var(--gray)">Nenhum dado no período</td></tr>`
    : data.map((row, i) => {
        const cols = ESTAGIOS.map(est => {
          const e   = row.estagios[est] || { total: 0, emAndamento: 0, finalizado: 0, pct: 0 };
          return `<td class="funil-num">${e.total || '—'}</td><td class="funil-and">${e.emAndamento || '—'}</td><td class="funil-pct">${e.pct > 0 ? e.pct + '%' : '—'}</td>`;
        }).join('');

        const convBadge = row.convPct > 0
          ? `<span class="badge ${row.convPct >= 10 ? 'badge-green' : 'badge-gray'}">${row.convPct}%</span>`
          : '—';

        return `<tr>
          <td><div class="rank-num">${i + 1}</div></td>
          <td><strong>${row.operador}</strong></td>
          <td class="funil-num">${row.totalLeads}</td>
          ${cols}
          <td>${row.aprovadas || '—'}</td>
          <td>${convBadge}</td>
        </tr>`;
      }).join('');

  document.getElementById('ranking-body').innerHTML = `
    <div class="section-title"><span class="bar"></span>Funil de Conversão</div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">Funil por ${colLabel.toLowerCase()}</div>
        <div class="table-filters">
          <button class="filter-btn" onclick="setRankView('seller')">Vendedor</button>
          <button class="filter-btn" onclick="setRankView('team')">Time</button>
          <button class="filter-btn" onclick="setRankView('sup')">Supervisor</button>
          <button class="filter-btn" onclick="setRankView('ger')">Gerente</button>
          <button class="filter-btn active" onclick="setRankView('funil')">Funil</button>
          <span style="margin-left:12px;color:var(--gray);font-size:.8rem">Agrupar:</span>
          <button class="filter-btn ${v === 'vendedor' ? 'active' : ''}" onclick="setFunilView('vendedor')">Vendedor</button>
          <button class="filter-btn ${v === 'time'     ? 'active' : ''}" onclick="setFunilView('time')">Time</button>
        </div>
      </div>
      <div class="table-wrap"><table class="funil-table">
        <thead>
          <tr>
            <th rowspan="2">#</th>
            <th rowspan="2">${colLabel}</th>
            <th rowspan="2">Total Leads</th>
            ${estagioHeaders}
            <th rowspan="2">Aprovadas</th>
            <th rowspan="2">% Conversão</th>
          </tr>
          <tr>${estagioSubHeaders}</tr>
        </thead>
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
