import { state } from './state.js';
import { filteredData, calcKPIs } from './core/calcKPIs.js';
import { renderOverview } from './pages/overview.js';
import { renderRanking } from './pages/ranking.js';
import { renderReview } from './pages/review.js';
import { renderProcv, procvPendingCount } from './pages/procv.js';
import { renderClientes } from './pages/clientes.js';
import { saveState } from './core/storage.js';

const TITLES = {
  import:   'Importar Dados',
  overview: 'Visão Geral',
  ranking:  'Ranking de Vendas',
  review:   'Revisão Manual',
  procv:    'PROCV — Fila de Confirmação',
  clientes: 'Clientes Confirmados',
  goals:    'Configurar Metas',
};

export function navigate(sec) {
  localStorage.setItem('sc_last_section', sec);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.sec === sec));
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `sec-${sec}`));
  document.getElementById('topbar-title').textContent = TITLES[sec] || '';
}

export function renderAll() {
  const fd = filteredData();
  if (!fd) return;
  const kpis = calcKPIs(fd.entries, fd.facebook);
  renderOverview(kpis, fd);
  renderRanking(fd.entries);
  renderReview(kpis.toReview, state.result.unknownStatuses);
  renderProcv(fd.entries);
  renderClientes(fd.entries);

  // Badge "Revisão Manual" → só statuses desconhecidos
  const reviewBadge = document.getElementById('review-badge');
  const reviewCnt   = state.result.unknownStatuses.length;
  reviewBadge.textContent = reviewCnt;
  reviewBadge.classList.toggle('hidden', reviewCnt === 0);

  // Badge "PROCV" → registros de marketing pendentes de revisão
  const procvBadge  = document.getElementById('procv-badge');
  const procvCnt    = procvPendingCount(fd.entries);
  if (procvBadge) {
    procvBadge.textContent = procvCnt;
    procvBadge.classList.toggle('hidden', procvCnt === 0);
  }
}

export function applyFilter() {
  state.filterDates.start = document.getElementById('date-start').value || null;
  state.filterDates.end   = document.getElementById('date-end').value   || null;
  if (state.result) { renderAll(); saveState(); }
}

export function clearFilter() {
  state.filterDates = { start: null, end: null };
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value   = '';
  if (state.result) { renderAll(); saveState(); }
}

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.sec))
  );
}
