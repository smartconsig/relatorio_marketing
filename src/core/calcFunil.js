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

/** Agrupa leads pela chave extraída (vazio vira '—'). */
function _agruparPor(leads, chaveDe) {
  const grupos = {};
  for (const l of leads) {
    const key = chaveDe(l) || '—';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(l);
  }
  return grupos;
}

/** Conta aprovadas/quase pagas/pagas de marketing no período, por chave. */
function _contarAprovadasPor(chaveDe) {
  const { start, end } = state.filterDates;
  const porChave = {};
  for (const e of (state.result?.entries || [])) {
    if (!inRange(e.saleDate, start, end)) continue;
    if (e.statusCat !== 'aprovado' && e.statusCat !== 'quase pago' && e.statusCat !== 'pago') continue;
    if (!e.isMarketing) continue;
    const k = chaveDe(e);
    porChave[k] = (porChave[k] || 0) + 1;
  }
  return porChave;
}

/** Monta a linha do funil de um grupo, com % de conversão sobre os ativos. */
function _linhaFunil(operador, grupoLeads, aprovadas) {
  const funil   = _calcFunilGroup(grupoLeads);
  const ativos  = (funil.estagios['Novo Lead']?.total || 0) + (funil.estagios['Negociação']?.total || 0);
  const convPct = ativos > 0
    ? +((aprovadas / ativos) * 100).toFixed(1)
    : 0;
  return { operador, ...funil, aprovadas, convPct };
}

/**
 * Retorna o funil agrupado por vendedor.
 * Também injeta a % de conversão = aprovadas (Ecorban) ÷ leads (Smart) × 100
 */
export function calcFunilByVendedor() {
  const byOp = _agruparPor(_filteredLeads(), l => l.operador);
  // Chave BRUTA do lead vs chave normStr do Ecorban — igual ao original:
  // só casa quando o nome do operador já vem normalizado do Smart.
  const aprovadosByOp = _contarAprovadasPor(e => normStr(e.vendedor || ''));

  return Object.entries(byOp)
    .map(([operador, opLeads]) => _linhaFunil(operador, opLeads, aprovadosByOp[operador] || 0))
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

/**
 * Retorna o funil agrupado por time.
 */
export function calcFunilByTime() {
  const byTime = _agruparPor(_filteredLeads(), l => l.time);
  const aprovadosByTime = _contarAprovadasPor(e => normStr(e.loja || ''));

  return Object.entries(byTime)
    .map(([time, tmLeads]) => _linhaFunil(time, tmLeads, aprovadosByTime[normStr(time)] || 0))
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export { ESTAGIOS };
