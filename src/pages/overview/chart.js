// Gráfico "Evolução Diária" da Visão Geral (Chart.js via CDN — global Chart,
// declarado em eslint.config.mjs).
// A instância vive em state.chart e é destruída/recriada a cada render.
import { state } from '../../state.js';
import { fmtBRL, fmtN, parseBRL } from '../../utils/currency.js';
import { parseExcelDate } from '../../utils/date.js';
import { trafegoInRange, TAXA_IMPOSTO } from '../../services/trafego-svc.js';

function _somarTrafego(dayMap, trDays) {
  for (const r of trDays) {
    if (!dayMap[r.dia]) dayMap[r.dia] = { invest: 0, valid: 0, rejected: 0 };
    dayMap[r.dia].invest += (Number(r.investimento) || 0) * (1 + TAXA_IMPOSTO);
  }
}

function _somarMeta(dayMap) {
  for (const row of state.metaAds.daily) {
    if (!dayMap[row.date]) dayMap[row.date] = { invest: 0, valid: 0, rejected: 0 };
    dayMap[row.date].invest += row.invest;
  }
}

function _somarPlanilhaFB(dayMap, fd) {
  for (const r of fd.facebook) {
    const d = parseExcelDate(r['Dia'] || r['Início dos relatórios'] || r['Inicio dos relatórios']);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { invest: 0, valid: 0, rejected: 0 };
    dayMap[key].invest += parseBRL(r['Montante gasto (BRL)']);
  }
}

// Fonte oficial: dias digitados no Tráfego (com imposto); depois API do Meta; depois planilha
function _investPorDia(fd, dayMap) {
  const trDays = trafegoInRange(state.filterDates.start, state.filterDates.end).rows;
  if (trDays.length)                     _somarTrafego(dayMap, trDays);
  else if (state.metaAds?.daily?.length) _somarMeta(dayMap);
  else                                   _somarPlanilhaFB(dayMap, fd);
}

function _vendasPorDia(fd, dayMap) {
  for (const r of fd.entries) {
    if (r.isMarketing && r.saleDate) {
      const key = new Date(r.saleDate).toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { invest: 0, valid: 0, rejected: 0 };
      if (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') dayMap[key].valid += (r.valor || 0);
      if (r.statusCat === 'reprovado') dayMap[key].rejected += (r.valor || 0);
    }
  }
}

export function renderChart(fd) {
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  const dayMap = {};
  _investPorDia(fd, dayMap);
  _vendasPorDia(fd, dayMap);
  const days = Object.keys(dayMap).sort();
  if (!days.length) return;
  const ctx = document.getElementById('main-chart')?.getContext('2d');
  if (!ctx) return;
  const gradValid = ctx.createLinearGradient(0, 0, 0, 260);
  gradValid.addColorStop(0, 'rgba(61,214,140,0.20)');
  gradValid.addColorStop(1, 'rgba(61,214,140,0)');
  state.chart = new Chart(ctx, {
    data: {
      labels: days.map(d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; }),
      datasets: [
        {
          type: 'bar', label: 'Investimento (R$)',
          data: days.map(d => dayMap[d]?.invest || 0),
          backgroundColor: 'rgba(229,51,58,0.30)', borderColor: 'rgba(229,51,58,0.85)', borderWidth: 1,
          borderRadius: 4, borderSkipped: false,
          yAxisID: 'y',
        },
        {
          type: 'line', label: 'Válidos (Em Andamento + Pagas)',
          data: days.map(d => dayMap[d]?.valid || 0),
          borderColor: '#3dd68c', borderWidth: 2, backgroundColor: gradValid, fill: true,
          pointBackgroundColor: '#3dd68c', pointRadius: 2, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y2',
        },
        {
          type: 'line', label: 'Reprovados',
          data: days.map(d => dayMap[d]?.rejected || 0),
          borderColor: 'rgba(242,85,90,0.85)', borderWidth: 1.5, borderDash: [5, 5],
          pointBackgroundColor: '#f2555a', pointRadius: 2, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#a8a1a3', font: { family: 'Instrument Sans', size: 11 }, usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
        tooltip: {
          backgroundColor: 'rgba(19,16,17,0.94)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          padding: 12, cornerRadius: 10,
          titleFont: { family: 'Archivo', weight: 600 }, bodyFont: { family: 'Instrument Sans' },
          titleColor: '#f4f1f2', bodyColor: '#a8a1a3',
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
        x: { ticks: { color: '#8b8286', font: { family: 'Instrument Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          position: 'left',
          ticks: { color: '#8b8286', font: { family: 'Instrument Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y2: {
          position: 'right',
          ticks: { color: '#a8a1a3', font: { family: 'Instrument Sans', size: 11 }, callback: v => 'R$' + fmtN(v) },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}
