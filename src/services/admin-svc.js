// Acesso a dados da Administração (profiles, grupos_acesso e Edge Functions
// invite-user/delete-user). As funções devolvem { data, error } cru do
// supabase-js — o tratamento de erro continua nos call sites das abas.
import { sb } from './supabase.js';

export function fetchProfiles() {
  return sb
    .from('profiles')
    .select('*, grupos_acesso(nome)')
    .order('created_at', { ascending: false });
}

export function updateProfileAtivo(id, ativo) {
  return sb.from('profiles').update({ ativo }).eq('id', id);
}

export function updateProfile(id, campos) {
  return sb.from('profiles').update(campos).eq('id', id);
}

export function fetchGrupos() {
  return sb.from('grupos_acesso').select('*').order('nome');
}

export function insertGrupo(reg) {
  return sb.from('grupos_acesso').insert(reg);
}

export function updateGrupo(id, reg) {
  return sb.from('grupos_acesso').update(reg).eq('id', id);
}

export function deleteGrupoRow(id) {
  return sb.from('grupos_acesso').delete().eq('id', id);
}

export function invokeInviteUser(body) {
  return sb.functions.invoke('invite-user', { body });
}

export function invokeDeleteUser(user_id) {
  return sb.functions.invoke('delete-user', { body: { user_id } });
}
