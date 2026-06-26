import { sb } from './supabase.js';
import { state } from '../state.js';

export async function syncKolmeya() {
  if (!state.currentUser) return false;

  const { start } = state.filterDates;
  const date = start
    ? (typeof start === 'string' ? start : start.toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10);

  // Deriva o período no formato YYYY-MM
  const period = date.slice(0, 7);

  try {
    const { data, error } = await sb.functions.invoke('kolmeya-reports', {
      body: { period },
    });

    if (error || !data || data.error) {
      console.warn('[kolmeya] erro na sincronização:', error || data?.error);
      return false;
    }

    // A API retorna um array de jobs — agrega os totais
    const jobs = Array.isArray(data) ? data : (data.jobs ?? []);

    const totais = jobs.reduce((acc, job) => {
      acc.enviados      += Number(job.enviados      ?? job.sent       ?? 0);
      acc.entregues     += Number(job.entregues     ?? job.delivered  ?? 0);
      acc.naoEntregues  += Number(job.nao_entregues ?? job.undelivered ?? 0);
      acc.respostas     += Number(job.respostas     ?? job.replies    ?? 0);
      acc.acessos       += Number(job.acessos       ?? job.accesses   ?? 0);
      acc.valorPago     += Number(job.valor_pago    ?? job.amount     ?? 0);
      return acc;
    }, { enviados: 0, entregues: 0, naoEntregues: 0, respostas: 0, acessos: 0, valorPago: 0 });

    state.kolmeya = {
      period,
      jobs,
      ...totais,
      lastSync: new Date().toISOString(),
    };

    return true;
  } catch (e) {
    console.warn('[kolmeya] falha silenciosa:', e);
    return false;
  }
}
