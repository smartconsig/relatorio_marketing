import { sb } from './supabase.js';
import { toast } from '../utils/ui.js';

const BUCKET = 'quitacoes-docs';

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

export async function uploadDoc(clienteId, file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${clienteId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getDocSignedUrl(path) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDoc(path) {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]);
}
