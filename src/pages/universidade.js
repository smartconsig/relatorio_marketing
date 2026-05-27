// ── Universidade Smart ─────────────────────────────────────────────────────
// Plataforma de desenvolvimento profissional — layout streaming

import { sb } from '../services/supabase.js';

// ── Config ─────────────────────────────────────────────────────────────────
const BUNNY_LIB_ID = 670540;
// CDN usado para thumbnails: https://{BUNNY_CDN}/{videoId}/thumbnail.jpg
// const BUNNY_CDN = 'vz-1236dc06-5dd.b-cdn.net'; // reservado para Fase 2

// ── Demo data (fallback enquanto Ana Julia cadastra os cursos reais) ────────
const TRILHAS_CFG = [
  { nome: 'Vendas & Consignado',     cor: '#e07020' },
  { nome: 'Marketing Digital',       cor: '#E02020' },
  { nome: 'Liderança & Gestão',      cor: '#e0a020' },
  { nome: 'RH & Cultura',            cor: '#20c060' },
  { nome: 'Desenvolvimento Pessoal', cor: '#20e080' },
  { nome: 'Formalização',            cor: '#20a0e0' },
  { nome: 'Backoffice & Operações',  cor: '#8020e0' },
];

const DEMO_CURSOS = [
  {
    id: 'demo-vc-1',
    titulo: 'Fundamentos do Crédito Consignado',
    descricao: 'Entenda como funciona o crédito consignado, seus produtos, regras e regulamentação. O ponto de partida para qualquer vendedor da Smart Consig.',
    trilha: 'Vendas & Consignado', nivel: 'basico', aulas: 14, min: 200,
    img: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-vc-2',
    titulo: 'Técnicas de Abordagem e Captação',
    descricao: 'Domine as melhores estratégias para abordar, engajar e captar novos clientes no mercado consignado.',
    trilha: 'Vendas & Consignado', nivel: 'intermediario', aulas: 10, min: 145,
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face&q=80',
  },
  {
    id: 'demo-vc-3',
    titulo: 'Fechamento de Vendas de Alto Impacto',
    descricao: 'Estratégias avançadas de negociação, contorno de objeções e fechamento para maximizar sua taxa de conversão.',
    trilha: 'Vendas & Consignado', nivel: 'avancado', aulas: 8, min: 120,
    img: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-mkt-1',
    titulo: 'Marketing Digital do Zero',
    descricao: 'Aprenda os fundamentos do marketing digital: funil, persona, conteúdo e métricas para alavancar os resultados da Smart Consig.',
    trilha: 'Marketing Digital', nivel: 'basico', aulas: 18, min: 270,
    img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=600&fit=crop&q=80',
    destaque: true,
    hero_img: 'https://images.unsplash.com/photo-1552581234-26160f608093?w=1600&q=85',
  },
  {
    id: 'demo-mkt-2',
    titulo: 'Gestão de Tráfego Pago — Meta Ads',
    descricao: 'Crie e gerencie campanhas de alta performance no Facebook e Instagram com foco em leads qualificados.',
    trilha: 'Marketing Digital', nivel: 'intermediario', aulas: 22, min: 330,
    img: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-lider-1',
    titulo: 'Liderança de Alta Performance',
    descricao: 'Desenvolva as competências essenciais para liderar equipes com foco em resultado, engajamento e cultura de alta performance.',
    trilha: 'Liderança & Gestão', nivel: 'intermediario', aulas: 16, min: 240,
    img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=600&fit=crop&crop=face&q=80',
  },
  {
    id: 'demo-lider-2',
    titulo: 'Gestão de Metas e OKRs',
    descricao: 'Aprenda a definir, acompanhar e alcançar metas com clareza usando a metodologia OKR.',
    trilha: 'Liderança & Gestão', nivel: 'avancado', aulas: 10, min: 150,
    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-rh-1',
    titulo: 'Cultura Organizacional Smart',
    descricao: 'Conheça, fortaleça e viva os valores e a cultura da Smart Consig. Obrigatório para todos os colaboradores.',
    trilha: 'RH & Cultura', nivel: 'basico', aulas: 6, min: 90,
    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-dp-1',
    titulo: 'Mindset de Alta Performance',
    descricao: 'Construa a mentalidade necessária para superar limitações, manter foco e alcançar seus objetivos profissionais.',
    trilha: 'Desenvolvimento Pessoal', nivel: 'basico', aulas: 12, min: 180,
    img: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-dp-2',
    titulo: 'Comunicação e Oratória',
    descricao: 'Desenvolva sua comunicação verbal e não-verbal para se expressar com clareza e confiança em qualquer situação.',
    trilha: 'Desenvolvimento Pessoal', nivel: 'intermediario', aulas: 10, min: 140,
    img: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=600&fit=crop&crop=face&q=80',
  },
  {
    id: 'demo-form-1',
    titulo: 'Processo de Formalização Completo',
    descricao: 'Domine cada etapa do processo de formalização de contratos: documentação, sistemas, prazos e boas práticas.',
    trilha: 'Formalização', nivel: 'basico', aulas: 10, min: 150,
    img: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=400&h=600&fit=crop&q=80',
  },
  {
    id: 'demo-bk-1',
    titulo: 'Operações e Rotinas do Backoffice',
    descricao: 'Domine os sistemas, processos e rotinas operacionais da Smart Consig com eficiência e qualidade.',
    trilha: 'Backoffice & Operações', nivel: 'basico', aulas: 8, min: 120,
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=600&fit=crop&q=80',
  },
];

const DEMO_MODULOS = [
  {
    titulo: 'Módulo 1 — Introdução', aulas: [
      { titulo: 'Apresentação do curso e instrutor', dur: '8min' },
      { titulo: 'O que você vai aprender', dur: '10min' },
    ],
  },
  {
    titulo: 'Módulo 2 — Fundamentos', aulas: [
      { titulo: 'Conceitos essenciais', dur: '22min' },
      { titulo: 'Aplicando na prática', dur: '35min' },
      { titulo: 'Exercícios e fixação', dur: '18min' },
    ],
  },
  {
    titulo: 'Módulo 3 — Aplicação Avançada', aulas: [
      { titulo: 'Estratégias avançadas', dur: '28min' },
      { titulo: 'Casos reais da Smart Consig', dur: '40min' },
      { titulo: 'Desafio final', dur: '25min' },
    ],
  },
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
const isDemo = id => typeof id === 'string' && id.startsWith('demo-');

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
  // Remove o botão fixo de retorno do DOM (estava no shell)
  window.navigate('overview');
}

export function uniOpenCurso(id) {
  _showView('detail', id);
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
        .order('criado_em', { ascending: false }),
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
    // sem conexão — UI funciona com dados de demo
  }
}

// ── Shell (permanente, não re-renderiza) ───────────────────────────────────
function _buildShell() {
  const navItems = [
    { view: 'home',   tip: 'Início',      paths: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { view: 'cursos', tip: 'Meus Cursos', paths: ICONS.book },
    { view: 'ranking',tip: 'Ranking',     paths: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    { view: 'perfil', tip: 'Meu Perfil',  paths: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  ];

  return `
    <div class="uni-app">
      <aside class="uni-sidebar">
        <div class="uni-sidebar-logo">U<em>S</em></div>
        ${navItems.map(n => `
          <div class="uni-nav-btn" data-view="${n.view}" data-tip="${n.tip}">
            ${svg(n.paths, 20, 20)}
          </div>
        `).join('')}
      </aside>
      <div class="uni-main" id="uni-main"></div>
    </div>

    <!-- Botão fixo de retorno ao Smart RYC -->
    <button class="uni-ryc-return" onclick="exitUniversidade()">
      <span class="uni-ryc-return-dot"></span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Smart RYC
    </button>
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
    case 'home':    main.innerHTML = _renderHome(); break;
    case 'cursos':  main.innerHTML = _renderMeusCursos(); break;
    case 'ranking': main.innerHTML = _renderComingSoon('ranking', 'Ranking', 'Veja quem está acumulando mais XP na empresa', 'Semana 3'); break;
    case 'perfil':  main.innerHTML = _renderComingSoon('perfil',  'Meu Perfil', 'XP, nível, badges e certificados', 'Semana 3'); break;
    case 'detail':  _renderDetailAsync(main, data); break;
    case 'player':  _renderPlayerView(main, data); break;
  }
}

// ── Home ───────────────────────────────────────────────────────────────────
function _renderHome() {
  // Herói: primeiro curso DB destaque, ou demo destaque
  const heroReal = _cursosDB.find(c => c.destaque);
  const heroDemo = DEMO_CURSOS.find(c => c.destaque);
  const heroSrc  = heroReal || heroDemo;
  const heroIsDemo = !heroReal;
  const heroTrilha = heroIsDemo
    ? (TRILHAS_CFG.find(t => t.nome === heroSrc.trilha) || {})
    : { cor: heroSrc.uni_trilhas?.cor || '#E02020' };
  const heroCor  = heroTrilha.cor || '#E02020';
  const heroImg  = heroIsDemo ? (heroSrc.hero_img || heroSrc.img) : (heroSrc.hero_img || heroSrc.capa_url || heroSrc.img || '');
  const heroAulas = heroIsDemo ? heroSrc.aulas : (heroSrc.total_aulas || 0);
  const heroMin   = heroIsDemo ? heroSrc.min   : (heroSrc.duracao_minutos || 0);
  const heroTrilhaNome = heroIsDemo ? heroSrc.trilha : (heroSrc.uni_trilhas?.nome || '');

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
    const realCursos = _cursosDB.filter(c => c.uni_trilhas?.nome === trilha.nome);
    const demoCursos = DEMO_CURSOS.filter(c => c.trilha === trilha.nome);
    const cursos = realCursos.length ? realCursos : demoCursos;
    if (!cursos.length) return '';
    const useDemo = !realCursos.length;

    const cards = cursos.map(c => _buildCard(c, useDemo)).join('');

    return `
      <div class="uni-row">
        <div class="uni-row-header">
          <div class="uni-row-title">
            <span class="uni-row-dot" style="background:${trilha.cor}"></span>
            ${trilha.nome}
          </div>
          <span class="uni-row-see-all">Ver todos ›</span>
        </div>
        <div class="uni-cards-scroll">${cards}</div>
      </div>
    `;
  }).join('');

  return heroHtml + `<div class="uni-rows">${rowsHtml}</div>`;
}

function _buildCard(c, demo) {
  const img    = demo ? c.img : (c.capa_url || c.img || '');
  const nivel  = c.nivel || 'basico';
  const aulas  = demo ? c.aulas : (c.total_aulas || 0);
  const minutos = demo ? c.min : (c.duracao_minutos || 0);
  const prog   = !demo ? (_progresso[c.id] || null) : null;
  const pct    = prog?.pct_concluido ?? 0;
  const concl  = prog?.concluido ?? false;

  const progressBar = pct > 0 ? `
    <div class="uni-card-progress-bar">
      <div class="uni-card-progress-fill" style="width:${pct}%"></div>
    </div>
  ` : '';

  const badge = demo
    ? `<span class="uni-card-demo-badge">DEMO</span>`
    : (concl ? `<span class="uni-card-concluido-badge">${svg(ICONS.check, 9, 9)} Concluído</span>` : '');

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

  if (isDemo(courseId)) {
    // Demo course: usa dados locais
    const curso = DEMO_CURSOS.find(c => c.id === courseId);
    if (!curso) { main.innerHTML = _renderComingSoon('default', 'Curso não encontrado', '', ''); return; }
    _currentDetail = { curso: { ...curso, _demo: true }, modulos: DEMO_MODULOS, aulas: _flattenDemoAulas(DEMO_MODULOS) };
    main.innerHTML = _renderDetailHTML(_currentDetail);
  } else {
    // Real course: carrega do Supabase
    try {
      const [{ data: curso }, { data: modulos }, { data: aulas }] = await Promise.all([
        sb.from('uni_cursos').select('*, uni_trilhas(nome, cor)').eq('id', courseId).single(),
        sb.from('uni_modulos').select('*').eq('curso_id', courseId).order('ordem'),
        sb.from('uni_aulas').select('*').eq('curso_id', courseId).eq('ativo', true).order('ordem'),
      ]);

      if (!curso) { main.innerHTML = _renderComingSoon('default', 'Curso não encontrado', '', ''); return; }

      const modulosComAulas = (modulos || []).map(m => ({
        ...m,
        aulas: (aulas || []).filter(a => a.modulo_id === m.id),
      }));

      _currentDetail = {
        curso,
        modulos: modulosComAulas,
        aulas: aulas || [],
      };
      main.innerHTML = _renderDetailHTML(_currentDetail);
    } catch (_e) {
      main.innerHTML = _renderComingSoon('default', 'Erro ao carregar o curso', 'Tente novamente em instantes', '');
    }
  }

  main.scrollTo({ top: 0, behavior: 'instant' });
  _attachDetailListeners(main);
}

function _flattenDemoAulas(modulos) {
  let n = 0;
  return modulos.flatMap(m => m.aulas.map(a => ({ id: `demo-aula-${++n}`, titulo: a.titulo, bunny_video_id: null, duracao_segundos: null, _demo: true })));
}

function _renderDetailHTML({ curso, modulos, aulas }) {
  const demo     = curso._demo || false;
  const trilhaCor = demo
    ? (TRILHAS_CFG.find(t => t.nome === curso.trilha)?.cor || '#E02020')
    : (curso.uni_trilhas?.cor || '#E02020');
  const trilhaNome = demo ? curso.trilha : (curso.uni_trilhas?.nome || '');
  const img       = demo ? (curso.hero_img || curso.img) : (curso.hero_img || curso.capa_url || curso.img || '');
  const nivel     = curso.nivel || 'basico';
  const totalAulas = demo ? curso.aulas : (aulas.length || curso.total_aulas || 0);
  const totalMin   = demo ? curso.min   : (curso.duracao_minutos || 0);

  const prog      = !demo ? (_progresso[curso.id] || null) : null;
  const concluidas = !demo ? (aulas.filter(a => _progrAulas[a.id]).length) : 0;
  const pct        = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;

  // Barra de progresso geral do curso
  const progressBar = (!demo && totalAulas > 0) ? `
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

  // Primeiro aula incompleta (para botão Continuar)
  const primeiraAula = !demo
    ? (aulas.find(a => !_progrAulas[a.id]) || aulas[0])
    : null;

  const btnLabel = !demo && concluidas > 0 ? 'Continuar' : 'Começar curso';
  const btnOnClick = !demo && primeiraAula
    ? `uniPlayAula('${primeiraAula.id}')`
    : (demo ? `alert('Curso demo — em breve disponível')` : '');

  // Módulos e aulas
  let aulaNum = 0;
  const modulosHtml = modulos.map(m => {
    const mAulas = demo ? m.aulas : (m.aulas || []);
    return `
      <div class="uni-modulo-item">
        <div class="uni-modulo-header">
          <span>${m.titulo}</span>
          <span style="font-size:11px;color:#555;font-weight:400">${mAulas.length} aulas</span>
        </div>
        <div class="uni-modulo-aulas">
          ${mAulas.map(a => {
            aulaNum++;
            const aulaId     = demo ? `demo-aula-${aulaNum}` : a.id;
            const concluida  = !demo && _progrAulas[a.id];
            const temVideo   = !demo && !!a.bunny_video_id;
            const durSec     = !demo ? (a.duracao_segundos || 0) : 0;
            const durStr     = demo ? a.dur : (durSec ? fmtDur(Math.round(durSec / 60)) : '—');

            return `
              <div class="uni-aula-item ${concluida ? 'uni-aula-concluida' : ''} ${!demo ? 'uni-aula-clicavel' : ''}"
                   ${!demo ? `data-aula-id="${a.id}"` : ''}>
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
        ${demo ? `<span style="font-size:9px;color:#444;border:1px solid #282828;padding:2px 7px;border-radius:3px;font-family:var(--font-h);">DEMO</span>` : ''}
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
        <div class="uni-player-next uni-player-fim">
          ${svg(ICONS.check, 16, 16, 'style="color:#4ade80"')}
          <div>
            <div class="uni-player-next-label">Última aula do curso</div>
            <div class="uni-player-next-title">Volte ao início para rever o conteúdo</div>
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
        <div class="uni-cards-scroll">${cursos.map(c => _buildCard(c, false)).join('')}</div>
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
