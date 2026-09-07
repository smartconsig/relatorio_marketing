// Cards da Visão Geral: KPI, pipeline e hero (com animação de contagem).
import { state } from '../../state.js';
import { fmtBRL, fmtN, fmtPct } from '../../utils/currency.js';

export function pct(v, g) { return g ? (v / g) * 100 : null; }

export function kpiCard(label, val, meta, p, inv, goalLabel) {
  let cls = 'accent';
  if (p !== null && state.goals) {
    cls = inv
      ? (p <= 100 ? 'good' : p <= 120 ? 'warn' : 'bad')
      : (p >= 100 ? 'good' : p >= 70  ? 'warn' : 'bad');
  }
  const barW    = p !== null ? Math.min(Math.max(p, 0), 100).toFixed(1) : 0;
  const metaStr = p !== null
    ? (goalLabel ? `${goalLabel} · ` : '') + `${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}`
    : (meta || '—');
  const vStr    = String(val);
  const vStyle  = vStr.length > 14 ? ' style="font-size:15px"' : vStr.length > 11 ? ' style="font-size:20px"' : '';
  return `
    <div class="kpi-card ${p !== null ? cls : 'accent'}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"${vStyle}>${val}</div>
      <div class="kpi-meta">${metaStr}</div>
      ${p !== null ? `<div class="kpi-progress"><div class="kpi-bar ${cls}" style="width:${barW}%"></div></div>` : ''}
    </div>`;
}

export function pipelineCard(label, cls, count, value, sub) {
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

export function heroCard(label, count, value, sub, accentColor, p, inv, valueColor, goalLabel) {
  const cls = p === null ? '' : inv
    ? (p <= 100 ? 'good' : p <= 120 ? 'warn' : 'bad')
    : (p >= 100 ? 'good' : p >= 70  ? 'warn' : 'bad');
  const isNum = typeof value !== 'string';
  const countUp = isNum ? ` data-cv="${value}" data-k="${label}"` : '';
  return `
    <div class="hero-card">
      <div class="hero-label">${label}</div>
      ${count !== null ? `<div class="hero-count">${fmtN(count)}</div>` : ''}
      <div class="hero-value" style="color:${valueColor || accentColor}"${countUp}>${isNum ? fmtHeroBRL(value) : value}</div>
      <div class="hero-sub">${sub}</div>
      ${p !== null ? `
        <div class="kpi-progress" style="margin-top:14px"><div class="kpi-bar ${cls || 'accent'}" style="width:${Math.min(Math.max(p,0),100).toFixed(1)}%"></div></div>
        <div style="font-size:11px;color:var(--gray-light);margin-top:4px">${goalLabel ? goalLabel + ' · ' : ''}${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}</div>` : ''}
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
