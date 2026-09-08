// Lista da Central de BMs: render + resumo (KPIs) + listeners dos cards +
// liga/desliga com modal de motivo. Os abridores de modal são injetados por
// callback (onAbrirModalPerfil/BM/Num) — este módulo nunca importa os modais.
import { perm } from '../../services/permissions.js';
import { toast } from '../../utils/ui.js';
import { MOTIVOS_INATIVA, MOTIVOS_PERFIL, setPerfilAtivo, setBMAtiva, logEvento } from '../../services/bm-svc.js';
import { B, opts, bmsDo, bmMatch } from './bm-core.js';
import { perfilCardHTML } from './bm-cards.js';

// Callbacks registrados pelo orquestrador
let _onAbrirPerfil = () => {};
let _onAbrirBM     = () => {};
let _onAbrirNum    = () => {};
export function onAbrirModalPerfil(fn) { _onAbrirPerfil = fn; }
export function onAbrirModalBM(fn)     { _onAbrirBM = fn; }
export function onAbrirModalNum(fn)    { _onAbrirNum = fn; }

function _perfisVisiveis() {
  return B.perfis.filter(p => {
    if (B.filtro === 'ativos'   && !p.ativa) return false;
    if (B.filtro === 'inativos' &&  p.ativa) return false;
    if (!B.busca) return true;
    return p.nome.toLowerCase().includes(B.busca) || bmsDo(p.id).some(bm => bmMatch(bm));
  });
}

export function renderLista() {
  const lista = document.getElementById('bm-lista');
  if (!lista) return;

  const perfis = _perfisVisiveis();
  lista.innerHTML = perfis.length
    ? perfis.map(perfilCardHTML).join('')
    : `<div class="bm-vazio">${B.perfis.length ? 'Nenhum perfil encontrado com esse filtro.' : 'Nenhum perfil cadastrado ainda.'}</div>`;

  _bindLista();
  _renderResumo();
}

function _renderResumo() {
  const perfilOk = Object.fromEntries(B.perfis.map(p => [p.id, p.ativa]));
  const perfisAtivos   = B.perfis.filter(p => p.ativa).length;
  const perfisInativos = B.perfis.length - perfisAtivos;

  // BM só conta como ativa se ela E o perfil dela estiverem no ar
  const bmsAtivas = B.bms.filter(b => b.ativa && perfilOk[b.perfil_id]).length;
  const bmsFora   = B.bms.length - bmsAtivas;
  const banidas   = B.bms.filter(b => !b.ativa && b.motivo_inativa === 'banida').length;

  const numAtivos  = B.numeros.filter(n => n.status === 'ativo').length;
  const numBanidos = B.numeros.filter(n => n.status === 'banido').length;
  const qualBaixa  = B.numeros.filter(n => n.status === 'ativo' && n.qualidade === 'baixa').length;

  const cards = [
    { label: 'Perfis ativos',     valor: perfisAtivos, sub: perfisInativos ? `${perfisInativos} fora do ar` : '' },
    { label: 'BMs ativas',        valor: bmsAtivas,    sub: bmsFora ? `${bmsFora} fora do ar` : '' },
    { label: 'BMs banidas',       valor: banidas,      sub: '', tom: banidas ? 'ruim' : '' },
    { label: 'Números ativos',    valor: numAtivos,    sub: `${B.numeros.length} no total` },
    { label: 'Números banidos',   valor: numBanidos,   sub: '', tom: numBanidos ? 'ruim' : '' },
    { label: 'Qualidade baixa',   valor: qualBaixa,    sub: 'entre os ativos', tom: qualBaixa ? 'alerta' : '' },
  ];

  document.getElementById('bm-resumo').innerHTML = cards.map(c => `
    <div class="bm-kpi${c.tom ? ` ${c.tom}` : ''}">
      <div class="bm-kpi-valor">${c.valor}</div>
      <div class="bm-kpi-label">${c.label}</div>
      ${c.sub ? `<div class="bm-kpi-sub">${c.sub}</div>` : ''}
    </div>`).join('');
}

function _bindLista() {
  document.querySelectorAll('#bm-lista [data-expandir-perfil]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.bm-card-acoes')) return;   // botões têm ação própria
      const id = el.dataset.expandirPerfil;
      if (B.abertosP.has(id)) B.abertosP.delete(id); else B.abertosP.add(id);
      renderLista();
    });
  });

  document.querySelectorAll('#bm-lista [data-editar-perfil]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _onAbrirPerfil(btn.dataset.editarPerfil); })
  );
  document.querySelectorAll('#bm-lista [data-toggle-perfil]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _togglePerfil(btn.dataset.togglePerfil); })
  );
  document.querySelectorAll('#bm-lista [data-add-bm]').forEach(btn =>
    btn.addEventListener('click', () => _onAbrirBM(null, btn.dataset.addBm))
  );

  document.querySelectorAll('#bm-lista [data-expandir]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.bm-card-acoes')) return;
      const id = el.dataset.expandir;
      if (B.abertas.has(id)) B.abertas.delete(id); else B.abertas.add(id);
      renderLista();
    });
  });

  document.querySelectorAll('#bm-lista [data-editar]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _onAbrirBM(btn.dataset.editar, null); })
  );
  document.querySelectorAll('#bm-lista [data-toggle]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); _toggleBM(btn.dataset.toggle); })
  );
  document.querySelectorAll('#bm-lista [data-add-num]').forEach(btn =>
    btn.addEventListener('click', () => _onAbrirNum(btn.dataset.addNum, null))
  );
  document.querySelectorAll('#bm-lista [data-editar-num]').forEach(btn =>
    btn.addEventListener('click', () => {
      const n = B.numeros.find(x => x.id === btn.dataset.editarNum);
      if (n) _onAbrirNum(n.bm_id, n.id);
    })
  );
}

// ── liga/desliga (BM e perfil compartilham o modal de motivo) ────────────────
function _togglePerfil(id) {
  const p = B.perfis.find(x => x.id === id);
  if (!p || !perm.bmEditar()) return;

  if (p.ativa) {                        // desligar exige motivo
    _abrirMotivo('perfil', p);
    return;
  }
  _aplicarTogglePerfil(p, true, null, null);   // religar é direto
}

function _toggleBM(id) {
  const bm = B.bms.find(b => b.id === id);
  if (!bm || !perm.bmEditar()) return;

  if (bm.ativa) {                       // desligar exige motivo
    _abrirMotivo('bm', bm);
    return;
  }
  _aplicarToggle(bm, true, null, null);  // religar é direto
}

function _abrirMotivo(tipo, obj) {
  B.motivoAlvo = { tipo, obj };
  const ehPerfil = tipo === 'perfil';
  document.getElementById('bm-motivo-title').textContent = ehPerfil ? 'Desativar perfil' : 'Desativar BM';
  document.getElementById('bm-motivo-sel').innerHTML =
    opts(ehPerfil ? MOTIVOS_PERFIL : MOTIVOS_INATIVA, ehPerfil ? 'banido' : 'banida');
  document.getElementById('bm-motivo-txt').value = '';
  document.getElementById('bm-motivo-modal').style.display = 'flex';
}

export function fecharMotivo() {
  B.motivoAlvo = null;
  document.getElementById('bm-motivo-modal').style.display = 'none';
}

export function confirmarMotivo() {
  const alvo = B.motivoAlvo;
  if (!alvo) return;
  const motivo = document.getElementById('bm-motivo-sel').value;
  const nota   = document.getElementById('bm-motivo-txt').value.trim();
  fecharMotivo();
  if (alvo.tipo === 'perfil') _aplicarTogglePerfil(alvo.obj, false, motivo, nota);
  else                        _aplicarToggle(alvo.obj, false, motivo, nota);
}

async function _aplicarTogglePerfil(p, ativa, motivo, nota) {
  try {
    const novo = await setPerfilAtivo(p, ativa, motivo);
    if (nota) await logEvento({ perfil_id: p.id, tipo: 'nota', texto: nota });
    Object.assign(p, novo);
    renderLista();
    toast(ativa ? 'Perfil reativado' : 'Perfil desativado');
  } catch (err) {
    console.error('togglePerfil:', err);
    toast('Erro ao alterar o perfil', 'err');
  }
}

async function _aplicarToggle(bm, ativa, motivo, nota) {
  try {
    const novo = await setBMAtiva(bm, ativa, motivo);
    if (nota) await logEvento({ bm_id: bm.id, tipo: 'nota', texto: nota });
    Object.assign(bm, novo);
    renderLista();
    toast(ativa ? 'BM reativada' : 'BM desativada');
  } catch (err) {
    console.error('toggleBM:', err);
    toast('Erro ao alterar a BM', 'err');
  }
}
