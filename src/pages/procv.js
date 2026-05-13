import { state } from '../state.js';
import { fmtN } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { saveClassificationToSupabase } from '../services/classifications.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { logAction } from '../services/action-log.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';
import { renderClientes } from './clientes.js';

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

  const total   = filtered.length;
  const capped  = filtered.slice(0, 500);
  const hasMore = total > 500;
  return { mktEntries, total, capped, hasMore };
}

/** Constrói apenas o HTML da tabela de resultados (sem a barra de pesquisa). */
function buildProcvResultsHTML(total, hasMore, capped) {
  const rowsHtml = capped.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:36px;color:var(--gray)">Nenhum cliente encontrado com os filtros aplicados.</td></tr>`
    : capped.map((e, i) => `
      <tr data-procv-row data-name="${(e.cliente || '').toLowerCase().replace(/"/g, '')}" data-cpf="${e.cpf || ''}" data-phone="${(e.smartPhone || '').replace(/\D/g, '')}">
        <td class="muted" style="font-size:11px">${i + 1}</td>
        <td><strong>${e.cliente || '—'}</strong></td>
        <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
        <td><span class="badge ${statusBadge(e.statusCat)}">${e.rawStatus || '—'}</span></td>
        <td class="muted">${e.ecorbanOrigem || '—'}</td>
        <td class="muted" style="font-family:monospace;font-size:12px">${e.smartPhone || '—'}</td>
        <td>${e.origem ? `<span class="badge badge-blue">${e.origem}</span>` : '<span class="muted">—</span>'}</td>
        <td class="muted" style="font-size:12px">${e.audiencia || '—'}</td>
        <td>${signalBadge(e)}</td>
        <td>
          ${e.reviewReason === 'manual'
            ? e.isMarketing
              ? `<span class="badge badge-green">✅ Confirmado: Marketing</span>`
              : `<span class="badge badge-red">❌ Confirmado: Não é Marketing</span>`
            : `<div style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn-mkt"   onclick="classifyFromProcv(${e._idx},true)"  style="font-size:11px;padding:4px 8px">✅ É Marketing</button>
                <button class="btn-nomkt" onclick="classifyFromProcv(${e._idx},false)" style="font-size:11px;padding:4px 8px">❌ Não é Marketing</button>
               </div>`
          }
        </td>
        <td>
          <button class="btn-dots" title="Histórico" onclick="openHistoryPanel('${e.cpf || ''}','${(e.cliente || '').replace(/'/g, '')}')">⋯</button>
        </td>
      </tr>`).join('');

  return `
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">${fmtN(total)} clientes encontrados${hasMore ? ' — exibindo os primeiros 500' : ''}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Cliente</th><th>CPF</th><th>Status</th>
          <th>Origem Ecorban</th><th>Telefone Smart</th><th>Origem Smart</th><th>Audiência Smart</th>
          <th>Sinal Smart</th><th>Confirmar</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>
    ${hasMore ? `<div style="text-align:center;padding:12px;font-size:12px;color:var(--gray)">Refine a busca acima para encontrar os registros restantes.</div>` : ''}
  `;
}

export function renderProcv(entries) {
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
        <button class="filter-btn ${f === 'pending'      ? 'active' : ''}" onclick="setProcvFilter('pending')"       style="${f === 'pending'      ? '' : 'color:#f59e0b'}">⏳ Pendentes (${cPending})</button>
        <button class="filter-btn ${f === 'doubt'        ? 'active' : ''}" onclick="setProcvFilter('doubt')"         style="${f === 'doubt'        ? '' : 'color:#f59e0b'}">❓ Dúvida (${cDoubt})</button>
        <button class="filter-btn ${f === 'contradiction'? 'active' : ''}" onclick="setProcvFilter('contradiction')" style="${f === 'contradiction'? '' : 'color:#ef4444'}">🔴 Contradição (${cContradition})</button>
        <button class="filter-btn ${f === 'smart'        ? 'active' : ''}" onclick="setProcvFilter('smart')"         style="${f === 'smart'        ? '' : 'color:#22c55e'}">✅ Smart confirma (${cConfirmedSmart})</button>
        <button class="filter-btn ${f === 'manual'       ? 'active' : ''}" onclick="setProcvFilter('manual')"        style="${f === 'manual'       ? '' : 'color:#22c55e'}">✔ Revisados (${cManual})</button>
        <button class="filter-btn ${f === 'all'          ? 'active' : ''}" onclick="setProcvFilter('all')">Todos (${cAll})</button>
      </div>
      <button class="btn-sm btn-ghost" onclick="exportProcvCSV()">⬇ Exportar CSV</button>
    </div>

    <div id="procv-results">${buildProcvResultsHTML(total, hasMore, capped)}</div>
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
