import { perm } from '../services/permissions.js';
import { toast } from '../utils/ui.js';
import { showConfirm } from '../utils/confirm.js';
import {
  MOTIVOS_INATIVA, STATUS_NUMERO, QUALIDADES, TIERS,
  loadBMs, createBM, updateBM, setBMAtiva, deleteBM,
  loadNumeros, createNumero, updateNumero, deleteNumero,
  logEvento, loadEventos,
} from '../services/bm-svc.js';

/**
 * Central de BMs — controle das Business Managers e dos números oficiais.
 * Cada ação grava direto no Supabase (sem snapshot); a lista revalida
 * a cada 30s e ao voltar o foco para a aba.
 */

let _bms      = [];
let _numeros  = [];
let _busca    = '';
let _filtro   = 'todas';          // todas | ativas | inativas
let _abertas  = new Set();        // ids das BMs expandidas
let _editBmId  = null;            // BM aberta no modal (null = nova)
let _editNumId = null;            // número aberto no modal (null = novo)
let _numBmId   = null;            // BM dona do número em edição
let _motivoBm  = null;            // BM aguardando o motivo da desativação
let _built     = false;
let _pollTimer = null;

const MOTIVO_LABEL = Object.fromEntries(MOTIVOS_INATIVA.map(m => [m.key, m.label]));
const STATUS_LABEL = Object.fromEntries(STATUS_NUMERO.map(s => [s.key, s.label]));
const QUAL_LABEL   = Object.fromEntries(QUALIDADES.map(q => [q.key, q.label]));
const TIER_LABEL   = Object.fromEntries(TIERS.map(t => [t.key, t.label]));

// ── helpers ──────────────────────────────────────────────────────────────────
function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function _opts(lista, sel) {
  return lista.map(o => `<option value="${o.key}"${o.key === sel ? ' selected' : ''}>${o.label}</option>`).join('');
}

function _fmtData(ymd) {
  if (!ymd) return '—';
  const [a, m, d] = ymd.split('-');
  return `${d}/${m}/${a}`;
}

function _fmtDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Dias inteiros decorridos desde uma data ISO/YMD. */
function _diasDesde(iso) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function _numerosDa(bmId) {
  return _numeros.filter(n => n.bm_id === bmId);
}

function _labelEvento(ev) {
  switch (ev.tipo) {
    case 'bm_criada':        return `BM criada`;
    case 'bm_desativada':    return `Desativada — ${MOTIVO_LABEL[ev.para] || ev.para || '—'}`;
    case 'bm_reativada':     return `Reativada`;
    case 'bm_editada':       return `Dados alterados${ev.texto ? `: ${ev.texto}` : ''}`;
    case 'numero_add':       return `Número adicionado — ${ev.texto || ''}`;
    case 'numero_status':    return `${ev.texto || 'Número'}: status ${STATUS_LABEL[ev.de] || ev.de} → ${STATUS_LABEL[ev.para] || ev.para}`;
    case 'numero_qualidade': return `${ev.texto || 'Número'}: qualidade ${QUAL_LABEL[ev.de] || ev.de} → ${QUAL_LABEL[ev.para] || ev.para}`;
    case 'numero_editado':   return `${ev.texto || 'Número'} editado`;
    case 'numero_removido':  return `Número removido — ${ev.texto || ''}`;
    default:                 return ev.texto || ev.tipo;
  }
}

// ── shell (renderizado uma vez) ──────────────────────────────────────────────
function _shell() {
  return `
  <div class="bm-wrap">
    <div class="bm-toolbar">
      <div class="bm-toolbar-left">
        <button class="btn btn-primary" id="bm-nova">+ Nova BM</button>
        <div class="bm-seg">
          <button class="bm-seg-btn active" data-filtro="todas">Todas</button>
          <button class="bm-seg-btn" data-filtro="ativas">Ativas</button>
          <button class="bm-seg-btn" data-filtro="inativas">Inativas</button>
        </div>
        <input class="bm-input bm-search" id="bm-busca" placeholder="Buscar BM ou número…">
      </div>
    </div>

    <div class="bm-resumo" id="bm-resumo"></div>
    <div class="bm-lista" id="bm-lista"></div>
  </div>

  <!-- Modal: criar/editar BM -->
  <div class="bm-modal-bg" id="bm-modal" style="display:none">
    <div class="bm-modal">
      <div class="bm-modal-head">
        <h3 id="bm-modal-title">Nova BM</h3>
        <button class="bm-x" id="bm-fechar">&times;</button>
      </div>
      <div class="bm-modal-body">
        <label class="bm-label">Nome da BM</label>
        <input class="bm-input" id="bm-f-nome" placeholder="Ex.: BM-07 Smart Vendas" maxlength="120">

        <div class="bm-row">
          <div>
            <label class="bm-label">ID da BM na Meta</label>
            <input class="bm-input" id="bm-f-idmeta" placeholder="Opcional">
          </div>
          <div>
            <label class="bm-label">Data de criação</label>
            <input class="bm-input" id="bm-f-data" type="date">
          </div>
        </div>

        <label class="bm-label">Observação</label>
        <textarea class="bm-input bm-textarea" id="bm-f-obs" rows="3"
                  placeholder="Ex.: BM do cartão X, usada só para campanha de servidor"></textarea>

        <div class="bm-hist-wrap" id="bm-hist-wrap" style="display:none">
          <div class="bm-hist-head">Histórico</div>
          <div class="bm-hist" id="bm-hist"></div>
        </div>
      </div>
      <div class="bm-modal-foot">
        <button class="btn btn-ghost bm-del" id="bm-excluir">Excluir</button>
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="bm-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: criar/editar número oficial -->
  <div class="bm-modal-bg" id="bm-num-modal" style="display:none">
    <div class="bm-modal bm-modal-sm">
      <div class="bm-modal-head">
        <h3 id="bm-num-title">Novo número oficial</h3>
        <button class="bm-x" id="bm-num-x">&times;</button>
      </div>
      <div class="bm-modal-body">
        <div class="bm-row">
          <div>
            <label class="bm-label">Número</label>
            <input class="bm-input" id="bm-n-numero" placeholder="+55 62 90000-0000">
          </div>
          <div>
            <label class="bm-label">Nome de exibição</label>
            <input class="bm-input" id="bm-n-nome" placeholder="Ex.: Smart Consig">
          </div>
        </div>

        <div class="bm-row">
          <div>
            <label class="bm-label">Status</label>
            <select class="bm-input" id="bm-n-status">${_opts(STATUS_NUMERO)}</select>
          </div>
          <div>
            <label class="bm-label">Qualidade</label>
            <select class="bm-input" id="bm-n-qual">${_opts(QUALIDADES)}</select>
          </div>
        </div>

        <div class="bm-row">
          <div>
            <label class="bm-label">Limite de conversas</label>
            <select class="bm-input" id="bm-n-tier">${_opts(TIERS)}</select>
          </div>
          <div>
            <label class="bm-label">Ativado em</label>
            <input class="bm-input" id="bm-n-data" type="date">
          </div>
        </div>

        <label class="bm-label">Observação</label>
        <textarea class="bm-input bm-textarea" id="bm-n-obs" rows="2"
                  placeholder="Ex.: banido após disparo em massa no dia 12"></textarea>
      </div>
      <div class="bm-modal-foot">
        <button class="btn btn-ghost bm-del" id="bm-n-excluir">Excluir</button>
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-n-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="bm-n-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: motivo da desativação -->
  <div class="bm-modal-bg" id="bm-motivo-modal" style="display:none">
    <div class="bm-modal bm-modal-sm">
      <div class="bm-modal-head">
        <h3>Desativar BM</h3>
        <button class="bm-x" id="bm-motivo-x">&times;</button>
      </div>
      <div class="bm-modal-body">
        <p class="bm-hint" style="margin-bottom:10px">
          O motivo fica registrado no histórico — é ele que separa banimento de desativação por opção.
        </p>
        <label class="bm-label">Por que ela saiu do ar?</label>
        <select class="bm-input" id="bm-motivo-sel">${_opts(MOTIVOS_INATIVA, 'banida')}</select>
        <label class="bm-label">Detalhe (opcional)</label>
        <textarea class="bm-input bm-textarea" id="bm-motivo-txt" rows="2"
                  placeholder="Ex.: banimento por política de mensagens"></textarea>
      </div>
      <div class="bm-modal-foot">
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-motivo-cancel">Cancelar</button>
          <button class="btn btn-primary" id="bm-motivo-ok">Desativar</button>
        </div>
      </div>
    </div>
  </div>`;
}

function _bindShell() {
  document.getElementById('bm-nova').addEventListener('click', () => _abrirModalBM(null));
  document.getElementById('bm-fechar').addEventListener('click', _fecharModalBM);
  document.getElementById('bm-cancelar').addEventListener('click', _fecharModalBM);
  document.getElementById('bm-salvar').addEventListener('click', _salvarBM);
  document.getElementById('bm-excluir').addEventListener('click', _excluirBM);

  document.getElementById('bm-num-x').addEventListener('click', _fecharModalNum);
  document.getElementById('bm-n-cancelar').addEventListener('click', _fecharModalNum);
  document.getElementById('bm-n-salvar').addEventListener('click', _salvarNumero);
  document.getElementById('bm-n-excluir').addEventListener('click', _excluirNumero);

  document.getElementById('bm-motivo-x').addEventListener('click', _fecharMotivo);
  document.getElementById('bm-motivo-cancel').addEventListener('click', _fecharMotivo);
  document.getElementById('bm-motivo-ok').addEventListener('click', _confirmarMotivo);

  document.querySelectorAll('.bm-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtro = btn.dataset.filtro;
      document.querySelectorAll('.bm-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      _renderLista();
    });
  });

  document.getElementById('bm-busca').addEventListener('input', e => {
    _busca = e.target.value.trim().toLowerCase();
    _renderLista();
  });
}

// ── render ───────────────────────────────────────────────────────────────────
export async function renderBMs() {
  const sec = document.getElementById('sec-bms');
  if (!sec) return;

  if (!_built) {
    sec.innerHTML = _shell();
    _built = true;
    _bindShell();
  }

  document.getElementById('bm-nova').style.display = perm.bmEditar() ? '' : 'none';

  await _reload();
  _startPolling();
}

async function _reload() {
  const [bms, nums] = await Promise.all([loadBMs(), loadNumeros()]);
  if (bms === null || nums === null) return;   // erro já reportado no serviço
  _bms     = bms;
  _numeros = nums;
  _renderLista();
}

function _visiveis() {
  return _bms.filter(bm => {
    if (_filtro === 'ativas'   && !bm.ativa) return false;
    if (_filtro === 'inativas' &&  bm.ativa) return false;
    if (!_busca) return true;
    const alvo = [bm.nome, bm.bm_id_meta, ..._numerosDa(bm.id).flatMap(n => [n.numero, n.nome_exibicao])]
      .filter(Boolean).join(' ').toLowerCase();
    return alvo.includes(_busca);
  });
}

function _renderLista() {
  const lista = document.getElementById('bm-lista');
  if (!lista) return;

  const bms = _visiveis();
  lista.innerHTML = bms.length
    ? bms.map(_bmCardHTML).join('')
    : `<div class="bm-vazio">${_bms.length ? 'Nenhuma BM encontrada com esse filtro.' : 'Nenhuma BM cadastrada ainda.'}</div>`;

  _bindLista();
  _renderResumo();
}

function _renderResumo() {
  const ativas   = _bms.filter(b => b.ativa).length;
  const inativas = _bms.length - ativas;
  const banidas  = _bms.filter(b => !b.ativa && b.motivo_inativa === 'banida').length;
  const numAtivos  = _numeros.filter(n => n.status === 'ativo').length;
  const numBanidos = _numeros.filter(n => n.status === 'banido').length;
  const qualBaixa  = _numeros.filter(n => n.status === 'ativo' && n.qualidade === 'baixa').length;

  const cards = [
    { label: 'BMs ativas',        valor: ativas,     sub: inativas ? `${inativas} fora do ar` : '' },
    { label: 'BMs banidas',       valor: banidas,    sub: '', tom: banidas ? 'ruim' : '' },
    { label: 'Números ativos',    valor: numAtivos,  sub: `${_numeros.length} no total` },
    { label: 'Números banidos',   valor: numBanidos, sub: '', tom: numBanidos ? 'ruim' : '' },
    { label: 'Qualidade baixa',   valor: qualBaixa,  sub: 'entre os ativos', tom: qualBaixa ? 'alerta' : '' },
  ];

  document.getElementById('bm-resumo').innerHTML = cards.map(c => `
    <div class="bm-kpi${c.tom ? ` ${c.tom}` : ''}">
      <div class="bm-kpi-valor">${c.valor}</div>
      <div class="bm-kpi-label">${c.label}</div>
      ${c.sub ? `<div class="bm-kpi-sub">${c.sub}</div>` : ''}
    </div>`).join('');
}

function _bmCardHTML(bm) {
  const nums     = _numerosDa(bm.id);
  const ativos   = nums.filter(n => n.status === 'ativo').length;
  const banidos  = nums.filter(n => n.status === 'banido').length;
  const aberta   = _abertas.has(bm.id);
  const podeEditar = perm.bmEditar();

  const statusBadge = bm.ativa
    ? '<span class="bm-badge ok">Ativa</span>'
    : `<span class="bm-badge ${bm.motivo_inativa === 'banida' ? 'ruim' : 'off'}">${_esc(MOTIVO_LABEL[bm.motivo_inativa] || 'Inativa')}</span>`;

  const resumo = [
    `${nums.length} número${nums.length === 1 ? '' : 's'}`,
    ativos  ? `${ativos} ativo${ativos === 1 ? '' : 's'}` : null,
    banidos ? `<span class="bm-ruim-txt">${banidos} banido${banidos === 1 ? '' : 's'}</span>` : null,
  ].filter(Boolean).join(' · ');

  return `
    <div class="bm-card${bm.ativa ? '' : ' off'}${aberta ? ' aberta' : ''}" data-bm="${bm.id}">
      <div class="bm-card-head" data-expandir="${bm.id}">
        <svg class="bm-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <div class="bm-card-info">
          <div class="bm-card-nome">
            ${_esc(bm.nome)}
            ${statusBadge}
            ${bm.bm_id_meta ? `<span class="bm-idmeta">ID ${_esc(bm.bm_id_meta)}</span>` : ''}
          </div>
          <div class="bm-card-sub">${resumo}</div>
        </div>
        <div class="bm-card-acoes">
          ${podeEditar ? `<button class="bm-link" data-editar="${bm.id}">Editar</button>` : ''}
          <button class="bm-switch${bm.ativa ? ' on' : ''}" data-toggle="${bm.id}"
                  ${podeEditar ? '' : 'disabled'}
                  title="${bm.ativa ? 'Desativar BM' : 'Reativar BM'}"
                  aria-pressed="${bm.ativa}"><span class="bm-switch-knob"></span></button>
        </div>
      </div>
      ${aberta ? _numerosHTML(bm, nums, podeEditar) : ''}
    </div>`;
}

function _numerosHTML(bm, nums, podeEditar) {
  const linhas = nums.length ? nums.map(n => {
    const dias = _diasDesde(n.data_ativacao || n.created_at);
    return `
      <tr data-num="${n.id}">
        <td class="bm-td-num">${_esc(n.numero)}</td>
        <td>${_esc(n.nome_exibicao || '—')}</td>
        <td><span class="bm-badge ${n.status === 'ativo' ? 'ok' : n.status === 'banido' ? 'ruim' : 'off'}">${STATUS_LABEL[n.status] || n.status}</span></td>
        <td><span class="bm-qual q-${n.qualidade}">${QUAL_LABEL[n.qualidade] || n.qualidade}</span></td>
        <td>${TIER_LABEL[n.tier] || n.tier}</td>
        <td>${_fmtData(n.data_ativacao)}${dias !== null ? ` <span class="bm-dias">${dias}d</span>` : ''}</td>
        <td class="bm-td-acao">${podeEditar ? `<button class="bm-link" data-editar-num="${n.id}">Editar</button>` : ''}</td>
      </tr>`;
  }).join('') : `<tr><td colspan="7" class="bm-vazio-td">Nenhum número oficial cadastrado nesta BM.</td></tr>`;

  return `
    <div class="bm-card-body">
      <table class="bm-table">
        <thead>
          <tr>
            <th>Número</th><th>Nome de exibição</th><th>Status</th>
            <th>Qualidade</th><th>Limite</th><th>Ativado em</th><th></th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      ${podeEditar ? `<button class="bm-add-num" data-add-num="${bm.id}">+ Adicionar número oficial</button>` : ''}
    </div>`;
}

function _bindLista() {
  document.querySelectorAll('#bm-lista [data-expandir]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.bm-card-acoes')) return;   // botões têm ação própria
      const id = el.dataset.expandir;
      if (_abertas.has(id)) _abertas.delete(id); else _abertas.add(id);
      _renderLista();
    });
  });

  document.querySelectorAll('#bm-lista [data-editar]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _abrirModalBM(btn.dataset.editar); })
  );
  document.querySelectorAll('#bm-lista [data-toggle]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _toggleBM(btn.dataset.toggle); })
  );
  document.querySelectorAll('#bm-lista [data-add-num]').forEach(btn =>
    btn.addEventListener('click', () => _abrirModalNum(btn.dataset.addNum, null))
  );
  document.querySelectorAll('#bm-lista [data-editar-num]').forEach(btn =>
    btn.addEventListener('click', () => {
      const n = _numeros.find(x => x.id === btn.dataset.editarNum);
      if (n) _abrirModalNum(n.bm_id, n.id);
    })
  );
}

// ── liga/desliga ─────────────────────────────────────────────────────────────
function _toggleBM(id) {
  const bm = _bms.find(b => b.id === id);
  if (!bm || !perm.bmEditar()) return;

  if (bm.ativa) {                       // desligar exige motivo
    _motivoBm = bm;
    document.getElementById('bm-motivo-sel').value = 'banida';
    document.getElementById('bm-motivo-txt').value = '';
    document.getElementById('bm-motivo-modal').style.display = 'flex';
    return;
  }
  _aplicarToggle(bm, true, null, null);  // religar é direto
}

function _fecharMotivo() {
  _motivoBm = null;
  document.getElementById('bm-motivo-modal').style.display = 'none';
}

function _confirmarMotivo() {
  const bm = _motivoBm;
  if (!bm) return;
  const motivo = document.getElementById('bm-motivo-sel').value;
  const nota   = document.getElementById('bm-motivo-txt').value.trim();
  _fecharMotivo();
  _aplicarToggle(bm, false, motivo, nota);
}

async function _aplicarToggle(bm, ativa, motivo, nota) {
  try {
    const novo = await setBMAtiva(bm, ativa, motivo);
    if (nota) await logEvento({ bm_id: bm.id, tipo: 'nota', texto: nota });
    Object.assign(bm, novo);
    _renderLista();
    toast(ativa ? 'BM reativada' : 'BM desativada');
  } catch (err) {
    console.error('toggleBM:', err);
    toast('Erro ao alterar a BM', 'err');
  }
}

// ── modal: BM ────────────────────────────────────────────────────────────────
async function _abrirModalBM(id) {
  if (!perm.bmEditar()) return;
  _editBmId = id;
  const bm = id ? _bms.find(b => b.id === id) : null;

  document.getElementById('bm-modal-title').textContent = bm ? 'Editar BM' : 'Nova BM';
  document.getElementById('bm-f-nome').value   = bm?.nome || '';
  document.getElementById('bm-f-idmeta').value = bm?.bm_id_meta || '';
  document.getElementById('bm-f-data').value   = bm?.data_criacao_bm || '';
  document.getElementById('bm-f-obs').value    = bm?.observacao || '';
  document.getElementById('bm-excluir').style.display = bm && perm.isAdmin() ? '' : 'none';

  const histWrap = document.getElementById('bm-hist-wrap');
  histWrap.style.display = bm ? '' : 'none';
  document.getElementById('bm-modal').style.display = 'flex';
  document.getElementById('bm-f-nome').focus();

  if (bm) {
    document.getElementById('bm-hist').innerHTML = '<div class="bm-hint">Carregando…</div>';
    const eventos = await loadEventos(bm.id);
    if (_editBmId !== bm.id) return;                    // usuário já trocou de modal
    document.getElementById('bm-hist').innerHTML = eventos.length
      ? eventos.map(ev => `
          <div class="bm-hist-item">
            <span class="bm-hist-txt">${_esc(_labelEvento(ev))}</span>
            <span class="bm-hist-meta">${_esc(ev.autor_nome || '')} · ${_fmtDataHora(ev.created_at)}</span>
          </div>`).join('')
      : '<div class="bm-hint">Sem histórico ainda.</div>';
  }
}

function _fecharModalBM() {
  _editBmId = null;
  document.getElementById('bm-modal').style.display = 'none';
}

async function _salvarBM() {
  const nome = document.getElementById('bm-f-nome').value.trim();
  if (!nome) { toast('Dê um nome para a BM', 'err'); return; }

  const payload = {
    nome,
    bm_id_meta:      document.getElementById('bm-f-idmeta').value.trim() || null,
    data_criacao_bm: document.getElementById('bm-f-data').value || null,
    observacao:      document.getElementById('bm-f-obs').value.trim() || null,
  };

  try {
    if (_editBmId) {
      const bm = _bms.find(b => b.id === _editBmId);
      const novo = await updateBM(_editBmId, payload);
      const mudou = Object.keys(payload).filter(k => (bm[k] || '') !== (payload[k] || ''));
      if (mudou.length) await logEvento({ bm_id: _editBmId, tipo: 'bm_editada', texto: mudou.join(', ') });
      Object.assign(bm, novo);
      toast('BM atualizada');
    } else {
      const novo = await createBM(payload);
      _bms.push(novo);
      _bms.sort((a, b) => a.nome.localeCompare(b.nome));
      _abertas.add(novo.id);            // já abre para cadastrar os números
      toast('BM criada');
    }
    _fecharModalBM();
    _renderLista();
  } catch (err) {
    console.error('salvarBM:', err);
    toast('Erro ao salvar a BM', 'err');
  }
}

function _excluirBM() {
  if (!_editBmId) return;
  const id  = _editBmId;
  const bm  = _bms.find(b => b.id === id);
  const qtd = _numerosDa(id).length;
  showConfirm(
    'Excluir BM?',
    `Os ${qtd} número(s) e todo o histórico dela também serão apagados. Esta ação não pode ser desfeita.`,
    'Excluir',
    async () => {
      try {
        await deleteBM(id);
        _bms     = _bms.filter(b => b.id !== id);
        _numeros = _numeros.filter(n => n.bm_id !== id);
        _abertas.delete(id);
        _fecharModalBM();
        _renderLista();
        toast(`BM "${bm?.nome || ''}" excluída`);
      } catch (err) {
        console.error('excluirBM:', err);
        toast('Erro ao excluir a BM', 'err');
      }
    },
  );
}

// ── modal: número oficial ────────────────────────────────────────────────────
function _abrirModalNum(bmId, numId) {
  if (!perm.bmEditar()) return;
  _numBmId   = bmId;
  _editNumId = numId;
  const n  = numId ? _numeros.find(x => x.id === numId) : null;
  const bm = _bms.find(b => b.id === bmId);

  document.getElementById('bm-num-title').textContent =
    (n ? 'Editar número — ' : 'Novo número — ') + (bm?.nome || '');
  document.getElementById('bm-n-numero').value = n?.numero || '';
  document.getElementById('bm-n-nome').value   = n?.nome_exibicao || '';
  document.getElementById('bm-n-status').value = n?.status    || 'ativo';
  document.getElementById('bm-n-qual').value   = n?.qualidade || 'na';
  document.getElementById('bm-n-tier').value   = n?.tier      || 'na';
  document.getElementById('bm-n-data').value   = n?.data_ativacao || '';
  document.getElementById('bm-n-obs').value    = n?.observacao || '';
  document.getElementById('bm-n-excluir').style.display = n ? '' : 'none';

  document.getElementById('bm-num-modal').style.display = 'flex';
  document.getElementById('bm-n-numero').focus();
}

function _fecharModalNum() {
  _editNumId = null;
  _numBmId   = null;
  document.getElementById('bm-num-modal').style.display = 'none';
}

async function _salvarNumero() {
  const numero = document.getElementById('bm-n-numero').value.trim();
  if (!numero) { toast('Informe o número', 'err'); return; }

  const payload = {
    numero,
    nome_exibicao: document.getElementById('bm-n-nome').value.trim() || null,
    status:        document.getElementById('bm-n-status').value,
    qualidade:     document.getElementById('bm-n-qual').value,
    tier:          document.getElementById('bm-n-tier').value,
    data_ativacao: document.getElementById('bm-n-data').value || null,
    observacao:    document.getElementById('bm-n-obs').value.trim() || null,
  };

  try {
    if (_editNumId) {
      const n = _numeros.find(x => x.id === _editNumId);
      const novo = await updateNumero(n, payload);
      Object.assign(n, novo);
      toast('Número atualizado');
    } else {
      const novo = await createNumero({ ...payload, bm_id: _numBmId });
      _numeros.push(novo);
      toast('Número adicionado');
    }
    _fecharModalNum();
    _renderLista();
  } catch (err) {
    console.error('salvarNumero:', err);
    toast('Erro ao salvar o número', 'err');
  }
}

function _excluirNumero() {
  if (!_editNumId) return;
  const n = _numeros.find(x => x.id === _editNumId);
  if (!n) return;
  showConfirm(
    'Excluir número?',
    'Prefira marcar como "Banido" para manter o histórico. Excluir apaga o registro de vez.',
    'Excluir',
    async () => {
      try {
        await deleteNumero(n);
        _numeros = _numeros.filter(x => x.id !== n.id);
        _fecharModalNum();
        _renderLista();
        toast('Número excluído');
      } catch (err) {
        console.error('excluirNumero:', err);
        toast('Erro ao excluir o número', 'err');
      }
    },
  );
}

// ── revalidação ──────────────────────────────────────────────────────────────
function _secaoAtiva() {
  return document.getElementById('sec-bms')?.classList.contains('active');
}

function _startPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => { if (_secaoAtiva()) _reload(); }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _secaoAtiva()) _reload();
  });
}
