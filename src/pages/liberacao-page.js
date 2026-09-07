// ── Liberação de Margem Master — orquestrador ──────────────────────────────
// Os blocos vivem em src/pages/liberacao/:
//   lib-core.js    estado compartilhado (store S), helpers, presets, loadData
//   lib-tabela.js  shell + atualização dinâmica + linha da tabela
//   lib-modais.js  modais adicionar/editar cliente + preview de cálculo
//   lib-import.js  importadores de planilha de clientes e de acerto
//   lib-acoes.js   OK, acerto, resíduo, exportar, excluir, limpar base
// Este arquivo re-exporta os 23 nomes públicos originais — main.js e os
// onclick das strings HTML não mudaram uma linha.
import { S, presetRange, spinner, loadData } from './liberacao/lib-core.js';
import { render, updateTable } from './liberacao/lib-tabela.js';

export { libEditarCliente, libSalvarEdicao, libAddCliente, libFecharModal, libCalcPreview, libSalvarCliente } from './liberacao/lib-modais.js';
export { libImportarPlanilha, libOnImportFile, libImportarAcerto, libOnImportAcertoFile } from './liberacao/lib-import.js';
export { libParaResiduo, libExportar, libLimparBase, libDeletarCliente, libToggleOk, libSalvarAcerto } from './liberacao/lib-acoes.js';

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderLiberacao() {
  const el = document.getElementById('sec-liberacao');
  if (!el) return;
  S.page = 1; S.search = ''; S.dateFrom = null; S.dateTo = null; S.preset = null; S.empresaFiltro = '';
  el.innerHTML = spinner();
  await loadData();
  render(el);
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
