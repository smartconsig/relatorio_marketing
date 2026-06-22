// ── Universidade Smart ─────────────────────────────────────────────────────
// Plataforma de desenvolvimento profissional — layout streaming

import { sb } from '../services/supabase.js';
import { can } from '../services/permissions.js';
import { renderUniAdmin } from './uni-admin.js';
import { renderUniGamificacao } from './uni-gamificacao.js';

// ── Config ─────────────────────────────────────────────────────────────────
const BUNNY_LIB_ID = 670540;
// CDN usado para thumbnails: https://{BUNNY_CDN}/{videoId}/thumbnail.jpg
// const BUNNY_CDN = 'vz-1236dc06-5dd.b-cdn.net'; // reservado para Fase 2

// ── Config de trilhas ──────────────────────────────────────────────────────
const TRILHAS_CFG = [
  { nome: 'Vendas & Consignado',     cor: '#e07020' },
  { nome: 'Marketing Digital',       cor: '#E02020' },
  { nome: 'Liderança & Gestão',      cor: '#e0a020' },
  { nome: 'RH & Cultura',            cor: '#20c060' },
  { nome: 'Desenvolvimento Pessoal', cor: '#20e080' },
  { nome: 'Formalização',            cor: '#20a0e0' },
  { nome: 'Backoffice & Operações',  cor: '#8020e0' },
];

// ── State ──────────────────────────────────────────────────────────────────
let _initialized  = false;
let _trilhasDB    = [];
let _cursosDB     = [];
let _progresso    = {};   // curso_id  → uni_progresso_cursos row
let _progrAulas   = {};   // aula_id   → true
let _userId       = null;
let _activeView   = 'home';
let _currentDetail = null; // { curso, modulos, aulas } para nav player ↔ detail

// ── Helpers ────────────────────────────────────────────────────────────────
const NIVEL_LABEL = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };
const NIVEL_CLASS = { basico: 'uni-nivel-basico', intermediario: 'uni-nivel-intermediario', avancado: 'uni-nivel-avancado' };
const fmtDur = m => {
  if (!m) return '—';
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
};
// SVG icons reutilizáveis
const ICONS = {
  play:  '<polygon points="5 3 19 12 5 21 5 3"/>',
  back:  '<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  book:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  lock:  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  info:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  next:  '<path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>',
};
const svg = (paths, w = 14, h = 14, extra = '') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${extra}>${paths}</svg>`;

// ── Public API ─────────────────────────────────────────────────────────────
export async function renderUniversidade() {
  document.body.classList.add('uni-mode');
  const el = document.getElementById('sec-universidade');
  if (!el) return;

  if (!_initialized) {
    _initialized = true;
    el.innerHTML = _buildShell();
    _attachSidebarNav();
  }

  await _loadData();
  _showView('home');
}

export function exitUniversidade() {
  document.body.classList.remove('uni-mode');
  _initialized = false; // força rebuild do shell no próximo acesso
  window.navigate('overview');
}

export function resetUniversidade() {
  _initialized = false; // chamado no logout para limpar estado
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
  if (_activeView === 'player') {
    _showView('detail', _currentDetail?.curso?.id);
  } else {
    _showView('home');
  }
}

export function uniPlayAula(aulaId) {
  if (!_currentDetail) return;
  const aula = _currentDetail.aulas.find(a => a.id === aulaId);
  if (!aula) return;
  _showView('player', { aula });
}

// ── Data loading ────────────────────────────────────────────────────────────
async function _loadData() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    _userId = user?.id || null;

    const [{ data: trilhas }, { data: cursos }] = await Promise.all([
      sb.from('uni_trilhas').select('*').order('id'),
      sb.from('uni_cursos')
        .select('*, uni_trilhas(nome, cor)')
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
    ]);

    _trilhasDB = trilhas || [];
    _cursosDB  = cursos  || [];

    if (_userId) {
      const [{ data: prog }, { data: progrAulas }] = await Promise.all([
        sb.from('uni_progresso_cursos').select('*').eq('user_id', _userId),
        sb.from('uni_progresso_aulas').select('aula_id').eq('user_id', _userId),
      ]);
      _progresso  = {};
      (prog || []).forEach(p => { _progresso[p.curso_id] = p; });
      _progrAulas = {};
      (progrAulas || []).forEach(p => { _progrAulas[p.aula_id] = true; });
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
  _activeView = view;
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
    case 'home':           main.innerHTML = _renderHome(); break;
    case 'cursos':         main.innerHTML = _renderMeusCursos(); break;
    case 'ranking':        main.innerHTML = _renderComingSoon('ranking', 'Ranking', 'Veja quem está acumulando mais XP na empresa', 'Semana 3'); break;
    case 'perfil':         main.innerHTML = _renderComingSoon('perfil',  'Meu Perfil', 'XP, nível, badges e certificados', 'Semana 3'); break;
    case 'detail':         _renderDetailAsync(main, data); break;
    case 'player':         _renderPlayerView(main, data); break;
    case 'uni-admin':      renderUniAdmin(main); break;
    case 'uni-gamificacao':renderUniGamificacao(main); break;
  }
}

// ── Home ───────────────────────────────────────────────────────────────────
function _renderHome() {
  if (!_cursosDB.length) {
    return _renderComingSoon('default', 'Nenhum curso disponível', 'Em breve novos cursos serão publicados aqui.', '');
  }

  const heroSrc        = _cursosDB.find(c => c.destaque) || _cursosDB[0];
  const heroCor        = heroSrc.uni_trilhas?.cor || '#E02020';
  const heroImg        = heroSrc.hero_img || heroSrc.capa_url || '';
  const heroAulas      = heroSrc.total_aulas || 0;
  const heroMin        = heroSrc.duracao_minutos || 0;
  const heroTrilhaNome = heroSrc.uni_trilhas?.nome || '';

  const heroHtml = `
    <div class="uni-hero" style="background-image:url('${heroImg}')">
      <div class="uni-hero-gradient"></div>
      <div class="uni-hero-content">
        <div class="uni-hero-eyebrow" style="color:${heroCor}">${heroTrilhaNome.toUpperCase()}</div>
        <h1 class="uni-hero-title">${heroSrc.titulo}</h1>
        <p class="uni-hero-desc">${heroSrc.descricao}</p>
        <div class="uni-hero-meta">
          <span class="uni-nivel-badge ${NIVEL_CLASS[heroSrc.nivel] || ''}">${NIVEL_LABEL[heroSrc.nivel] || heroSrc.nivel}</span>
          ${heroAulas ? `<span class="uni-hero-meta-item">${svg(ICONS.book, 13, 13)} ${heroAulas} aulas</span>` : ''}
          ${heroMin   ? `<span class="uni-hero-meta-item">${svg(ICONS.clock, 13, 13)} ${fmtDur(heroMin)}</span>` : ''}
        </div>
        <div class="uni-hero-actions">
          <button class="uni-btn-primary" onclick="uniOpenCurso('${heroSrc.id}')">
            ${svg(ICONS.play, 15, 15, 'fill="currentColor"')} Começar
          </button>
          <button class="uni-btn-ghost" onclick="uniOpenCurso('${heroSrc.id}')">
            ${svg(ICONS.info, 15, 15)} Mais informações
          </button>
        </div>
      </div>
    </div>
  `;

  const rowsHtml = TRILHAS_CFG.map(trilha => {
    const cursos = _cursosDB.filter(c => c.uni_trilhas?.nome === trilha.nome);
    if (!cursos.length) return '';
    return `
      <div class="uni-row">
        <div class="uni-row-header">
          <div class="uni-row-title">
            <span class="uni-row-dot" style="background:${trilha.cor}"></span>
            ${trilha.nome}
          </div>
          <span class="uni-row-see-all">Ver todos ›</span>
        </div>
        <div class="uni-cards-scroll">${cursos.map(c => _buildCard(c)).join('')}</div>
      </div>
    `;
  }).join('');

  return heroHtml + `<div class="uni-rows">${rowsHtml}</div>`;
}

function _buildCard(c) {
  const img     = c.capa_url || c.img || '';
  const nivel   = c.nivel || 'basico';
  const aulas   = c.total_aulas || 0;
  const minutos = c.duracao_minutos || 0;
  const prog    = _progresso[c.id] || null;
  const pct     = prog?.pct_concluido ?? 0;
  const concl   = prog?.concluido ?? false;

  const progressBar = pct > 0 ? `
    <div class="uni-card-progress-bar">
      <div class="uni-card-progress-fill" style="width:${pct}%"></div>
    </div>
  ` : '';

  const badge = concl ? `<span class="uni-card-concluido-badge">${svg(ICONS.check, 9, 9)} Concluído</span>` : '';

  return `
    <div class="uni-card" onclick="uniOpenCurso('${c.id}')">
      <div class="uni-card-thumb" style="background-image:url('${img}')">
        <div class="uni-card-overlay">
          <div class="uni-card-play">
            ${svg(ICONS.play, 17, 17, 'fill="#111" stroke="none"')}
          </div>
        </div>
        <span class="uni-card-nivel uni-nivel-badge ${NIVEL_CLASS[nivel]}">${NIVEL_LABEL[nivel]}</span>
        ${badge}
        ${progressBar}
      </div>
      <div class="uni-card-info">
        <div class="uni-card-title">${c.titulo}</div>
        <div class="uni-card-meta">${aulas ? `${aulas} aulas` : ''}${aulas && minutos ? ' · ' : ''}${minutos ? fmtDur(minutos) : ''}</div>
      </div>
    </div>
  `;
}

// ── Detalhe do curso (async) ────────────────────────────────────────────────
async function _renderDetailAsync(main, courseId) {
  main.innerHTML = _spinnerHTML();

  try {
      const [{ data: curso }, { data: modulos }, { data: aulas }, { data: prova }] = await Promise.all([
        sb.from('uni_cursos').select('*, uni_trilhas(nome, cor)').eq('id', courseId).single(),
        sb.from('uni_modulos').select('*').eq('curso_id', courseId).order('ordem'),
        sb.from('uni_aulas').select('*').eq('curso_id', courseId).eq('ativo', true).order('ordem'),
        sb.from('uni_provas').select('*').eq('curso_id', courseId).maybeSingle(),
      ]);

      if (!curso) { main.innerHTML = _renderComingSoon('default', 'Curso não encontrado', '', ''); return; }

      const modulosComAulas = (modulos || []).map(m => ({
        ...m,
        aulas: (aulas || []).filter(a => a.modulo_id === m.id),
      }));

      let tentativas = [], certificado = null;
      if (prova && _userId) {
        const [{ data: t }, { data: c }] = await Promise.all([
          sb.from('uni_tentativas').select('*').eq('prova_id', prova.id).eq('user_id', _userId).order('criado_em', { ascending: false }),
          sb.from('uni_certificados').select('*').eq('user_id', _userId).eq('curso_id', courseId).maybeSingle(),
        ]);
        tentativas  = t || [];
        certificado = c || null;
      }

      _currentDetail = {
        curso,
        modulos: modulosComAulas,
        aulas: aulas || [],
        prova: prova || null,
        tentativas,
        certificado,
      };
      main.innerHTML = _renderDetailHTML(_currentDetail);
  } catch (_e) {
    main.innerHTML = _renderComingSoon('default', 'Erro ao carregar o curso', 'Tente novamente em instantes', '');
  }

  main.scrollTo({ top: 0, behavior: 'instant' });
  _attachDetailListeners(main);
}

function _renderDetailHTML({ curso, modulos, aulas, prova, tentativas, certificado }) {
  const trilhaCor  = curso.uni_trilhas?.cor || '#E02020';
  const trilhaNome = curso.uni_trilhas?.nome || '';
  const img        = curso.hero_img || curso.capa_url || curso.img || '';
  const nivel      = curso.nivel || 'basico';
  const totalAulas = aulas.length || curso.total_aulas || 0;
  const totalMin   = curso.duracao_minutos || 0;

  const concluidas = aulas.filter(a => _progrAulas[a.id]).length;
  const pct        = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;

  // Barra de progresso geral do curso
  const progressBar = totalAulas > 0 ? `
    <div class="uni-detail-progress">
      <div class="uni-detail-progress-label">
        <span>${concluidas} de ${totalAulas} aulas concluídas</span>
        <span style="color:${trilhaCor};font-weight:700">${pct}%</span>
      </div>
      <div class="uni-detail-progress-track">
        <div class="uni-detail-progress-fill" style="width:${pct}%;background:${trilhaCor}"></div>
      </div>
    </div>
  ` : '';

  // Primeira aula incompleta (para botão Continuar)
  const primeiraAula = aulas.find(a => !_progrAulas[a.id]) || aulas[0];

  const btnLabel   = concluidas > 0 ? 'Continuar' : 'Começar curso';
  const btnOnClick = primeiraAula ? `uniPlayAula('${primeiraAula.id}')` : '';

  // Módulos e aulas
  let aulaNum = 0;
  const modulosHtml = modulos.map(m => {
    const mAulas = m.aulas || [];
    return `
      <div class="uni-modulo-item">
        <div class="uni-modulo-header">
          <span>${m.titulo}</span>
          <span style="font-size:11px;color:#555;font-weight:400">${mAulas.length} aulas</span>
        </div>
        <div class="uni-modulo-aulas">
          ${mAulas.map(a => {
            aulaNum++;
            const concluida = !!_progrAulas[a.id];
            const temVideo  = !!a.bunny_video_id;
            const durSec    = a.duracao_segundos || 0;
            const durStr    = durSec ? fmtDur(Math.round(durSec / 60)) : '—';

            return `
              <div class="uni-aula-item ${concluida ? 'uni-aula-concluida' : ''} uni-aula-clicavel"
                   data-aula-id="${a.id}">
                <span class="uni-aula-num">${aulaNum}</span>
                ${concluida
                  ? svg(ICONS.check, 12, 12, 'class="uni-aula-check-icon"')
                  : (temVideo ? svg(ICONS.play, 12, 12, 'fill="currentColor" stroke="none" style="color:#555"') : svg(ICONS.lock, 12, 12, 'style="color:#444"'))
                }
                <span>${a.titulo}</span>
                <span class="uni-aula-dur">${durStr}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="uni-detail-hero" style="background-image:url('${img}')">
      <div class="uni-detail-gradient"></div>
      <button class="uni-detail-back" onclick="uniGoBack()">
        ${svg(ICONS.back, 14, 14)} Voltar
      </button>
    </div>
    <div class="uni-detail-content">
      <div class="uni-detail-meta">
        <span class="uni-nivel-badge ${NIVEL_CLASS[nivel]}">${NIVEL_LABEL[nivel]}</span>
        ${totalAulas ? `<span style="font-size:12px;color:#666;">${totalAulas} aulas</span><span style="color:#333">·</span>` : ''}
        ${totalMin   ? `<span style="font-size:12px;color:#666;">${fmtDur(totalMin)}</span><span style="color:#333">·</span>` : ''}
        <span style="font-size:11px;color:${trilhaCor};font-family:var(--font-h);font-weight:700;letter-spacing:0.5px;">${trilhaNome.toUpperCase()}</span>
      </div>
      <div class="uni-detail-title">${curso.titulo}</div>
      <p class="uni-detail-desc">${curso.descricao}</p>
      ${progressBar}
      <div class="uni-detail-actions">
        <button class="uni-btn-primary" onclick="${btnOnClick}">
          ${svg(ICONS.play, 15, 15, 'fill="currentColor" stroke="none"')} ${btnLabel}
        </button>
        <button class="uni-btn-ghost">+ Minha Lista</button>
      </div>
      ${prova ? _provaSection(prova, tentativas || [], certificado, concluidas, totalAulas, trilhaCor) : ''}
      <div class="uni-modulos-title">Conteúdo do curso</div>
      <div class="uni-modulos">${modulosHtml}</div>
    </div>
  `;
}

function _attachDetailListeners(main) {
  main.querySelectorAll('.uni-aula-clicavel').forEach(el => {
    el.addEventListener('click', () => {
      const aulaId = el.dataset.aulaId;
      if (aulaId) uniPlayAula(aulaId);
    });
  });
}

// ── Player de vídeo ─────────────────────────────────────────────────────────
function _renderPlayerView(main, { aula }) {
  if (!_currentDetail) return;
  const { curso, aulas } = _currentDetail;
  const idx      = aulas.findIndex(a => a.id === aula.id);
  const nextAula = aulas[idx + 1] || null;
  const concluida = !!_progrAulas[aula.id];

  const trilhaCor = curso.uni_trilhas?.cor || '#E02020';
  const durSec    = aula.duracao_segundos || 0;

  const iframeHtml = aula.bunny_video_id
    ? `<iframe
         id="bunny-player-iframe"
         class="uni-player-iframe"
         src="https://iframe.mediadelivery.net/embed/${BUNNY_LIB_ID}/${aula.bunny_video_id}?autoplay=true&responsive=true&captions=false&preload=true"
         frameborder="0"
         allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
         allowfullscreen>
       </iframe>`
    : `<div class="uni-player-no-video">
         ${svg(ICONS.clock, 48, 48, 'style="color:#333;margin-bottom:16px"')}
         <div style="font-family:var(--font-h);font-size:17px;color:#555;margin-bottom:8px">Vídeo em preparação</div>
         <div style="font-size:12px;color:#3a3a3a;font-family:var(--font-b)">O conteúdo desta aula será disponibilizado em breve.</div>
         ${!concluida ? `<button class="uni-btn-ghost" style="margin-top:24px" id="btn-marcar-concluida">
           ${svg(ICONS.check, 13, 13)} Marcar como lida
         </button>` : `<div style="margin-top:24px;color:#4ade80;font-size:13px;display:flex;align-items:center;gap:6px">${svg(ICONS.check, 14, 14, 'style="color:#4ade80"')} Aula concluída</div>`}
       </div>`;

  main.innerHTML = `
    <div class="uni-player-wrap">
      <div class="uni-player-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar
        </button>
        <div class="uni-player-course-info">
          <span class="uni-player-course-name" style="color:${trilhaCor}">${curso.titulo}</span>
        </div>
      </div>

      <div class="uni-player-stage">
        ${iframeHtml}
      </div>

      <div class="uni-player-info">
        <div class="uni-player-aula-header">
          <div>
            <div class="uni-player-aula-title">${aula.titulo}</div>
            ${durSec ? `<div class="uni-player-aula-meta">${svg(ICONS.clock, 11, 11)} ${fmtDur(Math.round(durSec / 60))}</div>` : ''}
          </div>
          <div id="uni-player-complete-badge" class="uni-player-complete-badge" style="display:${concluida ? 'flex' : 'none'}">
            ${svg(ICONS.check, 13, 13)} Concluída
          </div>
        </div>
        ${aula.bunny_video_id ? `
          <div class="uni-player-progress-track">
            <div class="uni-player-progress-fill" id="uni-player-progress-bar" style="width:${concluida ? '100' : '0'}%"></div>
          </div>
          <div class="uni-player-progress-label" id="uni-player-progress-label">
            ${concluida ? 'Aula já concluída' : 'Assista 90% para concluir'}
          </div>
        ` : ''}
      </div>

      ${nextAula ? `
        <div class="uni-player-next" id="uni-player-next" onclick="uniPlayAula('${nextAula.id}')"
             ${!concluida && aula.bunny_video_id ? 'style="opacity:.4;pointer-events:none"' : ''}>
          <div class="uni-player-next-label">Próxima aula</div>
          <div class="uni-player-next-title">${nextAula.titulo}</div>
          ${svg(ICONS.next, 16, 16)}
        </div>
      ` : `
        <div class="uni-player-next uni-player-fim" id="uni-player-fim-block">
          ${svg(ICONS.check, 16, 16, 'style="color:#4ade80"')}
          <div style="flex:1">
            <div class="uni-player-next-label">Última aula do curso</div>
            <div class="uni-player-next-title" id="uni-player-fim-sub">Parabéns! Você concluiu todas as aulas.</div>
          </div>
        </div>
      `}
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Botão "Marcar como lida" (para aulas sem vídeo)
  const btnMarcar = main.querySelector('#btn-marcar-concluida');
  if (btnMarcar) {
    btnMarcar.addEventListener('click', () => _markAulaComplete(aula.id, curso.id, aulas));
  }

  // Inicializa player Bunny.net se tiver vídeo
  if (aula.bunny_video_id && !concluida) {
    _initBunnyPlayer(aula.id, curso.id, aulas);
  }
}

// ── Bunny.net player tracking ───────────────────────────────────────────────
function _loadPlayerJs() {
  return new Promise(resolve => {
    if (window.playerjs) return resolve();
    const s = document.createElement('script');
    s.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
    s.onload = resolve;
    s.onerror = resolve; // falha silenciosa — fallback sem tracking
    document.head.appendChild(s);
  });
}

async function _initBunnyPlayer(aulaId, cursoId, aulas) {
  await _loadPlayerJs();

  const iframe = document.getElementById('bunny-player-iframe');
  if (!iframe || !window.playerjs) return;

  const player = new window.playerjs.Player(iframe);
  let maxPct = 0;

  player.on('ready', () => {
    player.on('timeupdate', ({ seconds, duration }) => {
      if (!duration) return;
      const pct = seconds / duration;
      if (pct > maxPct) maxPct = pct;

      // Atualiza barra de progresso
      const bar = document.getElementById('uni-player-progress-bar');
      if (bar) bar.style.width = `${Math.min(maxPct * 100, 100).toFixed(1)}%`;

      // Libera ao chegar em 90%
      if (maxPct >= 0.9 && !_progrAulas[aulaId]) {
        _markAulaComplete(aulaId, cursoId, aulas);
      }
    });

    player.on('ended', () => {
      if (!_progrAulas[aulaId]) {
        _markAulaComplete(aulaId, cursoId, aulas);
      }
    });
  });
}

async function _markAulaComplete(aulaId, cursoId, aulas) {
  if (_progrAulas[aulaId] || !_userId) return;
  _progrAulas[aulaId] = true;

  // UI imediata
  const badge = document.getElementById('uni-player-complete-badge');
  if (badge) { badge.style.display = 'flex'; }
  const bar = document.getElementById('uni-player-progress-bar');
  if (bar) { bar.style.width = '100%'; }
  const lbl = document.getElementById('uni-player-progress-label');
  if (lbl) { lbl.textContent = 'Aula concluída!'; lbl.style.color = '#4ade80'; }
  // Desbloqueia "próxima aula"
  const nxt = document.getElementById('uni-player-next');
  if (nxt) { nxt.style.opacity = '1'; nxt.style.pointerEvents = 'auto'; }

  // Toast
  _showToast(`+10 XP — Aula concluída!`);

  // Persiste no Supabase
  try {
    await sb.from('uni_progresso_aulas').upsert({
      user_id: _userId, aula_id: aulaId, curso_id: cursoId,
      pct_assistido: 100, concluida: true,
      concluida_em: new Date().toISOString(),
    }, { onConflict: 'user_id,aula_id' });

    await sb.from('uni_xp_log').insert({
      user_id: _userId, tipo: 'aula_concluida', referencia_id: aulaId, xp: 10,
    });

    // Atualiza progresso do curso
    const aulasConcl = aulas.filter(a => _progrAulas[a.id]).length;
    const totalAulas = aulas.length;
    const pct        = totalAulas > 0 ? Math.round((aulasConcl / totalAulas) * 100) : 0;
    const concluido  = aulasConcl >= totalAulas;

    await sb.from('uni_progresso_cursos').upsert({
      user_id: _userId, curso_id: cursoId,
      aulas_concluidas: aulasConcl, total_aulas: totalAulas,
      pct_concluido: pct, concluido,
      ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
    }, { onConflict: 'user_id,curso_id' });

    _progresso[cursoId] = { aulas_concluidas: aulasConcl, total_aulas: totalAulas, pct_concluido: pct, concluido };

    // XP extra: curso completo
    if (concluido) {
      await sb.from('uni_xp_log').insert({
        user_id: _userId, tipo: 'curso_concluido', referencia_id: cursoId, xp: 100,
      });
      _showToast(`+100 XP — Curso concluído! Parabéns!`, true);
    }
  } catch (_e) {
    // falha silenciosa — XP será recalculado na próxima carga
  }
}

// ── Prova ──────────────────────────────────────────────────────────────────

function _provaSection(prova, tentativas, certificado, concluidas, totalAulas, cor) {
  const todasConcluidas = totalAulas > 0 && concluidas >= totalAulas;
  const jaPassou        = tentativas.some(t => t.aprovado);
  const ultimaTentativa = tentativas[0] || null;
  const numTentativas   = tentativas.length;
  const podeRefazer     = !jaPassou && numTentativas < prova.max_tentativas;

  // Verificar cooldown (dias_para_retry)
  let emCooldown = false;
  if (!jaPassou && ultimaTentativa && prova.dias_para_retry > 0) {
    const diasPassados = (Date.now() - new Date(ultimaTentativa.criado_em).getTime()) / 86400000;
    if (diasPassados < prova.dias_para_retry) emCooldown = true;
  }

  if (jaPassou) {
    return `
      <div class="uni-prova-section uni-prova-aprovado">
        <div class="uni-prova-icon">🏆</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Prova concluída — Aprovado!</div>
          <div class="uni-prova-sub">Nota: ${ultimaTentativa?.nota ?? '—'}% · ${prova.tem_certificado ? 'Certificado disponível' : 'Parabéns!'}</div>
        </div>
        ${prova.tem_certificado && certificado ? `
          <button class="uni-btn-primary" style="background:#4ade80;color:#000;flex-shrink:0"
                  onclick="uniVerCertificado('${certificado.id}')">
            Ver certificado
          </button>
        ` : ''}
      </div>
    `;
  }

  if (!todasConcluidas) {
    return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">📝</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Prova disponível ao concluir o curso</div>
          <div class="uni-prova-sub">Complete todas as ${totalAulas} aulas para desbloquear a prova final.</div>
        </div>
      </div>
    `;
  }

  if (emCooldown) {
    const diasRestantes = Math.ceil(prova.dias_para_retry - (Date.now() - new Date(ultimaTentativa.criado_em).getTime()) / 86400000);
    return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">⏳</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Aguarde para tentar novamente</div>
          <div class="uni-prova-sub">Última nota: ${ultimaTentativa.nota}% · Nova tentativa em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
  }

  if (!podeRefazer && numTentativas >= prova.max_tentativas) {
    return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">❌</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Limite de tentativas atingido</div>
          <div class="uni-prova-sub">Você usou todas as ${prova.max_tentativas} tentativas. Entre em contato com seu gestor.</div>
        </div>
      </div>
    `;
  }

  const labelBtn = numTentativas === 0 ? 'Fazer prova final' : `Tentar novamente (${numTentativas}/${prova.max_tentativas})`;
  const subText  = numTentativas > 0
    ? `Última nota: ${ultimaTentativa.nota}% · Mínimo para passar: ${prova.nota_minima}%`
    : `Nota mínima: ${prova.nota_minima}% · ${prova.max_tentativas} tentativa${prova.max_tentativas !== 1 ? 's' : ''}`;

  return `
    <div class="uni-prova-section uni-prova-disponivel">
      <div class="uni-prova-icon">📝</div>
      <div class="uni-prova-info">
        <div class="uni-prova-titulo">Prova final disponível</div>
        <div class="uni-prova-sub">${subText}</div>
      </div>
      <button class="uni-btn-primary" style="flex-shrink:0" onclick="uniStartProva('${prova.id}')">
        ${svg(ICONS.play, 13, 13, 'fill="currentColor" stroke="none"')} ${labelBtn}
      </button>
    </div>
  `;
}

export async function uniStartProva(provaId) {
  const main = document.getElementById('uni-main');
  if (!main) return;
  main.innerHTML = _spinnerHTML();

  try {
    const [{ data: prova }, { data: questoes }] = await Promise.all([
      sb.from('uni_provas').select('*').eq('id', provaId).single(),
      sb.from('uni_questoes').select('*').eq('prova_id', provaId).order('ordem'),
    ]);

    if (!prova || !questoes?.length) {
      main.innerHTML = _renderComingSoon('default', 'Prova não encontrada', 'Esta prova ainda não possui questões cadastradas.', '');
      return;
    }

    _renderProvaView(main, prova, questoes);
  } catch (e) {
    main.innerHTML = _renderComingSoon('default', 'Erro ao carregar prova', 'Tente novamente em instantes.', '');
  }
}

function _renderProvaView(main, prova, questoes) {
  const letras = ['A', 'B', 'C', 'D'];

  main.innerHTML = `
    <div class="uni-prova-wrap">
      <div class="uni-prova-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar ao curso
        </button>
        <div class="uni-prova-topbar-title">Prova Final</div>
        <div style="width:120px"></div>
      </div>

      <div class="uni-prova-body">
        <div class="uni-prova-header">
          <div class="uni-prova-badge">📝 ${questoes.length} questões</div>
          <div class="uni-prova-nota-info">Nota mínima: <strong>${prova.nota_minima}%</strong></div>
        </div>

        <form id="uni-prova-form">
          ${questoes.map((q, qi) => `
            <div class="uni-questao-wrap" data-qi="${qi}">
              <div class="uni-questao-enunciado">
                <span class="uni-questao-num">${qi + 1}</span>
                ${q.enunciado}
              </div>
              <div class="uni-questao-alts">
                ${(Array.isArray(q.alternativas) ? q.alternativas : []).map((alt, ai) => `
                  <label class="uni-alt-label" data-qi="${qi}" data-ai="${ai}">
                    <input type="radio" name="q${qi}" value="${ai}" required>
                    <span class="uni-alt-letra">${letras[ai]}</span>
                    <span class="uni-alt-text">${alt}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}

          <div class="uni-prova-footer">
            <div class="uni-prova-footer-info">Responda todas as questões antes de enviar.</div>
            <button type="submit" class="uni-btn-primary uni-prova-submit" id="btn-enviar-prova">
              Enviar prova
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Highlight ao selecionar alternativa
  main.querySelectorAll('.uni-alt-label').forEach(lbl => {
    lbl.querySelector('input')?.addEventListener('change', () => {
      const qi = lbl.dataset.qi;
      main.querySelectorAll(`[data-qi="${qi}"]`).forEach(l => {
        if (l.classList.contains('uni-alt-label')) l.classList.remove('selecionada');
      });
      lbl.classList.add('selecionada');
    });
  });

  main.querySelector('#uni-prova-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = main.querySelector('#btn-enviar-prova');
    btn.disabled = true; btn.textContent = 'Corrigindo…';

    const respostas = questoes.map((_, qi) => {
      const sel = main.querySelector(`input[name="q${qi}"]:checked`);
      return sel ? parseInt(sel.value) : -1;
    });

    await _submitProva(main, prova, questoes, respostas);
  });
}

async function _submitProva(main, prova, questoes, respostas) {
  const acertos   = questoes.filter((q, i) => respostas[i] === q.correta).length;
  const nota      = Math.round((acertos / questoes.length) * 100);
  const aprovado  = nota >= prova.nota_minima;
  const primeiraT = !_userId ? false : !(await sb.from('uni_tentativas').select('id').eq('prova_id', prova.id).eq('user_id', _userId).limit(1)).data?.length;

  try {
    if (_userId) {
      await sb.from('uni_tentativas').insert({
        user_id: _userId, prova_id: prova.id,
        nota, aprovado, respostas,
      });

      if (aprovado) {
        // XP: aprovação
        const xpBase = primeiraT ? 50 : 0;
        const xpMax  = nota === 100 ? 30 : 0;

        if (xpBase > 0) await sb.from('uni_xp_log').insert({ user_id: _userId, tipo: 'prova_primeira_tentativa', referencia_id: prova.id, xp: xpBase });
        if (xpMax  > 0) await sb.from('uni_xp_log').insert({ user_id: _userId, tipo: 'prova_nota_maxima',        referencia_id: prova.id, xp: xpMax });

        // Certificado
        let certCodigo = null;
        let certId     = null;
        if (prova.tem_certificado && _currentDetail?.curso?.id) {
          const { data: cert } = await sb.from('uni_certificados')
            .upsert({ user_id: _userId, curso_id: _currentDetail.curso.id }, { onConflict: 'user_id,curso_id' })
            .select().single();
          certCodigo = cert?.codigo || null;
          certId     = cert?.id     || null;
        }

        _renderProvaResultado(main, { aprovado: true, nota, acertos, total: questoes.length, prova, primeiraT, xpBase, xpMax, certCodigo, certId });
      } else {
        _renderProvaResultado(main, { aprovado: false, nota, acertos, total: questoes.length, prova });
      }
    }
  } catch (err) {
    console.error(err);
    _renderProvaResultado(main, { aprovado, nota, acertos, total: questoes.length, prova, erro: true });
  }
}

function _renderProvaResultado(main, { aprovado, nota, acertos, total, prova, primeiraT, xpBase = 0, xpMax = 0, certCodigo, certId, erro }) {
  const xpTotal = xpBase + xpMax;

  main.innerHTML = `
    <div class="uni-prova-wrap">
      <div class="uni-prova-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar ao curso
        </button>
        <div class="uni-prova-topbar-title">Resultado da Prova</div>
        <div style="width:120px"></div>
      </div>

      <div class="uni-resultado-body">
        <div class="uni-resultado-card">
          <div class="uni-resultado-icon">${aprovado ? '🏆' : '📖'}</div>
          <div class="uni-resultado-status ${aprovado ? 'aprovado' : 'reprovado'}">
            ${aprovado ? 'Aprovado!' : 'Não aprovado'}
          </div>
          <div class="uni-resultado-nota">${nota}<span class="uni-resultado-pct">%</span></div>
          <div class="uni-resultado-detalhe">${acertos} de ${total} questões corretas</div>

          ${aprovado && xpTotal > 0 ? `
            <div class="uni-resultado-xp">
              ${xpBase > 0 ? `<span class="uni-xp-pill">+${xpBase} XP — Aprovado na prova</span>` : ''}
              ${xpMax  > 0 ? `<span class="uni-xp-pill">+${xpMax} XP — Nota máxima!</span>` : ''}
            </div>
          ` : ''}

          ${aprovado && certId ? `
            <div class="uni-resultado-cert">
              <div class="uni-resultado-cert-label">🎓 Certificado emitido!</div>
              <div class="uni-resultado-cert-code">Código: <strong>${certCodigo}</strong></div>
            </div>
            <button class="uni-btn-primary" style="width:100%;background:#4ade80;color:#000"
                    onclick="uniVerCertificado('${certId}')">
              🎓 Ver meu certificado
            </button>
          ` : ''}

          ${!aprovado ? `
            <div class="uni-resultado-dica">
              Mínimo para aprovação: <strong>${prova.nota_minima}%</strong><br>
              ${prova.dias_para_retry > 0 ? `Você poderá tentar novamente em <strong>${prova.dias_para_retry} dia${prova.dias_para_retry !== 1 ? 's' : ''}</strong>.` : 'Você pode tentar novamente a qualquer momento.'}
            </div>
          ` : ''}

          <button class="uni-btn-ghost" style="margin-top:8px;width:100%" onclick="uniGoBack()">
            Voltar ao curso
          </button>
        </div>
      </div>
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Abre o certificado automaticamente quando aprovada
  if (aprovado && certId) {
    setTimeout(() => uniVerCertificado(certId), 800);
  }
}

export async function uniVerCertificado(certId) {
  // Remove modal anterior se existir
  document.getElementById('uni-cert-modal')?.remove();

  // Cria overlay com spinner enquanto carrega
  const overlay = document.createElement('div');
  overlay.id = 'uni-cert-modal';
  overlay.className = 'uni-cert-overlay';
  overlay.innerHTML = `<div class="uni-cert-modal">${_spinnerHTML()}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const [{ data: cert }, { data: profile }] = await Promise.all([
      sb.from('uni_certificados')
        .select('*, uni_cursos(titulo, uni_trilhas(nome, cor))')
        .eq('id', certId).single(),
      sb.from('profiles').select('nome').eq('id', _userId).single(),
    ]);

    if (!cert) { overlay.remove(); _showToast('Certificado não encontrado'); return; }

    const nome       = profile?.nome || 'Colaborador';
    const curso      = cert.uni_cursos?.titulo || 'Curso';
    const trilha     = cert.uni_cursos?.uni_trilhas?.nome || '';
    const trilhaCor  = cert.uni_cursos?.uni_trilhas?.cor || '#E02020';
    const codigo     = cert.codigo;
    const emitidoEm  = new Date(cert.emitido_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const qrData     = encodeURIComponent(`Smart Consig - Universidade Smart\nCertificado: ${codigo}\nCurso: ${curso}\nNome: ${nome}`);
    const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}&bgcolor=ffffff&color=111111&margin=8`;

    overlay.querySelector('.uni-cert-modal').innerHTML = `
      <button class="uni-cert-close" onclick="document.getElementById('uni-cert-modal').remove()">✕</button>

      <div class="uni-cert-doc" id="uni-cert-print-area">
        <div class="uni-cert-top-stripe" style="background:${trilhaCor}"></div>

        <div class="uni-cert-header">
          <div class="uni-cert-logo-wrap">
            <div class="uni-cert-logo-us">U<em>S</em></div>
            <div class="uni-cert-logo-text">Universidade <strong>Smart</strong></div>
          </div>
          <div class="uni-cert-tipo-label">Certificado de Conclusão</div>
        </div>

        <div class="uni-cert-body">
          <div class="uni-cert-certifica-texto">Certificamos que</div>
          <div class="uni-cert-nome">${nome}</div>
          <div class="uni-cert-concluiu-texto">concluiu com êxito o curso</div>
          <div class="uni-cert-curso">${curso}</div>
          ${trilha ? `<div class="uni-cert-trilha" style="color:${trilhaCor}">${trilha.toUpperCase()}</div>` : ''}
          <div class="uni-cert-data">Emitido em ${emitidoEm}</div>
        </div>

        <div class="uni-cert-footer">
          <div class="uni-cert-assinatura">
            <div class="uni-cert-assinatura-linha"></div>
            <div class="uni-cert-assinatura-nome">Smart Consig</div>
            <div class="uni-cert-assinatura-cargo">Universidade Smart</div>
          </div>
          <div class="uni-cert-qr-wrap">
            <img class="uni-cert-qr-img" src="${qrUrl}" alt="QR Code de verificação" width="140" height="140">
            <div class="uni-cert-codigo-label">Código de verificação</div>
            <div class="uni-cert-codigo">${codigo}</div>
          </div>
        </div>

        <div class="uni-cert-bottom-stripe" style="background:${trilhaCor}"></div>
      </div>

      <div class="uni-cert-actions">
        <button class="uni-cert-btn-ghost" onclick="document.getElementById('uni-cert-modal').remove()">Fechar</button>
        <button class="uni-cert-btn-download" onclick="window.print()">
          ⬇ Baixar / Imprimir PDF
        </button>
      </div>
    `;
  } catch (e) {
    overlay.remove();
    _showToast('Erro ao carregar certificado. Tente novamente.');
  }
}

// ── Meus Cursos ─────────────────────────────────────────────────────────────
function _renderMeusCursos() {
  const cursosComProgresso = _cursosDB.filter(c => _progresso[c.id]);

  if (!cursosComProgresso.length) {
    return `
      <div class="uni-coming-soon">
        <div class="uni-coming-soon-icon">
          ${svg(ICONS.book, 52, 52, 'style="color:#333"')}
        </div>
        <div class="uni-coming-soon-title">Meus Cursos</div>
        <div class="uni-coming-soon-sub">Você ainda não iniciou nenhum curso.<br>Explore a Home e comece sua jornada.</div>
        <button class="uni-btn-primary" style="margin-top:20px" onclick="uniGoBack()">
          ${svg(ICONS.play, 14, 14, 'fill="currentColor" stroke="none"')} Explorar cursos
        </button>
      </div>
    `;
  }

  const andamento = cursosComProgresso.filter(c => !_progresso[c.id]?.concluido);
  const concluidos = cursosComProgresso.filter(c => _progresso[c.id]?.concluido);

  const renderRow = (titulo, cursos) => {
    if (!cursos.length) return '';
    return `
      <div class="uni-row">
        <div class="uni-row-header">
          <div class="uni-row-title">${titulo}</div>
        </div>
        <div class="uni-cards-scroll">${cursos.map(c => _buildCard(c)).join('')}</div>
      </div>
    `;
  };

  return `<div class="uni-rows">
    ${renderRow('Em andamento', andamento)}
    ${renderRow('Concluídos', concluidos)}
  </div>`;
}

// ── Coming soon ─────────────────────────────────────────────────────────────
const COMING_SOON_SVG = {
  cursos:  ICONS.book,
  ranking: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  perfil:  '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  default: ICONS.info,
};

function _renderComingSoon(svgKey, title, sub, semana) {
  return `
    <div class="uni-coming-soon">
      <div class="uni-coming-soon-icon">
        ${svg(COMING_SOON_SVG[svgKey] || COMING_SOON_SVG.default, 52, 52, 'style="color:#333"')}
      </div>
      <div class="uni-coming-soon-title">${title}</div>
      ${semana ? `<span class="uni-coming-soon-week">Em desenvolvimento — ${semana}</span>` : ''}
      ${sub ? `<div class="uni-coming-soon-sub">${sub}</div>` : ''}
    </div>
  `;
}

// ── Utils ──────────────────────────────────────────────────────────────────
function _spinnerHTML() {
  return `
    <div style="display:flex;align-items:center;justify-content:center;height:60vh">
      <div class="uni-spinner"></div>
    </div>
  `;
}

function _showToast(msg, big = false) {
  const existing = document.getElementById('uni-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'uni-toast';
  t.className = `uni-toast${big ? ' uni-toast-big' : ''}`;
  t.innerHTML = `${svg(ICONS.check, 14, 14, 'style="color:#4ade80;flex-shrink:0"')} ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.classList.add('uni-toast-show'); });
  setTimeout(() => { t.classList.remove('uni-toast-show'); setTimeout(() => t.remove(), 400); }, big ? 4000 : 2500);
}
