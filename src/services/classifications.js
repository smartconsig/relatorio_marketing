import { sb } from './supabase.js';
import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { toast } from '../utils/ui.js';

export async function syncClassificationsFromSupabase() {
  let synced = 0;
  try {
    const { data, error } = await sb.from('classifications').select('cpf, is_marketing');
    if (error || !data) return 0;

    // CPFs confirmados no banco (fonte da verdade)
    const confirmedCPFs = new Set(data.map(row => normCPF(row.cpf)));

    if (state.result) {
      // 1. Reseta entradas que estão como 'manual' no snapshot mas foram removidas do banco.
      //    Sem isso, um snapshot antigo baixado no F5 manteria o reviewReason mesmo após reclassificação.
      for (const entry of state.result.entries) {
        if (entry.reviewReason === 'manual' && !confirmedCPFs.has(normCPF(entry.cpf))) {
          entry.reviewReason = null;
          entry.isMarketing  = null;
          delete state.overrides[normCPF(entry.cpf)];
        }
      }

      // 2. Aplica classificações do banco em TODAS as entradas com o CPF (não só a primeira).
      for (const row of data) {
        const normCpf = normCPF(row.cpf);
        state.overrides[normCpf] = row.is_marketing;
        const matches = state.result.entries.filter(e =>
          normCPF(e.cpf) === normCpf ||
          String(e.cpf).replace(/\D/g, '') === String(row.cpf).replace(/\D/g, '')
        );
        for (const entry of matches) {
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
