// Esteira de Conteúdo — orquestrador. Os blocos vivem em src/pages/conteudo/:
//   cont-core.js      estado compartilhado (C) + helpers + rótulos
//   cont-shell.js     shell (renderizado 1x) + select de status por tipo
//   cont-board.js     kanban: colunas, drag & drop, status, aprovação/ajustes
//   cont-modal.js     modal do card (novo/edição/leitura/excluir)
//   cont-anexos.js    artes: galeria, upload (botão/Ctrl+V), lightbox
//   cont-historico.js timeline + chat (conteudo_eventos)
// Cada ação grava direto no Supabase (sem snapshot); o board revalida a cada
// 30s e ao voltar o foco para a aba. Export público: renderConteudo.
import { perm } from '../services/permissions.js';
import { C } from './conteudo/cont-core.js';
import { shellHTML, popularStatusModal } from './conteudo/cont-shell.js';
import { reload, renderBoard, onAbrirCard, fecharMotivo, confirmarMotivo } from './conteudo/cont-board.js';
import { abrirModal, fecharModal, salvarCard, excluirCard } from './conteudo/cont-modal.js';
import { subirArquivos } from './conteudo/cont-anexos.js';
import { enviarComentario } from './conteudo/cont-historico.js';

function _bindShell() {
  onAbrirCard(abrirModal);   // clique no card (board) abre o modal

  document.getElementById('cont-novo').addEventListener('click', () => abrirModal(null));
  document.getElementById('cont-fechar').addEventListener('click', fecharModal);
  document.getElementById('cont-cancelar').addEventListener('click', fecharModal);
  document.getElementById('cont-salvar').addEventListener('click', salvarCard);
  document.getElementById('cont-excluir').addEventListener('click', excluirCard);

  document.getElementById('cont-filtro-resp').addEventListener('change', e => {
    C.filtroResp = e.target.value;
    renderBoard();
  });

  document.getElementById('cont-filtro-canal').addEventListener('change', e => {
    C.filtroCanal = e.target.value;
    renderBoard();
  });

  // trocar o tipo no modal reajusta as opções de status (vídeo tem Gravação)
  document.getElementById('cont-f-tipo').addEventListener('change', e => {
    popularStatusModal(e.target.value, document.getElementById('cont-f-status').value);
  });

  document.getElementById('cont-chat-send').addEventListener('click', enviarComentario);
  document.getElementById('cont-chat-txt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario(); }
  });

  const inputFile = document.getElementById('cont-file');
  document.getElementById('cont-anexar').addEventListener('click', () => inputFile.click());
  inputFile.addEventListener('change', () => {
    subirArquivos([...inputFile.files]);
    inputFile.value = '';                       // permite reenviar o mesmo arquivo
  });

  // Ctrl+V com o card aberto cola a arte direto
  document.getElementById('cont-modal').addEventListener('paste', e => {
    const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    subirArquivos(imgs);
  });

  const lb = document.getElementById('cont-lightbox');
  lb.addEventListener('click', () => { lb.style.display = 'none'; });

  document.getElementById('cont-motivo-x').addEventListener('click', fecharMotivo);
  document.getElementById('cont-motivo-cancel').addEventListener('click', fecharMotivo);
  document.getElementById('cont-motivo-ok').addEventListener('click', confirmarMotivo);
}

// ── render ───────────────────────────────────────────────────────────────────
export async function renderConteudo() {
  const sec = document.getElementById('sec-conteudo');
  if (!sec) return;

  if (!C.built) {
    sec.innerHTML = shellHTML();
    C.built = true;
    _bindShell();
  }

  const podeEditar = perm.conteudoEditar();
  document.getElementById('cont-novo').style.display = podeEditar ? '' : 'none';

  await reload();
  _startPolling();
}

// ── revalidação ──────────────────────────────────────────────────────────────
function _secaoAtiva() {
  return document.getElementById('sec-conteudo')?.classList.contains('active');
}

function _startPolling() {
  if (C.pollTimer) return;
  C.pollTimer = setInterval(() => { if (_secaoAtiva()) reload(); }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _secaoAtiva()) reload();
  });
}
