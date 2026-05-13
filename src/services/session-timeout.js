import { doSignOut } from './auth.js';

const TIMEOUT_MS = 2 * 60 * 60 * 1000;       // 2 horas
const WARN_MS    = (2 * 60 - 2) * 60 * 1000;  // 1h58 — aviso 2 min antes

let _warnTimer   = null;
let _logoutTimer = null;
let _lastReset   = 0;

function showWarning() {
  const el = document.getElementById('session-warning');
  if (el) el.classList.add('open');
}

function hideWarning() {
  const el = document.getElementById('session-warning');
  if (el) el.classList.remove('open');
}

function scheduleTimers() {
  clearTimeout(_warnTimer);
  clearTimeout(_logoutTimer);
  _warnTimer   = setTimeout(showWarning, WARN_MS);
  _logoutTimer = setTimeout(() => { hideWarning(); doSignOut(); }, TIMEOUT_MS);
}

/** Reseta o timer de inatividade. Throttled a 30s para não impactar performance. */
function onActivity() {
  const now = Date.now();
  if (now - _lastReset < 30_000) return;
  _lastReset = now;
  hideWarning();
  scheduleTimers();
}

/** Inicia o monitoramento de inatividade (chamar após login). */
export function startSessionTimeout() {
  _lastReset = Date.now();
  scheduleTimers();
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, onActivity, { passive: true })
  );
}

/** Para o monitoramento (chamar no logout). */
export function stopSessionTimeout() {
  clearTimeout(_warnTimer);
  clearTimeout(_logoutTimer);
  hideWarning();
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev =>
    document.removeEventListener(ev, onActivity)
  );
}

/** Botão "Continuar conectado" — reseta tudo. */
export function keepSession() {
  _lastReset = 0; // força reset imediato
  onActivity();
}
