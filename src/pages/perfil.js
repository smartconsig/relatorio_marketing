import { state } from '../state.js';
import { fmtBRL, fmtPct } from '../utils/currency.js';
import { calcPerfil } from '../core/calcPerfil.js';

const _fmtDias  = d => (d === null || d === undefined) ? '—' : `${d} dia${d === 1 ? '' : 's'}`;
const _fmtCPF   = cpf => cpf ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—';
const _medal    = i => i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';

function _bar(val, total) {
  const pct = total > 0 ? Math.round(val / total * 100) : 0;
  return `<div style="display:flex;align-items:center;gap:8px">
    <div style="flex:1;background:var(--surface3);border-radius:4px;height:6px;overflow:hidden">
      <div style="width:${pct}%;background:var(--red);height:100%;border-radius:4px"></div>
    </div>
    <span style="font-size:11px;color:var(--gray);white-space:nowrap">${val}/${total} (${pct}%)</span>
  </div>`;
}

function _cardHeader(title, extra = '') {
  return `<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <span style="font-family:var(--font-h);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:var(--white)">${title}</span>
    ${extra ? `<span style="font-size:12px;color:var(--gray)">${extra}</span>` : ''}
  </div>`;
}

export function renderPerfil(filteredEntries) {
  const el = document.getElementById('sec-perfil');
  if (!el) return;

  if (!filteredEntries || filteredEntries.length === 0) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--gray);font-family:var(--font-h)">
      Importe dados do Ecorban para visualizar o Perfil de Cliente.
    </div>`;
    return;
  }

  // allEntries = histórico completo para cálculo de LTV (ignora filtro de datas)
  const allEntries = state.result?.entries || filteredEntries;
  const perf = calcPerfil(filteredEntries, allEntries);
  const { faixas, estados, conversao, ltv, cobertura } = perf;

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const taxaGeral  = cobertura.totalMkt > 0 ? cobertura.totalPagos / cobertura.totalMkt : 0;
  const bestFaixa  = faixas[0];
  const bestEstado = estados[0];

  const kpis = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:24px">
      <div class="kpi-card">
        <div class="kpi-label">Leads Marketing</div>
        <div class="kpi-value">${cobertura.totalMkt}</div>
        <div class="kpi-sub">${cobertura.totalPagos} pagos · ${fmtPct(taxaGeral)} conv.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Faixa que mais converte</div>
        <div class="kpi-value" style="font-size:22px">${bestFaixa ? bestFaixa.label + ' anos' : '—'}</div>
        <div class="kpi-sub">${bestFaixa ? `${bestFaixa.pagos} pagos · ${fmtPct(bestFaixa.taxa)}` : 'Dados insuficientes'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Estado campeão</div>
        <div class="kpi-value" style="font-size:22px">${bestEstado ? bestEstado.uf : '—'}</div>
        <div class="kpi-sub">${bestEstado ? `${bestEstado.pagos} pagos · ${fmtPct(bestEstado.taxa)}` : 'Dados insuficientes'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tempo médio de conversão</div>
        <div class="kpi-value" style="font-size:22px">${_fmtDias(conversao.mediaDias)}</div>
        <div class="kpi-sub">${conversao.medianaDias !== null ? 'Mediana: ' + _fmtDias(conversao.medianaDias) : 'Dados insuficientes'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clientes recorrentes</div>
        <div class="kpi-value" style="font-size:22px">${ltv.recorrentes}</div>
        <div class="kpi-sub">${fmtPct(ltv.taxaRecorrencia)} dos clientes${ltv.tempMedioRecompra !== null ? ' · recompra em ' + _fmtDias(ltv.tempMedioRecompra) : ''}</div>
      </div>
    </div>`;

  // ── Aviso de cobertura parcial ─────────────────────────────────────────────
  const pctIdade  = cobertura.totalMkt > 0 ? cobertura.comIdade  / cobertura.totalMkt : 0;
  const pctEstado = cobertura.totalMkt > 0 ? cobertura.comEstado / cobertura.totalMkt : 0;
  const warn = (pctIdade < 0.5 || pctEstado < 0.5) ? `
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;color:#f59e0b;font-family:var(--font-h)">
      ⚠ Cobertura parcial — as análises refletem apenas registros com os campos preenchidos.
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:500px">
        <div><div style="margin-bottom:4px">Data de Nascimento</div>${_bar(cobertura.comIdade, cobertura.totalMkt)}</div>
        <div><div style="margin-bottom:4px">Estado (UF)</div>${_bar(cobertura.comEstado, cobertura.totalMkt)}</div>
      </div>
    </div>` : '';

  // ── Tabela faixas etárias ──────────────────────────────────────────────────
  const faixasRows = faixas.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--gray)">Sem dados de nascimento disponíveis</td></tr>`
    : faixas.map((f, i) => `<tr>
        <td><strong>${_medal(i)}${f.label} anos</strong></td>
        <td>${f.leads}</td><td>${f.pagos}</td>
        <td><strong style="color:${f.taxa >= 0.15 ? '#22c55e' : 'inherit'}">${fmtPct(f.taxa)}</strong></td>
        <td>${f.pagos > 0 ? fmtBRL(f.ticketMedio) : '—'}</td>
      </tr>`).join('');

  const tblFaixas = `<div class="card" style="margin-bottom:0">
    ${_cardHeader('Faixa Etária')}
    <div style="overflow-x:auto"><table class="admin-table">
      <thead><tr><th>Faixa</th><th>Leads</th><th>Pagos</th><th>Tx. Conv.</th><th>Ticket Médio</th></tr></thead>
      <tbody>${faixasRows}</tbody>
    </table></div>
  </div>`;

  // ── Tabela estados ─────────────────────────────────────────────────────────
  const estadosRows = estados.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gray)">Sem dados de estado disponíveis</td></tr>`
    : estados.slice(0, 15).map((e, i) => `<tr>
        <td><strong>${_medal(i)}${e.uf}</strong></td>
        <td style="color:var(--gray);font-size:12px">${e.regiao || '—'}</td>
        <td>${e.leads}</td><td>${e.pagos}</td>
        <td><strong style="color:${e.taxa >= 0.15 ? '#22c55e' : 'inherit'}">${fmtPct(e.taxa)}</strong></td>
        <td>${e.pagos > 0 ? fmtBRL(e.ticketMedio) : '—'}</td>
      </tr>`).join('');

  const tblEstados = `<div class="card" style="margin-bottom:0">
    ${_cardHeader('Ranking por Estado')}
    <div style="overflow-x:auto"><table class="admin-table">
      <thead><tr><th>UF</th><th>Região</th><th>Leads</th><th>Pagos</th><th>Tx. Conv.</th><th>Ticket Médio</th></tr></thead>
      <tbody>${estadosRows}</tbody>
    </table></div>
  </div>`;

  // ── LTV top clientes ───────────────────────────────────────────────────────
  const ltvRows = ltv.topClientes.length === 0
    ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray)">Nenhum cliente pago encontrado</td></tr>`
    : ltv.topClientes.map((c, i) => `<tr>
        <td><strong>${_medal(i)}${c.cliente || '—'}</strong></td>
        <td style="color:var(--gray);font-size:12px">${_fmtCPF(c.cpf)}</td>
        <td style="text-align:center">${c.compras}</td>
        <td><strong style="color:var(--red)">${fmtBRL(c.ltv)}</strong></td>
      </tr>`).join('');

  const tblLtv = `<div class="card">
    ${_cardHeader('LTV — Top Clientes (histórico completo)', `${ltv.totalClientes} únicos · ${ltv.recorrentes} recorrentes`)}
    <div style="overflow-x:auto"><table class="admin-table">
      <thead><tr><th>Cliente</th><th>CPF</th><th style="text-align:center">Compras</th><th>LTV Total</th></tr></thead>
      <tbody>${ltvRows}</tbody>
    </table></div>
  </div>`;

  el.innerHTML = `
    <div style="padding:24px;max-width:1200px">
      ${kpis}
      ${warn}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        ${tblFaixas}
        ${tblEstados}
      </div>
      ${tblLtv}
    </div>`;
}
