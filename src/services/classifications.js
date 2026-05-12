import { sb } from './supabase.js';
import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { toast } from '../utils/ui.js';

export async function syncClassificationsFromSupabase() {
  let synced = 0;
  try {
    const { data, error } = await sb.from('classifications').select('cpf, is_marketing');
    if (error || !data) return 0;
    for (const row of data) {
      const normCpf = normCPF(row.cpf);
      state.overrides[normCpf] = row.is_marketing;
      if (state.result) {
        for (const entry of state.result.entries) {
          const entryNorm = normCPF(entry.cpf);
          if (entryNorm !== normCpf) continue;
          // Pula entradas explicitamente reclassificadas pelo usuário ('reclassified').
          // Isso garante que reclassificar UMA proposta não reaplica a classificação
          // do banco nessa entrada específica, mesmo que outras propostas do mesmo
          // CPF continuem confirmadas.
          if (entry.reviewReason === 'reclassified') continue;
          // Pula entradas que já estão confirmadas manualmente no snapshot
          if (entry.reviewReason === 'manual') continue;
          entry.isMarketing  = row.is_marketing;
          entry.reviewReason = 'manual';
          synced++;
        }
      }
    }
  } catch (e) { console.warn('syncClassifications:', e); }
  return synced;
}

export async function saveClassificationToSupabase(cpf, isMkt) {
  if (!cpf || !state.currentUser) return;
  const normCpf = normCPF(cpf);
  try {
    const { error } = await sb.from('classifications').upsert(
      { cpf: normCpf, is_marketing: isMkt, classified_by: state.currentUser.id, classified_at: new Date().toISOString() },
      { onConflict: 'cpf' }
    );
    if (error) throw error;
  } catch (e) {
    console.warn('saveClassification:', e);
    toast('⚠️ Erro ao salvar classificação no servidor. Verifique sua conexão.', 'err');
  }
}
