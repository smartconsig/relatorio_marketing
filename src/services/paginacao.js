// Leitura de tabelas inteiras em PARALELO (desempenho, out/2026).
// Antes: páginas de 1000 linhas pedidas UMA DEPOIS DA OUTRA (4 mil linhas = 4–5
// viagens em fila). Agora: 1 consulta leve de contagem + todas as páginas juntas.
// A ordem precisa ser total (último critério = id) para as páginas não se
// sobreporem nem pularem linha quando há empate na coluna de ordenação.
//
// montar(): devolve uma query NOVA do supabase-js já com select/filtros/order.
// Devolve { data, error, ms } no mesmo formato dos wrappers dos serviços.
import { sb } from './supabase.js';

const PAGINA = 1000;
const MAX_PARALELO = 6;   // não abre dezenas de conexões de uma vez no Supabase

async function _contar(tabela, filtrar) {
  let q = sb.from(tabela).select('id', { count: 'exact', head: true });
  if (filtrar) q = filtrar(q);
  const { count, error } = await q;
  return { count: count || 0, error };
}

async function _emLotes(tarefas) {
  const res = [];
  for (let i = 0; i < tarefas.length; i += MAX_PARALELO) {
    res.push(...await Promise.all(tarefas.slice(i, i + MAX_PARALELO).map(t => t())));
  }
  return res;
}

/**
 * opts: { tabela, montar: () => query (com select/order), filtrar?: q => q (mesmos filtros para a contagem) }
 */
export async function lerTudo({ tabela, montar, filtrar }) {
  const t0 = performance.now();
  const { count, error } = await _contar(tabela, filtrar);
  if (error) return { data: null, error, ms: 0 };
  const paginas = Math.max(1, Math.ceil(count / PAGINA));
  const resps = await _emLotes(Array.from({ length: paginas }, (_, p) =>
    () => montar().range(p * PAGINA, p * PAGINA + PAGINA - 1)));
  const falha = resps.find(r => r.error);
  if (falha) return { data: null, error: falha.error, ms: 0 };
  const data = resps.flatMap(r => r.data || []);
  // Linhas criadas entre a contagem e a leitura: a última página veio cheia →
  // continua pedindo até vir uma página incompleta (raro; garante não perder linha)
  for (let p = paginas, ultima = resps[resps.length - 1]?.data?.length; ultima === PAGINA; p++) {
    const r = await montar().range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (r.error) return { data: null, error: r.error, ms: 0 };
    data.push(...(r.data || []));
    ultima = r.data?.length || 0;
  }
  const ms = Math.round(performance.now() - t0);
  console.info(`[desempenho] ${tabela}: ${data.length} linhas em ${ms} ms (${paginas} página(s) em paralelo)`);
  return { data, error: null, ms };
}
