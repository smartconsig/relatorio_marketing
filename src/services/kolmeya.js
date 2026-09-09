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

    // Cada campo pode vir com nome PT ou EN — pega o primeiro que existir
    const num = (pt, en) => Number(pt ?? en ?? 0);
    const totais = jobs.reduce((acc, job) => {
      acc.enviados      += num(job.enviados,      job.sent);
      acc.entregues     += num(job.entregues,     job.delivered);
      acc.naoEntregues  += num(job.nao_entregues, job.undelivered);
      acc.respostas     += num(job.respostas,     job.replies);
      acc.acessos       += num(job.acessos,       job.accesses);
      acc.valorPago     += num(job.valor_pago,    job.amount);
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
