// Design system RYC — janelas de formulário e de confirmação.
//   dsForm({ ... })    → Promise com os valores digitados, ou null se cancelou
//   dsConfirm({ ... }) → Promise<boolean>
// Campos obrigatórios são validados aqui (mensagem embaixo do campo); o botão
// só fecha a janela quando tudo está preenchido e o onSubmit (se houver) deu certo.
import { icon } from '../../utils/icons.js';
import { parseBRL } from '../../utils/currency.js';
import { esc } from './ds-html.js';

let _overlay = null;
let _fecharAtual = null;

function _getOverlay() {
  if (_overlay) return _overlay;
  _overlay = document.createElement('div');
  _overlay.className = 'ds-overlay';
  _overlay.addEventListener('mousedown', e => { if (e.target === _overlay && _fecharAtual) _fecharAtual(null); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _fecharAtual) _fecharAtual(null); });
  document.body.appendChild(_overlay);
  return _overlay;
}

// ── Campos ───────────────────────────────────────────────────────────────
const CONTROLE = {
  textarea: f => `<textarea class="ds-input" data-f="${f.id}" placeholder="${esc(f.placeholder)}">${esc(f.value)}</textarea>`,
  yesno:    f => `<div class="ds-yn" data-f="${f.id}" data-yn="${f.value === true ? 'sim' : f.value === false ? 'nao' : ''}">`
    + `<button type="button" data-v="sim"${f.value === true ? ' class="is-on"' : ''}>Sim</button>`
    + `<button type="button" data-v="nao"${f.value === false ? ' class="is-on"' : ''}>Não</button></div>`,
  date:     f => `<input type="date" class="ds-input" data-f="${f.id}" value="${esc(f.value)}">`,
  money:    f => `<input class="ds-input" data-f="${f.id}" inputmode="decimal" placeholder="${esc(f.placeholder || 'R$ 0,00')}" value="${esc(f.value)}">`,
};
const _controle = f => (CONTROLE[f.type] || (x => `<input class="ds-input" data-f="${x.id}" placeholder="${esc(x.placeholder)}" value="${esc(x.value)}">`))(f);

function _campoHtml(f) {
  const req = f.required ? '<span class="ds-req">*</span>' : '';
  const opc = !f.required && f.optionalLabel !== false ? ' <span class="ds-hint">(opcional)</span>' : '';
  const hint = f.hint ? `<span class="ds-hint">${esc(f.hint)}</span>` : '';
  return `<div class="ds-field"><label>${esc(f.label)}${req}${opc}</label>${_controle(f)}${hint}<span class="ds-err" data-err="${f.id}" hidden></span></div>`;
}

// Lê e converte o valor de um campo (money → número, yesno → boolean, resto → texto aparado)
function _ler(box, f) {
  const el = box.querySelector(`[data-f="${f.id}"]`);
  if (f.type === 'yesno') return el.dataset.yn ? el.dataset.yn === 'sim' : null;
  const bruto = el.value.trim();
  if (f.type === 'money') return bruto ? parseBRL(bruto) : null;
  return bruto || null;
}

function _erroDe(f, v) {
  if (f.required && (v === null || v === '')) return f.requiredMsg || (f.type === 'yesno' ? 'Escolha Sim ou Não.' : 'Preencha este campo.');
  if (f.type === 'money' && v !== null && f.min != null && v < f.min) return f.minMsg || 'Valor inválido.';
  return '';
}

function _mostrarErro(box, id, msg) {
  const err = box.querySelector(`[data-err="${id}"]`);
  err.textContent = msg;
  err.hidden = !msg;
  const ctl = box.querySelector(`[data-f="${id}"]`);
  if (ctl.classList.contains('ds-input')) ctl.classList.toggle('is-invalid', !!msg);
}

function _validar(box, fields) {
  const valores = {};
  let ok = true;
  for (const f of fields) {
    const v = _ler(box, f);
    const msg = _erroDe(f, v);
    _mostrarErro(box, f.id, msg);
    if (msg) ok = false;
    valores[f.id] = v;
  }
  return ok ? valores : null;
}

function _ligarCampos(box) {
  box.querySelectorAll('.ds-yn').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    g.dataset.yn = b.dataset.v;
    g.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
    _mostrarErro(box, g.dataset.f, '');
  }));
  box.querySelectorAll('.ds-input').forEach(i => i.addEventListener('input', () => _mostrarErro(box, i.dataset.f, '')));
}

// ── Janela genérica ─────────────────────────────────────────────────────
function _abrir({ eyebrow, title, sub, corpo, okLabel, cancelLabel = 'Cancelar', danger, wide }) {
  const ov = _getOverlay();
  ov.innerHTML = `<div class="ds-modal${wide ? ' ds-modal--wide' : ''}" role="dialog" aria-modal="true">`
    + `<div class="ds-modal__head"><div>${eyebrow ? `<div class="ds-modal__eyebrow">${esc(eyebrow)}</div>` : ''}`
    + `<h2 class="ds-modal__title">${esc(title)}</h2>${sub ? `<div class="ds-hint" style="margin-top:2px">${esc(sub)}</div>` : ''}</div>`
    + `<button type="button" class="ds-btn ds-btn--ghost ds-btn--icon" data-ds-close aria-label="Fechar">${icon('x', 16)}</button></div>`
    + `<div class="ds-modal__body">${corpo}</div>`
    + `<div class="ds-modal__foot"><span class="ds-err" data-ds-foot-err hidden></span>`
    + `<button type="button" class="ds-btn" data-ds-close>${esc(cancelLabel)}</button>`
    + `<button type="button" class="ds-btn ds-btn--primary${danger ? ' ds-btn--danger-fill' : ''}" data-ds-ok>${esc(okLabel)}</button></div></div>`;
  ov.classList.add('is-open');
  return ov.firstElementChild;
}

function _fechar() {
  _fecharAtual = null;
  if (_overlay) { _overlay.classList.remove('is-open'); _overlay.innerHTML = ''; }
}

async function _enviar(box, fields, onSubmit) {
  const valores = _validar(box, fields);
  if (!valores) return null;
  if (!onSubmit) return valores;
  const ok = box.querySelector('[data-ds-ok]');
  const footErr = box.querySelector('[data-ds-foot-err]');
  ok.disabled = true;
  footErr.hidden = true;
  try {
    const r = await onSubmit(valores);
    return r === false ? null : valores;
  } catch (e) {
    footErr.textContent = e?.message || 'Não foi possível salvar. Tente de novo.';
    footErr.hidden = false;
    return null;
  } finally {
    ok.disabled = false;
  }
}

/**
 * Formulário em janela. fields: [{ id, label, type?: 'text'|'money'|'date'|'textarea'|'yesno',
 *   required?, placeholder?, hint?, value?, min?, requiredMsg? }]
 * onSubmit(valores) opcional e pode ser async: se lançar erro, a mensagem aparece no rodapé
 * e a janela continua aberta (o usuário não perde o que digitou).
 */
export function dsForm({ fields = [], nota = '', onSubmit, ...janela }) {
  _fecharAtual?.(null);
  return new Promise(resolve => {
    const corpo = fields.map(_campoHtml).join('') + (nota ? `<div class="ds-hint">${esc(nota)}</div>` : '');
    const box = _abrir({ okLabel: 'Salvar', ...janela, corpo });
    _ligarCampos(box);
    _fecharAtual = v => { _fechar(); resolve(v); };
    box.querySelectorAll('[data-ds-close]').forEach(b => b.addEventListener('click', () => _fecharAtual(null)));
    box.querySelector('[data-ds-ok]').addEventListener('click', async () => {
      const v = await _enviar(box, fields, onSubmit);
      if (v) _fecharAtual(v);
    });
    setTimeout(() => box.querySelector('.ds-input, .ds-yn button')?.focus(), 30);
  });
}

/** Confirmação ("Tem certeza?"). danger = ação destrutiva (botão vermelho). */
export function dsConfirm({ title, desc = '', okLabel = 'Confirmar', danger = false, eyebrow }) {
  _fecharAtual?.(null);
  return new Promise(resolve => {
    const box = _abrir({ eyebrow, title, okLabel, danger, corpo: desc ? `<p class="ds-muted" style="margin:0">${esc(desc)}</p>` : '' });
    _fecharAtual = v => { _fechar(); resolve(!!v); };
    box.querySelectorAll('[data-ds-close]').forEach(b => b.addEventListener('click', () => _fecharAtual(false)));
    box.querySelector('[data-ds-ok]').addEventListener('click', () => _fecharAtual(true));
    setTimeout(() => box.querySelector('[data-ds-ok]').focus(), 30);
  });
}

// Usado pelo relatório de importação, que monta o próprio corpo.
export const _dsJanela = { abrir: _abrir, fechar: _fechar, setFechar: fn => { _fecharAtual = fn; } };
