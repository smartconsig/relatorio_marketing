// Filtro de período do sistema. setPeriodo() é a porta de entrada ÚNICA para
// mudar o período — toda origem (barras por tela, atalhos, restauração de
// F5/login) passa por aqui; nunca gravar state.filterDates diretamente.
import { state } from '../state.js';
import { saveState } from '../core/storage.js';
import { syncMetaAds } from '../services/meta-ads.js';
import { syncKolmeya } from '../services/kolmeya.js';
import { syncPeriodBars } from '../components/period-bar.js';
import { renderTrafego } from '../pages/trafego-page.js';
import { renderAll } from './render-all.js';

export function setPeriodo(start, end) {
  state.filterDates = { start: start || null, end: end || null };
  syncPeriodBars();
  if (state.result) {
    state.metaAds  = null; // limpa dados antigos para evitar período errado
    state.kolmeya  = null;
    renderAll();
    saveState();
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
    syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
  }
  renderTrafego(); // fora do if: a tela de Tráfego funciona mesmo sem import processado
}

export function clearFilter() {
  setPeriodo(null, null);
}

const _pad = n => String(n).padStart(2, '0');
const _fmt = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;

const _diasAtras = (today, n) => { const s = new Date(today); s.setDate(s.getDate() - n); return s; };

// Converte o atalho no par [start, end] (YYYY-MM-DD); null se desconhecido.
function _rangeDoPreset(preset, today) {
  switch (preset) {
    case 'today':      return [_fmt(today), _fmt(today)];
    case 'yesterday':  { const f = _fmt(_diasAtras(today, 1)); return [f, f]; }
    case 'this-month': return [_fmt(new Date(today.getFullYear(), today.getMonth(), 1)), _fmt(today)];
    case 'last-month': return [
      _fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      _fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
    ];
    case '7d':  return [_fmt(_diasAtras(today, 6)),  _fmt(today)];
    case '15d': return [_fmt(_diasAtras(today, 14)), _fmt(today)];
    case '30d': return [_fmt(_diasAtras(today, 29)), _fmt(today)];
    default: return null;
  }
}

export function quickFilter(preset) {
  const today = new Date(); today.setHours(0,0,0,0);
  const range = _rangeDoPreset(preset, today);
  if (!range) return;
  setPeriodo(range[0], range[1]);
}
