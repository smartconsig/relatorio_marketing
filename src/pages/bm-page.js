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

function _bindShell() {
  // cliques nos cards da lista abrem os modais correspondentes
  onAbrirModalPerfil(abrirModalPerfil);
  onAbrirModalBM(abrirModalBM);
  onAbrirModalNum(abrirModalNum);

  document.getElementById('bm-novo-perfil').addEventListener('click', () => abrirModalPerfil(null));
  document.getElementById('bm-p-x').addEventListener('click', fecharModalPerfil);
  document.getElementById('bm-p-cancelar').addEventListener('click', fecharModalPerfil);
  document.getElementById('bm-p-salvar').addEventListener('click', salvarPerfil);
  document.getElementById('bm-p-excluir').addEventListener('click', excluirPerfil);

  document.getElementById('bm-fechar').addEventListener('click', fecharModalBM);
  document.getElementById('bm-cancelar').addEventListener('click', fecharModalBM);
  document.getElementById('bm-salvar').addEventListener('click', salvarBM);
  document.getElementById('bm-excluir').addEventListener('click', excluirBM);

  document.getElementById('bm-num-x').addEventListener('click', fecharModalNum);
  document.getElementById('bm-n-cancelar').addEventListener('click', fecharModalNum);
  document.getElementById('bm-n-salvar').addEventListener('click', salvarNumero);
  document.getElementById('bm-n-excluir').addEventListener('click', excluirNumero);

  document.getElementById('bm-motivo-x').addEventListener('click', fecharMotivo);
  document.getElementById('bm-motivo-cancel').addEventListener('click', fecharMotivo);
  document.getElementById('bm-motivo-ok').addEventListener('click', confirmarMotivo);

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
