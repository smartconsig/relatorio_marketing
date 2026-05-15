import { sb } from './supabase.js';
import { state } from '../state.js';

const ALL_PRODUCTS   = ['Clt', 'Inss', 'PublicServant'];
const DEFAULT_PAGE_SIZE = 500;

/**
 * Busca os leads do sistema Smart via Edge Function.
 * @param {string[]} [products]  - produtos a buscar (padrão: todos)
 * @param {number}   [page_size] - registros por página (padrão: 500)
 * Salva em state.smartLeads e retorna true/false (falha silenciosa).
 */
export async function syncSmartData(products = ALL_PRODUCTS, page_size = DEFAULT_PAGE_SIZE) {
  if (!state.currentUser) return false;

  const { start, end } = state.filterDates;
  const date_start = start || null;
  const date_end   = end   || null;

  try {
    const { data, error } = await sb.functions.invoke('smart-sync', {
      body: { date_start, date_end, products, page_size },
    });
    if (error || !data || data.error) {
      console.warn('[smart-sync] erro:', error || data?.error);
      return false;
    }
    state.smartLeads = data.leads || [];
    console.info(`[smart-sync] ${state.smartLeads.length} leads carregados (${products.join(', ')}, pageSize=${page_size})`);
    return true;
  } catch (e) {
    console.warn('[smart-sync] falha silenciosa:', e);
    return false;
  }
}
