// ── Universidade Smart — orquestrador ──────────────────────────────────────
// Plataforma de desenvolvimento profissional — layout streaming.
// As features vivem em src/pages/uni/:
//   uni-core.js        estado compartilhado (UV) + helpers de UI
//   uni-catalogo.js    Home (hero + fileiras por trilha) e Meus Cursos
//   uni-detalhe.js     detalhe do curso (clique na aula via callback)
//   uni-player.js      player Bunny + tracking + progresso/XP
//   uni-prova.js       prova final + resultado
//   uni-certificado.js overlay do certificado
// Acesso a dados em services/uni-svc.js. Este arquivo mantém o shell, o
// roteador (_showView) e os 10 exports públicos originais.
import { can } from '../services/permissions.js';
import { renderUniAdmin } from './uni-admin.js';
import { renderUniGamificacao } from './uni-gamificacao.js';
import { getUser, fetchCatalogo, fetchProgresso } from '../services/uni-svc.js';
import { UV, ICONS, svg, renderComingSoon } from './uni/uni-core.js';
import { renderHome, renderMeusCursos } from './uni/uni-catalogo.js';
import { renderDetailAsync, onPlayAula } from './uni/uni-detalhe.js';
import { renderPlayerView } from './uni/uni-player.js';

export { uniStartProva } from './uni/uni-prova.js';
export { uniVerCertificado } from './uni/uni-certificado.js';

// ── Public API ─────────────────────────────────────────────────────────────
export async function renderUniversidade() {
  document.body.classList.add('uni-mode');
  const el = document.getElementById('sec-universidade');
  if (!el) return;

  if (!UV.initialized) {
    UV.initialized = true;
    el.innerHTML = _buildShell();
    _attachSidebarNav();
  }

  await _loadData();
  _showView('home');
}

export function exitUniversidade() {
  document.body.classList.remove('uni-mode');
  UV.initialized = false; // força rebuild do shell no próximo acesso
  window.navigate('overview');
}

export function resetUniversidade() {
  UV.initialized = false; // chamado no logout para limpar estado
}

export function uniOpenCurso(id) {
  _showView('detail', id);
}

export function uniOpenAdmin() {
  _showView('uni-admin');
}

export function uniOpenGamificacao() {
  _showView('uni-gamificacao');
}

export function uniGoBack() {
  if (UV.activeView === 'player') {
    _showView('detail', UV.currentDetail?.curso?.id);
  } else {
    _showView('home');
  }
}

export function uniPlayAula(aulaId) {
  if (!UV.currentDetail) return;
  const aula = UV.currentDetail.aulas.find(a => a.id === aulaId);
  if (!aula) return;
  _showView('player', { aula });
}

// clique numa aula do detalhe toca a aula (callback — sem ciclo de import)
onPlayAula(uniPlayAula);

// ── Data loading ────────────────────────────────────────────────────────────
async function _loadData() {
  try {
    const { data: { user } } = await getUser();
    UV.userId = user?.id || null;

    const [{ data: trilhas }, { data: cursos }] = await fetchCatalogo();

    UV.trilhasDB = trilhas || [];
    UV.cursosDB  = cursos  || [];

    if (UV.userId) {
      const [{ data: prog }, { data: progrAulas }] = await fetchProgresso(UV.userId);
      UV.progresso  = {};
      (prog || []).forEach(p => { UV.progresso[p.curso_id] = p; });
      UV.progrAulas = {};
      (progrAulas || []).forEach(p => { UV.progrAulas[p.aula_id] = true; });
    }
  } catch (_e) {
    // sem conexão — UI fica em branco até reconectar
  }
}

// ── Shell (permanente, não re-renderiza) ───────────────────────────────────
function _buildShell() {
  const mainNav = [
    { view: 'home',   tip: 'Início',      paths: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { view: 'cursos', tip: 'Meus Cursos', paths: ICONS.book },
    { view: 'ranking',tip: 'Ranking',     paths: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    { view: 'perfil', tip: 'Meu Perfil',  paths: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  ];

  const temAcessoRYC = can('visao_geral');
  const temCriador   = can('universidade_criador')     || can('admin_usuarios') || can('admin_grupos');
  const temGamif     = can('universidade_gamificacao') || can('admin_usuarios') || can('admin_grupos');

  return `
    <div class="uni-app">
      <aside class="uni-sidebar">
        <div class="uni-sidebar-logo">U<em>S</em></div>

        ${mainNav.map(n => `
          <div class="uni-nav-btn" data-view="${n.view}" data-tip="${n.tip}">
            ${svg(n.paths, 20, 20)}
          </div>
        `).join('')}

        ${temCriador || temGamif ? `<div class="uni-sidebar-divider"></div>` : ''}

        ${temCriador ? `
          <div class="uni-nav-btn" data-view="uni-admin" data-tip="Criador de Cursos" onclick="uniOpenAdmin()">
            ${svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', 20, 20)}
          </div>
        ` : ''}

        ${temGamif ? `
          <div class="uni-nav-btn" data-view="uni-gamificacao" data-tip="Gamificação" onclick="uniOpenGamificacao()">
            ${svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 20, 20)}
          </div>
        ` : ''}

        <div class="uni-sidebar-spacer"></div>

        <div class="uni-nav-btn uni-nav-logout" data-tip="Sair" onclick="doSignOut()">
          ${svg('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', 20, 20)}
        </div>
      </aside>
      <div class="uni-main" id="uni-main"></div>
    </div>

    ${temAcessoRYC ? `
      <button class="uni-ryc-return" onclick="exitUniversidade()">
        <span class="uni-ryc-return-dot"></span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Smart RYC
      </button>
    ` : ''}
  `;
}

function _attachSidebarNav() {
  document.querySelectorAll('.uni-nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => _showView(btn.dataset.view));
  });
}

// ── Router ─────────────────────────────────────────────────────────────────
function _showView(view, data = null) {
  UV.activeView = view;
  document.querySelectorAll('.uni-nav-btn[data-view]').forEach(btn => {
    const active = btn.dataset.view === view ||
                   (view === 'detail' && btn.dataset.view === 'home') ||
                   (view === 'player' && btn.dataset.view === 'home');
    btn.classList.toggle('active', active);
  });

  const main = document.getElementById('uni-main');
  if (!main) return;
  main.scrollTo({ top: 0, behavior: 'instant' });

  switch (view) {
    case 'home':           main.innerHTML = renderHome(); break;
    case 'cursos':         main.innerHTML = renderMeusCursos(); break;
    case 'ranking':        main.innerHTML = renderComingSoon('ranking', 'Ranking', 'Veja quem está acumulando mais XP na empresa', 'Semana 3'); break;
    case 'perfil':         main.innerHTML = renderComingSoon('perfil',  'Meu Perfil', 'XP, nível, badges e certificados', 'Semana 3'); break;
    case 'detail':         renderDetailAsync(main, data); break;
    case 'player':         renderPlayerView(main, data); break;
    case 'uni-admin':      renderUniAdmin(main); break;
    case 'uni-gamificacao':renderUniGamificacao(main); break;
  }
}
