// renderAll(): sincroniza todas as telas de dados com o state, mais a troca
// de sub-abas da Gestão e os badges de pendência.
import { state } from '../state.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from '../pages/overview.js';
import { renderRanking } from '../pages/ranking.js';
import { renderReview } from '../pages/review.js';
import { renderProcv, procvPendingCount } from '../pages/procv.js';
import { renderClientes } from '../pages/clientes.js';
import { renderPropostas } from '../pages/propostas.js';
import { renderPerfil } from '../pages/perfil.js';
import { syncPeriodBars } from '../components/period-bar.js';
import { syncFloatBadges } from './float-rail.js';

function _syncGoalsToPeriodo() {
  const ref = state.filterDates?.start || new Date().toISOString().slice(0, 10);
  const periodo = ref.slice(0, 7);
  state.goals = state.allGoals?.[periodo] || { invest: 0, cpl: 0, approved: 0, paid: 0, cac: 0, roas: 0 };
}

export function renderAll() {
  _syncGoalsToPeriodo();
  syncPeriodBars(); // pós-restauração de F5/login, as barras refletem o filtro carregado
  const fd = filteredData();
  if (!fd) return;
  const kpis = calcKPIs(fd.entries, fd.facebook);
  renderOverview(kpis, fd);
  renderRanking(fd.entries);
  renderReview(kpis.toReview, state.result.unknownStatuses);
  renderProcv(fd.entries);
  renderClientes(fd.entries);
  renderPropostas(fd.entries);
  renderPerfil(fd.entries);
  switchGestaoTab(state.gestaoTab || 'procv');

  // Badge "Revisão Manual" → só statuses desconhecidos
  const reviewCnt   = state.result.unknownStatuses.length;
  const reviewBadge = document.getElementById('review-badge');
  reviewBadge.textContent = reviewCnt;
  reviewBadge.classList.toggle('hidden', reviewCnt === 0);
  const reviewBadgeInner = document.getElementById('review-badge-inner');
  if (reviewBadgeInner) {
    reviewBadgeInner.textContent = reviewCnt;
    reviewBadgeInner.classList.toggle('hidden', reviewCnt === 0);
  }
  syncFloatBadges();

  // Badge "PROCV" → registros de marketing pendentes de revisão
  const procvBadge  = document.getElementById('procv-badge');
  const procvCnt    = procvPendingCount(fd.entries);
  if (procvBadge) {
    procvBadge.textContent = procvCnt;
    procvBadge.classList.toggle('hidden', procvCnt === 0);
  }

  // Badge mobile bottom nav gestão → soma revisão + procv pendentes
  const mbnGestaoBadge = document.getElementById('mbn-gestao-badge');
  if (mbnGestaoBadge) {
    const mbnCnt = reviewCnt + procvCnt;
    mbnGestaoBadge.textContent = mbnCnt;
    mbnGestaoBadge.classList.toggle('hidden', mbnCnt === 0);
  }
}

export function switchGestaoTab(tab) {
  state.gestaoTab = tab;
  ['procv','review','clientes'].forEach(t => {
    const body = document.getElementById(`${t}-body`);
    if (body) body.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.gestao-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}
