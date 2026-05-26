// ── Universidade Smart ────────────────────────────────────────────────────
// Plataforma de desenvolvimento profissional — layout streaming

// ── Dados de demo (substituir conforme Ana Julia cadastrar os cursos reais) ──
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
  // ── Vendas & Consignado ──────────────────────────────────────────────
  {
    id: 'demo-vc-1',
    titulo: 'Fundamentos do Crédito Consignado',
    descricao: 'Entenda como funciona o crédito consignado, seus produtos, regras e regulamentação. O ponto de partida para qualquer vendedor da Smart Consig.',
    trilha: 'Vendas & Consignado', nivel: 'basico', aulas: 14, min: 200,
    img: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=700&q=80',
  },
  {
    id: 'demo-vc-2',
    titulo: 'Técnicas de Abordagem e Captação',
    descricao: 'Domine as melhores estratégias para abordar, engajar e captar novos clientes no mercado consignado.',
    trilha: 'Vendas & Consignado', nivel: 'intermediario', aulas: 10, min: 145,
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80',
  },
  {
    id: 'demo-vc-3',
    titulo: 'Fechamento de Vendas de Alto Impacto',
    descricao: 'Estratégias avançadas de negociação, contorno de objeções e fechamento para maximizar sua taxa de conversão.',
    trilha: 'Vendas & Consignado', nivel: 'avancado', aulas: 8, min: 120,
    img: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=700&q=80',
  },
  // ── Marketing Digital ────────────────────────────────────────────────
  {
    id: 'demo-mkt-1',
    titulo: 'Marketing Digital do Zero',
    descricao: 'Aprenda os fundamentos do marketing digital: funil, persona, conteúdo e métricas para alavancar os resultados da Smart Consig.',
    trilha: 'Marketing Digital', nivel: 'basico', aulas: 18, min: 270,
    img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=700&q=80',
    destaque: true,
    hero_img: 'https://images.unsplash.com/photo-1552581234-26160f608093?w=1600&q=85',
  },
  {
    id: 'demo-mkt-2',
    titulo: 'Gestão de Tráfego Pago — Meta Ads',
    descricao: 'Crie e gerencie campanhas de alta performance no Facebook e Instagram com foco em leads qualificados.',
    trilha: 'Marketing Digital', nivel: 'intermediario', aulas: 22, min: 330,
    img: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=700&q=80',
  },
  // ── Liderança & Gestão ───────────────────────────────────────────────
  {
    id: 'demo-lider-1',
    titulo: 'Liderança de Alta Performance',
    descricao: 'Desenvolva as competências essenciais para liderar equipes com foco em resultado, engajamento e cultura de alta performance.',
    trilha: 'Liderança & Gestão', nivel: 'intermediario', aulas: 16, min: 240,
    img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&q=80',
  },
  {
    id: 'demo-lider-2',
    titulo: 'Gestão de Metas e OKRs',
    descricao: 'Aprenda a definir, acompanhar e alcançar metas com clareza usando a metodologia OKR.',
    trilha: 'Liderança & Gestão', nivel: 'avancado', aulas: 10, min: 150,
    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=700&q=80',
  },
  // ── RH & Cultura ─────────────────────────────────────────────────────
  {
    id: 'demo-rh-1',
    titulo: 'Cultura Organizacional Smart',
    descricao: 'Conheça, fortaleça e viva os valores e a cultura da Smart Consig. Obrigatório para todos os colaboradores.',
    trilha: 'RH & Cultura', nivel: 'basico', aulas: 6, min: 90,
    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=700&q=80',
  },
  // ── Desenvolvimento Pessoal ──────────────────────────────────────────
  {
    id: 'demo-dp-1',
    titulo: 'Mindset de Alta Performance',
    descricao: 'Construa a mentalidade necessária para superar limitações, manter foco e alcançar seus objetivos profissionais.',
    trilha: 'Desenvolvimento Pessoal', nivel: 'basico', aulas: 12, min: 180,
    img: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=700&q=80',
  },
  {
    id: 'demo-dp-2',
    titulo: 'Comunicação e Oratória',
    descricao: 'Desenvolva sua comunicação verbal e não-verbal para se expressar com clareza e confiança em qualquer situação.',
    trilha: 'Desenvolvimento Pessoal', nivel: 'intermediario', aulas: 10, min: 140,
    img: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&q=80',
  },
  // ── Formalização ─────────────────────────────────────────────────────
  {
    id: 'demo-form-1',
    titulo: 'Processo de Formalização Completo',
    descricao: 'Domine cada etapa do processo de formalização de contratos: documentação, sistemas, prazos e boas práticas.',
    trilha: 'Formalização', nivel: 'basico', aulas: 10, min: 150,
    img: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=700&q=80',
  },
  // ── Backoffice & Operações ───────────────────────────────────────────
  {
    id: 'demo-bk-1',
    titulo: 'Operações e Rotinas do Backoffice',
    descricao: 'Domine os sistemas, processos e rotinas operacionais da Smart Consig com eficiência e qualidade.',
    trilha: 'Backoffice & Operações', nivel: 'basico', aulas: 8, min: 120,
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=80',
  },
];

// ── State ──────────────────────────────────────────────────────────────────
let _initialized = false;

// ── Helpers ────────────────────────────────────────────────────────────────
const NIVEL_LABEL = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };
const NIVEL_CLASS = { basico: 'uni-nivel-basico', intermediario: 'uni-nivel-intermediario', avancado: 'uni-nivel-avancado' };
const fmtDur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;

// ── Entry point ────────────────────────────────────────────────────────────
export function renderUniversidade() {
  document.body.classList.add('uni-mode');
  const el = document.getElementById('sec-universidade');
  if (!el) return;

  if (!_initialized) {
    _initialized = true;
    el.innerHTML = _buildShell();
    _attachSidebarNav();
  }

  _showView('home');
}

export function exitUniversidade() {
  document.body.classList.remove('uni-mode');
  window.navigate('overview');
}

export function uniOpenCurso(id) {
  const curso = DEMO_CURSOS.find(c => c.id === id);
  _showView('detail', curso);
}

export function uniGoBack() {
  _showView('home');
}

// ── Shell (permanente, não re-renderiza) ───────────────────────────────────
function _buildShell() {
  const SVG = {
    home:    '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    cursos:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    ranking: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    perfil:  '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    back:    '<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>',
  };

  const navItems = [
    { view: 'home',    tip: 'Início',          svg: SVG.home    },
    { view: 'cursos',  tip: 'Meus Cursos',     svg: SVG.cursos  },
    { view: 'ranking', tip: 'Ranking',          svg: SVG.ranking },
    { view: 'perfil',  tip: 'Meu Perfil',      svg: SVG.perfil  },
  ];

  const navHtml = navItems.map(n => `
    <div class="uni-nav-btn" data-view="${n.view}" data-tip="${n.tip}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.svg}</svg>
    </div>
  `).join('');

  return `
    <div class="uni-app">
      <aside class="uni-sidebar">
        <div class="uni-sidebar-logo">U<em>S</em></div>
        ${navHtml}
        <div class="uni-sidebar-spacer"></div>
        <div class="uni-back-btn" data-tip="Voltar ao Smart RYC" onclick="exitUniversidade()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">${SVG.back}</svg>
        </div>
      </aside>
      <div class="uni-main" id="uni-main"></div>
    </div>
  `;
}

function _attachSidebarNav() {
  document.querySelectorAll('.uni-nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => _showView(btn.dataset.view));
  });
}

// ── Router ─────────────────────────────────────────────────────────────────
function _showView(view, data = null) {
  // Atualiza nav ativo
  document.querySelectorAll('.uni-nav-btn[data-view]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );

  const main = document.getElementById('uni-main');
  if (!main) return;
  main.scrollTo({ top: 0, behavior: 'instant' });

  switch (view) {
    case 'home':
      main.innerHTML = _renderHome();
      break;
    case 'cursos':
      main.innerHTML = _renderComingSoon('📚', 'Meus Cursos', 'Seus cursos em andamento e concluídos', 'Semana 2');
      break;
    case 'ranking':
      main.innerHTML = _renderComingSoon('🏆', 'Ranking', 'Veja quem está acumulando mais XP na empresa', 'Semana 3');
      break;
    case 'perfil':
      main.innerHTML = _renderComingSoon('👤', 'Meu Perfil', 'XP, nível, badges e certificados', 'Semana 3');
      break;
    case 'detail':
      main.innerHTML = data ? _renderDetail(data) : _renderComingSoon('❓', 'Curso não encontrado', '', '');
      break;
  }
}

// ── Home ───────────────────────────────────────────────────────────────────
function _renderHome() {
  const hero = DEMO_CURSOS.find(c => c.destaque) || DEMO_CURSOS[0];
  const trilhaCor = TRILHAS_CFG.find(t => t.nome === hero.trilha)?.cor || '#E02020';

  const heroHtml = `
    <div class="uni-hero" style="background-image:url('${hero.hero_img || hero.img}')">
      <div class="uni-hero-gradient"></div>
      <div class="uni-hero-content">
        <div class="uni-hero-eyebrow" style="color:${trilhaCor}">🎓 ${hero.trilha.toUpperCase()}</div>
        <h1 class="uni-hero-title">${hero.titulo}</h1>
        <p class="uni-hero-desc">${hero.descricao}</p>
        <div class="uni-hero-meta">
          <span class="uni-nivel-badge ${NIVEL_CLASS[hero.nivel]}">${NIVEL_LABEL[hero.nivel]}</span>
          <span class="uni-hero-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${fmtDur(hero.min)}
          </span>
          <span class="uni-hero-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            ${hero.aulas} aulas
          </span>
        </div>
        <div class="uni-hero-actions">
          <button class="uni-btn-primary" onclick="uniOpenCurso('${hero.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Começar
          </button>
          <button class="uni-btn-ghost" onclick="uniOpenCurso('${hero.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Mais informações
          </button>
        </div>
      </div>
    </div>
  `;

  const rowsHtml = TRILHAS_CFG.map(trilha => {
    const cursos = DEMO_CURSOS.filter(c => c.trilha === trilha.nome);
    if (!cursos.length) return '';

    const cards = cursos.map(c => `
      <div class="uni-card" onclick="uniOpenCurso('${c.id}')">
        <div class="uni-card-thumb" style="background-image:url('${c.img}')">
          <div class="uni-card-overlay">
            <div class="uni-card-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          <span class="uni-card-nivel uni-nivel-badge ${NIVEL_CLASS[c.nivel]}">${NIVEL_LABEL[c.nivel]}</span>
          <span class="uni-card-demo-badge">DEMO</span>
        </div>
        <div class="uni-card-info">
          <div class="uni-card-title">${c.titulo}</div>
          <div class="uni-card-meta">${c.aulas} aulas · ${fmtDur(c.min)}</div>
        </div>
      </div>
    `).join('');

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

// ── Detalhe do curso ───────────────────────────────────────────────────────
function _renderDetail(c) {
  const trilhaCor = TRILHAS_CFG.find(t => t.nome === c.trilha)?.cor || '#E02020';

  // Módulos de demo
  const modulos = [
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
      titulo: 'Módulo 3 — Avançado', aulas: [
        { titulo: 'Estratégias avançadas', dur: '28min' },
        { titulo: 'Casos reais da Smart Consig', dur: '40min' },
        { titulo: 'Desafio final', dur: '25min' },
      ],
    },
  ];

  let aulaNum = 0;
  const modulosHtml = modulos.map(m => `
    <div class="uni-modulo-item">
      <div class="uni-modulo-header">
        <span>${m.titulo}</span>
        <span style="font-size:11px;color:#555;font-weight:400">${m.aulas.length} aulas</span>
      </div>
      <div class="uni-modulo-aulas">
        ${m.aulas.map(a => {
          aulaNum++;
          return `
          <div class="uni-aula-item">
            <span class="uni-aula-num">${aulaNum}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
            <span>${a.titulo}</span>
            <span class="uni-aula-dur">${a.dur}</span>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div class="uni-detail-hero" style="background-image:url('${c.hero_img || c.img}')">
      <div class="uni-detail-gradient"></div>
      <button class="uni-detail-back" onclick="uniGoBack()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        Voltar
      </button>
    </div>
    <div class="uni-detail-content">
      <div class="uni-detail-meta">
        <span class="uni-nivel-badge ${NIVEL_CLASS[c.nivel]}">${NIVEL_LABEL[c.nivel]}</span>
        <span style="font-size:12px;color:#666;">${c.aulas} aulas</span>
        <span style="font-size:12px;color:#666;">·</span>
        <span style="font-size:12px;color:#666;">${fmtDur(c.min)}</span>
        <span style="font-size:11px;color:${trilhaCor};font-family:var(--font-h);font-weight:700;letter-spacing:0.5px;">${c.trilha.toUpperCase()}</span>
        <span style="font-size:9px;color:#444;border:1px solid #282828;padding:2px 7px;border-radius:3px;font-family:var(--font-h);">DEMO</span>
      </div>
      <div class="uni-detail-title">${c.titulo}</div>
      <p class="uni-detail-desc">${c.descricao}</p>
      <div class="uni-detail-actions">
        <button class="uni-btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Começar curso
        </button>
        <button class="uni-btn-ghost">+ Minha Lista</button>
      </div>
      <div class="uni-modulos-title">Conteúdo do curso</div>
      <div class="uni-modulos">${modulosHtml}</div>
    </div>
  `;
}

// ── Coming soon ────────────────────────────────────────────────────────────
function _renderComingSoon(icon, title, sub, semana) {
  return `
    <div class="uni-coming-soon">
      <div class="uni-coming-soon-icon">${icon}</div>
      <div class="uni-coming-soon-title">${title}</div>
      ${semana ? `<span class="uni-coming-soon-week">🔧 Disponível na ${semana}</span>` : ''}
      ${sub ? `<div class="uni-coming-soon-sub">${sub}</div>` : ''}
    </div>
  `;
}
