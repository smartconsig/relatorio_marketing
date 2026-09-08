// ── Universidade Smart — Painel Criador (orquestrador) ─────────────────────
// Interface CMS para gestão de cursos. Os blocos vivem em src/pages/uni-admin/:
//   uadm-core.js        estado compartilhado (U) + factories + helpers
//   curso-lista.js      lista de cursos (editor aberto via callback injetado)
//   curso-editor.js     editor: carga, render das seções e listeners
//   modulos-builder.js  builder de módulos/aulas + uploads de vídeo/PDF
//   quiz-builder.js     builder de questões da prova
//   uadm-salvar.js      salvamento transacional (coleta DOM → uni_*)
// Acesso a dados em services/uni-admin-svc.js e uploads em
// services/uni-upload-svc.js. Export público: renderUniAdmin(container).
import { spinner } from './uni-admin/uadm-core.js';
import { reloadLista, showList, onEditarCurso } from './uni-admin/curso-lista.js';
import { openEditor } from './uni-admin/curso-editor.js';

onEditarCurso(openEditor);   // "Editar"/"Novo Curso" na lista abre o editor

export async function renderUniAdmin(container) {
  const el = container || document.getElementById('sec-uni-admin');
  if (!el) return;
  el.innerHTML = spinner();
  await reloadLista();
  showList(el);
}
