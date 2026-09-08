// Modal do card da Esteira: abrir (novo/edição/leitura), salvar e excluir.
import { toast } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import { perm } from '../../services/permissions.js';
import { statusDoTipo, createCard, updateCard, deleteCard, logEvento, removeArquivosDoCard } from '../../services/conteudo-svc.js';
import { C, esc, camposAlterados } from './cont-core.js';
import { popularStatusModal } from './cont-shell.js';
import { renderBoard } from './cont-board.js';
import { carregarAnexos } from './cont-anexos.js';
import { carregarHistorico } from './cont-historico.js';

export function abrirModal(id) {
  const podeEditar = perm.conteudoEditar();
  if (!id && !podeEditar) return;

  C.editId = id;
  const card = id ? C.cards.find(c => c.id === id) : null;

  document.getElementById('cont-modal-title').textContent = card ? 'Editar conteúdo' : 'Novo conteúdo';

  const respSel = document.getElementById('cont-f-resp');
  respSel.innerHTML = '<option value="">—</option>' +
    C.membros.map(m => `<option value="${m.id}">${esc(m.nome || m.email)}</option>`).join('');

  document.getElementById('cont-f-titulo').value = card?.titulo    || '';
  document.getElementById('cont-f-canal').value  = card?.canal     || '';
  document.getElementById('cont-f-tipo').value   = card?.tipo      || '';
  respSel.value                                  = card?.responsavel_id || '';
  document.getElementById('cont-f-data').value   = card?.data_alvo || '';
  document.getElementById('cont-f-coluna').value = card?.coluna    || 'ideias';
  document.getElementById('cont-f-link').value   = card?.link_url  || '';
  document.getElementById('cont-f-desc').value   = card?.descricao || '';

  // Sem permissão de edição, o modal vira leitura
  document.querySelectorAll('#cont-modal .cont-input').forEach(el => { el.disabled = !podeEditar; });
  // depois do loop: o select de status tem regra própria (precisa de tipo)
  popularStatusModal(card?.tipo || '', card?.producao_status || '');
  if (!podeEditar) document.getElementById('cont-f-status').disabled = true;
  document.getElementById('cont-salvar').style.display  = podeEditar ? '' : 'none';
  document.getElementById('cont-excluir').style.display = (card && podeEditar) ? '' : 'none';

  // Anexos e histórico só existem para card já criado
  document.getElementById('cont-hist-wrap').style.display   = card ? '' : 'none';
  document.getElementById('cont-anexos-wrap').style.display = card ? '' : 'none';
  document.getElementById('cont-chat-box').style.display = podeEditar ? '' : 'none';
  document.getElementById('cont-anexar').style.display   = podeEditar ? '' : 'none';

  document.getElementById('cont-modal').style.display = 'flex';
  if (podeEditar) document.getElementById('cont-f-titulo').focus();

  if (card) {
    carregarAnexos(card.id);
    carregarHistorico(card.id);
  }
}

export function fecharModal() {
  document.getElementById('cont-modal').style.display = 'none';
  C.editId = null;
}

export async function salvarCard() {
  const titulo = document.getElementById('cont-f-titulo').value.trim();
  if (!titulo) { toast('Dê um título ao conteúdo', 'err'); return; }

  const coluna = document.getElementById('cont-f-coluna').value;

  // status só existe com tipo; se o status atual não vale para o tipo
  // (ex.: vídeo em Gravação virou estático), volta para Roteiro
  const tipo = document.getElementById('cont-f-tipo').value || null;
  let producaoStatus = document.getElementById('cont-f-status').value || null;
  if (tipo) {
    if (!statusDoTipo(tipo).some(s => s.key === producaoStatus)) producaoStatus = 'roteiro';
  } else {
    producaoStatus = null;
  }

  const payload = {
    titulo,
    canal:          document.getElementById('cont-f-canal').value || null,
    tipo,
    producao_status: producaoStatus,
    responsavel_id: document.getElementById('cont-f-resp').value  || null,
    data_alvo:      document.getElementById('cont-f-data').value  || null,
    link_url:       document.getElementById('cont-f-link').value.trim() || null,
    descricao:      document.getElementById('cont-f-desc').value.trim() || null,
    coluna,
  };

  try {
    if (C.editId) {
      const card = C.cards.find(c => c.id === C.editId);
      // troca de etapa pelo modal também reinicia o cronômetro da coluna
      if (card && card.coluna !== coluna) {
        payload.coluna_desde = new Date().toISOString();
      }
      const mudou = camposAlterados(card, payload);
      const novo = await updateCard(C.editId, payload);
      if (card && card.coluna !== coluna) {
        await logEvento(C.editId, 'movido', { de_coluna: card.coluna, para_coluna: coluna });
      } else if (mudou.length) {
        await logEvento(C.editId, 'editado', { texto: mudou.join(', ') });
      }
      Object.assign(card, novo);
      toast('Conteúdo atualizado');
    } else {
      const maior = C.cards.filter(c => c.coluna === coluna)
        .reduce((m, c) => Math.max(m, Number(c.ordem)), 0);
      const novo = await createCard({ ...payload, ordem: maior + 1000 });
      C.cards.push(novo);
      toast('Conteúdo criado');
    }
    fecharModal();
    renderBoard();
  } catch (err) {
    console.error('salvarCard:', err);
    toast('Erro ao salvar o conteúdo', 'err');
  }
}

export function excluirCard() {
  if (!C.editId) return;
  const id = C.editId;
  showConfirm('Excluir conteúdo?', 'Esta ação não pode ser desfeita.', 'Excluir', async () => {
    try {
      // as imagens precisam sair do bucket antes: o CASCADE só apaga as linhas
      await removeArquivosDoCard(id);
      await deleteCard(id);
      C.cards = C.cards.filter(c => c.id !== id);
      fecharModal();
      renderBoard();
      toast('Conteúdo excluído');
    } catch (err) {
      console.error('excluirCard:', err);
      toast('Erro ao excluir', 'err');
    }
  });
}
