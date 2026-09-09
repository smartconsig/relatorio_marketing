// Roteador de seções + barrel da navegação. Os blocos vivem em:
//   src/navigation/permissions-ui.js  applyPermissionsToUI
//   src/navigation/periodo.js         setPeriodo / clearFilter / quickFilter
//   src/navigation/render-all.js      renderAll / switchGestaoTab
//   src/navigation/float-rail.js      menu flutuante da sidebar recolhida
//   src/config/nav-items.js           dados dos itens do float rail
// Este arquivo re-exporta os nomes públicos originais — quem importava de
// './navigation.js' continua funcionando sem mudar uma linha.
import { syncBottomNav, initSwipe } from './utils/mobile.js';
import { renderAdminPage } from './pages/admin-page.js';
import { renderQuitacoes } from './pages/quitacoes-page.js';
import { renderConteudo } from './pages/conteudo-page.js';
import { renderBMs } from './pages/bm-page.js';
import { initGoalsPage } from './pages/goals-page.js';
import { renderUniversidade, exitUniversidade, uniOpenCurso, uniGoBack, uniPlayAula, uniStartProva, uniVerCertificado, uniOpenAdmin, uniOpenGamificacao } from './pages/universidade.js';
import { renderUniAdmin } from './pages/uni-admin.js';
import { renderUniGamificacao } from './pages/uni-gamificacao.js';
import { renderLiberacao } from './pages/liberacao-page.js';
import { renderBoletos } from './pages/boletos-page.js';
import { renderResiduos } from './pages/residuos-page.js';
import { renderTrafego } from './pages/trafego-page.js';
import { renderHome } from './pages/home-page.js';
import { syncPeriodBars } from './components/period-bar.js';
import { applyPermissionsToUI } from './navigation/permissions-ui.js';
import { buildFloatRail, destroyFloatRail } from './navigation/float-rail.js';

export { exitUniversidade, uniOpenCurso, uniGoBack, uniPlayAula, uniStartProva, uniVerCertificado, uniOpenAdmin, uniOpenGamificacao };
export { applyPermissionsToUI } from './navigation/permissions-ui.js';
export { renderAll, switchGestaoTab } from './navigation/render-all.js';
export { setPeriodo, clearFilter, quickFilter } from './navigation/periodo.js';

let _animEnterT = null; // timer da cascata de entrada das seções

// Maps each child section to its parent group identifier
const GROUP_MAP = {
  overview:  'dashboard',
  bsc:       'dashboard',
  parceiros: 'dashboard',
  perfil:    'dashboard',
  gestao:    'gestao-grp',
  ranking:   'gestao-grp',
  propostas: 'comercial',
  goals:     'comercial',
  trafego:   'marketing',
  bms:       'marketing',
  conteudo:  'tarefas',
  quitacoes: 'financeiro',
  liberacao: 'financeiro',
  boletos:   'financeiro',
  residuos:  'financeiro',
};

const TITLES = {
  home:         'Home',
  import:       'Importar Dados',
  overview:     'Visão Geral',
  ranking:      'Ranking de Vendas',
  trafego:      'Tráfego (Ads)',
  perfil:       'Perfil de Cliente',
  gestao:       'Gestão de Classificações',
  quitacoes:    'Quitações',
  conteudo:     'Esteira de Conteúdo',
  bms:          'Central de BMs',
  propostas:    'Propostas de Marketing',
  goals:        'Configurar Metas',
  bsc:          'Ranking BSC',
  parceiros:    'Ranking Parceiros',
  liberacao:    'Liberação de Margem Master',
  boletos:      'Quitação de Boleto',
  residuos:     'Resíduos',
  universidade: 'Universidade Smart',
  'uni-admin':       'Criador de Cursos',
  'uni-gamificacao': 'Gamificação',
  admin:             'Administração',
};

// Entra/sai dos modos imersivos (Universidade e admin da Universidade)
function _sairDosModosImersivos(sec) {
  if (sec !== 'universidade') document.body.classList.remove('uni-mode');
  if (sec !== 'uni-admin' && sec !== 'uni-gamificacao') {
    document.body.classList.remove('uni-admin-mode');
    document.getElementById('uni-admin-ryc-return')?.remove();
  }
  if (sec === 'uni-admin' || sec === 'uni-gamificacao') {
    document.body.classList.add('uni-admin-mode');
    if (!document.getElementById('uni-admin-ryc-return')) {
      const btn = document.createElement('button');
      btn.id = 'uni-admin-ryc-return';
      btn.className = 'uni-ryc-return';
      btn.innerHTML = `<span class="uni-ryc-return-dot"></span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>Smart RYC`;
      btn.addEventListener('click', () => navigate('overview'));
      document.body.appendChild(btn);
    }
  }
}

// Filtro de data do header, seção lembrada e hash da URL
function _atualizarChromeDaSecao(sec) {
  // Oculta o filtro de data global na tela de Lib. Margem
  const dateFilter = document.querySelector('.date-filter');
  if (dateFilter) dateFilter.style.display = (sec === 'liberacao' || sec === 'boletos' || sec === 'residuos') ? 'none' : '';

  localStorage.setItem('sc_last_section', sec);
  // Atualiza o hash da URL sem recarregar — sobrevive ao F5
  if (!window.location.hash.includes('access_token')) {
    history.replaceState(null, '', '#' + sec);
  }
}

// Sidebar (grupo pai, item ativo), seção visível e título do topo
function _atualizarMenus(sec) {
  // Auto-abre o grupo pai se a seção for um item filho
  const parentGroup = GROUP_MAP[sec];
  if (parentGroup) {
    const groupEl = document.querySelector(`.nav-group[data-group="${parentGroup}"]`);
    if (groupEl) groupEl.classList.add('open');
  }

  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.sec === sec));
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `sec-${sec}`));
  document.getElementById('topbar-title').textContent = TITLES[sec] || '';
}

// Cascata de entrada: os cards da seção sobem em sequência ao entrar nela
function _animarEntrada(sec) {
  const secEl = document.getElementById(`sec-${sec}`);
  if (!secEl) return;
  secEl.classList.remove('anim-enter');
  void secEl.offsetWidth; // reinicia as animações CSS
  secEl.classList.add('anim-enter');
  clearTimeout(_animEnterT);
  _animEnterT = setTimeout(() => secEl.classList.remove('anim-enter'), 900);
}

// Float rail — itens standalone e grupos (ativo se algum filho for a atual)
function _atualizarFloatRail(sec) {
  document.querySelectorAll('.nav-float-item:not(.nav-float-group)').forEach(el =>
    el.classList.toggle('active', el.dataset.sec === sec)
  );
  document.querySelectorAll('.nav-float-item.nav-float-group').forEach(groupEl => {
    const children = groupEl.querySelectorAll('.nav-float-flyout-item[data-sec]');
    const hasActive = [...children].some(c => c.dataset.sec === sec);
    groupEl.classList.toggle('active', hasActive);
    children.forEach(c => c.classList.toggle('active', c.dataset.sec === sec));
  });
}

// Seções que renderizam sob demanda ao entrar
const RENDER_POR_SECAO = {
  admin:             renderAdminPage,
  home:              renderHome,
  trafego:           renderTrafego,
  quitacoes:         renderQuitacoes,
  conteudo:          renderConteudo,
  bms:               renderBMs,
  liberacao:         renderLiberacao,
  boletos:           renderBoletos,
  residuos:          renderResiduos,
  goals:             initGoalsPage,
  universidade:      renderUniversidade,
  'uni-admin':       renderUniAdmin,
  'uni-gamificacao': renderUniGamificacao,
};

export function navigate(sec) {
  _sairDosModosImersivos(sec);
  _atualizarChromeDaSecao(sec);
  _atualizarMenus(sec);
  _animarEntrada(sec);
  syncPeriodBars(); // barras de período refletem o state ao trocar de tela
  _atualizarFloatRail(sec);
  syncBottomNav(sec);
  // Scroll para o topo ao trocar de seção no mobile
  document.querySelector('.content')?.scrollTo({ top: 0 });
  RENDER_POR_SECAO[sec]?.();
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  localStorage.setItem('sc_sidebar_collapsed', isCollapsed ? '1' : '0');
  if (isCollapsed) { buildFloatRail(navigate); applyPermissionsToUI(); } else { destroyFloatRail(); }
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
    buildFloatRail(navigate);
  }

  // Swipe entre seções no mobile
  initSwipe(navigate);
}
