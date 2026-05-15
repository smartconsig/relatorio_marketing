import { sb } from './supabase.js';
import { state } from '../state.js';

const ALL_PRODUCTS      = ['Clt', 'Inss', 'PublicServant'];
const DEFAULT_PAGE_SIZE = 60;

/**
 * Busca uma página de leads do sistema Smart via Edge Function.
 * @param {object} opts
 * @param {string[]} [opts.products]  - produtos a buscar (padrão: todos)
 * @param {number}   [opts.page]      - página a buscar (padrão: 1)
 * @param {number}   [opts.page_size] - registros por página (padrão: 60)
 *
 * Retorna { leads, page, pageSize, totalPages, totalResults } ou null em caso de erro.
 */
export async function syncSmartData({ products = ALL_PRODUCTS, page = 1, page_size = DEFAULT_PAGE_SIZE } = {}) {
  if (!state.currentUser) return null;

  const { start, end } = state.filterDates;
  const date_start = start || null;
  const date_end   = end   || null;

  try {
    const { data, error } = await sb.functions.invoke('smart-sync', {
      body: { date_start, date_end, products, page, page_size },
    });
    if (error || !data || data.error) {
      console.warn('[smart-sync] erro:', error || data?.error);
      return null;
    }

    // Acumula leads se for página > 1, substitui se for página 1
    if (page === 1) {
      state.smartLeads = data.leads || [];
    } else {
      state.smartLeads = [...(state.smartLeads || []), ...(data.leads || [])];
    }

    console.info(`[smart-sync] p${data.page}/${data.totalPages} — ${state.smartLeads.length} leads acumulados`);
    return {
      page:         data.page,
      pageSize:     data.pageSize,
      totalPages:   data.totalPages,
      totalResults: data.totalResults,
    };
  } catch (e) {
    console.warn('[smart-sync] falha silenciosa:', e);
    return null;
  }
}
