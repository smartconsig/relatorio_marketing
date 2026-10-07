// Design system RYC — geradores de HTML (strings) para as telas montarem os
// templates no padrão novo. Só markup: nenhum acesso a banco nem a `state`.
// Visual de referência: design-system/vitrine.html e prototipo.html.
import { icon } from '../../utils/icons.js';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tons de status: neutral | info | warn | ok | bad | pur | brand
export const dsBadge = (label, tone = 'neutral') =>
  `<span class="ds-badge${tone === 'neutral' ? '' : ' ds-badge--' + tone}">${esc(label)}</span>`;

const DOT = {
  neutral: 'var(--ds-ink-3)', info: 'var(--ds-info-dot)', warn: 'var(--ds-warn-dot)', ok: 'var(--ds-ok-dot)',
  bad: 'var(--ds-bad-dot)', pur: 'var(--ds-pur-dot)', brand: 'var(--ds-brand)',
};

/**
 * Filtros de status. items: [{ value, label, count, tone?, alert? }]
 * O clique é tratado pela tela via delegação no atributo data-ds-chip.
 */
export function dsChips(items, active = '') {
  return '<div class="ds-chips">' + items.map(it => {
    const cls = ['ds-chip', it.value === active ? 'is-on' : '', it.alert ? 'ds-chip--alert' : ''].filter(Boolean).join(' ');
    const lead = it.alert ? icon('alert', 14) : (it.tone ? `<span class="ds-chip__dot" style="background:${DOT[it.tone]}"></span>` : '');
    return `<button type="button" class="${cls}" data-ds-chip="${esc(it.value)}">${lead}${esc(it.label)} <span class="ds-chip__n">${it.count ?? 0}</span></button>`;
  }).join('') + '</div>';
}

/** Linha do tempo das etapas. atual = índice da etapa em andamento (passos.length = tudo concluído). */
export function dsSteps(passos, atual) {
  return '<div class="ds-steps">' + passos.map((p, i) => {
    const estado = i < atual ? 'is-done' : (i === atual ? 'is-now' : '');
    const marca = i < atual ? icon('check', 12) : String(i + 1);
    const barra = i ? `<div class="ds-steps__bar${i <= atual ? ' is-done' : ''}"></div>` : '';
    return `${barra}<div class="ds-step ${estado}"><i>${marca}</i>${esc(p)}</div>`;
  }).join('') + '</div>';
}

export const dsKv = (label, valorHtml) => `<div class="ds-kv"><span>${esc(label)}</span><b>${valorHtml}</b></div>`;

export const dsWait = (texto = 'Aguardando Smart') => `<span class="ds-wait">${icon('clock', 14)}${esc(texto)}</span>`;

/**
 * Botão. opts: { label, icon?, variant?: 'primary'|'ghost'|'quiet'|'danger', size?: 'sm', attrs? }
 * attrs é HTML pronto (ex.: 'data-act="ok" data-id="12"') — montado pela tela, não pelo usuário.
 */
export function dsBtn({ label = '', icon: ic, variant, size, attrs = '', ariaLabel }) {
  const cls = ['ds-btn', variant ? 'ds-btn--' + variant : '', size ? 'ds-btn--' + size : '', !label ? 'ds-btn--icon' : ''].filter(Boolean).join(' ');
  const aria = ariaLabel ? ` aria-label="${esc(ariaLabel)}"` : '';
  return `<button type="button" class="${cls}"${aria} ${attrs}>${ic ? icon(ic, 16) : ''}${esc(label)}</button>`;
}

/**
 * Menu suspenso (Importar ▾ / Exportar ▾ / ⋯). items: [{ action, label, sub?, icon?, tag?, danger? } | { sep: true }]
 * Itens escolhidos disparam a tela via data-ds-action. Abrir/fechar: initDsMenus().
 */
export function dsMenu({ label = '', icon: ic, items, right = false, ariaLabel }) {
  if (!items.some(i => !i.sep)) return '';
  const botao = label
    ? `<button type="button" class="ds-btn" data-ds-menu-toggle>${ic ? icon(ic, 16) : ''}${esc(label)}${icon('chevron', 14)}</button>`
    : `<button type="button" class="ds-btn ds-btn--icon" data-ds-menu-toggle aria-label="${esc(ariaLabel || 'Mais opções')}">${icon(ic || 'dots', 16)}</button>`;
  return `<div class="ds-menu${right ? ' ds-menu--right' : ''}">${botao}<div class="ds-pop" role="menu">${items.map(_menuItem).join('')}</div></div>`;
}

function _menuItem(it) {
  if (it.sep) return '<div class="ds-pop__sep"></div>';
  const sub = it.sub ? `<small>${esc(it.sub)}</small>` : '';
  const tag = it.tag ? `<span class="ds-pop__tag">${esc(it.tag)}</span>` : '';
  return `<div class="ds-pop__it${it.danger ? ' ds-pop__it--danger' : ''}" role="menuitem" data-ds-action="${esc(it.action)}">`
    + `${it.icon ? icon(it.icon, 16) : ''}<div>${esc(it.label)}${sub}</div>${tag}</div>`;
}

/** Estado vazio ("Nenhum cliente neste filtro"). */
export const dsEmpty = ({ titulo, texto = '', acao = '' }) =>
  `<div class="ds-empty"><div class="ds-empty__ic">${icon('inbox', 24)}</div><h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ''}${acao}</div>`;
