import { state } from './state.js';
import { filteredData, calcKPIs } from './core/calcKPIs.js';
import { renderOverview } from './pages/overview.js';
import { renderRanking } from './pages/ranking.js';
import { renderReview } from './pages/review.js';
import { renderProcv, procvPendingCount } from './pages/procv.js';
import { renderClientes } from './pages/clientes.js';
import { renderPropostas } from './pages/propostas.js';
import { saveState } from './core/storage.js';

const TITLES = {
  import:    'Importar Dados',
  overview:  'Visão Geral',
  ranking:   'Ranking de Vendas',
  review:    'Revisão Manual',
  procv:     'PROCV — Fila de Confirmação',
  clientes:  'Clientes Confirmados',
  propostas: 'Propostas de Marketing',
  goals:     'Configurar Metas',
  bsc:       'Ranking BSC',
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
  renderPropostas(fd.entries);

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
  const btn = document.getElementById('qf-btn');
  if (btn) btn.textContent = 'Período ▾';
  if (state.result) { renderAll(); saveState(); }
}

const _pad = n => String(n).padStart(2, '0');
const _fmt = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;

const QF_LABELS = {
  'today':      'Hoje',
  'yesterday':  'Ontem',
  'this-month': 'Esse Mês',
  'last-month': 'Último Mês',
  '7d':         'Últimos 7 dias',
  '15d':        'Últimos 15 dias',
  '30d':        'Últimos 30 dias',
};

export function quickFilter(preset) {
  const today = new Date(); today.setHours(0,0,0,0);
  let start, end;
  switch (preset) {
    case 'today':
      start = end = _fmt(today); break;
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      start = end = _fmt(y); break;
    }
    case 'this-month':
      start = _fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      end   = _fmt(today); break;
    case 'last-month': {
      start = _fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      end   = _fmt(new Date(today.getFullYear(), today.getMonth(), 0)); break;
    }
    case '7d': { const s = new Date(today); s.setDate(s.getDate()-6);  start=_fmt(s); end=_fmt(today); break; }
    case '15d':{ const s = new Date(today); s.setDate(s.getDate()-14); start=_fmt(s); end=_fmt(today); break; }
    case '30d':{ const s = new Date(today); s.setDate(s.getDate()-29); start=_fmt(s); end=_fmt(today); break; }
    default: return;
  }
  document.getElementById('date-start').value = start;
  document.getElementById('date-end').value   = end;
  document.getElementById('qf-menu').classList.remove('open');
  const btn = document.getElementById('qf-btn');
  if (btn) btn.textContent = (QF_LABELS[preset] || 'Período') + ' ▾';
  applyFilter();
}

export function toggleQuickFilter() {
  const menu = document.getElementById('qf-menu');
  const isOpen = menu.classList.toggle('open');
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!document.getElementById('qf-btn').contains(e.target)) {
          menu.classList.remove('open');
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }
}

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.sec))
  );
}
