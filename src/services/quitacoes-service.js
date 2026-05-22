import { sb } from './supabase.js';
import { toast } from '../utils/ui.js';

export async function loadQuitacoes() {
  const { data, error } = await sb
    .from('quitacoes_clientes')
    .select('*')
    .order('nome');
  if (error) {
    console.error('loadQuitacoes:', error);
    toast('Erro ao carregar quitações', 'err');
    return [];
  }
  return data || [];
}

export async function upsertQuitacao(cliente) {
  if (cliente.id) {
    const { data, error } = await sb
      .from('quitacoes_clientes')
      .update(cliente)
      .eq('id', cliente.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb
      .from('quitacoes_clientes')
      .insert(cliente)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
