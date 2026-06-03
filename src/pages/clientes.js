import { state } from '../state.js';
import { fmtN } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { sb } from '../services/supabase.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';
import { renderProcv } from './procv.js';
import { normCPF } from '../utils/cpf.js';
import { saveSnapshotToSupabase, checkSnapshotTimestamp } from '../services/snapshot.js';
import { saveSnapshotTimestamp } from '../core/storage.js';
import { logAction } from '../services/action-log.js';
import { showConfirm } from '../utils/confirm.js';
import { badgeHTML } from '../components/Badge.jsx';
import { filterButtonsHTML } from '../components/FilterButtons.jsx';
import { sectionTitle } from '../components/ui.js';

function thSort(label, col, cls = '') {
  const { col: sc, dir } = state.clientesSort;
  const active = sc === col;
  const arrow  = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
  const style  = `cursor:pointer;user-select:none;white-space:nowrap${active ? ';color:var(--red)' : ''}`;
  const clsAttr = cls ? ` class="${cls}"` : '';
  return `<th${clsAttr} style="${style}" onclick="sortClientes('${col}')">${label}${arrow}</th>`;
}

function applySortClientes(arr) {
  const { col, dir } = state.clientesSort;
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

/** Aplica filtro de aba + busca por texto nos clientes confirmados. */
function applyClientesFilters(confirmed) {
  let filtered = confirmed;
  if (state.clientesFilter === 'mkt') filtered = filtered.filter(e => e.isMarketing === true);
  if (state.clientesFilter === 'no')  filtered = filtered.filter(e => e.isMarketing === false);

  const q = state.clientesSearch.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  if (q) filtered = filtered.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) ||
    (qDigits && (e.cpf || '').includes(qDigits)) ||
    (qDigits && (e.smartPhone || '').replace(/\D/g, '').includes(qDigits))
  );
  return filtered;
}

/** Constrói apenas o HTML da tabela de resultados (sem a barra de pesquisa). */
function buildClientesResultsHTML(filtered) {
  const rowsHtml = filtered.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--gray)">Nenhum cliente encontrado.</td></tr>`
    : filtered.map((e, i) => {
        const safeName = (e.cliente || '').replace(/'/g, "\\'");
        return `
      <tr data-clientes-row data-name="${(e.cliente || '').toLowerCase().replace(/"/g, '')}" data-cpf="${e.cpf || ''}" data-phone="${(e.smartPhone || '').replace(/\D/g, '')}">
        <td class="muted" style="font-size:11px">${i + 1}</td>
        <td><strong>${e.cliente || '—'}</strong></td>
        <td class="muted mobile-hide" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
        <td>${badgeHTML(e.statusCat, e.rawStatus)}</td>
        <td class="muted mobile-hide">${e.ecorbanOrigem || '—'}</td>
        <td class="muted mobile-hide" style="font-family:monospace;font-size:12px">${e.smartPhone || '—'}</td>
        <td><span class="badge ${e.isMarketing === true ? 'badge-green' : 'badge-gray'}">${e.isMarketing === true ? '✅ Marketing' : '❌ Não é Marketing'}</span></td>
        <td style="display:flex;gap:6px;align-items:center">
          <button class="btn-nomkt procv-actions-desktop" onclick="askUndo(${e._idx},'${safeName}')" style="font-size:11px;padding:4px 8px">↩ Reclassificar</button>
          <button class="btn-dots procv-actions-mobile" onclick="openBottomSheet({title:'${safeName}',sub:'Reclassificar cliente',actions:[{id:'undo',label:'↩ Reclassificar',cls:'ms-btn-nomkt',onClick:()=>askUndo(${e._idx},'${safeName}')},{id:'cancel',label:'Cancelar',cls:'ms-btn-cancel',onClick:()=>{}}]})">⋯</button>
          <button class="btn-dots" title="Histórico" onclick="openHistoryPanel('${e.cpf || ''}','${(e.cliente || '').replace(/'/g, '')}')">⋯</button>
        </td>
      </tr>`;
      }).join('');

  return `
    <div class="table-card">
      <div class="table-header">
        <div class="table-header-title">${fmtN(filtered.length)} clientes</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th>
          ${thSort('Cliente','cliente')}
          ${thSort('CPF','cpf','mobile-hide')}
          ${thSort('Status','statusCat')}
          ${thSort('Origem Ecorban','ecorbanOrigem','mobile-hide')}
          ${thSort('Telefone Smart','smartPhone','mobile-hide')}
          ${thSort('Classificação','isMarketing')}
          <th>Ação</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>
  `;
}

export function renderClientes(entries) {
  const confirmed = entries.filter(e => e.reviewReason === 'manual');

  const badge = document.getElementById('clientes-badge');
  if (badge) {
    badge.textContent = confirmed.length;
    badge.classList.toggle('hidden', confirmed.length === 0);
  }

  if (confirmed.length === 0) {
    document.getElementById('clientes-body').innerHTML = `
      <div class="empty"><div class="empty-icon">👥</div>
      <div class="empty-title">Nenhum cliente confirmado ainda</div>
      <div class="empty-desc">Confirme clientes no PROCV para eles aparecerem aqui.</div></div>`;
    return;
  }

  const filtered = applySortClientes(applyClientesFilters(confirmed));
  const cMkt = confirmed.filter(e => e.isMarketing === true).length;
  const cNo  = confirmed.filter(e => e.isMarketing === false).length;
  const f    = state.clientesFilter;

  document.getElementById('clientes-body').innerHTML = `
    ${sectionTitle('Clientes Confirmados')}
    <div class="info-box" style="margin-bottom:16px">
      Todos os clientes que passaram pela sua confirmação no PROCV. Total de <strong>${confirmed.length} confirmados</strong>.
    </div>

    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px;position:relative">
        <input type="text" id="clientes-search" placeholder="Buscar por nome ou CPF…"
          value="${state.clientesSearch.replace(/"/g, '&quot;')}"
          oninput="setClientesSearch(this.value)"
          style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--white);
                 padding:8px 12px 8px 34px;border-radius:7px;font-size:13px;font-family:var(--font-b);outline:none"
          onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--gray);pointer-events:none"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div class="table-filters">
        ${filterButtonsHTML([
          { value: 'all', label: `Todos (${confirmed.length})`,      onclick: "setClientesFilter('all')" },
          { value: 'mkt', label: `✅ Marketing (${cMkt})`,            onclick: "setClientesFilter('mkt')" },
          { value: 'no',  label: `❌ Não Marketing (${cNo})`,         onclick: "setClientesFilter('no')" },
        ], f)}
      </div>
    </div>

    <div id="clientes-results">${buildClientesResultsHTML(filtered)}</div>
  `;
}

export function sortClientes(col) {
  const s = state.clientesSort;
  if (s.col === col) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.col = col; s.dir = 'asc'; }
  const fd = filteredData();
  if (fd) renderClientes(fd.entries);
}

export function setClientesFilter(v) {
  state.clientesFilter = v;
  const fd = filteredData();
  if (fd) renderClientes(fd.entries);
}

export function setClientesSearch(v) {
  state.clientesSearch = v;
  const resultsEl = document.getElementById('clientes-results');
  if (!resultsEl) {
    const fd = filteredData();
    if (fd) renderClientes(fd.entries);
    return;
  }
  // Filtra as linhas existentes sem reconstruir o DOM (preserva o foco)
  const q = v.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  let visible = 0;
  resultsEl.querySelectorAll('tr[data-clientes-row]').forEach(row => {
    const show = !q ||
      row.dataset.name.includes(q) ||
      (qDigits && row.dataset.cpf.includes(qDigits)) ||
      (qDigits && row.dataset.phone.includes(qDigits));
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const titleEl = resultsEl.querySelector('.table-header-title');
  if (titleEl) titleEl.textContent = `${fmtN(visible)} clientes`;
}

export function askUndo(idx, clientName) {
  showConfirm(
    'Reclassificar cliente?',
    `"${clientName || 'Este cliente'}" voltará para o PROCV e precisará ser revisado novamente.`,
    '↩ Sim, reclassificar',
    () => undoFromClientes(idx)
  );
}

export async function undoFromClientes(idx) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;

  // Marca essa proposta específica como reclassificada — NÃO apaga outras propostas
  // do mesmo CPF. 'reclassified' impede que o sync do banco reaplique a classificação
  // nessa entrada sem afetar outras propostas do mesmo cliente.
  entry.isMarketing  = null;
  entry.reviewReason = 'reclassified';

  // Só remove do banco de classificações se NENHUMA outra proposta desse CPF
  // ainda estiver confirmada como 'manual'
  const normCpf = entry.cpf ? normCPF(entry.cpf) : null;
  const otherStillConfirmed = normCpf && state.result.entries.some(
    (e, i) => i !== idx && normCPF(e.cpf) === normCpf && e.reviewReason === 'manual'
  );

  if (!otherStillConfirmed && normCpf) {
    delete state.overrides[normCpf];
    localStorage.setItem('sc_overrides_v1', JSON.stringify(state.overrides));
  }

  saveState();
  logAction(entry.cpf, entry.cliente, 'reclassified');
  toast('↩ Classificação desfeita — proposta voltou para o PROCV');

  if (state.currentUser) {
    if (!otherStillConfirmed && normCpf) {
      await sb.from('classifications').delete().eq('cpf', normCpf);
    }
    // Salva snapshot imediatamente e busca o timestamp real do Supabase
    // para evitar mismatch de formato e re-download do snapshot antigo no F5
    await saveSnapshotToSupabase();
    const serverTs = await checkSnapshotTimestamp();
    if (serverTs) saveSnapshotTimestamp(serverTs);
  }

  const fd = filteredData();
  if (fd) {
    renderProcv(fd.entries);
    renderClientes(fd.entries);
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }
}
