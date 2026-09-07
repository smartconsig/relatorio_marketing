// Visão Geral — orquestrador. Os blocos vivem em src/pages/overview/:
//   kpi-cards.js    cards KPI/pipeline/hero + animação de contagem
//   chart.js        gráfico "Evolução Diária" (Chart.js via CDN)
//   exports-csv.js  exports de entradas sem valor / sem data
//   divergencias.js banner de divergências Ecorban
//   diag.js         painel "Diagnóstico do Processamento"
// Este arquivo re-exporta os nomes públicos originais — quem importava de
// './pages/overview.js' continua funcionando sem mudar uma linha.
import { state } from '../state.js';
import { fmtBRL, fmtN, fmtPct } from '../utils/currency.js';
import { sectionTitle } from '../components/ui.js';
import { icon } from '../utils/icons.js';
import { badgeHTML } from '../components/Badge.jsx';
import { pct, kpiCard, pipelineCard, heroCard, animateHeroValues } from './overview/kpi-cards.js';
import { renderChart } from './overview/chart.js';
import { renderDivergencias } from './overview/divergencias.js';

export { pct, kpiCard, pipelineCard } from './overview/kpi-cards.js';
export { exportNoValueCSV, exportNoDatesCSV } from './overview/exports-csv.js';
export { renderDiag } from './overview/diag.js';

// ── main render ────────────────────────────────────────────────────────────
export function renderOverview(k, fd) {
  const g = state.goals;
  let h = '';

  // ── 0. AVISO ENTRADAS SEM DATA ───────────────────────────────────────────
  const semData     = (state.result?.entries || []).filter(e => !e.saleDate);
  const semDataMkt  = semData.filter(e => e.isMarketing);
  if (semData.length > 0) {
    h += `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="color:var(--danger);line-height:1">${icon('alert', 18)}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">ENTRADAS SEM DATA DE CADASTRO</div>
        <div style="font-size:13px;color:var(--white)">
          <strong>${fmtN(semData.length)}</strong> entradas não têm Data de Cadastro reconhecida —
          estão sendo incluídas em <strong>qualquer filtro de período</strong> e podem estar inflando os números.
          ${semDataMkt.length > 0 ? `<span style="color:#fca5a5"> (${fmtN(semDataMkt.length)} são de marketing)</span>` : ''}
        </div>
        <div style="margin-top:10px">
          <button onclick="exportNoDatesCSV()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--font-b);cursor:pointer">
            ${icon('download', 12)} Exportar lista completa (CSV)
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── 0b. DIVERGÊNCIAS ECORBAN ─────────────────────────────────────────────
  h += renderDivergencias(fd.entries);

  // ── 1. HERO ──────────────────────────────────────────────────────────────
  const cacValidas = k.countValidMkt > 0 ? k.invest / (k.countValidMkt * 0.70) : 0;
  const convProspeccao = k.leads > 0 ? (k.countValidMkt / k.leads) * 100 : 0;
  h += sectionTitle('Resultados de Marketing');
  h += `<div class="hero-grid">
    ${heroCard('Válidas Total', k.countValidMkt, k.valueValidMkt, 'em andamento + pagas · tráfego pago', 'var(--green)', pct(k.valueValidMkt, g.approved), false, 'var(--blue)', g.approved ? `meta: ${fmtBRL(g.approved)}` : null)}
    ${heroCard('Pagas', k.paidMkt, k.valueMkt, 'operações confirmadas · tráfego pago', 'var(--green)', pct(k.valueMkt, g.paid), false, null, g.paid ? `meta: ${fmtBRL(g.paid)}` : null)}
    ${heroCard('Investimento', null, k.invest, k.investSource === 'trafego' ? 'total investido · tráfego digitado (c/ imposto)' : 'total investido · Facebook Ads', 'var(--red-bright)', pct(k.invest, g.invest), true, 'var(--white)', g.invest ? `limite: ${fmtBRL(g.invest)}` : null)}
    ${heroCard('CAC Válidas', null, cacValidas, 'custo por venda válida · 70% das válidas', 'var(--yellow)', null, false, 'var(--white)', null)}
    ${heroCard('Conversão', null, `${convProspeccao.toFixed(1)}%`, `${fmtN(k.countValidMkt)} válidas de ${fmtN(k.leads)} leads Facebook · meta 15%`, convProspeccao >= 15 ? 'var(--green)' : convProspeccao >= 10 ? 'var(--yellow)' : 'var(--red-bright)', null, false, convProspeccao >= 15 ? 'var(--green)' : convProspeccao >= 10 ? 'var(--yellow)' : 'var(--danger)', null)}
  </div>`;

  // ── 2. PIPELINE COMPLEMENTAR ─────────────────────────────────────────────
  h += sectionTitle('Pipeline Marketing');
  h += `<div class="pipeline-row pipeline-3">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgMkt, k.valueInProgMkt, 'propostas em análise / aprovadas')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidMkt, k.valueAlmostPaidMkt, 'desaverbação em andamento')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejMkt, k.valueRejMkt, 'propostas reprovadas')}
  </div>`;

  // ── 3. INDICADORES ───────────────────────────────────────────────────────
  h += sectionTitle('Indicadores de Performance');
  h += `<div class="kpi-grid">
    ${kpiCard('Ticket Médio Pagas', fmtBRL(k.ticketMkt), 'vendas pagas de marketing', null, false)}
    ${kpiCard('CAC', fmtBRL(k.cac), null, pct(k.cac, g.cac), true, g.cac ? `máx. ${fmtBRL(g.cac)}` : null)}
    ${kpiCard('ROAS', k.roas.toFixed(2) + 'x', null, pct(k.roas, g.roas), false, g.roas ? `mín. ${g.roas.toFixed(2)}x` : null)}
    ${kpiCard('Taxa de Conversão', fmtPct(k.convRate), 'Leads → Vendas Pagas', null, false)}
    ${kpiCard('CPL Calculado', fmtBRL(k.cplCalc), null, pct(k.cplCalc, g.cpl), true, g.cpl ? `máx. ${fmtBRL(g.cpl)}` : null)}
    ${kpiCard('Leads Gerados', fmtN(k.leads), 'leads recebidos no período', null, false)}
    ${kpiCard('CPL Facebook', fmtBRL(k.fbCpl), k.investSource === 'trafego' ? 'painel Meta · sem imposto' : 'Reportado pelo Facebook', null, false)}
  </div>`;

  // ── 4. SECUNDÁRIO ────────────────────────────────────────────────────────
  h += sectionTitle('Todas as Origens', 'margin-top:8px');
  h += `<div class="pipeline-row">
    ${pipelineCard('Em Andamento', 'pc-inprog', k.inProgAll, k.valueInProgAll, 'todas as origens')}
    ${pipelineCard('Quase Pago', 'pc-almost', k.almostPaidAll, k.valueAlmostPaidAll, 'todas as origens')}
    ${pipelineCard('Pagas', 'pc-paid', k.paidAll, k.valuePaidAll, 'todas as origens')}
    ${pipelineCard('Reprovadas', 'pc-rej', k.rejAll, k.valueRejAll, 'todas as origens')}
    ${pipelineCard('Válidas (Total)', 'pc-valid', k.countValidAll, k.valueValidAll, 'todas as origens')}
  </div>`;

  // ── 5. AVISO SEM VALOR ───────────────────────────────────────────────────
  const semValorValidas = fd.entries.filter(r => (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') && !r.valor);
  const semValorReprov  = fd.entries.filter(r => r.statusCat === 'reprovado' && !r.valor);
  const semValorTotal   = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (semValorTotal.length > 0) {
    h += `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="color:var(--yellow);line-height:1">${icon('alert', 18)}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:4px">PROPOSTAS SEM VALOR MULTIPLICADOR</div>
        <div style="font-size:13px;color:var(--white)"><strong>${semValorTotal.length}</strong> propostas não têm valor no campo Multiplicador — o sistema soma <strong>R$ 0,00</strong> para elas.</div>
        <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--gray)">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--yellow);margin-right:4px"></span>Válidas sem valor: <strong style="color:var(--white)">${semValorValidas.length}</strong></span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--danger);margin-right:4px"></span>Reprovadas sem valor: <strong style="color:var(--white)">${semValorReprov.length}</strong></span>
        </div>
        <div style="margin-top:10px">
          <button id="no-value-toggle" onclick="
            const el=document.getElementById('no-value-table');
            const open=el.style.display!=='none';
            el.style.display=open?'none':'block';
            this.textContent=open?'▼ Ver propostas':'▲ Ocultar propostas';
          " style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fcd34d;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--font-b);cursor:pointer">
            ▼ Ver propostas
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
                    <td><strong>${e.cliente || '—'}</strong></td>
                    <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
                    <td>${badgeHTML(e.statusCat, e.rawStatus)}</td>
                    <td class="muted">${e.saleDate ? new Date(e.saleDate).toLocaleDateString('pt-BR') : '—'}</td>
                    <td class="muted">${e.produto || '—'}</td>
                    <td class="muted">${e.banco || '—'}</td>
                    <td class="muted">${e.loja || '—'}</td>
                    <td class="muted">${e.vendedor || '—'}</td>
                    <td class="muted">${e.ecorbanOrigem || '—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── 6. SMS KOLMEYA ───────────────────────────────────────────────────────
  if (state.kolmeya) {
    const km = state.kolmeya;
    const txEntrega = km.enviados > 0 ? ((km.entregues / km.enviados) * 100).toFixed(1) + '%' : '—';
    h += sectionTitle('SMS — Kolmeya');
    h += `<div class="kpi-grid">
      ${kpiCard('Enviados', fmtN(km.enviados), `período ${km.period}`, null, false)}
      ${kpiCard('Entregues', fmtN(km.entregues), `taxa ${txEntrega}`, null, false)}
      ${kpiCard('Não Entregues', fmtN(km.naoEntregues), 'falha na entrega', null, false)}
      ${kpiCard('Respostas', fmtN(km.respostas), 'respostas dos destinatários', null, false)}
      ${kpiCard('Acessos no Link', fmtN(km.acessos), 'cliques no encurtador', null, false)}
      ${kpiCard('Custo SMS', fmtBRL(km.valorPago), 'valor pago no período', null, false)}
    </div>`;
  }

  // ── 7. GRÁFICO ───────────────────────────────────────────────────────────
  h += sectionTitle('Evolução Diária');
  h += `<div class="chart-card"><div class="chart-title">Investimento (barras) vs. Válidos e Reprovados de Marketing (linhas)</div>
    <canvas id="main-chart" height="75"></canvas>
  </div>`;

  document.getElementById('overview-body').innerHTML = h;
  animateHeroValues();
  renderChart(fd);
}
