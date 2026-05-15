import { sb } from './supabase.js';
import { state } from '../state.js';

const ALL_PRODUCTS = ['Clt', 'Inss', 'PublicServant'];

/**
 * Busca os leads do sistema Smart via Edge Function.
 * @param {string[]} [products] - produtos a buscar (padrão: todos)
 * Salva em state.smartLeads e retorna true/false (falha silenciosa).
 */
export async function syncSmartData(products = ALL_PRODUCTS) {
  if (!state.currentUser) return false;

  const { start, end } = state.filterDates;
  const date_start = start || null;
  const date_end   = end   || null;

  try {
    const { data, error } = await sb.functions.invoke('smart-sync', {
      body: { date_start, date_end, products },
    });
    if (error || !data || data.error) {
      console.warn('[smart-sync] erro:', error || data?.error);
      return false;
    }
    state.smartLeads = data.leads || [];
    console.info(`[smart-sync] ${state.smartLeads.length} leads carregados (${products.join(', ')})`);
    return true;
  } catch (e) {
    console.warn('[smart-sync] falha silenciosa:', e);
    return false;
  }
}
