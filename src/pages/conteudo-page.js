import { state } from '../state.js';
import { perm } from '../services/permissions.js';
import { toast } from '../utils/ui.js';
import {
  COLUNAS, CANAIS,
  loadCards, loadMembros, createCard, updateCard, moveCard, deleteCard, logEvento,
  comentar, loadEventos,
  loadAnexos, signedUrls, uploadAnexo, deleteAnexo, removeArquivosDoCard, ANEXO_MAX_BYTES,
} from '../services/conteudo-svc.js';

/**
 * Esteira de Conteúdo — kanban de criação.
 * Cada ação grava direto no Supabase (sem snapshot); o board revalida
 * a cada 30s e ao voltar o foco para a aba.
 */

let _cards      = [];
let _membros    = [];
let _filtroMeus = false;
let _filtroCanal = '';
let _editId     = null;      // id do card aberto no modal (null = novo)
let _motivoCard = null;      // card aguardando o motivo do ajuste
let _dragId     = null;
let _built      = false;
let _pollTimer  = null;

const CANAL_LABEL = Object.fromEntries(CANAIS.map(c => [c.key, c.label]));

// ── helpers ──────────────────────────────────────────────────────────────────
function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function _iniciais(nome) {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function _nomeMembro(id) {
  const m = _membros.find(x => x.id === id);
  return m?.nome || m?.email || '';
}

/** Dias inteiros decorridos desde uma data ISO. */
function _diasDesde(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function _fmtDataCurta(ymd) {
  if (!ymd) return '';
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

/** Ordem que coloca o card no fim da coluna de destino. */
function _ordemFinal(coluna, ignoraId) {
  const maior = _cards
    .filter(c => c.coluna === coluna && c.id !== ignoraId)
    .reduce((m, c) => Math.max(m, Number(c.ordem)), 0);
  return maior + 1000;
}

function _hojeYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── shell (renderizado uma vez) ──────────────────────────────────────────────
function _shell() {
  const canalOpts = CANAIS.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
  return `
  <div class="cont-wrap">
    <div class="cont-toolbar">
      <div class="cont-toolbar-left">
        <button class="btn btn-primary" id="cont-novo">+ Novo conteúdo</button>
        <div class="cont-seg">
          <button class="cont-seg-btn active" data-meus="0">Todos</button>
          <button class="cont-seg-btn" data-meus="1">Só os meus</button>
        </div>
        <select class="cont-select" id="cont-filtro-canal">
          <option value="">Todos os canais</option>
          ${canalOpts}
        </select>
      </div>
      <div class="cont-toolbar-right">
        <span class="cont-hint" id="cont-resumo"></span>
      </div>
    </div>

    <div class="cont-board" id="cont-board"></div>
  </div>

  <!-- Modal: criar/editar card -->
  <div class="cont-modal-bg" id="cont-modal" style="display:none">
    <div class="cont-modal">
      <div class="cont-modal-head">
        <h3 id="cont-modal-title">Novo conteúdo</h3>
        <button class="cont-x" id="cont-fechar">&times;</button>
      </div>
      <div class="cont-modal-body">
        <label class="cont-label">Título</label>
        <input class="cont-input" id="cont-f-titulo" placeholder="Ex.: Reels — 3 erros ao pedir empréstimo" maxlength="140">

        <div class="cont-row">
          <div>
            <label class="cont-label">Canal</label>
            <select class="cont-input" id="cont-f-canal">
              <option value="">—</option>
              ${canalOpts}
            </select>
          </div>
          <div>
            <label class="cont-label">Responsável</label>
            <select class="cont-input" id="cont-f-resp"></select>
          </div>
        </div>

        <div class="cont-row">
          <div>
            <label class="cont-label">Data alvo</label>
            <input class="cont-input" id="cont-f-data" type="date">
          </div>
          <div>
            <label class="cont-label">Etapa</label>
            <select class="cont-input" id="cont-f-coluna">
              ${COLUNAS.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <label class="cont-label">Link (Drive, Canva…)</label>
        <input class="cont-input" id="cont-f-link" placeholder="https://">

        <label class="cont-label">Descrição / briefing</label>
        <textarea class="cont-input cont-textarea" id="cont-f-desc" rows="3"></textarea>

        <div class="cont-anexos-wrap" id="cont-anexos-wrap">
          <div class="cont-hist-head">
            Artes
            <button class="cont-anexar" id="cont-anexar">+ Anexar imagem</button>
          </div>
          <div class="cont-anexos" id="cont-anexos"></div>
          <input type="file" id="cont-file" accept="image/*" multiple hidden>
        </div>

        <div class="cont-hist-wrap" id="cont-hist-wrap">
          <div class="cont-hist-head">Histórico</div>
          <div class="cont-hist" id="cont-hist"></div>
          <div class="cont-chat-box" id="cont-chat-box">
            <textarea class="cont-input cont-textarea" id="cont-chat-txt" rows="2"
                      placeholder="Escreva um comentário… (Enter envia)"></textarea>
            <button class="btn btn-ghost cont-chat-send" id="cont-chat-send">Enviar</button>
          </div>
        </div>
      </div>
      <div class="cont-modal-foot">
        <button class="btn btn-ghost cont-del" id="cont-excluir">Excluir</button>
        <div class="cont-foot-right">
          <button class="btn btn-ghost" id="cont-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="cont-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: motivo do ajuste -->
  <div class="cont-modal-bg" id="cont-motivo-modal" style="display:none">
    <div class="cont-modal cont-modal-sm">
      <div class="cont-modal-head">
        <h3>Pedir ajustes</h3>
        <button class="cont-x" id="cont-motivo-x">&times;</button>
      </div>
      <div class="cont-modal-body">
        <p class="cont-hint" style="margin-bottom:10px">O card volta para <b>Em produção</b> com o motivo registrado.</p>
        <label class="cont-label">O que precisa ser ajustado?</label>
        <textarea class="cont-input cont-textarea" id="cont-motivo-txt" rows="3" placeholder="Ex.: faltou a legenda e o CTA no final"></textarea>
      </div>
      <div class="cont-modal-foot">
        <div class="cont-foot-right">
          <button class="btn btn-ghost" id="cont-motivo-cancel">Cancelar</button>
          <button class="btn btn-primary" id="cont-motivo-ok">Enviar para ajustes</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Visualizador de imagem -->
  <div class="cont-lightbox" id="cont-lightbox" style="display:none">
    <img id="cont-lightbox-img" alt="">
  </div>`;
}

function _bindShell() {
  document.getElementById('cont-novo').addEventListener('click', () => _abrirModal(null));
  document.getElementById('cont-fechar').addEventListener('click', _fecharModal);
  document.getElementById('cont-cancelar').addEventListener('click', _fecharModal);
  document.getElementById('cont-salvar').addEventListener('click', _salvar);
  document.getElementById('cont-excluir').addEventListener('click', _excluir);

  document.querySelectorAll('.cont-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtroMeus = btn.dataset.meus === '1';
      document.querySelectorAll('.cont-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      _renderBoard();
    });
  });

  document.getElementById('cont-filtro-canal').addEventListener('change', e => {
    _filtroCanal = e.target.value;
    _renderBoard();
  });

  document.getElementById('cont-chat-send').addEventListener('click', _enviarComentario);
  document.getElementById('cont-chat-txt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _enviarComentario(); }
  });

  const inputFile = document.getElementById('cont-file');
  document.getElementById('cont-anexar').addEventListener('click', () => inputFile.click());
  inputFile.addEventListener('change', () => {
    _subirArquivos([...inputFile.files]);
    inputFile.value = '';                       // permite reenviar o mesmo arquivo
  });

  // Ctrl+V com o card aberto cola a arte direto
  document.getElementById('cont-modal').addEventListener('paste', e => {
    const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    _subirArquivos(imgs);
  });

  const lb = document.getElementById('cont-lightbox');
  lb.addEventListener('click', () => { lb.style.display = 'none'; });

  document.getElementById('cont-motivo-x').addEventListener('click', _fecharMotivo);
  document.getElementById('cont-motivo-cancel').addEventListener('click', _fecharMotivo);
  document.getElementById('cont-motivo-ok').addEventListener('click', _confirmarMotivo);
}

// ── render ───────────────────────────────────────────────────────────────────
export async function renderConteudo() {
  const sec = document.getElementById('sec-conteudo');
  if (!sec) return;

  if (!_built) {
    sec.innerHTML = _shell();
    _built = true;
    _bindShell();
  }

  const podeEditar = perm.conteudoEditar();
  document.getElementById('cont-novo').style.display = podeEditar ? '' : 'none';

  await _reload();
  _startPolling();
}

async function _reload() {
  // Retenta enquanto vier vazio — senão uma falha na 1ª carga deixaria o
  // seletor de responsável vazio até o usuário dar F5.
  if (!_membros.length) _membros = await loadMembros();

  const cards = await loadCards();
  if (cards === null) return;      // erro já reportado no serviço
  _cards = cards;
  _renderBoard();
}

function _visiveis() {
  const meuId = state.currentUser?.id;
  return _cards.filter(c => {
    if (_filtroMeus && c.responsavel_id !== meuId) return false;
    if (_filtroCanal && c.canal !== _filtroCanal) return false;
    return true;
  });
}

function _renderBoard() {
  const board = document.getElementById('cont-board');
  if (!board) return;

  const cards = _visiveis();
  const hoje  = _hojeYMD();

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

function _cardHTML(c, hoje) {
  const atrasado = c.data_alvo && c.data_alvo < hoje && c.coluna !== 'publicado';
  const dias     = _diasDesde(c.coluna_desde);
  const nome     = _nomeMembro(c.responsavel_id);
  const podeEditar  = perm.conteudoEditar();
  const podeAprovar = perm.conteudoAprovar();

  const chips = [];
  if (c.canal)     chips.push(`<span class="cont-chip">${_esc(CANAL_LABEL[c.canal] || c.canal)}</span>`);
  if (c.em_ajuste) chips.push(`<span class="cont-chip cont-chip-ajuste" title="${_esc(c.ajuste_motivo || '')}">Ajuste</span>`);

  const acoes = (c.coluna === 'aprovacao' && podeAprovar)
    ? `<div class="cont-card-acoes">
         <button class="cont-btn-ok"   data-aprovar="${c.id}">Aprovar</button>
         <button class="cont-btn-back" data-ajuste="${c.id}">Ajustes</button>
       </div>`
    : '';

  return `
    <div class="cont-card${atrasado ? ' late' : ''}" data-id="${c.id}" draggable="${podeEditar}">
      ${chips.length ? `<div class="cont-card-chips">${chips.join('')}</div>` : ''}
      <div class="cont-card-title">${_esc(c.titulo)}</div>
      ${c.em_ajuste && c.ajuste_motivo ? `<div class="cont-card-ajuste">${_esc(c.ajuste_motivo)}</div>` : ''}
      <div class="cont-card-foot">
        ${nome ? `<span class="cont-avatar" title="${_esc(nome)}">${_esc(_iniciais(nome))}</span>` : '<span class="cont-avatar cont-avatar-off" title="Sem responsável">·</span>'}
        ${c.data_alvo ? `<span class="cont-date${atrasado ? ' late' : ''}">${_fmtDataCurta(c.data_alvo)}</span>` : ''}
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
      _abrirModal(el.dataset.id);
    });
    if (!podeEditar) return;
    el.addEventListener('dragstart', () => { _dragId = el.dataset.id; el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => { _dragId = null; el.classList.remove('dragging'); });
  });

  document.querySelectorAll('#cont-board [data-aprovar]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _aprovar(btn.dataset.aprovar); })
  );
  document.querySelectorAll('#cont-board [data-ajuste]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _abrirMotivo(btn.dataset.ajuste); })
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

async function _soltar(body, y) {
  const id = _dragId;
  if (!id) return;
  const card = _cards.find(c => c.id === id);
  if (!card) return;

  const paraColuna = body.dataset.col;
  const ref        = _cardDepoisDoPonto(body, y);

  // ordem = média entre os vizinhos, para caber entre eles sem renumerar o resto
  const naColuna = _cards
    .filter(c => c.coluna === paraColuna && c.id !== id)
    .sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const idxDepois = ref ? naColuna.findIndex(c => c.id === ref.dataset.id) : naColuna.length;
  const antes = naColuna[idxDepois - 1];
  const depois = naColuna[idxDepois];
  const ordem = antes && depois ? (Number(antes.ordem) + Number(depois.ordem)) / 2
              : antes           ? Number(antes.ordem) + 1000
              : depois          ? Number(depois.ordem) - 1000
              : 1000;

  if (card.coluna === paraColuna && Number(card.ordem) === ordem) return;

  // sai do ajuste ao avançar de etapa
  const extra = (card.em_ajuste && paraColuna !== 'producao')
    ? { em_ajuste: false, ajuste_motivo: null }
    : {};

  try {
    const novo = await moveCard(card, paraColuna, ordem, extra);
    Object.assign(card, novo);
    _renderBoard();
  } catch (err) {
    console.error('moveCard:', err);
    toast('Não foi possível mover o card', 'err');
    _reload();
  }
}

// ── aprovação ────────────────────────────────────────────────────────────────
async function _aprovar(id) {
  const card = _cards.find(c => c.id === id);
  if (!card) return;
  try {
    const novo = await moveCard(card, 'agendado', _ordemFinal('agendado', card.id), {
      em_ajuste: false, ajuste_motivo: null, _evento: 'aprovado',
    });
    Object.assign(card, novo);
    toast('Conteúdo aprovado');
    _renderBoard();
  } catch (err) {
    console.error('aprovar:', err);
    toast('Erro ao aprovar', 'err');
  }
}

function _abrirMotivo(id) {
  _motivoCard = _cards.find(c => c.id === id) || null;
  if (!_motivoCard) return;
  document.getElementById('cont-motivo-txt').value = '';
  document.getElementById('cont-motivo-modal').style.display = 'flex';
  document.getElementById('cont-motivo-txt').focus();
}

function _fecharMotivo() {
  document.getElementById('cont-motivo-modal').style.display = 'none';
  _motivoCard = null;
}

async function _confirmarMotivo() {
  const motivo = document.getElementById('cont-motivo-txt').value.trim();
  if (!motivo) { toast('Escreva o que precisa ser ajustado', 'err'); return; }
  const card = _motivoCard;
  if (!card) return;
  try {
    const novo = await moveCard(card, 'producao', _ordemFinal('producao', card.id), {
      em_ajuste: true, ajuste_motivo: motivo, _evento: 'reprovado',
    });
    Object.assign(card, novo);
    _fecharMotivo();
    toast('Card devolvido para ajustes');
    _renderBoard();
  } catch (err) {
    console.error('pedirAjustes:', err);
    toast('Erro ao devolver o card', 'err');
  }
}

// ── anexos (artes) ───────────────────────────────────────────────────────────
async function _carregarAnexos(cardId) {
  const box = document.getElementById('cont-anexos');
  box.innerHTML = '<div class="cont-hist-vazio">Carregando…</div>';

  const anexos = await loadAnexos(cardId);
  if (!anexos.length) {
    box.innerHTML = '<div class="cont-hist-vazio">Nenhuma arte anexada.</div>';
    return;
  }

  const urls = await signedUrls(anexos.map(a => a.path));
  const podeEditar = perm.conteudoEditar();

  box.innerHTML = anexos.map(a => `
    <div class="cont-anexo" data-url="${_esc(urls[a.path] || '')}" title="${_esc(a.nome)}">
      <img src="${_esc(urls[a.path] || '')}" alt="${_esc(a.nome)}" loading="lazy">
      ${podeEditar ? `<button class="cont-anexo-x" data-del="${a.id}" title="Remover">&times;</button>` : ''}
    </div>`).join('');

  box.querySelectorAll('.cont-anexo').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.cont-anexo-x')) return;
      const lb = document.getElementById('cont-lightbox');
      document.getElementById('cont-lightbox-img').src = el.dataset.url;
      lb.style.display = 'flex';
    });
  });

  box.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const anexo = anexos.find(a => a.id === btn.dataset.del);
      if (!anexo || !window.confirm(`Remover "${anexo.nome}"?`)) return;
      try {
        await deleteAnexo(anexo);
        await _carregarAnexos(cardId);
      } catch (err) {
        console.error('deleteAnexo:', err);
        toast('Erro ao remover a imagem', 'err');
      }
    });
  });
}

async function _subirArquivos(files) {
  if (!_editId || !files.length) return;
  if (!perm.conteudoEditar()) return;

  const validos = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) { toast(`"${f.name}" não é imagem`, 'err'); continue; }
    if (f.size > ANEXO_MAX_BYTES)     { toast(`"${f.name}" passa de 10 MB`, 'err'); continue; }
    validos.push(f);
  }
  if (!validos.length) return;

  const btn = document.getElementById('cont-anexar');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    for (const f of validos) await uploadAnexo(_editId, f);
    await _carregarAnexos(_editId);
    await _carregarHistorico(_editId);
    toast(validos.length === 1 ? 'Imagem anexada' : `${validos.length} imagens anexadas`);
  } catch (err) {
    console.error('uploadAnexo:', err);
    toast('Erro ao enviar a imagem', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Anexar imagem';
  }
}

// ── histórico + chat ─────────────────────────────────────────────────────────
const COL_LABEL = Object.fromEntries(COLUNAS.map(c => [c.key, c.label]));

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
    const autor = _esc(e.autor_nome || 'Alguém');
    const quando = _haQuanto(e.created_at);

    if (e.tipo === 'comentario') {
      return `
        <div class="cont-hist-item cont-hist-msg">
          <span class="cont-avatar" title="${autor}">${_esc(_iniciais(e.autor_nome))}</span>
          <div class="cont-msg-corpo">
            <div class="cont-msg-topo"><b>${autor}</b><span>${quando}</span></div>
            <div class="cont-msg-txt">${_esc(e.texto || '')}</div>
          </div>
        </div>`;
    }

    const destaque = e.tipo === 'reprovado' ? ' cont-hist-alerta' : '';
    return `
      <div class="cont-hist-item${destaque}">
        <span class="cont-hist-dot"></span>
        <div class="cont-hist-txt"><b>${autor}</b> ${_esc(_descrEvento(e))}</div>
        <span class="cont-hist-quando">${quando}</span>
      </div>`;
  }).join('');

  box.scrollTop = box.scrollHeight;   // abre já no fim, na conversa mais recente
}

async function _carregarHistorico(cardId) {
  const box = document.getElementById('cont-hist');
  box.innerHTML = '<div class="cont-hist-vazio">Carregando…</div>';
  _renderTimeline(await loadEventos(cardId));
}

async function _enviarComentario() {
  const campo = document.getElementById('cont-chat-txt');
  const texto = campo.value.trim();
  if (!texto || !_editId) return;

  const btn = document.getElementById('cont-chat-send');
  btn.disabled = true;
  try {
    await comentar(_editId, texto);
    campo.value = '';
    await _carregarHistorico(_editId);
  } catch (err) {
    console.error('comentar:', err);
    toast('Erro ao enviar o comentário', 'err');
  } finally {
    btn.disabled = false;
  }
}

/** Lista legível dos campos alterados — alimenta a linha "alterou …". */
const CAMPO_LABEL = {
  titulo: 'título', descricao: 'descrição', canal: 'canal',
  responsavel_id: 'responsável', data_alvo: 'data alvo', link_url: 'link',
};

function _camposAlterados(antes, depois) {
  return Object.keys(CAMPO_LABEL)
    .filter(k => (antes?.[k] ?? null) !== (depois[k] ?? null))
    .map(k => CAMPO_LABEL[k]);
}

// ── modal de card ────────────────────────────────────────────────────────────
function _abrirModal(id) {
  const podeEditar = perm.conteudoEditar();
  if (!id && !podeEditar) return;

  _editId = id;
  const card = id ? _cards.find(c => c.id === id) : null;

  document.getElementById('cont-modal-title').textContent = card ? 'Editar conteúdo' : 'Novo conteúdo';

  const respSel = document.getElementById('cont-f-resp');
  respSel.innerHTML = '<option value="">—</option>' +
    _membros.map(m => `<option value="${m.id}">${_esc(m.nome || m.email)}</option>`).join('');

  document.getElementById('cont-f-titulo').value = card?.titulo    || '';
  document.getElementById('cont-f-canal').value  = card?.canal     || '';
  respSel.value                                  = card?.responsavel_id || '';
  document.getElementById('cont-f-data').value   = card?.data_alvo || '';
  document.getElementById('cont-f-coluna').value = card?.coluna    || 'ideias';
  document.getElementById('cont-f-link').value   = card?.link_url  || '';
  document.getElementById('cont-f-desc').value   = card?.descricao || '';

  // Sem permissão de edição, o modal vira leitura
  document.querySelectorAll('#cont-modal .cont-input').forEach(el => { el.disabled = !podeEditar; });
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
    _carregarAnexos(card.id);
    _carregarHistorico(card.id);
  }
}

function _fecharModal() {
  document.getElementById('cont-modal').style.display = 'none';
  _editId = null;
}

async function _salvar() {
  const titulo = document.getElementById('cont-f-titulo').value.trim();
  if (!titulo) { toast('Dê um título ao conteúdo', 'err'); return; }

  const coluna = document.getElementById('cont-f-coluna').value;
  const payload = {
    titulo,
    canal:          document.getElementById('cont-f-canal').value || null,
    responsavel_id: document.getElementById('cont-f-resp').value  || null,
    data_alvo:      document.getElementById('cont-f-data').value  || null,
    link_url:       document.getElementById('cont-f-link').value.trim() || null,
    descricao:      document.getElementById('cont-f-desc').value.trim() || null,
    coluna,
  };

  try {
    if (_editId) {
      const card = _cards.find(c => c.id === _editId);
      // troca de etapa pelo modal também reinicia o cronômetro da coluna
      if (card && card.coluna !== coluna) {
        payload.coluna_desde = new Date().toISOString();
      }
      const mudou = _camposAlterados(card, payload);
      const novo = await updateCard(_editId, payload);
      if (card && card.coluna !== coluna) {
        await logEvento(_editId, 'movido', { de_coluna: card.coluna, para_coluna: coluna });
      } else if (mudou.length) {
        await logEvento(_editId, 'editado', { texto: mudou.join(', ') });
      }
      Object.assign(card, novo);
      toast('Conteúdo atualizado');
    } else {
      const maior = _cards.filter(c => c.coluna === coluna)
        .reduce((m, c) => Math.max(m, Number(c.ordem)), 0);
      const novo = await createCard({ ...payload, ordem: maior + 1000 });
      _cards.push(novo);
      toast('Conteúdo criado');
    }
    _fecharModal();
    _renderBoard();
  } catch (err) {
    console.error('salvarCard:', err);
    toast('Erro ao salvar o conteúdo', 'err');
  }
}

async function _excluir() {
  if (!_editId) return;
  if (!window.confirm('Excluir este conteúdo? A ação não pode ser desfeita.')) return;
  try {
    // as imagens precisam sair do bucket antes: o CASCADE só apaga as linhas
    await removeArquivosDoCard(_editId);
    await deleteCard(_editId);
    _cards = _cards.filter(c => c.id !== _editId);
    _fecharModal();
    _renderBoard();
    toast('Conteúdo excluído');
  } catch (err) {
    console.error('excluirCard:', err);
    toast('Erro ao excluir', 'err');
  }
}

// ── revalidação ──────────────────────────────────────────────────────────────
function _secaoAtiva() {
  return document.getElementById('sec-conteudo')?.classList.contains('active');
}

function _startPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => { if (_secaoAtiva()) _reload(); }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _secaoAtiva()) _reload();
  });
}
