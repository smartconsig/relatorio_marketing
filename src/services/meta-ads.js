import { sb } from './supabase.js';
import { state } from '../state.js';

/**
 * Busca dados do Meta Ads via Edge Function e armazena em state.metaAds.
 * Retorna true se dados foram obtidos com sucesso, false caso contrário.
 * Sempre não-bloqueante: o chamador deve encadear .then() para re-renderizar.
 */
export async function syncMetaAds() {
  if (!state.currentUser) return false;

  const { start, end } = state.filterDates;
  const date_start = start
    ? (typeof start === 'string' ? start : start.toISOString().slice(0, 10))
    : null;
  const date_stop = end
    ? (typeof end === 'string' ? end : end.toISOString().slice(0, 10))
    : null;

  try {
    const { data, error } = await sb.functions.invoke('meta-ads', {
      body: { date_start, date_stop },
    });

    if (error || !data || data.error) {
      console.warn('[meta-ads] erro na sincronização:', error || data?.error);
      return false;
    }

    state.metaAds = {
      invest:   typeof data.invest === 'number' ? data.invest : 0,
      leads:    typeof data.leads  === 'number' ? data.leads  : 0,
      daily:    Array.isArray(data.daily) ? data.daily : [],
      lastSync: new Date().toISOString(),
    };

    return true;
  } catch (e) {
    console.warn('[meta-ads] falha silenciosa:', e);
    return false;
  }
}
