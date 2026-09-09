import { sb } from './supabase.js';
import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { toast } from '../utils/ui.js';

// Este navegador classificou algo desde que a tela abriu? Um carregamento de
// dados que termine DEPOIS de um clique não pode substituir o estado em
// memória — era assim que confirmações feitas enquanto as fichas carregavam
// se perdiam alguns segundos depois.
let _localEdits = 0;
export function markLocalEdit() { _localEdits++; }
export function hasLocalEdits() { return _localEdits > 0; }

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

/**
 * Remove a classificação de um CPF (usado pelo "desfazer" da tela Clientes
 * quando nenhuma outra proposta do CPF continua confirmada).
 * Devolve o { error } cru — quem decide o que fazer com ele é a tela.
 */
export function deleteClassificationFromSupabase(cpf) {
  return sb.from('classifications').delete().eq('cpf', cpf);
}

export async function saveClassificationToSupabase(cpf, isMkt) {
  if (!cpf || !state.currentUser) return;
  markLocalEdit();
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
