// Central de BMs — orquestrador. Os blocos vivem em src/pages/bm/:
//   bm-core.js   estado compartilhado (B) + rótulos + helpers
//   bm-shell.js  shell (renderizado 1x): toolbar, resumo, lista e 4 modais
//   bm-cards.js  HTML dos cards perfil → BM → números
//   bm-lista.js  render + KPIs + listeners + liga/desliga com motivo
//   bm-modais.js modais de perfil, BM e número (criar/editar/excluir)
// Hierarquia Perfil (Facebook) → BMs → números oficiais; toda ação grava
// direto no Supabase (sem snapshot) e a lista revalida a cada 30s e ao
// voltar o foco para a aba. Export público: renderBMs.
import { perm } from '../services/permissions.js';
import { loadPerfis, loadBMs, loadNumeros } from '../services/bm-svc.js';
import { B } from './bm/bm-core.js';
import { shellHTML } from './bm/bm-shell.js';
import { renderLista, onAbrirModalPerfil, onAbrirModalBM, onAbrirModalNum, fecharMotivo, confirmarMotivo } from './bm/bm-lista.js';
import {
  abrirModalPerfil, fecharModalPerfil, salvarPerfil, excluirPerfil,
  abrirModalBM, fecharModalBM, salvarBM, excluirBM,
  abrirModalNum, fecharModalNum, salvarNumero, excluirNumero,
} from './bm/bm-modais.js';

// (id do elemento, handler) de cada clique dos modais — mesma lista de antes,
// só que em tabela para ligar num laço.
const _CLIQUES_SHELL = [
  ['bm-novo-perfil',   () => abrirModalPerfil(null)],
  ['bm-p-x',           fecharModalPerfil],
  ['bm-p-cancelar',    fecharModalPerfil],
  ['bm-p-salvar',      salvarPerfil],
  ['bm-p-excluir',     excluirPerfil],
  ['bm-fechar',        fecharModalBM],
  ['bm-cancelar',      fecharModalBM],
  ['bm-salvar',        salvarBM],
  ['bm-excluir',       excluirBM],
  ['bm-num-x',         fecharModalNum],
  ['bm-n-cancelar',    fecharModalNum],
  ['bm-n-salvar',      salvarNumero],
  ['bm-n-excluir',     excluirNumero],
  ['bm-motivo-x',      fecharMotivo],
  ['bm-motivo-cancel', fecharMotivo],
  ['bm-motivo-ok',     confirmarMotivo],
];

function _bindShell() {
  // cliques nos cards da lista abrem os modais correspondentes
  onAbrirModalPerfil(abrirModalPerfil);
  onAbrirModalBM(abrirModalBM);
  onAbrirModalNum(abrirModalNum);

  _CLIQUES_SHELL.forEach(([id, fn]) => document.getElementById(id).addEventListener('click', fn));

  document.querySelectorAll('.bm-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      B.filtro = btn.dataset.filtro;
      document.querySelectorAll('.bm-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderLista();
    });
  });

  document.getElementById('bm-busca').addEventListener('input', e => {
    B.busca = e.target.value.trim().toLowerCase();
    renderLista();
  });
}

// ── render ───────────────────────────────────────────────────────────────────
export async function renderBMs() {
  const sec = document.getElementById('sec-bms');
  if (!sec) return;

  if (!B.built) {
    sec.innerHTML = shellHTML();
    B.built = true;
    _bindShell();
  }

  document.getElementById('bm-novo-perfil').style.display = perm.bmEditar() ? '' : 'none';

  await _reload();
  _startPolling();
}

async function _reload() {
  const [perfis, bms, nums] = await Promise.all([loadPerfis(), loadBMs(), loadNumeros()]);
  if (perfis === null || bms === null || nums === null) return;   // erro já reportado no serviço
  B.perfis  = perfis;
  B.bms     = bms;
  B.numeros = nums;
  renderLista();
}

// ── revalidação ──────────────────────────────────────────────────────────────
function _secaoAtiva() {
  return document.getElementById('sec-bms')?.classList.contains('active');
}

function _startPolling() {
  if (B.pollTimer) return;
  B.pollTimer = setInterval(() => { if (_secaoAtiva()) _reload(); }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _secaoAtiva()) _reload();
  });
}
