// Núcleo da Universidade Smart: estado compartilhado (store UV) e helpers de
// UI usados por todas as views. Todos os módulos uni-* importam daqui.

// Objeto único mutável: os módulos leem/escrevem UV.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const UV = {
  initialized: false,
  trilhasDB: [],
  cursosDB: [],
  progresso: {},     // curso_id → uni_progresso_cursos row
  progrAulas: {},    // aula_id  → true
  userId: null,
  activeView: 'home',
  currentDetail: null, // { curso, modulos, aulas } para nav player ↔ detail
};

// ── Helpers ────────────────────────────────────────────────────────────────
export const NIVEL_LABEL = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };
export const NIVEL_CLASS = { basico: 'uni-nivel-basico', intermediario: 'uni-nivel-intermediario', avancado: 'uni-nivel-avancado' };
export const fmtDur = m => {
  if (!m) return '—';
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
};
// SVG icons reutilizáveis
export const ICONS = {
  play:  '<polygon points="5 3 19 12 5 21 5 3"/>',
  back:  '<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  book:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  lock:  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  info:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  next:  '<path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>',
};
export const svg = (paths, w = 14, h = 14, extra = '') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${extra}>${paths}</svg>`;

// ── Coming soon ─────────────────────────────────────────────────────────────
const COMING_SOON_SVG = {
  cursos:  ICONS.book,
  ranking: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  perfil:  '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  default: ICONS.info,
};

export function renderComingSoon(svgKey, title, sub, semana) {
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
export function spinnerHTML() {
  return `
    <div style="display:flex;align-items:center;justify-content:center;height:60vh">
      <div class="uni-spinner"></div>
    </div>
  `;
}

export function showToast(msg, big = false) {
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
