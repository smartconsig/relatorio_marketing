import { sb } from './supabase.js';
import { state } from '../state.js';

/** Grava uma ação no log. Falha silenciosamente para não afetar o fluxo principal. */
export async function logAction(cpf, clientName, action) {
  if (!state.currentUser) return;
  try {
    const userName = state.currentUser.user_metadata?.full_name || state.currentUser.email;
    await sb.from('action_logs').insert({
      cpf:         cpf || '',
      client_name: clientName || '',
      action,
      user_name:   userName,
    });
  } catch (e) {
    console.warn('logAction:', e);
  }
}

/** Busca o histórico de ações de um CPF específico. */
export async function getClientHistory(cpf) {
  try {
    const { data, error } = await sb
      .from('action_logs')
      .select('action, user_name, created_at')
      .eq('cpf', cpf)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('getClientHistory:', e);
    return [];
  }
}
