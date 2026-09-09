// Board (kanban) da Esteira: colunas, cards, drag & drop, troca de status
// direto no card, aprovação e pedido de ajustes. O clique no card abre o
// modal via callback injetado (onAbrirCard) — este módulo nunca importa o
// modal, evitando ciclo.
import { state } from '../../state.js';
import { toast } from '../../utils/ui.js';
import { perm } from '../../services/permissions.js';
import { COLUNAS, statusDoTipo, loadCards, loadMembros, updateCard, moveCard, logEvento } from '../../services/conteudo-svc.js';
import {
  C, CANAL_LABEL, STATUS_LABEL,
  esc, iniciais, nomeMembro, diasDesde, fmtDataCurta, ordemFinal, hojeYMD,
} from './cont-core.js';

// Callback registrado pelo orquestrador (abre o modal do card)
let _onAbrirCard = () => {};
export function onAbrirCard(fn) { _onAbrirCard = fn; }

export async function reload() {
  // Retenta enquanto vier vazio — senão uma falha na 1ª carga deixaria o
  // seletor de responsável vazio até o usuário dar F5.
  if (!C.membros.length) C.membros = await loadMembros();

  const cards = await loadCards();
  if (cards === null) return;      // erro já reportado no serviço
  C.cards = cards;
  renderBoard();
}

function _visiveis() {
  const meuId = state.currentUser?.id;
  return C.cards.filter(c => {
    if (C.filtroResp === 'meus')     { if (c.responsavel_id !== meuId) return false; }
    else if (C.filtroResp === 'sem') { if (c.responsavel_id) return false; }
    else if (C.filtroResp)           { if (c.responsavel_id !== C.filtroResp) return false; }
    if (C.filtroCanal && c.canal !== C.filtroCanal) return false;
    return true;
  });
}

/** Opções do filtro de responsável: só quem tem card no quadro. */
function _popularFiltroResp() {
  const sel = document.getElementById('cont-filtro-resp');
  if (!sel) return;

  const ids = [...new Set(C.cards.map(c => c.responsavel_id).filter(Boolean))];
  const nomes = ids
    .map(id => ({ id, nome: nomeMembro(id) || '(sem nome)' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const temSemResp = C.cards.some(c => !c.responsavel_id);

  sel.innerHTML =
    '<option value="">Todos os responsáveis</option>' +
    '<option value="meus">Só os meus</option>' +
    nomes.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('') +
    (temSemResp ? '<option value="sem">Sem responsável</option>' : '');

  // seleção pode ter sumido do quadro (card excluído/reatribuído) — volta p/ todos
  if (![...sel.options].some(o => o.value === C.filtroResp)) C.filtroResp = '';
  sel.value = C.filtroResp;
}

export function renderBoard() {
  const board = document.getElementById('cont-board');
  if (!board) return;

  _popularFiltroResp();
  const cards = _visiveis();
  const hoje  = hojeYMD();

  board.innerHTML = COLUNAS.map(col => {
    const doCol = cards
      .filter(c => c.coluna === col.key)
      .sort((a, b) => Number(a.ordem) - Number(b.ordem));

    const corpo = doCol.length
      ? doCol.map(c => _cardHTML(c, hoje)).join('')
      : '<div class="cont-empty">—</div>';

    return `
      <div class="cont-col" data-col="${col.key}">
        <div class="cont-col-head">
          <span class="cont-col-name">${col.label}</span>
          <span class="cont-col-count">${doCol.length}</span>
        </div>
        <div class="cont-col-body" data-col="${col.key}">${corpo}</div>
      </div>`;
  }).join('');

  _bindBoard();

  const total    = cards.length;
  const atrasados = cards.filter(c => c.data_alvo && c.data_alvo < hoje && c.coluna !== 'publicado').length;
  document.getElementById('cont-resumo').textContent =
    `${total} card${total === 1 ? '' : 's'}` + (atrasados ? ` · ${atrasados} atrasado${atrasados === 1 ? '' : 's'}` : '');
}

// Chips de canal e de ajuste do topo do card
function _chipsCardHTML(c) {
  const chips = [];
  if (c.canal)     chips.push(`<span class="cont-chip">${esc(CANAL_LABEL[c.canal] || c.canal)}</span>`);
  if (c.em_ajuste) chips.push(`<span class="cont-chip cont-chip-ajuste" title="${esc(c.ajuste_motivo || '')}">Ajuste</span>`);
  return chips.length ? `<div class="cont-card-chips">${chips.join('')}</div>` : '';
}

// status de produção: select direto no card (sem abrir o modal);
// cards antigos sem tipo não mostram nada
function _statusCardHTML(c, podeEditar) {
  if (!c.tipo) return '';
  const atual = c.producao_status || 'roteiro';
  const cor   = ` cont-status-${atual}`;    // roteiro=azul, gravacao=roxo, edicao=verde, feito=teal
  return podeEditar
    ? `<select class="cont-status-sel${cor}" data-status="${c.id}" title="Status de produção">
           ${statusDoTipo(c.tipo).map(s =>
             `<option value="${s.key}"${s.key === atual ? ' selected' : ''}>${s.label}</option>`).join('')}
         </select>`
    : `<span class="cont-status-chip${cor}">${esc(STATUS_LABEL[atual] || atual)}</span>`;
}

function _cardHTML(c, hoje) {
  const atrasado = c.data_alvo && c.data_alvo < hoje && c.coluna !== 'publicado';
  const dias     = diasDesde(c.coluna_desde);
  const nome     = nomeMembro(c.responsavel_id);
  const podeEditar  = perm.conteudoEditar();
  const podeAprovar = perm.conteudoAprovar();

  const acoes = (c.coluna === 'aprovacao' && podeAprovar)
    ? `<div class="cont-card-acoes">
         <button class="cont-btn-ok"   data-aprovar="${c.id}">Aprovar</button>
         <button class="cont-btn-back" data-ajuste="${c.id}">Ajustes</button>
       </div>`
    : '';

  const statusHTML = _statusCardHTML(c, podeEditar);

  return `
    <div class="cont-card${atrasado ? ' late' : ''}" data-id="${c.id}" draggable="${podeEditar}">
      ${_chipsCardHTML(c)}
      <div class="cont-card-title">${esc(c.titulo)}</div>
      ${c.em_ajuste && c.ajuste_motivo ? `<div class="cont-card-ajuste">${esc(c.ajuste_motivo)}</div>` : ''}
      <div class="cont-card-foot">
        ${nome ? `<span class="cont-avatar" title="${esc(nome)}">${esc(iniciais(nome))}</span>` : '<span class="cont-avatar cont-avatar-off" title="Sem responsável">·</span>'}
        ${c.data_alvo ? `<span class="cont-date${atrasado ? ' late' : ''}">${fmtDataCurta(c.data_alvo)}</span>` : ''}
        ${statusHTML}
        <span class="cont-age" title="Tempo parado nesta etapa">${dias}d</span>
      </div>
      ${acoes}
    </div>`;
}

// ── drag & drop ──────────────────────────────────────────────────────────────
function _bindBoard() {
  const podeEditar = perm.conteudoEditar();

  document.querySelectorAll('#cont-board .cont-card').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.cont-card-acoes')) return;   // botões têm ação própria
      if (e.target.closest('.cont-status-sel')) return;   // select de status idem
      _onAbrirCard(el.dataset.id);
    });
    if (!podeEditar) return;
    el.addEventListener('dragstart', () => { C.dragId = el.dataset.id; el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => { C.dragId = null; el.classList.remove('dragging'); });
  });

  document.querySelectorAll('#cont-board [data-status]').forEach(sel => {
    // mousedown não pode virar dragstart do card (o pai é draggable)
    sel.addEventListener('mousedown', e => e.stopPropagation());
    sel.addEventListener('change', () => _trocarStatus(sel.dataset.status, sel.value));
  });

  document.querySelectorAll('#cont-board [data-aprovar]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _aprovar(btn.dataset.aprovar); })
  );
  document.querySelectorAll('#cont-board [data-ajuste]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); abrirMotivo(btn.dataset.ajuste); })
  );

  if (!podeEditar) return;

  document.querySelectorAll('#cont-board .cont-col-body').forEach(body => {
    body.addEventListener('dragover', e => {
      e.preventDefault();
      body.classList.add('over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('over'));
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('over');
      _soltar(body, e.clientY);
    });
  });
}

/** Card (não arrastado) antes do qual o card solto deve entrar. */
function _cardDepoisDoPonto(body, y) {
  const outros = [...body.querySelectorAll('.cont-card:not(.dragging)')];
  return outros.find(el => {
    const r = el.getBoundingClientRect();
    return y < r.top + r.height / 2;
  }) || null;
}

// ordem = média entre os vizinhos, para caber entre eles sem renumerar o resto
function _ordemEntreVizinhos(id, paraColuna, ref) {
  const naColuna = C.cards
    .filter(c => c.coluna === paraColuna && c.id !== id)
    .sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const idxDepois = ref ? naColuna.findIndex(c => c.id === ref.dataset.id) : naColuna.length;
  const antes = naColuna[idxDepois - 1];
  const depois = naColuna[idxDepois];
  return antes && depois ? (Number(antes.ordem) + Number(depois.ordem)) / 2
       : antes           ? Number(antes.ordem) + 1000
       : depois          ? Number(depois.ordem) - 1000
       : 1000;
}

async function _soltar(body, y) {
  const id = C.dragId;
  if (!id) return;
  const card = C.cards.find(c => c.id === id);
  if (!card) return;

  const paraColuna = body.dataset.col;
  const ref        = _cardDepoisDoPonto(body, y);
  const ordem      = _ordemEntreVizinhos(id, paraColuna, ref);

  if (card.coluna === paraColuna && Number(card.ordem) === ordem) return;

  // sai do ajuste ao avançar de etapa
  const extra = (card.em_ajuste && paraColuna !== 'producao')
    ? { em_ajuste: false, ajuste_motivo: null }
    : {};

  try {
    const novo = await moveCard(card, paraColuna, ordem, extra);
    Object.assign(card, novo);
    renderBoard();
  } catch (err) {
    console.error('moveCard:', err);
    toast('Não foi possível mover o card', 'err');
    reload();
  }
}

// ── status de produção (troca direto no card) ────────────────────────────────
async function _trocarStatus(id, valor) {
  const card = C.cards.find(c => c.id === id);
  if (!card || card.producao_status === valor) return;
  try {
    const novo = await updateCard(id, { producao_status: valor });
    Object.assign(card, novo);
    await logEvento(id, 'editado', { texto: `status de produção para ${STATUS_LABEL[valor] || valor}` });
    renderBoard();
  } catch (err) {
    console.error('trocarStatus:', err);
    toast('Não foi possível trocar o status', 'err');
    reload();      // desfaz o select para o valor real do banco
  }
}

// ── aprovação ────────────────────────────────────────────────────────────────
async function _aprovar(id) {
  const card = C.cards.find(c => c.id === id);
  if (!card) return;
  try {
    const novo = await moveCard(card, 'agendado', ordemFinal('agendado', card.id), {
      em_ajuste: false, ajuste_motivo: null, _evento: 'aprovado',
    });
    Object.assign(card, novo);
    toast('Conteúdo aprovado');
    renderBoard();
  } catch (err) {
    console.error('aprovar:', err);
    toast('Erro ao aprovar', 'err');
  }
}

export function abrirMotivo(id) {
  C.motivoCard = C.cards.find(c => c.id === id) || null;
  if (!C.motivoCard) return;
  document.getElementById('cont-motivo-txt').value = '';
  document.getElementById('cont-motivo-modal').style.display = 'flex';
  document.getElementById('cont-motivo-txt').focus();
}

export function fecharMotivo() {
  document.getElementById('cont-motivo-modal').style.display = 'none';
  C.motivoCard = null;
}

export async function confirmarMotivo() {
  const motivo = document.getElementById('cont-motivo-txt').value.trim();
  if (!motivo) { toast('Escreva o que precisa ser ajustado', 'err'); return; }
  const card = C.motivoCard;
  if (!card) return;
  try {
    const novo = await moveCard(card, 'producao', ordemFinal('producao', card.id), {
      em_ajuste: true, ajuste_motivo: motivo, _evento: 'reprovado',
    });
    Object.assign(card, novo);
    fecharMotivo();
    toast('Card devolvido para ajustes');
    renderBoard();
  } catch (err) {
    console.error('pedirAjustes:', err);
    toast('Erro ao devolver o card', 'err');
  }
}
