// Tráfego (Ads) — dados diários digitados pelo time (fonte oficial dos KPIs).
// Padrão das features novas: grava direto na tabela trafego_diario, sem snapshot.
import { sb } from './supabase.js';
import { state } from '../state.js';

/** Alíquota de imposto sobre o investimento — CAC/ROAS usam o custo real (com imposto). */
export const TAXA_IMPOSTO = 0.13;

/** Carrega todos os dias digitados para state.trafego (tabela pequena: 1 linha/dia). */
export async function loadTrafego() {
  try {
    const { data, error } = await sb.from('trafego_diario').select('*').order('dia');
    if (error) throw error;
    state.trafego = data || [];
    return true;
  } catch (e) {
    console.warn('loadTrafego:', e);
    if (!state.trafego) state.trafego = [];
    return false;
  }
}

/** Insere/atualiza um dia. reg = { dia:'YYYY-MM-DD', investimento, leads, cliques, impressoes, alcance } */
export async function saveTrafegoDia(reg) {
  const row = {
    dia:          reg.dia,
    investimento: Number(reg.investimento) || 0,
    leads:        Number(reg.leads)        || 0,
    cliques:      Number(reg.cliques)      || 0,
    impressoes:   Number(reg.impressoes)   || 0,
    alcance:      Number(reg.alcance)      || 0,
    updated_by:   state.currentUser?.email || null,
    updated_at:   new Date().toISOString(),
  };
  const { error } = await sb.from('trafego_diario').upsert(row);
  if (error) { console.warn('saveTrafegoDia:', error); return false; }
  state.trafego = (state.trafego || []).filter(r => r.dia !== row.dia).concat([row])
    .sort((a, b) => (a.dia < b.dia ? -1 : 1));
  return true;
}

/** Remove um dia digitado. */
export async function deleteTrafegoDia(dia) {
  const { error } = await sb.from('trafego_diario').delete().eq('dia', dia);
  if (error) { console.warn('deleteTrafegoDia:', error); return false; }
  state.trafego = (state.trafego || []).filter(r => r.dia !== dia);
  return true;
}

/**
 * Soma os dias digitados dentro do intervalo do filtro (strings 'YYYY-MM-DD';
 * null = sem limite). invest vem SEM imposto — quem precisa do custo real
 * multiplica por (1 + TAXA_IMPOSTO).
 */
export function trafegoInRange(start, end) {
  const rows = (state.trafego || []).filter(r =>
    (!start || r.dia >= start) && (!end || r.dia <= end)
  );
  const t = { dias: rows.length, invest: 0, leads: 0, cliques: 0, impressoes: 0, alcance: 0, rows };
  for (const r of rows) {
    t.invest     += Number(r.investimento) || 0;
    t.leads      += Number(r.leads)        || 0;
    t.cliques    += Number(r.cliques)      || 0;
    t.impressoes += Number(r.impressoes)   || 0;
    t.alcance    += Number(r.alcance)      || 0;
  }
  return t;
}
