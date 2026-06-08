// ── Funil de Conversão Smart ──────────────────────────────────────────────
import { state } from '../state.js';
import { inRange } from '../utils/date.js';
import { normStr } from '../utils/string.js';

const ESTAGIOS = ['Novo Lead', 'Negociação', 'Venda', 'Pago', 'Desqualificado'];

/**
 * Retorna os smart leads filtrados pelo período atual.
 */
function _filteredLeads() {
  const leads = state.result?.smartLeads || [];
  const { start, end } = state.filterDates;
  return leads.filter(l => inRange(l.dataCriacao, start, end));
}

/**
 * Cria um objeto de contagem zerado por estágio.
 */
function _emptyEstagio() {
  const obj = { total: 0, emAndamento: 0, finalizado: 0 };
  return obj;
}

/**
 * Calcula o funil de um grupo de leads.
 * Retorna: { totalLeads, estagios: { [estagio]: { total, emAndamento, finalizado, pct } } }
 */
function _calcFunilGroup(leads) {
  const totalLeads = leads.length;
  const estagios  = {};

  for (const e of ESTAGIOS) {
    estagios[e] = _emptyEstagio();
  }

  for (const l of leads) {
    const est = l.estagio || 'Desconhecido';
    if (!estagios[est]) estagios[est] = _emptyEstagio();
    estagios[est].total++;
    if (l.andamento?.toLowerCase().includes('andamento')) {
      estagios[est].emAndamento++;
    } else {
      estagios[est].finalizado++;
    }
  }

  // Calcula % de cada estágio sobre o total de leads
  for (const key of Object.keys(estagios)) {
    estagios[key].pct = totalLeads > 0
      ? +((estagios[key].total / totalLeads) * 100).toFixed(1)
      : 0;
  }

  return { totalLeads, estagios };
}

/**
 * Retorna o funil agrupado por vendedor.
 * Também injeta a % de conversão = aprovadas (Ecorban) ÷ leads (Smart) × 100
 */
export function calcFunilByVendedor() {
  const leads   = _filteredLeads();
  const { start, end } = state.filterDates;

  // Agrupa leads por operador
  const byOp = {};
  for (const l of leads) {
    const key = l.operador || '—';
    if (!byOp[key]) byOp[key] = [];
    byOp[key].push(l);
  }

  // Aprovadas do Ecorban por vendedor no mesmo período
  const aprovadosByOp = {};
  for (const e of (state.result?.entries || [])) {
    if (!inRange(e.saleDate, start, end)) continue;
    if (e.statusCat !== 'aprovado' && e.statusCat !== 'quase pago' && e.statusCat !== 'pago') continue;
    const op = normStr(e.vendedor || '');
    aprovadosByOp[op] = (aprovadosByOp[op] || 0) + 1;
  }

  return Object.entries(byOp)
    .map(([operador, opLeads]) => {
      const funil     = _calcFunilGroup(opLeads);
      const aprovadas = aprovadosByOp[operador] || 0;
      const ativos    = (funil.estagios['Novo Lead']?.total || 0) + (funil.estagios['Negociação']?.total || 0);
      const convPct   = ativos > 0
        ? +((aprovadas / ativos) * 100).toFixed(1)
        : 0;
      return { operador, ...funil, aprovadas, convPct };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

/**
 * Retorna o funil agrupado por time.
 */
export function calcFunilByTime() {
  const leads   = _filteredLeads();
  const { start, end } = state.filterDates;

  const byTime = {};
  for (const l of leads) {
    const key = l.time || '—';
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(l);
  }

  const aprovadosByTime = {};
  for (const e of (state.result?.entries || [])) {
    if (!inRange(e.saleDate, start, end)) continue;
    if (e.statusCat !== 'aprovado' && e.statusCat !== 'quase pago' && e.statusCat !== 'pago') continue;
    const tm = normStr(e.loja || '');
    aprovadosByTime[tm] = (aprovadosByTime[tm] || 0) + 1;
  }

  return Object.entries(byTime)
    .map(([time, tmLeads]) => {
      const funil     = _calcFunilGroup(tmLeads);
      const aprovadas = aprovadosByTime[normStr(time)] || 0;
      const ativos    = (funil.estagios['Novo Lead']?.total || 0) + (funil.estagios['Negociação']?.total || 0);
      const convPct   = ativos > 0
        ? +((aprovadas / ativos) * 100).toFixed(1)
        : 0;
      return { operador: time, ...funil, aprovadas, convPct };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export { ESTAGIOS };
