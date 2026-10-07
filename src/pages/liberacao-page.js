// ── Liberação de Margem Master — orquestrador ──────────────────────────────
// Os blocos vivem em src/pages/liberacao/:
//   lib-core.js    estado compartilhado (store S), helpers, presets, loadData
//   lib-tabela.js  shell + atualização dinâmica + linha da tabela
//   lib-modais.js  modais adicionar/editar cliente + preview de cálculo
//   lib-import.js  importadores de planilha de clientes e de acerto
//   lib-acoes.js   acerto, exportar, excluir, limpar base (+ libToggleOk legado)
//   lib-status.js  status da linha, quem age, alerta de 7 dias úteis (Fase 3)
//   lib-linha.js   linha e detalhe no visual novo
//   lib-residuo.js OK e resíduo em 4 etapas (RPCs da migration 015)
//   lib-pendencias.js importação da planilha de pendências (obs)
// Este arquivo re-exporta os 23 nomes públicos originais — main.js e os
// onclick das strings HTML não mudaram uma linha.
import { S, presetRange, spinner, loadData, temCache } from './liberacao/lib-core.js';
import { render, updateTable, reloadAndRender } from './liberacao/lib-tabela.js';

export { libImportarPendencias, libOnPendenciasFile } from './liberacao/lib-pendencias.js';
// Usados por módulos que não podem importar a tabela (evita ciclo)
export const libRedesenhar = () => updateTable();
export const libRecarregar = () => reloadAndRender();

export { libEditarCliente, libSalvarEdicao, libAddCliente, libFecharModal, libCalcPreview, libSalvarCliente } from './liberacao/lib-modais.js';
export { libImportarPlanilha, libOnImportFile, libImportarAcerto, libOnImportAcertoFile } from './liberacao/lib-import.js';
export { libExportar, libLimparBase, libDeletarCliente, libToggleOk, libSalvarAcerto } from './liberacao/lib-acoes.js';

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderLiberacao() {
  const el = document.getElementById('sec-liberacao');
  if (!el) return;
  S.page = 1; S.search = ''; S.dateFrom = null; S.dateTo = null; S.preset = null; S.empresaFiltro = '';
  S.statusFiltro = ''; S.abertos = new Set(); S.sel = new Set();
  if (temCache()) { render(el); _atualizarPorTras(); return; }
  el.innerHTML = spinner();
  await loadData();
  render(el);
}

// Voltou para a tela: mostra na hora o que já tinha e confere com o banco por trás
async function _atualizarPorTras() {
  const sync = document.getElementById('lib-sync');
  if (sync) sync.hidden = false;
  await loadData();
  updateTable();
  const s2 = document.getElementById('lib-sync');
  if (s2) s2.hidden = true;
}

// ── Ações públicas de filtro ───────────────────────────────────────────────
export function libSetSearch(val) {
  S.search = val || '';
  S.page   = 1;
  const inp = document.getElementById('lib-search');
  if (inp && inp.value !== S.search) inp.value = S.search;
  updateTable();
}

export function libSetPreset(key) {
  S.preset = key;
  const range = presetRange(key);
  S.dateFrom = range.from;
  S.dateTo   = range.to;
  S.page     = 1;
  updateTable();
}

export function libSetEmpresaFiltro(val) {
  S.empresaFiltro = val;
  S.page = 1;
  updateTable();
}

export function libClearDate() {
  S.preset = null; S.dateFrom = null; S.dateTo = null;
  S.page   = 1;
  updateTable();
}

export function libSetDateManual() {
  S.dateFrom = document.getElementById('lib-date-from')?.value || null;
  S.dateTo   = document.getElementById('lib-date-to')?.value   || null;
  S.preset   = null;
  S.page     = 1;
  updateTable();
}

export function libVerMais() {
  S.page++;
  updateTable();
  // Scroll suave até o fim da tabela
  document.getElementById('lib-ver-mais-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
