import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { getHierarchy } from '../core/calcKPIs.js';
import { filteredData } from '../core/calcKPIs.js';

export function renderRanking(entries) {
  const v   = state.rankView;
  const map = {};

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

  const extraCols = v === 'seller'
    ? '<th>Time</th><th>Supervisor</th><th>Gerente</th>'
    : v === 'team'
    ? '<th>Supervisor</th><th>Gerente</th>'
    : v === 'sup'
    ? '<th>Gerente</th>'
    : '';

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--gray)">Nenhum dado disponível</td></tr>`
    : rows.map((row, i) => {
        const ri = i + 1;
        const rc = ri === 1 ? 'r1' : ri === 2 ? 'r2' : ri === 3 ? 'r3' : '';
        const ticket = row.paid ? row.value / row.paid : 0;
        const pMkt   = row.paid ? (row.mktPaid / row.paid) * 100 : 0;
        const extra  = v === 'seller'
          ? `<td class="muted">${row.loja}</td><td class="muted">${row.supervisor}</td><td class="muted">${row.gerente}</td>`
          : v === 'team'
          ? `<td class="muted">${row.supervisor}</td><td class="muted">${row.gerente}</td>`
          : v === 'sup'
          ? `<td class="muted">${row.gerente}</td>`
          : '';
        return `<tr>
          <td><div class="rank-num ${rc}">${ri}</div></td>
          <td><strong>${row.name}</strong></td>
          ${extra}
          <td><span class="badge badge-green">${row.paid}</span></td>
          <td>${row.approved}</td>
          <td>${fmtBRL(row.value)}</td>
          <td>${fmtBRL(ticket)}</td>
          <td><span class="badge ${pMkt >= 50 ? 'badge-green' : 'badge-gray'}">${fmtPct(pMkt)}</span></td>
        </tr>`;
      }).join('');

  const colLabel = v === 'seller' ? 'Vendedor' : v === 'team' ? 'Time' : v === 'sup' ? 'Supervisor' : 'Gerente';

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
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>${colLabel}</th>${extraCols}
          <th>Pagas</th><th>Aprovadas</th><th>Valor Total</th><th>Ticket Médio</th><th>% Marketing</th>
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
