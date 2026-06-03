import { state } from '../state.js';
import { fmtN, fmtBRL } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { saveClassificationToSupabase } from '../services/classifications.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { logAction } from '../services/action-log.js';
import { showConfirm } from '../utils/confirm.js';
import { filterButtonsHTML } from '../components/FilterButtons.jsx';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';
import { renderClientes } from './clientes.js';

// ── Seleção em lote ───────────────────────────────────────────────────────────
let _selected = new Set(); // conjunto de e._idx selecionados

function _updateBatchBar() {
  const bar = document.getElementById('procv-batch-bar');
  if (!bar) return;
  const n = _selected.size;
  if (n === 0) {
    bar.style.display = 'none';
    const chkAll = document.getElementById('procv-select-all');
    if (chkAll) chkAll.checked = false;
    return;
  }
  bar.style.display = 'flex';
  bar.querySelector('.batch-count').textContent =
    `${n} registro${n !== 1 ? 's' : ''} selecionado${n !== 1 ? 's' : ''}`;
}

export function toggleBatchSelect(idx, checked) {
  if (checked) _selected.add(idx);
  else _selected.delete(idx);
  _updateBatchBar();
}

export function selectAllBatch(checked) {
  document.querySelectorAll('[data-batch-idx]').forEach(cb => {
    const idx = parseInt(cb.dataset.batchIdx, 10);
    cb.checked = checked;
    if (checked) _selected.add(idx);
    else _selected.delete(idx);
  });
  _updateBatchBar();
}

export function clearBatchSelection() {
  _selected.clear();
  document.querySelectorAll('[data-batch-idx]').forEach(cb => { cb.checked = false; });
  const chkAll = document.getElementById('procv-select-all');
  if (chkAll) chkAll.checked = false;
  _updateBatchBar();
}

export async function batchClassify(isMkt) {
  if (_selected.size === 0) return;
  const indices = [..._selected];
  const count   = indices.length;

  await Promise.all(indices.map(idx => {
    const entry = state.result?.entries[idx];
    if (!entry) return Promise.resolve();
    entry.isMarketing        = isMkt;
    entry.reviewReason       = 'manual';
    entry._justConfirmed     = true;
    entry._confirmedInFilter = state.procvFilter;
    if (entry.cpf) state.overrides[entry.cpf] = isMkt;
    saveClassificationToSupabase(entry.cpf, isMkt);
    logAction(entry.cpf, entry.cliente, isMkt ? 'classified_marketing' : 'classified_not_marketing');
    return Promise.resolve();
  }));

  saveState();
  scheduleSaveSnapshot();
  _selected.clear();

  toast(isMkt
    ? `✅ ${count} registro${count !== 1 ? 's' : ''} confirmado${count !== 1 ? 's' : ''} como Marketing`
    : `❌ ${count} registro${count !== 1 ? 's' : ''} confirmado${count !== 1 ? 's' : ''} como Não Marketing`
  );

  const fd = filteredData();
  if (fd) {
    renderProcv(fd.entries);
    renderClientes(fd.entries);
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }

  const pending = state.result ? procvPendingCount(state.result.entries) : 0;
  const badge   = document.getElementById('procv-badge');
  if (badge) {
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
  }
}

/** Conta quantos registros de marketing estão pendentes de revisão manual. */
export function procvPendingCount(entries) {
  return entries.filter(e =>
    e.isMarketing === true &&
    e.smartSignal !== 'confirmed' &&
    e.reviewReason !== 'manual'
  ).length;
}

function signalBadge(e) {
  if (e.reviewReason === 'manual')         return `<span class="badge badge-green">✔ Revisado</span>`;
  if (e.smartSignal === 'confirmed')        return `<span class="badge badge-green">✅ Smart confirma</span>`;
  if (e.smartSignal === 'contradiction')    return `<span class="badge badge-red">🔴 Smart contradiz</span>`;
  if (e.smartSignal === 'not_found')        return `<span class="badge badge-yellow">🔍 Não encontrado</span>`;
  return `<span class="badge badge-yellow">❓ Dúvida</span>`;
}

function statusBadge(cat) {
  if (cat === 'pago')       return 'badge-green';
  if (cat === 'quase pago') return 'badge-teal';
  if (cat === 'aprovado')   return 'badge-yellow';
  if (cat === 'reprovado')  return 'badge-red';
  return 'badge-gray';
}

function thSort(label, col, cls = '') {
  const { col: sc, dir } = state.procvSort;
  const active = sc === col;
  const arrow  = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
  const style  = `cursor:pointer;user-select:none;white-space:nowrap${active ? ';color:var(--red)' : ''}`;
  const clsAttr = cls ? ` class="${cls}"` : '';
  return `<th${clsAttr} style="${style}" onclick="sortProcv('${col}')">${label}${arrow}</th>`;
}

function applySortProcv(arr) {
  const { col, dir } = state.procvSort;
  if (!col) return arr;
  return [...arr].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
    return dir === 'desc' ? -cmp : cmp;
  });
}

/** Aplica filtro de aba + busca por texto e retorna os dados paginados. */
function applyProcvFilters(entries) {
  // 'reclassified' = proposta enviada de volta ao PROCV pelo usuário — deve reaparecer para revisão
  const mktEntries = entries.filter(e => e.isMarketing === true || e.reviewReason === 'manual' || e.reviewReason === 'reclassified');
  const f    = state.procvFilter;
  const here = (e) => e._justConfirmed && e._confirmedInFilter === f;

  let filtered = mktEntries;
  if (f === 'pending')       filtered = mktEntries.filter(e => (e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual') || here(e));
  if (f === 'doubt')         filtered = mktEntries.filter(e => ((e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual') || here(e));
  if (f === 'contradiction') filtered = mktEntries.filter(e => (e.smartSignal === 'contradiction' && e.reviewReason !== 'manual') || here(e));
  if (f === 'smart')         filtered = mktEntries.filter(e => (e.smartSignal === 'confirmed' && e.reviewReason !== 'manual') || here(e));
  if (f === 'manual')        filtered = mktEntries.filter(e => e.reviewReason === 'manual');

  const q = state.procvSearch.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  if (q) filtered = filtered.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) ||
    (qDigits && (e.cpf || '').includes(qDigits)) ||
    (qDigits && (e.smartPhone || '').replace(/\D/g, '').includes(qDigits))
  );

  const sorted  = applySortProcv(filtered);
  const total   = sorted.length;
  const capped  = sorted.slice(0, 500);
  const hasMore = total > 500;
  return { mktEntries, total, capped, hasMore };
}

/** Constrói apenas o HTML da tabela de resultados (sem a barra de pesquisa). */
function buildProcvResultsHTML(total, hasMore, capped) {
  const rowsHtml = capped.length === 0
    ? `<tr><td colspan="13" style="text-align:center;padding:36px;color:var(--gray)">Nenhum cliente encontrado com os filtros aplicados.</td></tr>`
    : capped.map((e, i) => {
        const safeName   = (e.cliente || '').replace(/'/g, "\\'");
        const canSelect  = e.reviewReason !== 'manual';
        const isChecked  = _selected.has(e._idx);
        return `
      <tr data-procv-row data-name="${(e.cliente || '').toLowerCase().replace(/"/g, '')}" data-cpf="${e.cpf || ''}" data-phone="${(e.smartPhone || '').replace(/\D/g, '')}">
        <td style="width:28px;padding:0 4px;text-align:center">
          ${canSelect
            ? `<input type="checkbox" data-batch-idx="${e._idx}" ${isChecked ? 'checked' : ''}
                 onchange="toggleBatchSelect(${e._idx},this.checked)"
                 style="cursor:pointer;accent-color:var(--red);width:14px;height:14px">`
            : `<span style="color:var(--gray);font-size:10px">✔</span>`}
        </td>
        <td class="muted" style="font-size:11px">${i + 1}</td>
        <td><strong>${e.cliente || '—'}</strong></td>
        <td class="muted mobile-hide" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
        <td><span class="badge ${statusBadge(e.statusCat)}">${e.rawStatus || '—'}</span></td>
        <td class="muted mobile-hide" style="font-size:12px;white-space:nowrap">${e.valor ? fmtBRL(e.valor) : '—'}</td>
        <td class="muted mobile-hide">${e.ecorbanOrigem || '—'}</td>
        <td class="muted mobile-hide" style="font-family:monospace;font-size:12px">${e.smartPhone || '—'}</td>
        <td class="mobile-hide">${e.origem ? `<span class="badge badge-blue">${e.origem}</span>` : '<span class="muted">—</span>'}</td>
        <td class="muted mobile-hide" style="font-size:12px">${e.audiencia || '—'}</td>
        <td>${signalBadge(e)}</td>
        <td>
          ${e.reviewReason === 'manual'
            ? e.isMarketing
              ? `<span class="badge badge-green">✅ Confirmado: Marketing</span>`
              : `<span class="badge badge-red">❌ Confirmado: Não é Marketing</span>`
            : `<div class="procv-actions-desktop" style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn-mkt"   onclick="askClassify(${e._idx},true)"  style="font-size:11px;padding:4px 8px">✅ É Marketing</button>
                <button class="btn-nomkt" onclick="askClassify(${e._idx},false)" style="font-size:11px;padding:4px 8px">❌ Não é Marketing</button>
               </div>
               <button class="procv-actions-mobile btn-dots" onclick="openBottomSheet({title:'${safeName}',sub:'Confirmar classificação',actions:[{id:'mkt',label:'✅ É Marketing',cls:'ms-btn-mkt',onClick:()=>askClassify(${e._idx},true)},{id:'nomkt',label:'❌ Não é Marketing',cls:'ms-btn-nomkt',onClick:()=>askClassify(${e._idx},false)},{id:'cancel',label:'Cancelar',cls:'ms-btn-cancel',onClick:()=>{}}]})">⋯</button>`
          }
        </td>
        <td>
          <button class="btn-dots" title="Histórico" onclick="openHistoryPanel('${e.cpf || ''}','${(e.cliente || '').replace(/'/g, '')}')">⋯</button>
        </td>
      </tr>`;
      }).join('');

  return `
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">${fmtN(total)} clientes encontrados${hasMore ? ' — exibindo os primeiros 500' : ''}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th style="width:28px;padding:0 4px;text-align:center">
            <input type="checkbox" id="procv-select-all" onchange="selectAllBatch(this.checked)"
              title="Selecionar todos" style="cursor:pointer;accent-color:var(--red);width:14px;height:14px">
          </th>
          <th>#</th>
          ${thSort('Cliente','cliente')}
          ${thSort('CPF','cpf','mobile-hide')}
          ${thSort('Status','statusCat')}
          ${thSort('Valor','valor','mobile-hide')}
          ${thSort('Origem Ecorban','ecorbanOrigem','mobile-hide')}
          ${thSort('Telefone Smart','smartPhone','mobile-hide')}
          ${thSort('Origem Smart','origem','mobile-hide')}
          ${thSort('Audiência Smart','audiencia','mobile-hide')}
          ${thSort('Sinal Smart','smartSignal')}
          <th>Confirmar</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>
    ${hasMore ? `<div style="text-align:center;padding:12px;font-size:12px;color:var(--gray)">Refine a busca acima para encontrar os registros restantes.</div>` : ''}
  `;
}

export function renderProcv(entries) {
  _selected.clear();
  const { mktEntries, total, capped, hasMore } = applyProcvFilters(entries);

  const cPending        = mktEntries.filter(e => e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual').length;
  const cDoubt          = mktEntries.filter(e => (e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual').length;
  const cContradition   = mktEntries.filter(e => e.smartSignal === 'contradiction' && e.reviewReason !== 'manual').length;
  const cConfirmedSmart = mktEntries.filter(e => e.smartSignal === 'confirmed' && e.reviewReason !== 'manual').length;
  const cManual         = mktEntries.filter(e => e.reviewReason === 'manual').length;
  const cAll            = mktEntries.length;
  const f               = state.procvFilter;

  document.getElementById('procv-body').innerHTML = `
    <div class="section-title"><span class="bar"></span>PROCV — Revisão de Clientes de Marketing</div>
    <div class="info-box" style="margin-bottom:16px">
      Todos os registros que o <strong>Ecorban classifica como MARKETING</strong>. O sinal do Smart indica se há dúvida ou contradição — revise os pendentes e confirme ou negue cada um.
    </div>

    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px;position:relative">
        <input type="text" id="procv-search" placeholder="Buscar por nome ou CPF…"
          value="${state.procvSearch.replace(/"/g, '&quot;')}"
          oninput="setProcvSearch(this.value)"
          style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--white);
                 padding:8px 12px 8px 34px;border-radius:7px;font-size:13px;font-family:var(--font-b);outline:none"
          onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'"
        >
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--gray);pointer-events:none"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div class="table-filters">
        ${filterButtonsHTML([
          { value: 'pending',       label: `⏳ Pendentes (${cPending})`,         onclick: "setProcvFilter('pending')",       style: 'color:#f59e0b' },
          { value: 'doubt',         label: `❓ Dúvida (${cDoubt})`,               onclick: "setProcvFilter('doubt')",         style: 'color:#f59e0b' },
          { value: 'contradiction', label: `🔴 Contradição (${cContradition})`,   onclick: "setProcvFilter('contradiction')", style: 'color:#ef4444' },
          { value: 'smart',         label: `✅ Smart confirma (${cConfirmedSmart})`, onclick: "setProcvFilter('smart')",      style: 'color:#22c55e' },
          { value: 'manual',        label: `✔ Revisados (${cManual})`,            onclick: "setProcvFilter('manual')",       style: 'color:#22c55e' },
          { value: 'all',           label: `Todos (${cAll})`,                     onclick: "setProcvFilter('all')" },
        ], f)}
      </div>
      <button class="btn-sm btn-ghost" onclick="exportProcvCSV()">⬇ Exportar CSV</button>
    </div>

    <div id="procv-results">${buildProcvResultsHTML(total, hasMore, capped)}</div>

    <div id="procv-batch-bar" style="display:none;position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:var(--surface2);border:1px solid var(--border);border-radius:12px;
      padding:10px 18px;gap:12px;align-items:center;z-index:300;
      box-shadow:0 8px 32px rgba(0,0,0,.55);white-space:nowrap">
      <span class="batch-count" style="color:var(--white);font-size:13px;font-family:var(--font-h);font-weight:700"></span>
      <button onclick="batchClassify(true)"
        style="background:#16a34a;color:#fff;border:none;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:var(--font-b)">
        ✅ Confirmar como Marketing
      </button>
      <button onclick="batchClassify(false)"
        style="background:#dc2626;color:#fff;border:none;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:var(--font-b)">
        ❌ Rejeitar todos
      </button>
      <button onclick="clearBatchSelection()"
        style="background:transparent;color:var(--gray);border:1px solid var(--border);border-radius:7px;padding:6px 10px;cursor:pointer;font-size:11px">
        ✕
      </button>
    </div>
  `;
}

export function setProcvFilter(v) {
  state.procvFilter = v;
  const fd = filteredData();
  if (fd) renderProcv(fd.entries);
}

export function setProcvSearch(v) {
  state.procvSearch = v;
  const resultsEl = document.getElementById('procv-results');
  if (!resultsEl) {
    // tabela ainda não foi renderizada — faz render completo
    const fd = filteredData();
    if (fd) renderProcv(fd.entries);
    return;
  }
  // Filtra as linhas existentes sem reconstruir o DOM (preserva o foco)
  const q = v.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  let visible = 0;
  resultsEl.querySelectorAll('tr[data-procv-row]').forEach(row => {
    const show = !q ||
      row.dataset.name.includes(q) ||
      (qDigits && row.dataset.cpf.includes(qDigits)) ||
      (qDigits && row.dataset.phone.includes(qDigits));
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const titleEl = resultsEl.querySelector('.table-header-title');
  if (titleEl) titleEl.textContent = `${fmtN(visible)} clientes encontrados`;
}

export function sortProcv(col) {
  const s = state.procvSort;
  if (s.col === col) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.col = col; s.dir = 'asc'; }
  const fd = filteredData();
  if (fd) renderProcv(fd.entries);
}

export function classifyFromProcv(idx, isMkt) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;
  entry.isMarketing  = isMkt;
  entry.reviewReason = 'manual';
  if (entry.cpf) state.overrides[entry.cpf] = isMkt;
  saveState();                              // salva ANTES das flags temporárias
  entry._justConfirmed     = true;          // flag só em memória — nunca chega ao storage
  entry._confirmedInFilter = state.procvFilter;
  toast(isMkt ? '✅ Confirmado como Marketing — salvo!' : '❌ Confirmado como Não Marketing — salvo!');
  saveClassificationToSupabase(entry.cpf, isMkt);
  logAction(entry.cpf, entry.cliente, isMkt ? 'classified_marketing' : 'classified_not_marketing');
  scheduleSaveSnapshot();
  const fd = filteredData();
  if (fd) {
    renderProcv(fd.entries);
    renderClientes(fd.entries);
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }
  // Atualiza badge do PROCV
  const pending = state.result
    ? procvPendingCount(state.result.entries)
    : 0;
  const badge = document.getElementById('procv-badge');
  if (badge) {
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
  }
}

export function askClassify(idx, isMkt) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;
  const name  = entry.cliente || 'este cliente';
  showConfirm(
    isMkt ? 'Confirmar como Marketing?' : 'Confirmar como Não Marketing?',
    isMkt
      ? `Você confirma que "${name}" realmente é Marketing?`
      : `Você confirma que "${name}" não é Marketing?`,
    isMkt ? '✅ Sim, é Marketing' : '❌ Sim, não é Marketing',
    () => classifyFromProcv(idx, isMkt)
  );
}

export function exportProcvCSV() {
  const fd = filteredData();
  if (!fd) return;
  let filtered = fd.entries.filter(e => e.isMarketing === true || e.reviewReason === 'manual' || e.reviewReason === 'reclassified');
  if (state.procvFilter === 'pending')       filtered = filtered.filter(e => e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual');
  if (state.procvFilter === 'doubt')         filtered = filtered.filter(e => (e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual');
  if (state.procvFilter === 'contradiction') filtered = filtered.filter(e => e.smartSignal === 'contradiction' && e.reviewReason !== 'manual');
  if (state.procvFilter === 'smart')         filtered = filtered.filter(e => e.smartSignal === 'confirmed');
  if (state.procvFilter === 'manual')        filtered = filtered.filter(e => e.reviewReason === 'manual');
  const q = state.procvSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) || (e.cpf || '').includes(q)
  );

  const header = ['Cliente', 'CPF', 'Status', 'Categoria', 'Origem Ecorban', 'Telefone Smart', 'Origem Smart', 'Audiencia Smart', 'Sinal Smart'];
  const rows   = filtered.map(e => [
    e.cliente || '', e.cpf || '', e.rawStatus || '', e.statusCat || '',
    e.ecorbanOrigem || '', e.smartPhone || '', e.origem || '', e.audiencia || '',
    e.reviewReason === 'manual' ? 'Revisado' : (e.smartSignal || 'desconhecido'),
  ]);

  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const bom  = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `procv_marketing_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado com sucesso');
}
