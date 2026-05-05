import { state } from '../state.js';
import { fmtN } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { saveClassificationToSupabase } from '../services/classifications.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';
import { renderClientes } from './clientes.js';
import { sb } from '../services/supabase.js';

export function renderProcv(entries) {
  entries = entries.filter(e => e.reviewReason !== 'manual');

  const cAll  = entries.length;
  const cMkt  = entries.filter(e => e.isMarketing === true).length;
  const cNo   = entries.filter(e => e.isMarketing === false).length;
  const cUnkn = entries.filter(e => e.isMarketing === null).length;

  let filtered = entries;
  if (state.procvFilter === 'mkt')  filtered = filtered.filter(e => e.isMarketing === true);
  if (state.procvFilter === 'no')   filtered = filtered.filter(e => e.isMarketing === false);
  if (state.procvFilter === 'unkn') filtered = filtered.filter(e => e.isMarketing === null);

  const q = state.procvSearch.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(e =>
      (e.cliente || '').toLowerCase().includes(q) ||
      (e.cpf     || '').includes(q)
    );
  }

  const total   = filtered.length;
  const capped  = filtered.slice(0, 500);
  const hasMore = total > 500;

  const f = state.procvFilter;

  function clsBadge(e) {
    if (e.isMarketing === true)  return 'badge-green';
    if (e.isMarketing === false) return 'badge-gray';
    return 'badge-yellow';
  }
  function clsLabel(e) {
    if (e.isMarketing === true)  return '✅ Marketing';
    if (e.isMarketing === false) return 'Não é Marketing';
    return '❓ Não identificado';
  }
  function statusBadge(cat) {
    if (cat === 'pago')       return 'badge-green';
    if (cat === 'quase pago') return 'badge-teal';
    if (cat === 'aprovado')   return 'badge-yellow';
    if (cat === 'reprovado')  return 'badge-red';
    return 'badge-gray';
  }

  const rowsHtml = capped.length === 0
    ? `<tr><td colspan="9" style="text-align:center;padding:36px;color:var(--gray)">Nenhum cliente encontrado com os filtros aplicados.</td></tr>`
    : capped.map((e, i) => `
      <tr>
        <td class="muted" style="font-size:11px">${i + 1}</td>
        <td><strong>${e.cliente || '—'}</strong></td>
        <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
        <td><span class="badge ${statusBadge(e.statusCat)}">${e.rawStatus || '—'}</span></td>
        <td class="muted">${e.ecorbanOrigem || '—'}</td>
        <td class="muted" style="font-family:monospace;font-size:12px">${e.smartPhone || '—'}</td>
        <td>${e.origem ? `<span class="badge badge-blue">${e.origem}</span>` : '<span class="muted">—</span>'}</td>
        <td><span class="badge ${clsBadge(e)}">${clsLabel(e)}</span></td>
        <td>
          ${e.reviewReason === 'manual'
            ? `<span class="badge badge-green" style="gap:4px">✔ Confirmado</span>`
            : `<div style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn-mkt"   onclick="classifyFromProcv(${e._idx},true)"  style="font-size:11px;padding:4px 8px">✅ É Marketing</button>
                <button class="btn-nomkt" onclick="classifyFromProcv(${e._idx},false)" style="font-size:11px;padding:4px 8px">❌ Não é Marketing</button>
               </div>`
          }
        </td>
      </tr>`).join('');

  document.getElementById('procv-body').innerHTML = `
    <div class="section-title"><span class="bar"></span>PROCV — Consulta de Clientes por Origem</div>
    <div class="info-box" style="margin-bottom:16px">
      Use esta tabela para identificar clientes classificados como <strong>Marketing</strong> que estão com a origem errada no Ecorban.
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
        <button class="filter-btn ${f === 'all'  ? 'active' : ''}" onclick="setProcvFilter('all')">Todos (${cAll})</button>
        <button class="filter-btn ${f === 'mkt'  ? 'active' : ''}" onclick="setProcvFilter('mkt')" style="${f === 'mkt' ? '' : 'color:#22c55e'}">✅ Marketing (${cMkt})</button>
        <button class="filter-btn ${f === 'no'   ? 'active' : ''}" onclick="setProcvFilter('no')">Não Marketing (${cNo})</button>
        <button class="filter-btn ${f === 'unkn' ? 'active' : ''}" onclick="setProcvFilter('unkn')" style="${f === 'unkn' ? '' : 'color:#f59e0b'}">❓ Não Identificado (${cUnkn})</button>
      </div>
      <button class="btn-sm btn-ghost" onclick="exportProcvCSV()">⬇ Exportar CSV</button>
    </div>

    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">${fmtN(total)} clientes encontrados${hasMore ? ' — exibindo os primeiros 500' : ''}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Cliente</th><th>CPF</th><th>Status</th>
          <th>Origem Ecorban</th><th>Telefone Smart</th><th>Origem Smart</th>
          <th>Classificação</th><th>Confirmar</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>
    ${hasMore ? `<div style="text-align:center;padding:12px;font-size:12px;color:var(--gray)">Refinando a busca acima você encontra os registros restantes.</div>` : ''}
  `;
}

export function setProcvFilter(v) {
  state.procvFilter = v;
  const fd = filteredData();
  if (fd) renderProcv(fd.entries);
}

export function setProcvSearch(v) {
  state.procvSearch = v;
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
  saveState();
  toast(isMkt ? '✅ Confirmado como Marketing — salvo!' : '❌ Confirmado como Não Marketing — salvo!');
  saveClassificationToSupabase(entry.cpf, isMkt);
  scheduleSaveSnapshot();
  const fd = filteredData();
  if (fd) {
    renderProcv(fd.entries);
    renderClientes(fd.entries);
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }
  const cnt = state.result.entries.filter(r =>
    r.reviewReason && r.reviewReason !== 'manual' && r.isMarketing === null
  ).length + state.result.unknownStatuses.length;
  const badge = document.getElementById('review-badge');
  badge.textContent = cnt;
  badge.classList.toggle('hidden', cnt === 0);
}

export function exportProcvCSV() {
  const fd = filteredData();
  if (!fd) return;
  let filtered = fd.entries.filter(e => e.reviewReason !== 'manual');
  if (state.procvFilter === 'mkt')  filtered = filtered.filter(e => e.isMarketing === true);
  if (state.procvFilter === 'no')   filtered = filtered.filter(e => e.isMarketing === false);
  if (state.procvFilter === 'unkn') filtered = filtered.filter(e => e.isMarketing === null);
  const q = state.procvSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) || (e.cpf || '').includes(q)
  );

  const header = ['Cliente', 'CPF', 'Status', 'Categoria', 'Origem Ecorban', 'Telefone Smart', 'Origem Smart', 'Audiencia Smart', 'Classificacao'];
  const rows   = filtered.map(e => [
    e.cliente || '', e.cpf || '', e.rawStatus || '', e.statusCat || '',
    e.ecorbanOrigem || '', e.smartPhone || '', e.origem || '', e.audiencia || '',
    e.isMarketing === true ? 'Marketing' : e.isMarketing === false ? 'Nao e Marketing' : 'Nao Identificado',
  ]);

  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const bom  = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `procv_clientes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado com sucesso');
}
