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

export function quickFilter(preset) {
  const today = new Date(); today.setHours(0,0,0,0);
  let start, end;
  switch (preset) {
    case 'today':
      start = end = _fmt(today); break;
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      start = end = _fmt(y); break;
    }
    case 'this-month':
      start = _fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      end   = _fmt(today); break;
    case 'last-month': {
      start = _fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      end   = _fmt(new Date(today.getFullYear(), today.getMonth(), 0)); break;
    }
    case '7d': { const s = new Date(today); s.setDate(s.getDate()-6);  start=_fmt(s); end=_fmt(today); break; }
    case '15d':{ const s = new Date(today); s.setDate(s.getDate()-14); start=_fmt(s); end=_fmt(today); break; }
    case '30d':{ const s = new Date(today); s.setDate(s.getDate()-29); start=_fmt(s); end=_fmt(today); break; }
    default: return;
  }
  setPeriodo(start, end);
}
