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

// ── 1. HERO — Resultados de Marketing ───────────────────────────────────────
function _heroSectionHTML(k, g) {
  const cacValidas = k.countValidMkt > 0 ? k.invest / (k.countValidMkt * 0.70) : 0;
  const convProspeccao = k.leads > 0 ? (k.countValidMkt / k.leads) * 100 : 0;
  const corConv = convProspeccao >= 15 ? 'var(--green)' : convProspeccao >= 10 ? 'var(--yellow)' : 'var(--red-bright)';
  const corConvVal = convProspeccao >= 15 ? 'var(--green)' : convProspeccao >= 10 ? 'var(--yellow)' : 'var(--danger)';

  return sectionTitle('Resultados de Marketing') + `<div class="hero-grid">
    ${heroCard({ label: 'Válidas Total', count: k.countValidMkt, value: k.valueValidMkt,
                 sub: 'em andamento + pagas · tráfego pago', accentColor: 'var(--green)',
                 p: pct(k.valueValidMkt, g.approved), valueColor: 'var(--blue)',
                 goalLabel: g.approved ? `meta: ${fmtBRL(g.approved)}` : null })}
    ${heroCard({ label: 'Pagas', count: k.paidMkt, value: k.valueMkt,
                 sub: 'operações confirmadas · tráfego pago', accentColor: 'var(--green)',
                 p: pct(k.valueMkt, g.paid),
                 goalLabel: g.paid ? `meta: ${fmtBRL(g.paid)}` : null })}
    ${heroCard({ label: 'Investimento', value: k.invest,
                 sub: k.investSource === 'trafego' ? 'total investido · tráfego digitado (c/ imposto)' : 'total investido · Facebook Ads',
                 accentColor: 'var(--red-bright)', p: pct(k.invest, g.invest), inv: true, valueColor: 'var(--white)',
                 goalLabel: g.invest ? `limite: ${fmtBRL(g.invest)}` : null })}
    ${heroCard({ label: 'CAC Válidas', value: cacValidas,
                 sub: 'custo por venda válida · 70% das válidas', accentColor: 'var(--yellow)', valueColor: 'var(--white)' })}
    ${heroCard({ label: 'Conversão', value: `${convProspeccao.toFixed(1)}%`,
                 sub: `${fmtN(k.countValidMkt)} válidas de ${fmtN(k.leads)} leads Facebook · meta 15%`,
                 accentColor: corConv, valueColor: corConvVal })}
  </div>`;
}

// ── 2. PIPELINE COMPLEMENTAR ────────────────────────────────────────────────
function _pipelineMktHTML(k) {
  return sectionTitle('Pipeline Marketing') + `<div class="pipeline-row pipeline-3">
    ${pipelineCard({ label: 'Em Andamento', cls: 'pc-inprog', count: k.inProgMkt,     value: k.valueInProgMkt,     sub: 'propostas em análise / aprovadas' })}
    ${pipelineCard({ label: 'Quase Pago',   cls: 'pc-almost', count: k.almostPaidMkt, value: k.valueAlmostPaidMkt, sub: 'desaverbação em andamento' })}
    ${pipelineCard({ label: 'Reprovadas',   cls: 'pc-rej',    count: k.rejMkt,        value: k.valueRejMkt,        sub: 'propostas reprovadas' })}
  </div>`;
}

// ── 3. INDICADORES ──────────────────────────────────────────────────────────
function _indicadoresHTML(k, g) {
  return sectionTitle('Indicadores de Performance') + `<div class="kpi-grid">
    ${kpiCard('Ticket Médio Pagas', fmtBRL(k.ticketMkt), { meta: 'vendas pagas de marketing' })}
    ${kpiCard('CAC', fmtBRL(k.cac), { p: pct(k.cac, g.cac), inv: true, goalLabel: g.cac ? `máx. ${fmtBRL(g.cac)}` : null })}
    ${kpiCard('ROAS', k.roas.toFixed(2) + 'x', { p: pct(k.roas, g.roas), goalLabel: g.roas ? `mín. ${g.roas.toFixed(2)}x` : null })}
    ${kpiCard('Taxa de Conversão', fmtPct(k.convRate), { meta: 'Leads → Vendas Pagas' })}
    ${kpiCard('CPL Calculado', fmtBRL(k.cplCalc), { p: pct(k.cplCalc, g.cpl), inv: true, goalLabel: g.cpl ? `máx. ${fmtBRL(g.cpl)}` : null })}
    ${kpiCard('Leads Gerados', fmtN(k.leads), { meta: 'leads recebidos no período' })}
    ${kpiCard('CPL Facebook', fmtBRL(k.fbCpl), { meta: k.investSource === 'trafego' ? 'painel Meta · sem imposto' : 'Reportado pelo Facebook' })}
  </div>`;
}

// ── 4. SECUNDÁRIO — Todas as Origens ────────────────────────────────────────
function _todasOrigensHTML(k) {
  return sectionTitle('Todas as Origens', 'margin-top:8px') + `<div class="pipeline-row">
    ${pipelineCard({ label: 'Em Andamento',    cls: 'pc-inprog', count: k.inProgAll,     value: k.valueInProgAll,     sub: 'todas as origens' })}
    ${pipelineCard({ label: 'Quase Pago',      cls: 'pc-almost', count: k.almostPaidAll, value: k.valueAlmostPaidAll, sub: 'todas as origens' })}
    ${pipelineCard({ label: 'Pagas',           cls: 'pc-paid',   count: k.paidAll,       value: k.valuePaidAll,       sub: 'todas as origens' })}
    ${pipelineCard({ label: 'Reprovadas',      cls: 'pc-rej',    count: k.rejAll,        value: k.valueRejAll,        sub: 'todas as origens' })}
    ${pipelineCard({ label: 'Válidas (Total)', cls: 'pc-valid',  count: k.countValidAll, value: k.valueValidAll,      sub: 'todas as origens' })}
  </div>`;
}

// ── main render ────────────────────────────────────────────────────────────
// ── 0. AVISO ENTRADAS SEM DATA ──────────────────────────────────────────────
function _avisoSemDataHTML() {
  const semData     = (state.result?.entries || []).filter(e => !e.saleDate);
  const semDataMkt  = semData.filter(e => e.isMarketing);
  if (semData.length === 0) return '';
  return `
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

export function renderOverview(k, fd) {
  const g = state.goals;
  let h = '';

  h += _avisoSemDataHTML();

  // ── 0b. DIVERGÊNCIAS ECORBAN ─────────────────────────────────────────────
  h += renderDivergencias(fd.entries);

  h += _heroSectionHTML(k, g);
  h += _pipelineMktHTML(k);
  h += _indicadoresHTML(k, g);
  h += _todasOrigensHTML(k);

  h += _avisoSemValorHTML(fd);
  h += _kolmeyaHTML();

  // ── 7. GRÁFICO ───────────────────────────────────────────────────────────
  h += sectionTitle('Evolução Diária');
  h += `<div class="chart-card"><div class="chart-title">Investimento (barras) vs. Válidos e Reprovados de Marketing (linhas)</div>
    <canvas id="main-chart" height="75"></canvas>
  </div>`;

  document.getElementById('overview-body').innerHTML = h;
  animateHeroValues();
  renderChart(fd);
}

// ── 5. AVISO SEM VALOR ──────────────────────────────────────────────────────
function _avisoSemValorHTML(fd) {
  const semValorValidas = fd.entries.filter(r => (r.statusCat === 'aprovado' || r.statusCat === 'quase pago' || r.statusCat === 'pago') && !r.valor);
  const semValorReprov  = fd.entries.filter(r => r.statusCat === 'reprovado' && !r.valor);
  const semValorTotal   = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (semValorTotal.length === 0) return '';
  return `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
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

// ── 6. SMS KOLMEYA ──────────────────────────────────────────────────────────
function _kolmeyaHTML() {
  if (!state.kolmeya) return '';
  const km = state.kolmeya;
  const txEntrega = km.enviados > 0 ? ((km.entregues / km.enviados) * 100).toFixed(1) + '%' : '—';
  return sectionTitle('SMS — Kolmeya') + `<div class="kpi-grid">
      ${kpiCard('Enviados', fmtN(km.enviados), { meta: `período ${km.period}` })}
      ${kpiCard('Entregues', fmtN(km.entregues), { meta: `taxa ${txEntrega}` })}
      ${kpiCard('Não Entregues', fmtN(km.naoEntregues), { meta: 'falha na entrega' })}
      ${kpiCard('Respostas', fmtN(km.respostas), { meta: 'respostas dos destinatários' })}
      ${kpiCard('Acessos no Link', fmtN(km.acessos), { meta: 'cliques no encurtador' })}
      ${kpiCard('Custo SMS', fmtBRL(km.valorPago), { meta: 'valor pago no período' })}
    </div>`;
}
