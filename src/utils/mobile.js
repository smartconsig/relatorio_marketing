/**
 * Utilitários mobile: bottom sheet e swipe entre seções.
 * Tudo protegido por isMobile() — desktop não é afetado.
 */

export function isMobile() {
  return window.innerWidth <= 768;
}

// ── BOTTOM SHEET ────────────────────────────────────────
let _sheetCallback = null;

export function openBottomSheet({ title, sub, actions }) {
  const overlay = document.getElementById('mobile-sheet-overlay');
  const sheet   = document.getElementById('mobile-sheet');
  if (!overlay || !sheet) return;

  document.getElementById('ms-title').textContent = title || '';
  document.getElementById('ms-sub').textContent   = sub   || '';

  const actionsEl = document.getElementById('ms-actions');
  actionsEl.innerHTML = actions.map(a => `
    <button class="mobile-sheet-btn ${a.cls}" data-action="${a.id}">
      ${a.label}
    </button>
  `).join('');

  actionsEl.querySelectorAll('.mobile-sheet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = actions.find(a => a.id === btn.dataset.action);
      closeBottomSheet();
      if (action?.onClick) action.onClick();
    });
  });

  overlay.classList.add('open');
  sheet.classList.add('open');
}

export function closeBottomSheet() {
  document.getElementById('mobile-sheet-overlay')?.classList.remove('open');
  document.getElementById('mobile-sheet')?.classList.remove('open');
}

// ── SWIPE ENTRE SEÇÕES ──────────────────────────────────
// Ordem das seções no mobile (sem import, sem bsc)
const MOBILE_SECTIONS = ['overview', 'ranking', 'gestao', 'propostas', 'goals'];

export function initSwipe(navigateFn) {
  const content = document.querySelector('.content');
  if (!content) return;

  let startX = 0, startY = 0, moved = false;

  content.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved  = false;
  }, { passive: true });

  content.addEventListener('touchmove', e => {
    moved = true;
  }, { passive: true });

  content.addEventListener('touchend', e => {
    if (!moved || !isMobile()) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Só processa swipe horizontal (dx > dy em módulo)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const activeSection = document.querySelector('.section.active')?.id?.replace('sec-', '');
    const idx = MOBILE_SECTIONS.indexOf(activeSection);
    if (idx === -1) return;

    if (dx < 0 && idx < MOBILE_SECTIONS.length - 1) navigateFn(MOBILE_SECTIONS[idx + 1]);
    if (dx > 0 && idx > 0) navigateFn(MOBILE_SECTIONS[idx - 1]);
  }, { passive: true });
}

// ── SYNC BOTTOM NAV ─────────────────────────────────────
export function syncBottomNav(sec) {
  document.querySelectorAll('.mbn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sec === sec);
  });
}
