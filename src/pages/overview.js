import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { parseBRL } from '../utils/currency.js';
import { parseExcelDate } from '../utils/date.js';
import { toast } from '../utils/ui.js';
import { filteredData } from '../core/calcKPIs.js';
import { toTitle } from '../utils/string.js';
import { badgeHTML } from '../components/Badge.jsx';
import { sectionTitle } from '../components/ui.js';
import { trafegoInRange, TAXA_IMPOSTO } from '../services/trafego-svc.js';

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function pct(v, g) { return g ? (v / g) * 100 : null; }

export function kpiCard(label, val, meta, p, inv, goalLabel) {
  let cls = 'accent';
  if (p !== null && state.goals) {
    cls = inv
      ? (p <= 100 ? 'good' : p <= 120 ? 'warn' : 'bad')
      : (p >= 100 ? 'good' : p >= 70  ? 'warn' : 'bad');
  }
  const barW    = p !== null ? Math.min(Math.max(p, 0), 100).toFixed(1) : 0;
  const metaStr = p !== null
    ? (goalLabel ? `${goalLabel} Â· ` : '') + `${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}`
    : (meta || 'â€”');
  const vStr    = String(val);
  const vStyle  = vStr.length > 14 ? ' style="font-size:15px"' : vStr.length > 11 ? ' style="font-size:20px"' : '';
  return `
    <div class="kpi-card ${p !== null ? cls : 'accent'}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"${vStyle}>${val}</div>
      <div class="kpi-meta">${metaStr}</div>
      ${p !== null ? `<div class="kpi-progress"><div class="kpi-bar ${cls}" style="width:${barW}%"></div></div>` : ''}
    </div>`;
}

export function pipelineCard(label, cls, count, value, sub) {
  return `
    <div class="pipeline-card ${cls}">
      <div class="pipeline-label"><span class="pipeline-dot ${cls}"></span>${label}</div>
      <div class="pipeline-count">${fmtN(count)}</div>
      <div class="pipeline-value">${fmtBRL(value)}</div>
      <div class="pipeline-sub">${sub}</div>
    </div>`;
}

function heroCard(label, count, value, sub, accentColor, p, inv, valueColor, goalLabel) {
  const cls = p === null ? '' : inv
    ? (p <= 100 ? 'good' : p <= 120 ? 'warn' : 'bad')
    : (p >= 100 ? 'good' : p >= 70  ? 'warn' : 'bad');
  const barColor = cls === 'good' ? 'var(--green)' : cls === 'warn' ? 'var(--yellow)' : cls === 'bad' ? 'var(--danger)' : accentColor;
  return `
    <div class="hero-card" style="border-top:3px solid ${accentColor}">
      <div class="hero-label">${label}</div>
      ${count !== null ? `<div class="hero-count">${fmtN(count)}</div>` : ''}
      <div class="hero-value" style="color:${valueColor || accentColor}">${typeof value === 'string' ? value : fmtBRL(value)}</div>
      <div class="hero-sub">${sub}</div>
      ${p !== null ? `
        <div class="kpi-progress" style="margin-top:14px"><div class="kpi-bar" style="width:${Math.min(Math.max(p,0),100).toFixed(1)}%;background:${barColor}"></div></div>
        <div style="font-size:11px;color:var(--gray-light);margin-top:4px">${goalLabel ? goalLabel + ' Â· ' : ''}${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}</div>` : ''}
    </div>`;
}

// â”€â”€ chart helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderChart(fd) {
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  const dayMap = {};

  // Fonte oficial: dias digitados no TrÃ¡fego (com imposto); depois API do Meta; depois planilha
  const trDays = trafegoInRange(state.filterDates.start, state.filterDates.end).rows;
  if (trDays.length) {
    for (const r of trDays) {
      if (!dayMap[r.dia]) dayMap[r.dia] = { invest: 0, valid: 0, rejected: 0 };
      dayMap[r.dia].invest += (Number(r.investimento) || 0) * (1 + TAXA_IMPOSTO);
    }
  } else if (state.metaAds?.daily?.length) {
    for (const row of state.metaAds.daily) {
      if (!dayMap[row.date]) dayMap[row.date] = { invest: 0, valid: 0, rejected: 0 };
      dayMap[row.date].invest += row.invest;
    }
  } else {
    for (const r of fd.facebook) {
      const d = parseExcelDate(r['Dia'] || r['InÃ­cio dos relatÃ³rios'] || r['Inicio dos relatÃ³rios']);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { invest: 0, valid: 0, rejected: 0 };
      dayMap[key].invest += parseBRL(r['Montante gasto (BRL)']);
    }
  }
  for (const r of fd.entries) {
    if (r.isMarketing && r.saleDate) {
      const key = new Date(r.saleDate).toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { invest: 0, valid: 0, rejected: 0 };
      if (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') dayMap[key].valid += (r.valor || 0);
      if (r.statusCat === 'reprovado') dayMap[key].rejected += (r.valor || 0);
    }
  }
  const days = Object.keys(dayMap).sort();
  if (!days.length) return;
  const ctx = document.getElementById('main-chart')?.getContext('2d');
  if (!ctx) return;
  state.chart = new Chart(ctx, {
    data: {
      labels: days.map(d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; }),
      datasets: [
        {
          type: 'bar', label: 'Investimento (R$)',
          data: days.map(d => dayMap[d]?.invest || 0),
          backgroundColor: 'rgba(148,11,16,0.5)', borderColor: '#940b10', borderWidth: 1,
          yAxisID: 'y',
        },
        {
          type: 'line', label: 'VÃ¡lidos (Em Andamento + Pagas)',
          data: days.map(d => dayMap[d]?.valid || 0),
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          pointBackgroundColor: '#22c55e', pointRadius: 4, tension: 0.3, yAxisID: 'y2',
        },
        {
          type: 'line', label: 'Reprovados',
          data: days.map(d => dayMap[d]?.rejected || 0),
          borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)',
          pointBackgroundColor: '#f87171', pointRadius: 4, tension: 0.3, yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: 'Instrument Sans', size: 12 }, boxWidth: 12, padding: 16 } },
        tooltip: {
          backgroundColor: '#1e1e1e', borderColor: '#2a2a2a', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#9ca3af',
          callbacks: {
            label: c => {
              if (c.datasetIndex === 0) return ` Investimento: ${fmtBRL(c.raw)}`;
              if (c.datasetIndex === 1) return ` VÃ¡lidos: ${fmtBRL(c.raw)}`;
              return ` Reprovados: ${fmtBRL(c.raw)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: '#6b7280', font: { family: 'Instrument Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          position: 'left',
          ticks: { color: '#6b7280', font: { family: 'Instrument Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y2: {
          position: 'right',
          ticks: { color: '#9ca3af', font: { family: 'Instrument Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

export function exportNoValueCSV() {
  const fd = filteredData();
  if (!fd) return;
  const noValue = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (!noValue.length) { toast('Nenhuma entrada sem valor no perÃ­odo'); return; }
  const header = ['Cliente','CPF','Status','Categoria','Data','Produto','Banco','Loja','Vendedor','Origem Ecorban','Ã‰ Marketing'];
  const rows   = noValue.map(e => [
    e.cliente||'', e.cpf||'', e.rawStatus||'', e.statusCat||'',
    e.saleDate ? new Date(e.saleDate).toLocaleDateString('pt-BR') : '',
    e.produto||'', e.banco||'', e.loja||'', e.vendedor||'',
    e.ecorbanOrigem||'', e.isMarketing ? 'Sim' : 'NÃ£o',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['ï»¿'+csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `sem_valor_multiplicador_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${fmtN(noValue.length)} entradas exportadas`);
}

export function exportNoDatesCSV() {
  if (!state.result) return;
  const noDate = state.result.entries.filter(e => !e.saleDate);
  if (!noDate.length) { toast('Nenhuma entrada sem data'); return; }
  const header = ['Cliente', 'CPF', 'Status', 'Categoria', 'Valor', 'Origem Ecorban', 'Loja', 'Vendedor', 'Ã‰ Marketing'];
  const rows   = noDate.map(e => [
    e.cliente || '', e.cpf || '', e.rawStatus || '', e.statusCat || '',
    e.valor || 0, e.ecorbanOrigem || '', e.loja || '', e.vendedor || '',
    e.isMarketing ? 'Sim' : 'NÃ£o',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['ï»¿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `entradas_sem_data_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${fmtN(noDate.length)} entradas exportadas`);
}


function renderDivergencias(entries) {
  const divs = entries.filter(e =>
    e.reviewReason === 'manual' &&
    e.isMarketing === true &&
    (e.ecorbanOrigem || '').toUpperCase() !== 'MARKETING' &&
    !e.divergenceConfirmed
  );
  if (!divs.length) return '';

  const rows = divs.map((e, i) => `
    <tr>
      <td class="muted" style="font-size:11px">${i + 1}</td>
      <td><strong>${e.cliente || 'â€”'}</strong></td>
      <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || 'â€”'}</td>
      <td class="muted" style="font-family:monospace;font-size:12px">${e.smartPhone || 'â€”'}</td>
      <td>${badgeHTML(e.statusCat, e.rawStatus)}</td>
      <td class="muted">${fmtBRL(e.valor)}</td>
      <td><span style="color:#f59e0b;font-weight:600">${e.ecorbanOrigem || 'â€”'}</span></td>
      <td class="muted">${e.loja || 'â€”'}</td>
      <td class="muted">${toTitle(e.vendedor || 'â€”')}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn-mkt"   onclick="confirmDivergence(${e._idx})" style="font-size:11px;padding:4px 8px">âœ… Ã‰ Marketing</button>
          <button class="btn-nomkt" onclick="rejectDivergence(${e._idx})"  style="font-size:11px;padding:4px 8px">âŒ NÃ£o Ã© Marketing</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:18px">âš ï¸</span>
        <div>
          <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#f59e0b">
            ${fmtN(divs.length)} ENTRADAS CONFIRMADAS COMO MARKETING MAS COM ORIGEM DIFERENTE NO ECORBAN
          </div>
          <div style="font-size:12px;color:var(--gray-light);margin-top:2px">
            Revise cada uma â€” confirme se Ã© realmente marketing ou remova para corrigir os nÃºmeros.
          </div>
        </div>
      </div>
      <div class="table-card" style="margin:0">
        <div class="table-wrap"><table>
          <thead><tr>
            <th>#</th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Status</th>
            <th>Valor</th><th>Origem Ecorban</th><th>Loja</th><th>Vendedor</th><th>AÃ§Ã£o</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </div>`;
}

// â”€â”€ main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderOverview(k, fd) {
  const g = state.goals;
  let h = '';

  // â”€â”€ 0. AVISO ENTRADAS SEM DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const semData     = (state.result?.entries || []).filter(e => !e.saleDate);
  const semDataMkt  = semData.filter(e => e.isMarketing);
  if (semData.length > 0) {
    h += `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="font-size:18px;line-height:1">âš ï¸</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">ENTRADAS SEM DATA DE CADASTRO</div>
        <div style="font-size:13px;color:var(--white)">
          <strong>${fmtN(semData.length)}</strong> entradas nÃ£o tÃªm Data de Cadastro reconhecida â€”
          estÃ£o sendo incluÃ­das em <strong>qualquer filtro de perÃ­odo</strong> e podem estar inflando os nÃºmeros.
          ${semDataMkt.length > 0 ? `<span style="color:#fca5a5"> (${fmtN(semDataMkt.length)} sÃ£o de marketing)</span>` : ''}
        </div>
        <div style="margin-top:10px">
          <button onclick="exportNoDatesCSV()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--font-b);cursor:pointer">
            â¬‡ Exportar lista completa (CSV)
          </button>
        </div>
      </div>
    </div>`;
  }

  // â”€â”€ 0b. DIVERGÃŠNCIAS ECORBAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  h += renderDivergencias(fd.entries);

  // â”€â”€ 1. HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cacValidas = k.countValidMkt > 0 ? k.invest / (k.countValidMkt * 0.70) : 0;
  const convProspeccao = k.leads > 0 ? (k.countValidMkt / k.leads) * 100 : 0;
  h += sectionTitle('Resultados de Marketing');
  h += `<div class="hero-grid">
    ${heroCard('VÃ¡lidas Total', k.countValidMkt, k.valueValidMkt, 'em andamento + pagas Â· trÃ¡fego pago', '#22c55e', pct(k.valueValidMkt, g.approved), false, '#60a5fa', g.approved ? `meta: ${fmtBRL(g.approved)}` : null)}
    ${heroCard('Pagas', k.paidMkt, k.valueMkt, 'operaÃ§Ãµes confirmadas Â· trÃ¡fego pago', '#22c55e', pct(k.valueMkt, g.paid), false, null, g.paid ? `meta: ${fmtBRL(g.paid)}` : null)}
    ${heroCard('Investimento', null, k.invest, k.investSource === 'trafego' ? 'total investido Â· trÃ¡fego digitado (c/ imposto)' : 'total investido Â· Facebook Ads', '#940b10', pct(k.invest, g.invest), true, 'var(--white)', g.invest ? `limite: ${fmtBRL(g.invest)}` : null)}
    ${heroCard('CAC VÃ¡lidas', null, cacValidas, 'custo por venda vÃ¡lida Â· 70% das vÃ¡lidas', '#f59e0b', null, false, 'var(--white)', null)}
    ${heroCard('ConversÃ£o', null, `${convProspeccao.toFixed(1)}%`, `${fmtN(k.countValidMkt)} vÃ¡lidas de ${fmtN(k.leads)} leads Facebook Â· meta 15%`, convProspeccao >= 15 ? '#22c55e' : convProspeccao >= 10 ? '#f59e0b' : '#940b10', null, false, convProspeccao >= 15 ? '#22c55e' : convProspeccao >= 10 ? '#f59e0b' : '#f87171', null)}
  </div>`;

  // â”€â”€ 2. PIPELINE COMPLEMENTAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  h += sectionTitle('Pipeline Marketing');
  h += `<div class="pipeline-row pipeline-3">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgMkt, k.valueInProgMkt, 'propostas em anÃ¡lise / aprovadas')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidMkt, k.valueAlmostPaidMkt, 'desaverbaÃ§Ã£o em andamento')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejMkt, k.valueRejMkt, 'propostas reprovadas')}
  </div>`;

  // â”€â”€ 3. INDICADORES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  h += sectionTitle('Indicadores de Performance');
  h += `<div class="kpi-grid">
    ${kpiCard('Ticket MÃ©dio Pagas', fmtBRL(k.ticketMkt), 'vendas pagas de marketing', null, false)}
    ${kpiCard('CAC', fmtBRL(k.cac), null, pct(k.cac, g.cac), true, g.cac ? `mÃ¡x. ${fmtBRL(g.cac)}` : null)}
    ${kpiCard('ROAS', k.roas.toFixed(2) + 'x', null, pct(k.roas, g.roas), false, g.roas ? `mÃ­n. ${g.roas.toFixed(2)}x` : null)}
    ${kpiCard('Taxa de ConversÃ£o', fmtPct(k.convRate), 'Leads â†’ Vendas Pagas', null, false)}
    ${kpiCard('CPL Calculado', fmtBRL(k.cplCalc), null, pct(k.cplCalc, g.cpl), true, g.cpl ? `mÃ¡x. ${fmtBRL(g.cpl)}` : null)}
    ${kpiCard('Leads Gerados', fmtN(k.leads), 'leads recebidos no perÃ­odo', null, false)}
    ${kpiCard('CPL Facebook', fmtBRL(k.fbCpl), k.investSource === 'trafego' ? 'painel Meta Â· sem imposto' : 'Reportado pelo Facebook', null, false)}
  </div>`;

  // â”€â”€ 4. SECUNDÃRIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  h += sectionTitle('Todas as Origens', 'margin-top:8px');
  h += `<div class="pipeline-row">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgAll, k.valueInProgAll, 'todas as origens')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidAll, k.valueAlmostPaidAll, 'todas as origens')}
    ${pipelineCard('Pagas', 'pc-paid', k.paidAll, k.valuePaidAll, 'todas as origens')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejAll, k.valueRejAll, 'todas as origens')}
    ${pipelineCard('VÃ¡lidas (Total)', 'pc-valid', k.countValidAll, k.valueValidAll, 'todas as origens')}
  </div>`;

  // â”€â”€ 5. AVISO SEM VALOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const semValorValidas = fd.entries.filter(r => (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') && !r.valor);
  const semValorReprov  = fd.entries.filter(r => r.statusCat === 'reprovado' && !r.valor);
  const semValorTotal   = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (semValorTotal.length > 0) {
    h += `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="font-size:18px;line-height:1">âš ï¸</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:4px">PROPOSTAS SEM VALOR MULTIPLICADOR</div>
        <div style="font-size:13px;color:var(--white)"><strong>${semValorTotal.length}</strong> propostas nÃ£o tÃªm valor no campo Multiplicador â€” o sistema soma <strong>R$ 0,00</strong> para elas.</div>
        <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--gray)">
          <span>ðŸŸ¡ VÃ¡lidas sem valor: <strong style="color:var(--white)">${semValorValidas.length}</strong></span>
          <span>ðŸ”´ Reprovadas sem valor: <strong style="color:var(--white)">${semValorReprov.length}</strong></span>
        </div>
        <div style="margin-top:10px">
          <button id="no-value-toggle" onclick="
            const el=document.getElementById('no-value-table');
            const open=el.style.display!=='none';
            el.style.display=open?'none':'block';
            this.textContent=open?'â–¼ Ver propostas':'â–² Ocultar propostas';
          " style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fcd34d;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--font-b);cursor:pointer">
            â–¼ Ver propostas
          </button>
        </div>
        <div id="no-value-table" style="display:none;margin-top:14px">
          <div class="table-card" style="margin:0">
            <div class="table-wrap"><table>
              <thead><tr>
                <th>#</th><th>Cliente</th><th>CPF</th><th>Status</th>
                <th>Data</th><th>Produto</th><th>Banco</th><th>Loja</th><th>Vendedor</th><th>Origem</th>
              </tr></thead>
              <tbody>
                ${semValorTotal.map((e, i) => `
                  <tr>
                    <td class="muted" style="font-size:11px">${i + 1}</td>
                    <td><strong>${e.cliente || 'â€”'}</strong></td>
                    <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || 'â€”'}</td>
                    <td>${badgeHTML(e.statusCat, e.rawStatus)}</td>
                    <td class="muted">${e.saleDate ? new Date(e.saleDate).toLocaleDateString('pt-BR') : 'â€”'}</td>
                    <td class="muted">${e.produto || 'â€”'}</td>
                    <td class="muted">${e.banco || 'â€”'}</td>
                    <td class="muted">${e.loja || 'â€”'}</td>
                    <td class="muted">${e.vendedor || 'â€”'}</td>
                    <td class="muted">${e.ecorbanOrigem || 'â€”'}</td>
                  </tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // â”€â”€ 6. SMS KOLMEYA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (state.kolmeya) {
    const km = state.kolmeya;
    const txEntrega = km.enviados > 0 ? ((km.entregues / km.enviados) * 100).toFixed(1) + '%' : 'â€”';
    h += sectionTitle('SMS â€” Kolmeya');
    h += `<div class="kpi-grid">
      ${kpiCard('Enviados', fmtN(km.enviados), `perÃ­odo ${km.period}`, null, false)}
      ${kpiCard('Entregues', fmtN(km.entregues), `taxa ${txEntrega}`, null, false)}
      ${kpiCard('NÃ£o Entregues', fmtN(km.naoEntregues), 'falha na entrega', null, false)}
      ${kpiCard('Respostas', fmtN(km.respostas), 'respostas dos destinatÃ¡rios', null, false)}
      ${kpiCard('Acessos no Link', fmtN(km.acessos), 'cliques no encurtador', null, false)}
      ${kpiCard('Custo SMS', fmtBRL(km.valorPago), 'valor pago no perÃ­odo', null, false)}
    </div>`;
  }

  // â”€â”€ 7. GRÃFICO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  h += sectionTitle('EvoluÃ§Ã£o DiÃ¡ria');
  h += `<div class="chart-card"><div class="chart-title">Investimento (barras) vs. VÃ¡lidos e Reprovados de Marketing (linhas)</div>
    <canvas id="main-chart" height="75"></canvas>
  </div>`;

  document.getElementById('overview-body').innerHTML = h;
  renderChart(fd);
}

// â”€â”€ diag (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderDiag(diag) {
  const panel = document.getElementById('diag-panel');
  if (!panel) return;
  const matchPct   = diag.ecorban.total ? Math.round(diag.ecorban.matched / diag.ecorban.total * 100) : 0;
  const matchColor = matchPct >= 80 ? '#22c55e' : matchPct >= 50 ? '#f59e0b' : '#ef4444';
  panel.style.display = 'block';
  panel.innerHTML = `
    ${sectionTitle('DiagnÃ³stico do Processamento', 'margin-bottom:12px')}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Sistema Smart</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Registros lidos: <strong>${fmtN(diag.smart.total)}</strong></div>
          <div>CPFs indexados: <strong style="color:#22c55e">${fmtN(diag.smart.cpfIndexed)}</strong></div>
          <div>Telefones indexados: <strong style="color:#22c55e">${fmtN(diag.smart.phoneIndexed)}</strong></div>
          <div style="margin-top:8px;color:var(--gray);font-size:11px">Colunas detectadas:</div>
          <div style="color:var(--gray-light);font-size:11px">${diag.smart.cols.map(c => `<span style="background:var(--surface2);padding:1px 6px;border-radius:4px;margin:2px;display:inline-block">${c}</span>`).join('')}</div>
        </div>
      </div>
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Ecorban</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Propostas lidas: <strong>${fmtN(diag.ecorban.total)}</strong></div>
          <div>Encontradas no Smart: <strong style="color:${matchColor}">${fmtN(diag.ecorban.matched)} (${matchPct}%)</strong></div>
          <div>Para revisÃ£o manual: <strong style="color:${diag.ecorban.toReview > 0 ? '#f59e0b' : '#22c55e'}">${fmtN(diag.ecorban.toReview)}</strong></div>
          <div>Com data lida: <strong style="color:${(diag.ecorban.withDate || 0) > 0 ? '#22c55e' : '#ef4444'}">${fmtN(diag.ecorban.withDate || 0)}</strong> de ${fmtN(diag.ecorban.total)} ${(diag.ecorban.withDate || 0) === 0 ? '<span style="color:#ef4444">âš  coluna de data nÃ£o encontrada</span>' : ''}</div>
          <div style="margin-top:6px;color:var(--gray);font-size:11px">DistribuiÃ§Ã£o de status:</div>
          <div style="font-size:11px;margin-bottom:4px">
            Pago: <strong style="color:#22c55e">${diag.statusDist?.pago || 0}</strong> &nbsp;
            Aprovado: <strong style="color:#f59e0b">${diag.statusDist?.aprovado || 0}</strong> &nbsp;
            Reprovado: <strong style="color:#ef4444">${diag.statusDist?.reprovado || 0}</strong> &nbsp;
            Desconhecido: <strong style="color:#9ca3af">${diag.statusDist?.desconhecido || 0}</strong> &nbsp;
            Sem Status: <strong style="color:#6b7280">${diag.statusDist?.['sem status'] || 0}</strong>
          </div>
          <div style="color:var(--gray);font-size:11px">Amostra de status brutos:</div>
          <div style="color:var(--gray-light);font-size:11px">${(diag.statusSample || []).map(s => `<span style="background:var(--surface2);padding:1px 6px;border-radius:4px;margin:2px;display:inline-block">${s}</span>`).join('')}</div>
          <div style="margin-top:8px;color:var(--gray);font-size:11px">Colunas detectadas:</div>
          <div style="color:var(--gray-light);font-size:11px">${diag.ecorban.cols.map(c => `<span style="background:var(--surface2);padding:1px 6px;border-radius:4px;margin:2px;display:inline-block">${c}</span>`).join('')}</div>
        </div>
      </div>
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Facebook Ads</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Total de linhas: <strong>${fmtN(diag.facebook.total)}</strong></div>
          <div>BM-03: <strong>${fmtN(diag.facebook.bm03)} linhas</strong></div>
          <div>BM-06: <strong>${fmtN(diag.facebook.bm06)} linhas</strong></div>
          ${diag.facebook.total === 0 ? '<div style="color:var(--gray)">Nenhum arquivo de Facebook importado</div>' : ''}
        </div>
      </div>
    </div>
    ${matchPct < 50 && diag.smart.cpfIndexed === 0 ? `
    <div style="margin-top:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#fca5a5">
      âš ï¸ <strong>AtenÃ§Ã£o:</strong> Nenhum CPF foi indexado do Sistema Smart. Verifique se a coluna se chama exatamente <code>CPF</code> no arquivo exportado.
    </div>` : ''}
    ${matchPct < 30 && diag.smart.cpfIndexed > 0 ? `
    <div style="margin-top:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#fcd34d">
      âš ï¸ <strong>Taxa de match baixa (${matchPct}%).</strong> PossÃ­vel causa: CPFs com zeros Ã  esquerda perdidos ao exportar.
    </div>` : ''}
  `;
}
