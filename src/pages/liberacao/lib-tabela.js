// Tabela da Liberação de Margem: shell (render único), atualização dinâmica
// e linha. Contrato de DOM com lib-acoes.js: libToggleOk atualiza a linha
// cirurgicamente (classes lib-tr/lib-btn-ok/lib-badge-*) — manter em sincronia
// com renderRow.
import { state } from '../../state.js';
import { perm } from '../../services/permissions.js';
import { S, PAGE_SIZE, isAdmin, fmtBRL, fmtDate, esc, PRESETS, filtered, loadData } from './lib-core.js';

// Padrão comum pós-escrita: recarrega do banco e redesenha o shell inteiro.
export async function reloadAndRender() {
  await loadData();
  const el = document.getElementById('sec-liberacao');
  if (el) render(el);
}

// ── Render shell (once) ───────────────────────────────────────────────────
export function render(el) {
  const admin = isAdmin();
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Liberação de Margem Master</h1>
          <p class="lib-count"></p>
        </div>
        <div class="lib-topbar-actions">
          ${admin ? `<button class="lib-btn-limpar" onclick="libLimparBase()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Limpar Base
          </button>` : ''}
          ${admin ? `<button class="lib-btn-export" onclick="libExportar()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>` : ''}
          <a class="lib-btn-modelo" href="/template_liberacao.xlsx" download="TEMPLATE_LIBERACAO.xlsx" title="Baixar modelo de planilha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Modelo
          </a>
          <button class="lib-btn-import" onclick="libImportarPlanilha()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Planilha
          </button>
          <input type="file" id="lib-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="libOnImportFile(this)" />
          ${admin ? `<button class="lib-btn-import" onclick="libImportarAcerto()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Acerto
          </button>
          <input type="file" id="lib-import-acerto-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="libOnImportAcertoFile(this)" />` : ''}
          <button class="lib-btn-add" onclick="libAddCliente()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Cliente
          </button>
        </div>
      </div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="lib-search" type="text" placeholder="Buscar por nome ou CPF…" oninput="libSetSearch(this.value)" />
          <button class="lib-search-clear" id="lib-search-clear" onclick="libSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>

        ${admin ? `<div class="lib-empresa-filter-wrap">
          <select class="lib-empresa-select" id="lib-empresa-select" onchange="libSetEmpresaFiltro(this.value)">
            <option value="">Todas as empresas</option>
          </select>
        </div>` : ''}

        <div class="lib-date-row">
          <div class="lib-presets">
            ${PRESETS.map(p => `<button class="lib-preset" data-key="${p.key}" onclick="libSetPreset('${p.key}')">${p.label}</button>`).join('')}
            <button class="lib-preset-clear" id="lib-preset-clear" onclick="libClearDate()" style="display:none">× Limpar</button>
          </div>
          <div class="lib-date-inputs">
            <input type="date" class="lib-date-input" id="lib-date-from" onchange="libSetDateManual()" />
            <span class="lib-date-sep">até</span>
            <input type="date" class="lib-date-input" id="lib-date-to" onchange="libSetDateManual()" />
          </div>
        </div>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              ${admin ? '<th>Empresa</th>' : ''}
              <th>CPF</th>
              <th>Nome</th>
              <th>Convênio</th>
              <th>Produto</th>
              <th>Saldo Devedor</th>
              <th>Troco</th>
              ${admin ? '<th>Troco Líquido</th>' : ''}
              <th>Saldo Total</th>
              <th>Comissão 6%</th>
              <th>Acerto</th>
              <th>Data Quitado</th>
              <th>Obs</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="lib-tbody"></tbody>
        </table>
      </div>
      <div id="lib-ver-mais-wrap"></div>
    </div>
  `;
  updateTable();
}

// ── Update dinâmico (sem re-renderizar tudo) ──────────────────────────────
function _atualizarContagem(list) {
  const countEl = document.querySelector('.lib-count');
  if (!countEl) return;
  countEl.textContent = S.search || S.dateFrom || S.dateTo
    ? `${list.length} resultado${list.length !== 1 ? 's' : ''} de ${S.registros.length} total`
    : `${S.registros.length} cliente${S.registros.length !== 1 ? 's' : ''} cadastrado${S.registros.length !== 1 ? 's' : ''}`;
}

function _atualizarTbody(visible, cols, admin) {
  const tbody = document.getElementById('lib-tbody');
  if (!tbody) return;
  tbody.innerHTML = visible.length === 0
    ? `<tr><td colspan="${cols}" class="lib-empty">
         <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
         <div>Nenhum cliente encontrado.</div>
       </td></tr>`
    : visible.map(r => renderRow(r, admin)).join('');
}

function _atualizarVerMais(list, visible) {
  const vmWrap = document.getElementById('lib-ver-mais-wrap');
  if (!vmWrap) return;
  if (list.length <= visible.length) { vmWrap.innerHTML = ''; return; }
  const rest = list.length - visible.length;
  const next = Math.min(PAGE_SIZE, rest);
  vmWrap.innerHTML = `
        <div class="lib-ver-mais-wrap">
          <button class="lib-ver-mais" onclick="libVerMais()">
            Mostrar mais ${next} cliente${next !== 1 ? 's' : ''}
            <span class="lib-ver-mais-sub">${rest} restante${rest !== 1 ? 's' : ''}</span>
          </button>
        </div>`;
}

// Botões de limpar, presets ativos e inputs de data refletindo o store S.
function _atualizarFiltrosUI() {
  const clearSearch = document.getElementById('lib-search-clear');
  if (clearSearch) clearSearch.style.display = S.search ? '' : 'none';

  const clearDate = document.getElementById('lib-preset-clear');
  if (clearDate) clearDate.style.display = (S.preset || S.dateFrom || S.dateTo) ? '' : 'none';

  document.querySelectorAll('.lib-preset[data-key]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === S.preset);
  });

  const fromEl = document.getElementById('lib-date-from');
  const toEl   = document.getElementById('lib-date-to');
  if (fromEl) fromEl.value = S.dateFrom || '';
  if (toEl)   toEl.value   = S.dateTo   || '';
}

// Popula dropdown de empresas (admin)
function _atualizarEmpresas() {
  const empSelect = document.getElementById('lib-empresa-select');
  if (!empSelect) return;
  const empresas = [...new Set(S.registros.map(r => r.empresa_parceira).filter(Boolean))].sort();
  const current  = empSelect.value;
  empSelect.innerHTML = `<option value="">Todas as empresas</option>` +
    empresas.map(e => `<option value="${esc(e)}"${e === S.empresaFiltro ? ' selected' : ''}>${esc(e)}</option>`).join('');
  if (current && empresas.includes(current)) empSelect.value = current;
}

export function updateTable() {
  const admin    = isAdmin();
  const list     = filtered();
  const visible  = list.slice(0, S.page * PAGE_SIZE);
  const cols     = admin ? 15 : 14;

  _atualizarContagem(list);
  _atualizarTbody(visible, cols, admin);
  _atualizarVerMais(list, visible);
  _atualizarFiltrosUI();
  _atualizarEmpresas();
}

function _acertoCellHTML(r, admin, canAct) {
  if (!canAct) return fmtDate(r.acerto);
  const acertoLocked = !admin && r.acerto;
  return `<input class="lib-acerto-input" type="date" value="${r.acerto || ''}" ${acertoLocked ? 'disabled style="opacity:.4;cursor:not-allowed"' : `onchange="libSalvarAcerto('${r.id}', this.value)"`} />`;
}

// ⚠ código-em-string: libToggleOk PRECISA continuar global (main.js)
function _btnOkHTML(r, admin) {
  const okLocked = !admin && r.aprovado;   // parceiro: depois de dar OK, não pode remover
  return `<button class="lib-btn-ok${r.aprovado ? ' ok' : ''}${okLocked ? ' locked' : ''}" ${okLocked ? 'disabled title="OK confirmado — somente admin pode remover"' : `onclick="libToggleOk('${r.id}', ${r.aprovado})" title="${r.aprovado ? 'Remover OK' : 'Marcar como OK'}"`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>`;
}

function _btnEditarHTML(r, admin) {
  const travado = !admin && r.acerto;
  return `<button class="lib-btn-edit${travado ? ' disabled' : ''}" ${travado ? 'disabled title="Acerto preenchido — edição bloqueada"' : `onclick="libEditarCliente('${r.id}')" title="Editar"`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>`;
}

function _btnExcluirHTML(r, admin) {
  if (!admin) return '';
  return `<button class="lib-btn-del" onclick="libDeletarCliente('${r.id}', '${r.nome.replace(/'/g, "\\'")}')" title="Excluir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>`;
}

function _acoesCellHTML(r, admin, canAct) {
  if (!canAct) return '<td></td>';
  // Cliente com resíduo a pagar sai desta tela para a de Resíduos
  const residuoBtn = perm.residuosEditar()
    ? `<button class="bol-btn-residuo" onclick="libParaResiduo('${r.id}')" title="Cliente tem resíduo — enviar para a tela de Resíduos">Resíduo →</button>`
    : '';
  return `
    <td class="lib-td-actions">
      ${residuoBtn}
      ${_btnOkHTML(r, admin)}
      ${_btnEditarHTML(r, admin)}
      ${_btnExcluirHTML(r, admin)}
    </td>`;
}

// CPF, nome, convênio e produto (mesmos fallbacks e titles de sempre)
function _celulasIdentidadeHTML(r) {
  return `<td>${r.cpf || '—'}</td>
      <td class="lib-nome" title="${esc(r.nome || '')}">${r.nome || '—'}</td>
      <td class="lib-trunc" title="${esc(r.convenio || '')}">${esc(r.convenio || '—')}</td>
      <td class="lib-trunc" title="${esc(r.produto || '')}">${esc(r.produto || '—')}</td>`;
}

function renderRow(r, admin) {
  const grupoNome = state.currentUser?.grupoNome || '';
  const canAct    = admin || r.empresa_parceira === grupoNome;

  return `
    <tr class="lib-tr${r.aprovado ? ' lib-row-ok' : ''}" data-id="${r.id}">
      ${admin ? `<td><span class="lib-empresa-badge">${esc(r.empresa_parceira)}</span></td>` : ''}
      ${_celulasIdentidadeHTML(r)}
      <td class="lib-val">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      ${admin ? `<td class="lib-val">${fmtBRL(r.troco_liquido)}</td>` : ''}
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_total)}</td>
      <td class="lib-val">${fmtBRL(r.comissao_6pct)}</td>
      <td>${_acertoCellHTML(r, admin, canAct)}</td>
      <td>${fmtDate(r.data_quitado)}</td>
      <td class="lib-obs">${r.obs || '—'}</td>
      <td>${r.aprovado
        ? '<span class="lib-badge-ok">✓ OK</span>'
        : '<span class="lib-badge-pen">Pendente</span>'}</td>
      ${_acoesCellHTML(r, admin, canAct)}
    </tr>`;
}
