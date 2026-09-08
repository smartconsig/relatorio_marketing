// Histórico + chat do card (a tabela conteudo_eventos é a fonte de tudo:
// movimentações, aprovações e comentários, em ordem cronológica).
import { toast } from '../../utils/ui.js';
import { comentar, loadEventos } from '../../services/conteudo-svc.js';
import { C, COL_LABEL, esc, iniciais } from './cont-core.js';

function _haQuanto(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)    return 'agora';
  if (min < 60)   return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)     return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Frase do evento na linha do tempo (comentário é tratado à parte). */
function _descrEvento(e) {
  const col = k => COL_LABEL[k] || k || '—';
  switch (e.tipo) {
    case 'criado':    return 'criou o card';
    case 'movido':    return `moveu: ${col(e.de_coluna)} → ${col(e.para_coluna)}`;
    case 'aprovado':  return 'aprovou o conteúdo';
    case 'reprovado': return `pediu ajustes: “${e.texto || ''}”`;
    case 'editado':   return e.texto ? `alterou ${e.texto}` : 'editou o card';
    case 'arquivado': return 'arquivou o card';
    case 'anexo':     return `anexou ${e.texto || 'uma imagem'}`;
    default:          return e.tipo;
  }
}

function _renderTimeline(eventos) {
  const box = document.getElementById('cont-hist');
  if (!box) return;

  if (!eventos.length) {
    box.innerHTML = '<div class="cont-hist-vazio">Nada por aqui ainda.</div>';
    return;
  }

  box.innerHTML = eventos.map(e => {
    const autor = esc(e.autor_nome || 'Alguém');
    const quando = _haQuanto(e.created_at);

    if (e.tipo === 'comentario') {
      return `
        <div class="cont-hist-item cont-hist-msg">
          <span class="cont-avatar" title="${autor}">${esc(iniciais(e.autor_nome))}</span>
          <div class="cont-msg-corpo">
            <div class="cont-msg-topo"><b>${autor}</b><span>${quando}</span></div>
            <div class="cont-msg-txt">${esc(e.texto || '')}</div>
          </div>
        </div>`;
    }

    const destaque = e.tipo === 'reprovado' ? ' cont-hist-alerta' : '';
    return `
      <div class="cont-hist-item${destaque}">
        <span class="cont-hist-dot"></span>
        <div class="cont-hist-txt"><b>${autor}</b> ${esc(_descrEvento(e))}</div>
        <span class="cont-hist-quando">${quando}</span>
      </div>`;
  }).join('');

  box.scrollTop = box.scrollHeight;   // abre já no fim, na conversa mais recente
}

export async function carregarHistorico(cardId) {
  const box = document.getElementById('cont-hist');
  box.innerHTML = '<div class="cont-hist-vazio">Carregando…</div>';
  _renderTimeline(await loadEventos(cardId));
}

export async function enviarComentario() {
  const campo = document.getElementById('cont-chat-txt');
  const texto = campo.value.trim();
  if (!texto || !C.editId) return;

  const btn = document.getElementById('cont-chat-send');
  btn.disabled = true;
  try {
    await comentar(C.editId, texto);
    campo.value = '';
    await carregarHistorico(C.editId);
  } catch (err) {
    console.error('comentar:', err);
    toast('Erro ao enviar o comentário', 'err');
  } finally {
    btn.disabled = false;
  }
}
