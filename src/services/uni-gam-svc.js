// Acesso a dados da Gamificação (uni_config_xp, uni_niveis_config,
// uni_conquistas, uni_premios). Wrappers finos que preservam a semântica dos
// call sites: updates/deletes com erro ignorado de propósito (comportamento
// original); inserts devolvem { data, error } para o chamador checar.
import { sb } from './supabase.js';

export function fetchGamificacao() {
  return Promise.all([
    sb.from('uni_config_xp').select('*').order('acao'),
    sb.from('uni_niveis_config').select('*').order('ordem'),
    sb.from('uni_conquistas').select('*').order('criado_em'),
    sb.from('uni_premios').select('*').order('xp_necessario'),
  ]);
}

export function updXP(acao, xp) {
  return sb.from('uni_config_xp').update({ xp }).eq('acao', acao);
}

export function updNivel(id, campos) {
  return sb.from('uni_niveis_config').update(campos).eq('id', id);
}

export function updConquista(id, payload) {
  return sb.from('uni_conquistas').update(payload).eq('id', id);
}
export function insConquista(payload) {
  return sb.from('uni_conquistas').insert(payload).select().single();
}
export function delConquista(id) {
  return sb.from('uni_conquistas').delete().eq('id', id);
}

export function updPremio(id, payload) {
  return sb.from('uni_premios').update(payload).eq('id', id);
}
export function insPremio(payload) {
  return sb.from('uni_premios').insert(payload).select().single();
}
export function delPremio(id) {
  return sb.from('uni_premios').delete().eq('id', id);
}
