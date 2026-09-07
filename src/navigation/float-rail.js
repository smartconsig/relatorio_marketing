// Float rail (menu flutuante quando a sidebar está recolhida).
// `navigate` é injetado por parâmetro (mesmo padrão do initSwipe) para não
// criar ciclo de import com o roteador.
import { FLOAT_NAV_ITEMS } from '../config/nav-items.js';

let _floatRail = null;

export function buildFloatRail(onNavigate) {
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
        childEl.addEventListener('click', e => { e.stopPropagation(); onNavigate(child.sec); });
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
      el.addEventListener('click', () => onNavigate(item.sec));
      _floatRail.appendChild(el);
    }
  });

  document.body.appendChild(_floatRail);
  syncFloatBadges();
}

export function destroyFloatRail() {
  if (_floatRail) { _floatRail.remove(); _floatRail = null; }
}

export function syncFloatBadges() {
  if (!_floatRail) return;
  // review badge
  const rb = document.getElementById('review-badge');
  const nfb = document.getElementById('nf-badge-gestao');
  if (rb && nfb) {
    const hidden = rb.classList.contains('hidden');
    nfb.style.display = hidden ? 'none' : '';
  }
}
