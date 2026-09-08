// Acesso a dados da Universidade Smart (aluno): catálogo, progresso, player,
// prova e certificado. Wrappers finos preservando a forma das consultas —
// quem checa erro/`data` continua sendo o call site.
import { sb } from './supabase.js';

export function getUser() {
  return sb.auth.getUser();
}

export function fetchCatalogo() {
  return Promise.all([
    sb.from('uni_trilhas').select('*').order('id'),
    sb.from('uni_cursos')
      .select('*, uni_trilhas(nome, cor)')
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
  ]);
}

export function fetchProgresso(userId) {
  return Promise.all([
    sb.from('uni_progresso_cursos').select('*').eq('user_id', userId),
    sb.from('uni_progresso_aulas').select('aula_id').eq('user_id', userId),
  ]);
}

export function fetchCursoDetalhe(courseId) {
  return Promise.all([
    sb.from('uni_cursos').select('*, uni_trilhas(nome, cor)').eq('id', courseId).single(),
    sb.from('uni_modulos').select('*').eq('curso_id', courseId).order('ordem'),
    sb.from('uni_aulas').select('*').eq('curso_id', courseId).eq('ativo', true).order('ordem'),
    sb.from('uni_provas').select('*').eq('curso_id', courseId).maybeSingle(),
  ]);
}

export function fetchTentativasECertificado(provaId, userId, courseId) {
  return Promise.all([
    sb.from('uni_tentativas').select('*').eq('prova_id', provaId).eq('user_id', userId).order('criado_em', { ascending: false }),
    sb.from('uni_certificados').select('*').eq('user_id', userId).eq('curso_id', courseId).maybeSingle(),
  ]);
}

export function upsertProgressoAula(row) {
  return sb.from('uni_progresso_aulas').upsert(row, { onConflict: 'user_id,aula_id' });
}

export function insertXpLog(row) {
  return sb.from('uni_xp_log').insert(row);
}

export function upsertProgressoCurso(row) {
  return sb.from('uni_progresso_cursos').upsert(row, { onConflict: 'user_id,curso_id' });
}

export function fetchProvaComQuestoes(provaId) {
  return Promise.all([
    sb.from('uni_provas').select('*').eq('id', provaId).single(),
    sb.from('uni_questoes').select('*').eq('prova_id', provaId).order('ordem'),
  ]);
}

export function fetchPrimeiraTentativa(provaId, userId) {
  return sb.from('uni_tentativas').select('id').eq('prova_id', provaId).eq('user_id', userId).limit(1);
}

export function insertTentativa(row) {
  return sb.from('uni_tentativas').insert(row);
}

export function upsertCertificado(userId, cursoId) {
  return sb.from('uni_certificados')
    .upsert({ user_id: userId, curso_id: cursoId }, { onConflict: 'user_id,curso_id' })
    .select().single();
}

export function fetchCertificadoDoc(certId, userId) {
  return Promise.all([
    sb.from('uni_certificados')
      .select('*, uni_cursos(titulo, uni_trilhas(nome, cor))')
      .eq('id', certId).single(),
    sb.from('profiles').select('nome').eq('id', userId).single(),
  ]);
}
