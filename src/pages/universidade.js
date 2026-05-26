// ── Universidade Smart ────────────────────────────────────────────────────

const TRILHAS = [
  { icon: '📣', nome: 'Marketing Digital',      cor: '#E02020' },
  { icon: '💼', nome: 'Vendas & Consignado',     cor: '#e07020' },
  { icon: '📝', nome: 'Formalização',            cor: '#20a0e0' },
  { icon: '⚙️',  nome: 'Backoffice & Operações', cor: '#8020e0' },
  { icon: '👥', nome: 'RH & Cultura',            cor: '#20c060' },
  { icon: '🎯', nome: 'Liderança & Gestão',      cor: '#e0a020' },
  { icon: '🌱', nome: 'Desenvolvimento Pessoal', cor: '#20e080' },
];

const PILLARS = [
  { icon: '📚', title: 'Biblioteca de Cursos',   desc: 'Trilhas por setor com módulos e aulas sequenciais — só avança quem concluiu' },
  { icon: '▶️',  title: 'Player Rastreado',       desc: 'Vídeos via Bunny.net — 90% assistidos de verdade para concluir a aula' },
  { icon: '📜', title: 'Avaliação & Certificado', desc: 'Prova ao final, certificado PDF com QR Code válido para promoções' },
  { icon: '⭐', title: 'Gamificação & XP',        desc: 'Pontos, níveis, badges e prêmios por curso concluído' },
  { icon: '🏆', title: 'Ranking',                 desc: 'Ranking geral, por setor e mensal — integrado ao BSC' },
  { icon: '🛠️', title: 'Painel Administrativo',   desc: 'Gestão completa de cursos, provas e relatórios sem depender do dev' },
];

const XP_ITEMS = [
  { acao: 'Concluir uma aula',                  xp: '+10 XP' },
  { acao: 'Concluir um curso completo',          xp: '+100 XP' },
  { acao: 'Passar na prova na 1ª tentativa',     xp: '+50 XP' },
  { acao: 'Nota máxima na prova',                xp: '+30 XP' },
  { acao: 'Ler um livro da biblioteca',          xp: '+25 XP' },
  { acao: 'Primeiro curso do mês',               xp: '+20 XP' },
];

const STEPS = [
  { label: 'Fundação',             sub: 'Infraestrutura & Banco',   status: 'current' },
  { label: 'Cursos & Player',      sub: 'Aulas & rastreamento',     status: 'pending' },
  { label: 'Prova & Gamificação',  sub: 'Certificado & XP',         status: 'pending' },
  { label: 'Admin & Lançamento',   sub: '1º de Julho de 2026',      status: 'pending' },
];

let _rendered = false;

export function renderUniversidade() {
  const el = document.getElementById('sec-universidade');
  if (!el) return;
  if (_rendered) return;
  _rendered = true;

  const stepsHtml = STEPS.map((s, i) => `
    <div class="uni-step ${s.status}">
      <div class="uni-step-num">
        <span class="uni-step-dot"></span>SEMANA ${i + 1}
      </div>
      <div class="uni-step-label">${s.label}</div>
      <div class="uni-step-sub">${s.sub}</div>
    </div>
  `).join('');

  const trilhasHtml = TRILHAS.map(t => `
    <div class="uni-trilha-card">
      <div class="uni-trilha-icon">${t.icon}</div>
      <div class="uni-trilha-nome">${t.nome}</div>
      <span class="uni-trilha-pill" style="background:${t.cor}">${t.nome.split(' ')[0].toUpperCase()}</span>
    </div>
  `).join('');

  const pillarsHtml = PILLARS.map(p => `
    <div class="uni-pillar-card">
      <div class="uni-pillar-icon">${p.icon}</div>
      <div class="uni-pillar-title">${p.title}</div>
      <div class="uni-pillar-desc">${p.desc}</div>
    </div>
  `).join('');

  const xpHtml = XP_ITEMS.map(x => `
    <div class="uni-xp-item">
      <span class="uni-xp-val">${x.xp}</span>
      <span>${x.acao}</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="uni-hero">
      <div class="uni-hero-icon">🎓</div>
      <div class="uni-hero-title">Universidade <em>Smart</em></div>
      <div class="uni-hero-sub">Plataforma de Desenvolvimento Profissional — Smart Consig</div>
    </div>

    <div class="uni-status-banner">
      <span class="uni-status-badge">🔧 EM DESENVOLVIMENTO</span>
      <span>Lançamento previsto: <strong>1º de Julho de 2026</strong></span>
      <span style="color:var(--border)">|</span>
      <span>Semana atual: <strong style="color:var(--white)">Semana 1 — Fundação</strong></span>
    </div>

    <div class="uni-progress-wrap">
      <div class="uni-progress-title">Progresso do desenvolvimento</div>
      <div class="uni-steps">${stepsHtml}</div>
    </div>

    <div class="uni-section-header">
      <div class="uni-section-bar"></div>
      <div class="uni-section-label">7 Trilhas de Aprendizado</div>
    </div>
    <div class="uni-trilhas-grid">${trilhasHtml}</div>

    <div class="uni-section-header">
      <div class="uni-section-bar"></div>
      <div class="uni-section-label">6 Pilares da Plataforma</div>
    </div>
    <div class="uni-pillars-grid">${pillarsHtml}</div>

    <div class="uni-section-header">
      <div class="uni-section-bar"></div>
      <div class="uni-section-label">Sistema de XP — Ganhe pontos por aprender</div>
    </div>
    <div class="uni-xp-grid">${xpHtml}</div>
  `;
}
