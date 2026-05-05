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
        const entry = state.result.entries.find(e =>
          normCPF(e.cpf) === normCpf ||
          String(e.cpf).replace(/\D/g, '') === String(row.cpf).replace(/\D/g, '')
        );
        if (entry) { entry.isMarketing = row.is_marketing; entry.reviewReason = 'manual'; synced++; }
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
