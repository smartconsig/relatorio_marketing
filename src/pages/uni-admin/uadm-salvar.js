// Salvamento transacional do curso: coleta do DOM → curso → deletes →
// módulos/aulas → prova → questões, na ordem original.
// ⚠ Contrato de IDs com curso-editor.js: f-titulo, f-desc, f-trilha,
// input[name="nivel"], f-instrutor, f-destaque, f-tem-prova, f-nota-minima,
// f-max-tentativas, f-dias-retry, f-tem-certificado + data-mkey/akey/qkey.
import {
  updCurso, insCurso, delAulas, delModulos, delQuestoes,
  updModulo, insModulo, updAula, insAula,
  updProva, insProva, delProva, updQuestao, insQuestao,
} from '../../services/uni-admin-svc.js';
import { U } from './uadm-core.js';
import { reloadLista, showList } from './curso-lista.js';

// ── Coleta do DOM (mesmos fallbacks de sempre) ─────────────────────────────
const _campoTexto = id => document.getElementById(id)?.value?.trim() || '';

function _coletarCursoDoDOM(publicar) {
  U.curso.titulo    = _campoTexto('f-titulo');
  U.curso.descricao = _campoTexto('f-desc');
  U.curso.trilha_id = document.getElementById('f-trilha')?.value || '';
  U.curso.nivel     = document.querySelector('input[name="nivel"]:checked')?.value || 'basico';
  U.curso.instrutor = _campoTexto('f-instrutor');
  U.curso.destaque  = document.getElementById('f-destaque')?.checked ?? false;
  U.curso.ativo     = publicar;
}

function _coletarProvaDoDOM() {
  U.prova.ativa          = document.getElementById('f-tem-prova')?.checked ?? false;
  U.prova.nota_minima    = parseInt(document.getElementById('f-nota-minima')?.value) || 70;
  U.prova.max_tentativas = parseInt(document.getElementById('f-max-tentativas')?.value) || 3;
  U.prova.dias_para_retry = parseInt(document.getElementById('f-dias-retry')?.value) ?? 7;
  U.prova.tem_certificado = document.getElementById('f-tem-certificado')?.checked ?? true;
}

function _coletarModulosDoDOM() {
  U.modulos.forEach(m => {
    const tituloEl = document.querySelector(`input[data-mkey="${m._key}"]:not([data-akey])`);
    if (tituloEl) m.titulo = tituloEl.value;
    m.aulas.forEach(a => {
      const aTitulo = document.querySelector(`input[data-akey="${a._key}"][data-field="titulo"]`);
      const aDur    = document.querySelector(`input[data-akey="${a._key}"][data-field="duracao_minutos"]`);
      if (aTitulo) a.titulo = aTitulo.value;
      if (aDur)    a.duracao_segundos = (parseInt(aDur.value) || 0) * 60;
    });
  });
}

function _coletarQuestoesDoDOM() {
  U.questoes.forEach(q => {
    const ta = document.querySelector(`[data-qkey="${q._key}"][data-qfield="enunciado"]`);
    if (ta) q.enunciado = ta.value;
    document.querySelectorAll(`[data-qkey="${q._key}"][data-qfield="alternativa"]`).forEach(inp => {
      q.alternativas[parseInt(inp.dataset.altI)] = inp.value;
    });
  });
}

// ── Persistência (mesma sequência de awaits do fluxo original) ─────────────
async function _salvarCursoBase() {
  const totalAulas = U.modulos.reduce((s, m) => s + m.aulas.length, 0);
  const totalMin   = U.modulos.reduce((s, m) => s + m.aulas.reduce((ss, a) => ss + (a.duracao_segundos || 0), 0), 0);

  const cursoPayload = {
    titulo: U.curso.titulo, descricao: U.curso.descricao, trilha_id: U.curso.trilha_id,
    nivel: U.curso.nivel, instrutor: U.curso.instrutor, destaque: U.curso.destaque,
    ativo: U.curso.ativo, capa_url: U.curso.capa_url || null, hero_img: U.curso.hero_img || null,
    total_aulas: totalAulas, duracao_minutos: Math.round(totalMin / 60),
  };

  if (U.curso.id) {
    await updCurso(U.curso.id, cursoPayload);
    return U.curso.id;
  }
  const { data, error } = await insCurso(cursoPayload);
  if (error) throw error;
  U.curso.id = data.id;
  return data.id;
}

async function _executarDeletes() {
  if (U.deletes.aulas.length)    await delAulas(U.deletes.aulas);
  if (U.deletes.modulos.length)  await delModulos(U.deletes.modulos);
  if (U.deletes.questoes.length) await delQuestoes(U.deletes.questoes);
}

async function _salvarModulo(m, mi, cursoId) {
  m.ordem = mi + 1;
  const mPayload = { titulo: m.titulo, curso_id: cursoId, ordem: m.ordem };
  if (m.id) {
    await updModulo(m.id, mPayload);
    return;
  }
  const { data, error } = await insModulo(mPayload);
  if (error) throw error;
  m.id = data.id; m._key = data.id;
}

async function _salvarAula(a, ai, m, cursoId) {
  a.ordem = ai + 1;
  const aPayload = {
    titulo: a.titulo, modulo_id: m.id, curso_id: cursoId,
    tipo: a.tipo, bunny_video_id: a.bunny_video_id || null,
    duracao_segundos: a.duracao_segundos || 0, ordem: a.ordem, ativo: true,
  };
  if (a.id) {
    await updAula(a.id, aPayload);
    return;
  }
  const { data, error } = await insAula(aPayload);
  if (error) throw error;
  a.id = data.id; a._key = data.id;
}

async function _salvarModulosEAulas(cursoId) {
  for (let mi = 0; mi < U.modulos.length; mi++) {
    const m = U.modulos[mi];
    await _salvarModulo(m, mi, cursoId);
    for (let ai = 0; ai < m.aulas.length; ai++) {
      await _salvarAula(m.aulas[ai], ai, m, cursoId);
    }
  }
}

async function _salvarQuestao(q, qi, provaId) {
  q.ordem = qi + 1;
  const qPayload = {
    prova_id: provaId,
    enunciado: q.enunciado,
    alternativas: q.alternativas,
    correta: q.correta,
    ordem: q.ordem,
  };
  if (q.id) {
    await updQuestao(q.id, qPayload);
    return;
  }
  const { data, error } = await insQuestao(qPayload);
  if (error) throw error;
  q.id = data.id; q._key = data.id;
}

async function _salvarProvaEQuestoes(cursoId) {
  if (!U.prova.ativa) {
    // Prova foi desativada — remove do DB
    if (U.prova.id) {
      await delProva(U.prova.id);
      U.prova.id = null;
    }
    return;
  }

  const provaPayload = {
    curso_id: cursoId,
    nota_minima:     U.prova.nota_minima,
    max_tentativas:  U.prova.max_tentativas,
    dias_para_retry: U.prova.dias_para_retry,
    tem_certificado: U.prova.tem_certificado,
  };
  let provaId = U.prova.id;
  if (provaId) {
    await updProva(provaId, provaPayload);
  } else {
    const { data, error } = await insProva(provaPayload);
    if (error) throw error;
    provaId = data.id;
    U.prova.id = provaId;
  }

  for (let qi = 0; qi < U.questoes.length; qi++) {
    await _salvarQuestao(U.questoes[qi], qi, provaId);
  }
}

function _validarCurso() {
  if (!U.curso.titulo) { alert('Informe o título do curso.'); return false; }
  if (!U.curso.trilha_id) { alert('Selecione uma trilha.'); return false; }
  return true;
}

// Desabilita/reabilita os 4 botões de salvar com os textos originais.
function _travarBotoes(btns, travando) {
  btns.forEach(b => {
    if (!b) return;
    b.disabled = travando;
    b.textContent = travando
      ? 'Salvando…'
      : (b.id?.includes('rascunho') ? 'Salvar rascunho' : 'Publicar curso');
  });
}

// Coleta dados do DOM antes de salvar (curso, prova, módulos, questões)
function _coletarDoDOM(publicar) {
  _coletarCursoDoDOM(publicar);
  _coletarProvaDoDOM();
  _coletarModulosDoDOM();
  _coletarQuestoesDoDOM();
}

export async function salvar(publicar, el) {
  if (U.saving) return;

  _coletarDoDOM(publicar);
  if (!_validarCurso()) return;

  U.saving = true;
  const btns = ['btn-publicar','btn-publicar-2','btn-rascunho','btn-rascunho-2'].map(id => document.getElementById(id));
  _travarBotoes(btns, true);

  try {
    const cursoId = await _salvarCursoBase();      // 1. curso
    await _executarDeletes();                      // 2. deletes
    await _salvarModulosEAulas(cursoId);           // 3. módulos e aulas
    await _salvarProvaEQuestoes(cursoId);          // 4-5. prova e questões

    await reloadLista();
    showList(el);

  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert(`Erro ao salvar: ${err.message}`);
    U.saving = false;
    _travarBotoes(btns, false);
  } finally {
    U.saving = false;
  }
}
