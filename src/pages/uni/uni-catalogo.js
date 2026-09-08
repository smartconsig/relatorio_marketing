// Catálogo da Universidade: Home (hero + fileiras por trilha), card de curso
// e "Meus Cursos". Os cliques usam os globais uniOpenCurso/uniGoBack.
import { UV, NIVEL_LABEL, NIVEL_CLASS, fmtDur, ICONS, svg, renderComingSoon } from './uni-core.js';

// ⚠ Duplica os nomes da tabela uni_trilhas de propósito (ordem/cores fixas da
// home); o filtro é por nome EXATO — renomear uma trilha no admin esconde os
// cursos dela da home (comportamento pré-existente).
const TRILHAS_CFG = [
  { nome: 'Vendas & Consignado',     cor: '#e07020' },
  { nome: 'Marketing Digital',       cor: '#E02020' },
  { nome: 'Liderança & Gestão',      cor: '#e0a020' },
  { nome: 'RH & Cultura',            cor: '#20c060' },
  { nome: 'Desenvolvimento Pessoal', cor: '#20e080' },
  { nome: 'Formalização',            cor: '#20a0e0' },
  { nome: 'Backoffice & Operações',  cor: '#8020e0' },
];

export function renderHome() {
  if (!UV.cursosDB.length) {
    return renderComingSoon('default', 'Nenhum curso disponível', 'Em breve novos cursos serão publicados aqui.', '');
  }

  const heroSrc        = UV.cursosDB.find(c => c.destaque) || UV.cursosDB[0];
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
    const cursos = UV.cursosDB.filter(c => c.uni_trilhas?.nome === trilha.nome);
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
        <div class="uni-cards-scroll">${cursos.map(c => buildCard(c)).join('')}</div>
      </div>
    `;
  }).join('');

  return heroHtml + `<div class="uni-rows">${rowsHtml}</div>`;
}

export function buildCard(c) {
  const img     = c.capa_url || c.img || '';
  const nivel   = c.nivel || 'basico';
  const aulas   = c.total_aulas || 0;
  const minutos = c.duracao_minutos || 0;
  const prog    = UV.progresso[c.id] || null;
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

// ── Meus Cursos ─────────────────────────────────────────────────────────────
export function renderMeusCursos() {
  const cursosComProgresso = UV.cursosDB.filter(c => UV.progresso[c.id]);

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

  const andamento = cursosComProgresso.filter(c => !UV.progresso[c.id]?.concluido);
  const concluidos = cursosComProgresso.filter(c => UV.progresso[c.id]?.concluido);

  const renderRow = (titulo, cursos) => {
    if (!cursos.length) return '';
    return `
      <div class="uni-row">
        <div class="uni-row-header">
          <div class="uni-row-title">${titulo}</div>
        </div>
        <div class="uni-cards-scroll">${cursos.map(c => buildCard(c)).join('')}</div>
      </div>
    `;
  };

  return `<div class="uni-rows">
    ${renderRow('Em andamento', andamento)}
    ${renderRow('Concluídos', concluidos)}
  </div>`;
}
