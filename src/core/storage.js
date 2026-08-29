import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { fmtN } from '../utils/currency.js';
import { supportsGzip, gzipToBase64, gunzipFromBase64 } from '../utils/gzip.js';

const STORE_RESULT  = 'sc_result_v1';
const STORE_FILTER  = 'sc_filter_v1';
const STORE_OVR     = 'sc_overrides_v1';
const STORE_SNAP_TS = 'sc_snap_ts_v1';

// Cache antigo é JSON puro; o novo leva este prefixo (gzip + base64).
// A leitura precisa aceitar os dois formatos.
const GZ_PREFIX = 'gz1:';

let _saveSeq = 0;

export function saveState() {
  if (!state.result) return;
  // O stringify é síncrono de propósito: captura o estado deste exato instante,
  // mesmo que o chamador altere o state logo depois (ex.: flags temporárias do procv)
  const payload = JSON.stringify({
    entries:              state.result.entries.map(({ _justConfirmed, _confirmedInFilter, ...rest }) => rest),
    facebook:             state.result.facebook,
    unknownStatuses:      state.result.unknownStatuses,
    diag:                 state.result.diag,
    smartLeadsByOperador: state.result.smartLeadsByOperador || {},
    smartLeadsByTime:     state.result.smartLeadsByTime     || {},
    smartLeads:           state.result.smartLeads           || [],
    confirmedDivergences: state.confirmedDivergences,
    vendorMappings:       state.vendorMappings || {},
  });
  const seq = ++_saveSeq;
  writeResultBlob(payload, seq).catch(e => console.warn('saveState:', e));
  // Filtro e overrides são pequenos — salvos separadamente mesmo se o blob principal falhar
  try { localStorage.setItem(STORE_FILTER, JSON.stringify(state.filterDates)); } catch {}
  try { localStorage.setItem(STORE_OVR, JSON.stringify(state.overrides)); } catch {}
}

async function writeResultBlob(payload, seq) {
  let blob = payload;
  if (supportsGzip()) {
    try { blob = GZ_PREFIX + await gzipToBase64(payload); } catch (e) { console.warn('gzip do cache local falhou, salvando sem compressão:', e); }
  }
  if (seq !== _saveSeq) return; // um save mais novo já foi disparado — não sobrescrever com dado velho
  try {
    localStorage.setItem(STORE_RESULT, blob);
  } catch (e) {
    console.warn('saveState (primeira tentativa):', e);
    try {
      localStorage.removeItem(STORE_RESULT);
      localStorage.setItem(STORE_RESULT, blob);
    } catch (e2) {
      console.warn('saveState (retry):', e2);
      toast('Espaço insuficiente no navegador para salvar os dados', 'err');
    }
  }
}

export async function loadState() {
  try {
    let raw = localStorage.getItem(STORE_RESULT);
    if (!raw) return false;
    if (raw.startsWith(GZ_PREFIX)) raw = await gunzipFromBase64(raw.slice(GZ_PREFIX.length));
    const parsed = JSON.parse(raw);
    parsed.entries = parsed.entries.map(e => ({
      ...e,
      saleDate: e.saleDate ? new Date(e.saleDate) : null,
    }));
    if (parsed.smartLeads) {
      parsed.smartLeads = parsed.smartLeads.map(l => ({
        ...l,
        dataCriacao: l.dataCriacao ? new Date(l.dataCriacao) : null,
      }));
    }
    state.result = parsed;
    state.confirmedDivergences = parsed.confirmedDivergences || {};
    state.vendorMappings       = parsed.vendorMappings       || {};
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

export function saveSnapshotTimestamp(ts) {
  try { if (ts) localStorage.setItem(STORE_SNAP_TS, ts); } catch {}
}

export function loadSnapshotTimestamp() {
  return localStorage.getItem(STORE_SNAP_TS) || null;
}

export function clearState() {
  [STORE_RESULT, STORE_FILTER, STORE_OVR, STORE_SNAP_TS, 'sc_last_section'].forEach(k => localStorage.removeItem(k));
  state.result = null;
  state.overrides = {};
  state.confirmedDivergences = {};
  state.vendorMappings = {};
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
