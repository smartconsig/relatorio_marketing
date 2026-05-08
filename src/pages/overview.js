import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { parseBRL } from '../utils/currency.js';
import { parseExcelDate } from '../utils/date.js';
import { getCol } from '../utils/string.js';

export function kpiCard(label, val, meta, pct, inv) {
  let cls = 'accent';
  if (pct !== null && state.goals) {
    if (inv) {
      cls = pct <= 90 ? 'good' : pct <= 110 ? 'warn' : 'bad';
    } else {
      cls = pct >= 100 ? 'good' : pct >= 70 ? 'warn' : 'bad';
    }
  }
  const barW    = pct !== null ? Math.min(Math.max(pct, 0), 100).toFixed(1) : 0;
  const metaStr = pct !== null ? `${fmtPct(pct)} da meta` : (meta || '—');
  const vStr    = String(val);
  const vStyle  = vStr.length > 14 ? ' style="font-size:15px"' : vStr.length > 11 ? ' style="font-size:20px"' : '';
  return `
    <div class="kpi-card ${pct !== null ? cls : 'accent'}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"${vStyle}>${val}</div>
      <div class="kpi-meta">${metaStr}</div>
      ${pct !== null ? `<div class="kpi-progress"><div class="kpi-bar ${cls}" style="width:${barW}%"></div></div>` : ''}
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

export function pct(v, g) { return g ? (v / g) * 100 : null; }

export function renderOverview(k, fd) {
  const g = state.goals;
  let h = '';

  h += `<div class="section-title"><span class="bar"></span>Facebook Ads</div>
  <div class="kpi-grid">
    ${kpiCard('Investimento', fmtBRL(k.invest), null, pct(k.invest, g.invest), false)}
    ${kpiCard('Leads Gerados', fmtN(k.leads), null, pct(k.leads, g.leads), false)}
    ${kpiCard('CPL Facebook', fmtBRL(k.fbCpl), 'Reportado pelo Facebook', null, false)}
    ${kpiCard('CPL Calculado', fmtBRL(k.cplCalc), null, pct(k.cplCalc, g.cpl), true)}
  </div>`;

  h += `<div class="section-title"><span class="bar"></span>Esteira de Vendas — Tráfego Pago (Marketing)</div>
  <div class="pipeline-row">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgMkt, k.valueInProgMkt, 'propostas em análise / aprovadas')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidMkt, k.valueAlmostPaidMkt, 'desaverbação em andamento')}
    ${pipelineCard('Pagas', 'pc-paid', k.paidMkt, k.valueMkt, 'operações pagas no período')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejMkt, k.valueRejMkt, 'propostas reprovadas')}
    ${pipelineCard('Válidas (Total)', 'pc-valid', k.countValidMkt, k.valueValidMkt, 'em andamento + pagas')}
  </div>`;

  h += `<div class="section-title"><span class="bar"></span>Indicadores de Performance — Marketing</div>
  <div class="kpi-grid">
    ${kpiCard('Ticket Médio Pagas', fmtBRL(k.ticketMkt), 'Vendas pagas de marketing', null, false)}
    ${kpiCard('CAC', fmtBRL(k.cac), null, pct(k.cac, g.cac), true)}
    ${kpiCard('ROAS', k.roas.toFixed(2) + 'x', null, pct(k.roas, g.roas), false)}
    ${kpiCard('Taxa de Conversão', fmtPct(k.convRate), 'Leads → Vendas Pagas', null, false)}
  </div>`;

  h += `<div class="section-title"><span class="bar"></span>Esteira de Vendas — Todas as Origens</div>
  <div class="pipeline-row">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgAll, k.valueInProgAll, 'propostas em análise / aprovadas')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidAll, k.valueAlmostPaidAll, 'desaverbação em andamento')}
    ${pipelineCard('Pagas', 'pc-paid', k.paidAll, k.valuePaidAll, 'operações pagas no período')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejAll, k.valueRejAll, 'propostas reprovadas')}
    ${pipelineCard('Válidas (Total)', 'pc-valid', k.countValidAll, k.valueValidAll, 'em andamento + pagas')}
  </div>`;

  const semValorValidas = fd.entries.filter(r => (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') && !r.valor);
  const semValorReprov  = fd.entries.filter(r => r.statusCat === 'reprovado' && !r.valor);
  const semValorTotal   = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (semValorTotal.length > 0) {
    h += `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="font-size:18px;line-height:1">⚠️</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:4px">PROPOSTAS SEM VALOR MULTIPLICADOR</div>
        <div style="font-size:13px;color:var(--white)">
          <strong>${semValorTotal.length}</strong> propostas não têm valor no campo Multiplicador — o sistema soma <strong>R$ 0,00</strong> para elas.
        </div>
        <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--gray)">
          <span>🟡 Válidas sem valor: <strong style="color:var(--white)">${semValorValidas.length}</strong></span>
          <span>🔴 Reprovadas sem valor: <strong style="color:var(--white)">${semValorReprov.length}</strong></span>
        </div>
      </div>
    </div>`;
  }

  const dayMap = {};
  for (const r of fd.facebook) {
    const d = parseExcelDate(r['Dia'] || r['Início dos relatórios'] || r['Inicio dos relatórios']);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { invest: 0, valid: 0, rejected: 0 };
    dayMap[key].invest += parseBRL(r['Montante gasto (BRL)']);
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

  h += `<div class="section-title"><span class="bar"></span>Evolução Diária</div>
  <div class="chart-card"><div class="chart-title">Investimento (barras) vs. Válidos e Reprovados de Marketing (linhas)</div>
    <canvas id="main-chart" height="75"></canvas>
  </div>`;

  document.getElementById('overview-body').innerHTML = h;

  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (days.length > 0) {
    const ctx = document.getElementById('main-chart').getContext('2d');
    state.chart = new Chart(ctx, {
      data: {
        labels: days.map(d => { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; }),
        datasets: [
          {
            type: 'bar', label: 'Investimento (R$)',
            data: days.map(d => dayMap[d]?.invest || 0),
            backgroundColor: 'rgba(148,11,16,0.5)', borderColor: '#940b10', borderWidth: 1,
            yAxisID: 'y',
          },
          {
            type: 'line', label: 'Válidos (Em Andamento + Pagas)',
            data: days.map(d => dayMap[d]?.valid || 0),
            borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
            pointBackgroundColor: '#22c55e', pointRadius: 4,
            tension: 0.3, yAxisID: 'y2',
          },
          {
            type: 'line', label: 'Reprovados',
            data: days.map(d => dayMap[d]?.rejected || 0),
            borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)',
            pointBackgroundColor: '#f87171', pointRadius: 4,
            tension: 0.3, yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Open Sans', size: 12 }, boxWidth: 12, padding: 16 } },
          tooltip: {
            backgroundColor: '#1e1e1e', borderColor: '#2a2a2a', borderWidth: 1,
            titleColor: '#fff', bodyColor: '#9ca3af',
            callbacks: {
              label: c => {
                if (c.datasetIndex === 0) return ` Investimento: ${fmtBRL(c.raw)}`;
                if (c.datasetIndex === 1) return ` Válidos: ${fmtBRL(c.raw)}`;
                return ` Reprovados: ${fmtBRL(c.raw)}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: '#6b7280', font: { family: 'Open Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            position: 'left',
            ticks: { color: '#6b7280', font: { family: 'Open Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y2: {
            position: 'right',
            ticks: { color: '#9ca3af', font: { family: 'Open Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }
}

export function renderDiag(diag) {
  const panel = document.getElementById('diag-panel');
  if (!panel) return;
  const matchPct   = diag.ecorban.total ? Math.round(diag.ecorban.matched / diag.ecorban.total * 100) : 0;
  const matchColor = matchPct >= 80 ? '#22c55e' : matchPct >= 50 ? '#f59e0b' : '#ef4444';
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="section-title" style="margin-bottom:12px"><span class="bar"></span>Diagnóstico do Processamento</div>
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
          <div>Para revisão manual: <strong style="color:${diag.ecorban.toReview > 0 ? '#f59e0b' : '#22c55e'}">${fmtN(diag.ecorban.toReview)}</strong></div>
          <div>Com data lida: <strong style="color:${(diag.ecorban.withDate || 0) > 0 ? '#22c55e' : '#ef4444'}">${fmtN(diag.ecorban.withDate || 0)}</strong> de ${fmtN(diag.ecorban.total)} ${(diag.ecorban.withDate || 0) === 0 ? '<span style="color:#ef4444">⚠ coluna de data não encontrada</span>' : ''}</div>
          <div style="margin-top:6px;color:var(--gray);font-size:11px">Distribuição de status:</div>
          <div style="font-size:11px;margin-bottom:4px">
            Pago: <strong style="color:#22c55e">${diag.statusDist?.pago || 0}</strong> &nbsp;
            Aprovado: <strong style="color:#f59e0b">${diag.statusDist?.aprovado || 0}</strong> &nbsp;
            Reprovado: <strong style="color:#ef4444">${diag.statusDist?.reprovado || 0}</strong> &nbsp;
            Desconhecido: <strong style="color:#9ca3af">${diag.statusDist?.desconhecido || 0}</strong>
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
      ⚠️ <strong>Atenção:</strong> Nenhum CPF foi indexado do Sistema Smart. Verifique se a coluna se chama exatamente <code>CPF</code> no arquivo exportado.
    </div>` : ''}
    ${matchPct < 30 && diag.smart.cpfIndexed > 0 ? `
    <div style="margin-top:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#fcd34d">
      ⚠️ <strong>Taxa de match baixa (${matchPct}%).</strong> Possível causa: CPFs com zeros à esquerda perdidos ao exportar.
    </div>` : ''}
  `;
}
