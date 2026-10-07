// Cards da Visão Geral: KPI, pipeline e hero (com animação de contagem).
import { fmtBRL, fmtN } from '../../utils/currency.js';

// Valores longos encolhem a fonte para não estourar o card
function _vStyle(val) {
  const vStr = String(val);
  return vStr.length > 14 ? ' style="font-size:15px"' : vStr.length > 11 ? ' style="font-size:20px"' : '';
}

// Assinatura por objeto: kpiCard(label, val, { meta }) — meta = texto da sub-linha
export function kpiCard(label, val, { meta = null } = {}) {
  return `
    <div class="kpi-card accent">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"${_vStyle(val)}>${val}</div>
      <div class="kpi-meta">${meta || '—'}</div>
    </div>`;
}

export function pipelineCard({ label, cls, count, value, sub }) {
  return `
    <div class="pipeline-card ${cls}">
      <div class="pipeline-label"><span class="pipeline-dot ${cls}"></span>${label}</div>
      <div class="pipeline-count">${fmtN(count)}</div>
      <div class="pipeline-value">${fmtBRL(value)}</div>
      <div class="pipeline-sub">${sub}</div>
    </div>`;
}

// "R$" discreto ao lado do número grande — o valor é o protagonista
export const fmtHeroBRL = v => fmtBRL(v).replace(/^R\$\s?/, '<span class="cur-sm">R$</span>');

// Assinatura por objeto: heroCard({ label, count, value, sub, accentColor, valueColor })
export function heroCard({ label, count = null, value, sub, accentColor, valueColor = null }) {
  const isNum = typeof value !== 'string';
  const countUp = isNum ? ` data-cv="${value}" data-k="${label}"` : '';
  return `
    <div class="hero-card">
      <div class="hero-label">${label}</div>
      ${count !== null ? `<div class="hero-count">${fmtN(count)}</div>` : ''}
      <div class="hero-value" style="color:${valueColor || accentColor}"${countUp}>${isNum ? fmtHeroBRL(value) : value}</div>
      <div class="hero-sub">${sub}</div>
    </div>`;
}

// Conta do valor anterior até o novo (só quando muda de verdade — clique de
// classificação com o mesmo total não re-anima). Desliga com reduced-motion.
const _lastHeroValues = {};
export function animateHeroValues() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('#overview-body .hero-value[data-cv]').forEach(el => {
    const key    = el.dataset.k;
    const target = parseFloat(el.dataset.cv) || 0;
    const from   = _lastHeroValues[key] ?? 0;
    _lastHeroValues[key] = target;
    if (from === target) return;
    const t0 = performance.now(), dur = 700;
    const step = now => {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      el.innerHTML = fmtHeroBRL(from + (target - from) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
