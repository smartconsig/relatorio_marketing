import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { fmtN } from '../utils/currency.js';

const STORE_RESULT = 'sc_result_v1';
const STORE_FILTER = 'sc_filter_v1';
const STORE_OVR    = 'sc_overrides_v1';

export function saveState() {
  if (!state.result) return;
  try {
    localStorage.setItem(STORE_RESULT, JSON.stringify({
      entries:         state.result.entries,
      facebook:        state.result.facebook,
      unknownStatuses: state.result.unknownStatuses,
      diag:            state.result.diag,
    }));
    localStorage.setItem(STORE_FILTER, JSON.stringify(state.filterDates));
    localStorage.setItem(STORE_OVR, JSON.stringify(state.overrides));
  } catch (e) {
    console.warn('saveState:', e);
    toast('Espaço insuficiente no navegador para salvar os dados', 'err');
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_RESULT);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    parsed.entries = parsed.entries.map(e => ({
      ...e,
      saleDate: e.saleDate ? new Date(e.saleDate) : null,
    }));
    state.result = parsed;
    const ov = localStorage.getItem(STORE_OVR);
    if (ov) state.overrides = JSON.parse(ov);
    const flt = localStorage.getItem(STORE_FILTER);
    if (flt) {
      state.filterDates = JSON.parse(flt);
      if (state.filterDates.start) document.getElementById('date-start').value = state.filterDates.start;
      if (state.filterDates.end)   document.getElementById('date-end').value   = state.filterDates.end;
    }
    return true;
  } catch (e) {
    console.warn('loadState:', e);
    return false;
  }
}

export function clearState() {
  [STORE_RESULT, STORE_FILTER, STORE_OVR].forEach(k => localStorage.removeItem(k));
  state.result = null;
  state.overrides = {};
  state.filterDates = { start: null, end: null };
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value   = '';
  ['fb03', 'fb06', 'smart', 'ecorban', 'overrides'].forEach(k => {
    state.raw[k] = null;
    const card = document.getElementById(`card-${k}`);
    if (card) card.classList.remove('loaded');
    const fn = document.getElementById(`fn-${k}`);
    if (fn) fn.textContent = '';
  });
  document.getElementById('diag-panel').style.display = 'none';
  document.getElementById('btn-process').disabled = true;
  document.getElementById('overview-body').innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Nenhum dado processado</div><div class="empty-desc">Importe os arquivos e processe os dados primeiro.</div></div>';
  document.getElementById('ranking-body').innerHTML  = '<div class="empty"><div class="empty-icon">🏆</div><div class="empty-title">Nenhum dado processado</div><div class="empty-desc">Importe os arquivos e processe os dados primeiro.</div></div>';
  document.getElementById('review-body').innerHTML   = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">Nenhum dado processado</div><div class="empty-desc">Importe os arquivos e processe os dados primeiro.</div></div>';
  document.getElementById('review-badge').classList.add('hidden');
  setCacheIndicator(false);
  toast('Dados removidos com sucesso');
}

export function setCacheIndicator(on) {
  const el = document.getElementById('cache-indicator');
  if (!el) return;
  if (on && state.result) {
    const n = state.result.entries.length;
    el.style.display = 'flex';
    el.querySelector('.ci-text').innerHTML =
      `⚡ <strong>${fmtN(n)} propostas</strong> carregadas da última sessão. Reimporte os arquivos para atualizar os dados.`;
  } else {
    el.style.display = 'none';
  }
}
