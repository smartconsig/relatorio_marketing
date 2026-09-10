// Cards da Visão Geral: KPI, pipeline e hero (com animação de contagem).
import { state } from '../../state.js';
import { fmtBRL, fmtN, fmtPct } from '../../utils/currency.js';

export function pct(v, g) { return g ? (v / g) * 100 : null; }

// good/warn/bad conforme a distância da meta (inv = quanto menor melhor)
function _clsMeta(p, inv) {
  return inv
    ? (p <= 100 ? 'good' : p <= 120 ? 'warn' : 'bad')
    : (p >= 100 ? 'good' : p >= 70  ? 'warn' : 'bad');
}

// Sub-linha do card: % da meta/limite quando tem meta; senão o texto fixo
function _metaStr(p, inv, goalLabel, meta) {
  if (p === null) return meta || '—';
  return (goalLabel ? `${goalLabel} · ` : '') + `${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}`;
}

// Valores longos encolhem a fonte para não estourar o card
function _vStyle(val) {
  const vStr = String(val);
  return vStr.length > 14 ? ' style="font-size:15px"' : vStr.length > 11 ? ' style="font-size:20px"' : '';
}

// Assinatura por objeto: kpiCard(label, val, { meta, p, inv, goalLabel })
export function kpiCard(label, val, { meta = null, p = null, inv = false, goalLabel = null } = {}) {
  const cls     = (p !== null && state.goals) ? _clsMeta(p, inv) : 'accent';
  const barW    = p !== null ? Math.min(Math.max(p, 0), 100).toFixed(1) : 0;
  const metaStr = _metaStr(p, inv, goalLabel, meta);
  const vStyle  = _vStyle(val);
  return `
    <div class="kpi-card ${p !== null ? cls : 'accent'}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"${vStyle}>${val}</div>
      <div class="kpi-meta">${metaStr}</div>
      ${p !== null ? `<div class="kpi-progress"><div class="kpi-bar ${cls}" style="width:${barW}%"></div></div>` : ''}
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

// Barra + linha "% da meta" do rodapé do hero (só quando há meta)
function _heroProgressoHTML(p, inv, cls, goalLabel) {
  if (p === null) return '';
  return `
        <div class="kpi-progress" style="margin-top:14px"><div class="kpi-bar ${cls || 'accent'}" style="width:${Math.min(Math.max(p,0),100).toFixed(1)}%"></div></div>
        <div style="font-size:11px;color:var(--gray-light);margin-top:4px">${goalLabel ? goalLabel + ' · ' : ''}${fmtPct(p)} ${inv ? 'do limite' : 'da meta'}</div>`;
}

// Assinatura por objeto: heroCard({ label, count, value, sub, accentColor, p, inv, valueColor, goalLabel })
export function heroCard({ label, count = null, value, sub, accentColor, p = null, inv = false, valueColor = null, goalLabel = null }) {
  const cls   = p === null ? '' : _clsMeta(p, inv);
  const isNum = typeof value !== 'string';
  const countUp = isNum ? ` data-cv="${value}" data-k="${label}"` : '';
  return `
    <div class="hero-card">
      <div class="hero-label">${label}</div>
      ${count !== null ? `<div class="hero-count">${fmtN(count)}</div>` : ''}
      <div class="hero-value" style="color:${valueColor || accentColor}"${countUp}>${isNum ? fmtHeroBRL(value) : value}</div>
      <div class="hero-sub">${sub}</div>
      ${_heroProgressoHTML(p, inv, cls, goalLabel)}
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
