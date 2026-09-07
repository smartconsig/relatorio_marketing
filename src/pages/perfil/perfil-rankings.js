// Rankings de Marketing da página Perfil (públicos, produtos/bancos,
// vendedores, times). Funções puras: recebem entries e devolvem HTML;
// leem apenas state.result.smartLeadsBy* e state.vendorMappings.
import { state } from '../../state.js';
import { fmtBRL, fmtN, fmtPct } from '../../utils/currency.js';
import { normStr, toTitle } from '../../utils/string.js';

function rankNum(i) {
  return `<div class="rank-num ${i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : ''}">${i + 1}</div>`;
}

function convBadge(validas, leads) {
  if (!leads) return `<span class="muted">—</span>`;
  const p = (validas / leads) * 100;
  const color = p >= 20 ? '#22c55e' : p >= 10 ? '#f59e0b' : '#ef4444';
  return `<strong style="color:${color}">${fmtPct(p)}</strong>`;
}

export function renderTopPublicos(entries) {
  const map = {};
  for (const e of entries.filter(e => e.isMarketing)) {
    const key = e.audiencia || '—';
    if (!map[key]) map[key] = { validas: 0, pagas: 0, valor: 0 };
    if (e.statusCat === 'aprovado' || e.statusCat === 'quase pago' || e.statusCat === 'pago') {
      map[key].validas++;
      map[key].valor += e.valor || 0;
    }
    if (e.statusCat === 'pago') map[key].pagas++;
  }
  const top = Object.entries(map).sort((a, b) => b[1].validas - a[1].validas).slice(0, 5);
  if (!top.length) return '';
  const rows = top.map(([name, d], i) => `
    <tr>
      <td>${rankNum(i)}</td>
      <td><strong>${name}</strong></td>
      <td>${fmtN(d.validas)}</td>
      <td>${fmtN(d.pagas)}</td>
      <td class="muted">${fmtBRL(d.valor)}</td>
    </tr>`).join('');
  return `
  <div class="section-title"><span class="bar"></span>Top Públicos</div>
  <div class="table-card">
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Audiência</th><th>Válidas</th><th>Pagas</th><th>Valor</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

export function renderTopProdutosBancos(entries) {
  const mkt = entries.filter(e => e.isMarketing && (e.statusCat === 'aprovado' || e.statusCat === 'quase pago' || e.statusCat === 'pago'));
  const buildMap = key => {
    const m = {};
    for (const e of mkt) {
      const k = e[key] || '—';
      if (!m[k]) m[k] = { count: 0, valor: 0 };
      m[k].count++;
      m[k].valor += e.valor || 0;
    }
    return Object.entries(m).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  };
  const topProd   = buildMap('produto');
  const topBancos = buildMap('banco');

  const makeRows = (top, cols) => top.length
    ? top.map(([name, d], i) => `
        <tr>
          <td>${rankNum(i)}</td>
          <td><strong>${name}</strong></td>
          <td>${fmtN(d.count)}</td>
          <td class="muted">${fmtBRL(d.valor)}</td>
        </tr>`).join('')
    : `<tr><td colspan="${cols}" style="text-align:center;color:var(--gray);padding:20px">Sem dados</td></tr>`;

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    <div>
      <div class="section-title"><span class="bar"></span>Top Produtos</div>
      <div class="table-card" style="margin:0">
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Produto</th><th>Válidas</th><th>Valor</th></tr></thead>
          <tbody>${makeRows(topProd, 4)}</tbody>
        </table></div>
      </div>
    </div>
    <div>
      <div class="section-title"><span class="bar"></span>Top Bancos</div>
      <div class="table-card" style="margin:0">
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Banco</th><th>Válidas</th><th>Valor</th></tr></thead>
          <tbody>${makeRows(topBancos, 4)}</tbody>
        </table></div>
      </div>
    </div>
  </div>`;
}

export function renderVendedores(entries) {
  const smartLeads = state.result?.smartLeadsByOperador || {};
  const map = {};
  for (const e of entries.filter(e => e.isMarketing)) {
    const key = e.vendedor || '—';
    if (!map[key]) map[key] = { lancados: 0, validas: 0, pagas: 0, valor: 0 };
    map[key].lancados++;
    if (e.statusCat === 'aprovado' || e.statusCat === 'quase pago' || e.statusCat === 'pago') {
      map[key].validas++;
      map[key].valor += e.valor || 0;
    }
    if (e.statusCat === 'pago') map[key].pagas++;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1].validas - a[1].validas);
  if (!sorted.length) return '';
  const rows = sorted.map(([name, d], i) => {
    const normName = normStr(name);
    const smartKey = state.vendorMappings?.[normName] || normName;
    const leads = smartLeads[smartKey] || 0;
    return `
      <tr>
        <td>${rankNum(i)}</td>
        <td><strong>${toTitle(name)}</strong></td>
        <td class="muted">${leads ? fmtN(leads) : '—'}</td>
        <td>${fmtN(d.lancados)}</td>
        <td>${fmtN(d.validas)}</td>
        <td>${fmtN(d.pagas)}</td>
        <td>${convBadge(d.validas, leads)}</td>
      </tr>`;
  }).join('');
  return `
  <div class="section-title"><span class="bar"></span>Vendedores — Marketing</div>
  <div class="table-card">
    <div class="table-header">
      <div class="table-header-title">Performance individual</div>
      <div style="font-size:11px;color:var(--gray)">Conversão = Válidas ÷ Leads recebidos</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Vendedor</th><th>Leads</th><th>Lançados</th><th>Válidos</th><th>Pagas</th><th>Conversão</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

export function renderTimes(entries) {
  const smartLeads = state.result?.smartLeadsByTime || {};
  const map = {};
  for (const e of entries.filter(e => e.isMarketing)) {
    const key = e.loja || '—';
    if (!map[key]) map[key] = { lancados: 0, validas: 0, pagas: 0, valor: 0 };
    map[key].lancados++;
    if (e.statusCat === 'aprovado' || e.statusCat === 'quase pago' || e.statusCat === 'pago') {
      map[key].validas++;
      map[key].valor += e.valor || 0;
    }
    if (e.statusCat === 'pago') map[key].pagas++;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1].validas - a[1].validas);
  if (!sorted.length) return '';
  const rows = sorted.map(([name, d], i) => {
    const normName = normStr(name);
    const smartKey = state.vendorMappings?.[normName] || normName;
    const leads = smartLeads[smartKey] || 0;
    return `
      <tr>
        <td>${rankNum(i)}</td>
        <td><strong>${name}</strong></td>
        <td class="muted">${leads ? fmtN(leads) : '—'}</td>
        <td>${fmtN(d.lancados)}</td>
        <td>${fmtN(d.validas)}</td>
        <td>${fmtN(d.pagas)}</td>
        <td>${convBadge(d.validas, leads)}</td>
      </tr>`;
  }).join('');
  return `
  <div class="section-title"><span class="bar"></span>Times — Marketing</div>
  <div class="table-card">
    <div class="table-header">
      <div class="table-header-title">Performance por time</div>
      <div style="font-size:11px;color:var(--gray)">Conversão = Válidas ÷ Leads recebidos</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Time</th><th>Leads</th><th>Lançados</th><th>Válidos</th><th>Pagas</th><th>Conversão</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}
