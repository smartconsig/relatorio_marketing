// Acesso a dados do Criador de Cursos (tabelas uni_*). Wrappers finos que
// preservam a semântica dos call sites: updates têm o erro ignorado de
// propósito (comportamento original); inserts devolvem { data, error } para
// o chamador checar.
import { sb } from './supabase.js';

export function fetchTrilhas() {
  return sb.from('uni_trilhas').select('*').order('id');
}

export function fetchCursos() {
  return sb.from('uni_cursos').select('*, uni_trilhas(nome, cor)').order('created_at', { ascending: false });
}

/** Módulos, aulas e prova (single) de um curso — carga do editor. */
export function fetchCursoRelacionado(cursoId) {
  return Promise.all([
    sb.from('uni_modulos').select('*').eq('curso_id', cursoId).order('ordem'),
    sb.from('uni_aulas').select('*').eq('curso_id', cursoId).order('ordem'),
    sb.from('uni_provas').select('*').eq('curso_id', cursoId).single(),
  ]);
}

export function fetchQuestoes(provaId) {
  return sb.from('uni_questoes').select('*').eq('prova_id', provaId).order('ordem');
}

export function updCurso(id, payload) {
  return sb.from('uni_cursos').update(payload).eq('id', id);
}
export function insCurso(payload) {
  return sb.from('uni_cursos').insert(payload).select().single();
}

export function delAulas(ids)    { return sb.from('uni_aulas').delete().in('id', ids); }
export function delModulos(ids)  { return sb.from('uni_modulos').delete().in('id', ids); }
export function delQuestoes(ids) { return sb.from('uni_questoes').delete().in('id', ids); }

export function updModulo(id, payload) {
  return sb.from('uni_modulos').update(payload).eq('id', id);
}
export function insModulo(payload) {
  return sb.from('uni_modulos').insert(payload).select().single();
}

export function updAula(id, payload) {
  return sb.from('uni_aulas').update(payload).eq('id', id);
}
export function insAula(payload) {
  return sb.from('uni_aulas').insert(payload).select().single();
}

export function updProva(id, payload) {
  return sb.from('uni_provas').update(payload).eq('id', id);
}
export function insProva(payload) {
  return sb.from('uni_provas').insert(payload).select().single();
}
export function delProva(id) {
  return sb.from('uni_provas').delete().eq('id', id);
}

export function updQuestao(id, payload) {
  return sb.from('uni_questoes').update(payload).eq('id', id);
}
export function insQuestao(payload) {
  return sb.from('uni_questoes').insert(payload).select().single();
}
