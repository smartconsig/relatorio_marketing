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

export async function salvar(publicar, el) {
  if (U.saving) return;

  // Coleta dados do DOM antes de salvar
  U.curso.titulo    = document.getElementById('f-titulo')?.value?.trim() || '';
  U.curso.descricao = document.getElementById('f-desc')?.value?.trim()   || '';
  U.curso.trilha_id = document.getElementById('f-trilha')?.value         || '';
  U.curso.nivel     = document.querySelector('input[name="nivel"]:checked')?.value || 'basico';
  U.curso.instrutor = document.getElementById('f-instrutor')?.value?.trim() || '';
  U.curso.destaque  = document.getElementById('f-destaque')?.checked ?? false;
  U.curso.ativo     = publicar;

  // Coleta config da prova do DOM
  U.prova.ativa          = document.getElementById('f-tem-prova')?.checked ?? false;
  U.prova.nota_minima    = parseInt(document.getElementById('f-nota-minima')?.value) || 70;
  U.prova.max_tentativas = parseInt(document.getElementById('f-max-tentativas')?.value) || 3;
  U.prova.dias_para_retry = parseInt(document.getElementById('f-dias-retry')?.value) ?? 7;
  U.prova.tem_certificado = document.getElementById('f-tem-certificado')?.checked ?? true;

  // Coleta títulos de módulos/aulas
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

  // Coleta enunciados/alternativas das questões
  U.questoes.forEach(q => {
    const ta = document.querySelector(`[data-qkey="${q._key}"][data-qfield="enunciado"]`);
    if (ta) q.enunciado = ta.value;
    document.querySelectorAll(`[data-qkey="${q._key}"][data-qfield="alternativa"]`).forEach(inp => {
      q.alternativas[parseInt(inp.dataset.altI)] = inp.value;
    });
  });

  if (!U.curso.titulo) { alert('Informe o título do curso.'); return; }
  if (!U.curso.trilha_id) { alert('Selecione uma trilha.'); return; }

  U.saving = true;
  const btns = ['btn-publicar','btn-publicar-2','btn-rascunho','btn-rascunho-2'].map(id => document.getElementById(id));
  btns.forEach(b => { if (b) { b.disabled = true; b.textContent = 'Salvando…'; } });

  try {
    // 1. Salva o curso
    const totalAulas = U.modulos.reduce((s, m) => s + m.aulas.length, 0);
    const totalMin   = U.modulos.reduce((s, m) => s + m.aulas.reduce((ss, a) => ss + (a.duracao_segundos || 0), 0), 0);

    const cursoPayload = {
      titulo: U.curso.titulo, descricao: U.curso.descricao, trilha_id: U.curso.trilha_id,
      nivel: U.curso.nivel, instrutor: U.curso.instrutor, destaque: U.curso.destaque,
      ativo: U.curso.ativo, capa_url: U.curso.capa_url || null, hero_img: U.curso.hero_img || null,
      total_aulas: totalAulas, duracao_minutos: Math.round(totalMin / 60),
    };

    let cursoId = U.curso.id;
    if (cursoId) {
      await updCurso(cursoId, cursoPayload);
    } else {
      const { data, error } = await insCurso(cursoPayload);
      if (error) throw error;
      cursoId = data.id;
      U.curso.id = cursoId;
    }

    // 2. Deletes
    if (U.deletes.aulas.length)    await delAulas(U.deletes.aulas);
    if (U.deletes.modulos.length)  await delModulos(U.deletes.modulos);
    if (U.deletes.questoes.length) await delQuestoes(U.deletes.questoes);

    // 3. Salva módulos e aulas
    for (let mi = 0; mi < U.modulos.length; mi++) {
      const m = U.modulos[mi];
      m.ordem = mi + 1;
      const mPayload = { titulo: m.titulo, curso_id: cursoId, ordem: m.ordem };
      if (m.id) {
        await updModulo(m.id, mPayload);
      } else {
        const { data, error } = await insModulo(mPayload);
        if (error) throw error;
        m.id = data.id; m._key = data.id;
      }

      for (let ai = 0; ai < m.aulas.length; ai++) {
        const a = m.aulas[ai];
        a.ordem = ai + 1;
        const aPayload = {
          titulo: a.titulo, modulo_id: m.id, curso_id: cursoId,
          tipo: a.tipo, bunny_video_id: a.bunny_video_id || null,
          duracao_segundos: a.duracao_segundos || 0, ordem: a.ordem, ativo: true,
        };
        if (a.id) {
          await updAula(a.id, aPayload);
        } else {
          const { data, error } = await insAula(aPayload);
          if (error) throw error;
          a.id = data.id; a._key = data.id;
        }
      }
    }

    // 4. Salva prova
    if (U.prova.ativa) {
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

      // 5. Salva questões
      for (let qi = 0; qi < U.questoes.length; qi++) {
        const q = U.questoes[qi];
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
        } else {
          const { data, error } = await insQuestao(qPayload);
          if (error) throw error;
          q.id = data.id; q._key = data.id;
        }
      }
    } else if (U.prova.id) {
      // Prova foi desativada — remove do DB
      await delProva(U.prova.id);
      U.prova.id = null;
    }

    await reloadLista();
    showList(el);

  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert(`Erro ao salvar: ${err.message}`);
    U.saving = false;
    btns.forEach(b => { if (b) { b.disabled = false; b.textContent = b.id?.includes('rascunho') ? 'Salvar rascunho' : 'Publicar curso'; } });
  } finally {
    U.saving = false;
  }
}
