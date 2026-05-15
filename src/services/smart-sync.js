import { sb } from './supabase.js';
import { state } from '../state.js';

/**
 * Busca os leads do sistema Smart via Edge Function.
 * Salva em state.smartLeads e retorna true/false (falha silenciosa).
 */
export async function syncSmartData() {
  if (!state.currentUser) return false;

  const { start, end } = state.filterDates;
  const date_start = start || null;
  const date_end   = end   || null;

  try {
    const { data, error } = await sb.functions.invoke('smart-sync', {
      body: { date_start, date_end },
    });
    if (error || !data || data.error) {
      console.warn('[smart-sync] erro:', error || data?.error);
      return false;
    }
    state.smartLeads = data.leads || [];
    console.info(`[smart-sync] ${state.smartLeads.length} leads carregados`);
    return true;
  } catch (e) {
    console.warn('[smart-sync] falha silenciosa:', e);
    return false;
  }
}
