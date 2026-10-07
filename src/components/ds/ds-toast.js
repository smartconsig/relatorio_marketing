// Design system RYC — aviso rápido no rodapé da tela (some sozinho).
//   dsToast('Acerto salvo')
//   dsToast('Não foi possível salvar', { type: 'err', sub: 'Verifique a conexão e tente de novo.' })
// Na Fase 1 o toast() legado de utils/ui.js passa a usar este visual.
import { icon } from '../../utils/icons.js';
import { esc } from './ds-html.js';

const ICONE = { ok: 'check', err: 'alert', warn: 'alert' };
let _pilha = null;

function _getPilha() {
  if (_pilha && document.body.contains(_pilha)) return _pilha;
  _pilha = document.createElement('div');
  _pilha.className = 'ds-toasts';
  _pilha.setAttribute('role', 'status');
  _pilha.setAttribute('aria-live', 'polite');
  document.body.appendChild(_pilha);
  return _pilha;
}

export function dsToast(msg, { type = 'ok', sub = '', ms = 3200 } = {}) {
  const el = document.createElement('div');
  el.className = `ds-toast${type === 'ok' ? '' : ' ds-toast--' + type}`;
  el.innerHTML = `<div class="ds-toast__ic">${icon(ICONE[type] || 'check', 16)}</div>`
    + `<div class="ds-toast__msg"><b>${esc(msg)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const pilha = _getPilha();
  pilha.appendChild(el);
  while (pilha.children.length > 3) pilha.firstElementChild.remove();
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 220); }, type === 'err' ? ms + 1800 : ms);
}
