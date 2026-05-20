import { state } from './state.js';
import { filteredData, calcKPIs } from './core/calcKPIs.js';
import { renderOverview } from './pages/overview.js';
import { renderRanking } from './pages/ranking.js';
import { renderReview } from './pages/review.js';
import { renderProcv, procvPendingCount } from './pages/procv.js';
import { renderClientes } from './pages/clientes.js';
import { renderPropostas } from './pages/propostas.js';
import { saveState } from './core/storage.js';
import { syncMetaAds } from './services/meta-ads.js';
import { syncBottomNav, initSwipe } from './utils/mobile.js';
import { can, canSeeGestao, perm } from './services/permissions.js';
import { renderAdminPage, initAdminPage } from './pages/admin-page.js';
import { renderPerfil } from './pages/perfil.js';

// Maps each child section to its parent group identifier
const GROUP_MAP = {
  overview:  'dashboard',
  ranking:   'dashboard',
  bsc:       'dashboard',
  perfil:    'dashboard',
  propostas: 'comercial',
  goals:     'comercial',
};

const TITLES = {
  import:    'Importar Dados',
  overview:  'Visão Geral',
  ranking:   'Ranking de Vendas',
  perfil:    'Perfil de Cliente',
  gestao:    'Gestão de Classificações',
  propostas: 'Propostas de Marketing',
  goals:     'Configurar Metas',
  bsc:       'Ranking BSC',
  admin:     'Administração',
};

export function navigate(sec) {
  localStorage.setItem('sc_last_section', sec);
  // Atualiza o hash da URL sem recarregar — sobrevive ao F5
  if (!window.location.hash.includes('access_token')) {
    history.replaceState(null, '', '#' + sec);
  }

  // Auto-abre o grupo pai se a seção for um item filho
  const parentGroup = GROUP_MAP[sec];
  if (parentGroup) {
    const groupEl = document.querySelector(`.nav-group[data-group="${parentGroup}"]`);
    if (groupEl) groupEl.classList.add('open');
  }

  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.sec === sec));
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `sec-${sec}`));
  document.getElementById('topbar-title').textContent = TITLES[sec] || '';

  // Float rail — itens standalone
  document.querySelectorAll('.nav-float-item:not(.nav-float-group)').forEach(el =>
    el.classList.toggle('active', el.dataset.sec === sec)
  );
  // Float rail — grupos: ativo se algum filho for a seção atual
  document.querySelectorAll('.nav-float-item.nav-float-group').forEach(groupEl => {
    const children = groupEl.querySelectorAll('.nav-float-flyout-item[data-sec]');
    const hasActive = [...children].some(c => c.dataset.sec === sec);
    groupEl.classList.toggle('active', hasActive);
    children.forEach(c => c.classList.toggle('active', c.dataset.sec === sec));
  });

  syncBottomNav(sec);
  // Scroll para o topo ao trocar de seção no mobile
  document.querySelector('.content')?.scrollTo({ top: 0 });
  // Renderiza admin page quando navega para lá
  if (sec === 'admin') renderAdminPage();
}

/**
 * Aplica permissões à interface: mostra/oculta itens de nav e seções
 * conforme o grupo do usuário logado.
 */
export function applyPermissionsToUI() {
  const permMap = {
    import:    () => can('importacao_fb03') || can('importacao_ecorban') || can('importacao_processar'),
    overview:  () => can('visao_geral'),
    ranking:   () => can('ranking'),
    gestao:    () => canSeeGestao(),
    perfil:    () => can('perfil_visualizar'),
    propostas: () => can('propostas'),
    goals:     () => can('metas_visualizar'),
    bsc:       () => can('bsc'),
    admin:     () => perm.isAdmin(),
  };

  // Sidebar nav items (standalone + filhos de grupos)
  document.querySelectorAll('.nav-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Oculta grupo se todos os filhos estiverem ocultos
  document.querySelectorAll('.nav-group').forEach(group => {
    const children = [...group.querySelectorAll('.nav-item[data-sec]')];
    const allHidden = children.length > 0 && children.every(el => el.style.display === 'none');
    const trigger = group.querySelector('.nav-group-trigger');
    if (trigger) trigger.style.display = allHidden ? 'none' : '';
  });

  // Float rail — itens standalone
  document.querySelectorAll('.nav-float-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Float rail — itens dentro do flyout de grupos
  document.querySelectorAll('.nav-float-flyout-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Oculta grupo do float rail se todos os filhos estiverem ocultos
  document.querySelectorAll('.nav-float-item.nav-float-group').forEach(groupEl => {
    const children = [...groupEl.querySelectorAll('.nav-float-flyout-item[data-sec]')];
    const allHidden = children.length > 0 && children.every(el => el.style.display === 'none');
    groupEl.style.display = allHidden ? 'none' : '';
  });

  // Sub-abas de Gestão
  const procvTab    = document.querySelector('.gestao-tab-btn[data-tab="procv"]');
  const revisaoTab  = document.querySelector('.gestao-tab-btn[data-tab="review"]');
  const clientesTab = document.querySelector('.gestao-tab-btn[data-tab="clientes"]');
  if (procvTab)    procvTab.style.display    = can('gestao_procv_visualizar')   ? '' : 'none';
  if (revisaoTab)  revisaoTab.style.display  = can('gestao_revisao_visualizar') ? '' : 'none';
  if (clientesTab) clientesTab.style.display = can('gestao_clientes')           ? '' : 'none';

  // Inicializa o admin modal uma vez
  initAdminPage();
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
  _syncFloatBadges();

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

export function applyFilter() {
  state.filterDates.start = document.getElementById('date-start').value || null;
  state.filterDates.end   = document.getElementById('date-end').value   || null;
  if (state.result) {
    state.metaAds  = null; // limpa dados antigos para evitar período errado
    renderAll();
    saveState();
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
  }
}

export function clearFilter() {
  state.filterDates = { start: null, end: null };
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value   = '';
  const btn = document.getElementById('qf-btn');
  if (btn) btn.textContent = 'Período ▾';
  if (state.result) {
    state.metaAds    = null;
    renderAll();
    saveState();
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
  }
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

// ── Float rail (shown when sidebar is collapsed) ──────────────────────
// Itens standalone têm { sec, title, badgeId, svg }.
// Grupos têm { group, title, svg, children: [{ sec, title, svg }] }.
const FLOAT_NAV_ITEMS = [
  {
    sec: 'import', title: 'Importar', badgeId: null,
    svg: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  {
    group: 'dashboard', title: 'Dashboard',
    svg: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    children: [
      { sec: 'overview', title: 'Visão Geral',      svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
      { sec: 'ranking',  title: 'Ranking',          svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
      { sec: 'bsc',      title: 'Ranking BSC',      svg: '<path d="M8 6l4-4 4 4"/><path d="M12 2v10"/><path d="M3 18h3v3h12v-3h3"/><path d="M6 15v3"/><path d="M18 15v3"/><path d="M12 12v6"/>' },
      { sec: 'perfil',   title: 'Perfil de Cliente', svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="21" x2="23" y2="15"/><line x1="16" y1="15" x2="16" y2="21"/><polyline points="20 18 23 21 26 18"/>' },
    ],
  },
  {
    sec: 'gestao', title: 'Gestão', badgeId: 'review-badge',
    svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  },
  {
    group: 'comercial', title: 'Comercial',
    svg: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
    children: [
      { sec: 'propostas', title: 'Propostas', svg: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
      { sec: 'goals',     title: 'Metas',     svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    ],
  },
  {
    sec: 'admin', title: 'Administração', badgeId: null,
    svg: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/><circle cx="19" cy="19" r="3"/><line x1="19" y1="16" x2="19" y2="19"/><line x1="19" y1="19" x2="22" y2="19"/>',
  },
];

let _floatRail = null;

function _buildFloatRail() {
  if (_floatRail) return;
  _floatRail = document.createElement('div');
  _floatRail.className = 'nav-float';
  _floatRail.id = 'nav-float-rail';
  const activeSec = localStorage.getItem('sc_last_section') || 'import';

  FLOAT_NAV_ITEMS.forEach(item => {
    if (item.group) {
      // ── Grupo com flyout ──────────────────────────────────────────
      const isChildActive = item.children.some(c => c.sec === activeSec);
      const el = document.createElement('div');
      el.className = 'nav-float-item nav-float-group' + (isChildActive ? ' active' : '');
      el.dataset.group = item.group;
      // Sem data-title para não mostrar tooltip (flyout ocupa esse papel)
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.svg}</svg>`;

      const flyout = document.createElement('div');
      flyout.className = 'nav-float-flyout';

      // Label do grupo no topo do flyout
      const label = document.createElement('div');
      label.className = 'nav-float-flyout-label';
      label.textContent = item.title;
      flyout.appendChild(label);

      item.children.forEach(child => {
        const childEl = document.createElement('div');
        childEl.className = 'nav-float-flyout-item' + (child.sec === activeSec ? ' active' : '');
        childEl.dataset.sec = child.sec;
        childEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${child.svg}</svg><span>${child.title}</span>`;
        childEl.addEventListener('click', e => { e.stopPropagation(); navigate(child.sec); });
        flyout.appendChild(childEl);
      });

      el.appendChild(flyout);
      _floatRail.appendChild(el);
    } else {
      // ── Item standalone ───────────────────────────────────────────
      const el = document.createElement('div');
      el.className = 'nav-float-item' + (item.sec === activeSec ? ' active' : '');
      el.dataset.sec = item.sec;
      el.dataset.title = item.title;
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.svg}</svg>`
        + (item.badgeId ? `<span class="nf-badge" id="nf-badge-${item.sec}" style="display:none"></span>` : '');
      el.addEventListener('click', () => navigate(item.sec));
      _floatRail.appendChild(el);
    }
  });

  document.body.appendChild(_floatRail);
  _syncFloatBadges();
}

function _destroyFloatRail() {
  if (_floatRail) { _floatRail.remove(); _floatRail = null; }
}

function _syncFloatBadges() {
  if (!_floatRail) return;
  // review badge
  const rb = document.getElementById('review-badge');
  const nfb = document.getElementById('nf-badge-gestao');
  if (rb && nfb) {
    const hidden = rb.classList.contains('hidden');
    nfb.style.display = hidden ? 'none' : '';
  }
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  localStorage.setItem('sc_sidebar_collapsed', isCollapsed ? '1' : '0');
  if (isCollapsed) { _buildFloatRail(); } else { _destroyFloatRail(); }
}

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.sec))
  );

  // Acordeão dos grupos
  document.querySelectorAll('.nav-group-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      trigger.closest('.nav-group').classList.toggle('open');
    });
  });

  // Restore sidebar state
  const collapsed = localStorage.getItem('sc_sidebar_collapsed') === '1';
  if (collapsed) {
    document.getElementById('sidebar').classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    _buildFloatRail();
  }

  // Swipe entre seções no mobile
  initSwipe(navigate);
}
