// PROCV — orquestrador. A tabela/filtros vivem em src/pages/procv/
// procv-tabela.js e o export CSV em procv-export.js. TODA a lógica de
// classificação (batch, classifyFromProcv, askClassify) fica AQUI, intacta —
// inclusive a ordem saveState() ANTES das flags temporárias (_justConfirmed),
// que é proteção documentada contra vazamento de flag para o cache.
import { state } from '../state.js';
import { icon } from '../utils/icons.js';
import { fmtN, fmtBRL } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { saveClassificationToSupabase } from '../services/classifications.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { logAction } from '../services/action-log.js';
import { showConfirm } from '../utils/confirm.js';
import { filterButtonsHTML } from '../components/FilterButtons.jsx';
import { applyProcvFilters, buildProcvResultsHTML } from './procv/procv-tabela.js';

export { exportProcvCSV } from './procv/procv-export.js';
import { sectionTitle } from '../components/ui.js';
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
    ? `${count} registro${count !== 1 ? 's' : ''} confirmado${count !== 1 ? 's' : ''} como Marketing`
    : `${count} registro${count !== 1 ? 's' : ''} confirmado${count !== 1 ? 's' : ''} como Não Marketing`
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
    ((e.isMarketing === true && e.smartSignal !== 'confirmed') || e.reverseCandidate === true) &&
    e.reviewReason !== 'manual'
  ).length;
}

export function renderProcv(entries) {
  _selected.clear();
  const { mktEntries, total, capped, hasMore } = applyProcvFilters(entries);

  const cPending        = mktEntries.filter(e => !e.reverseCandidate && e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual').length;
  const cDoubt          = mktEntries.filter(e => !e.reverseCandidate && (e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual').length;
  const cContradition   = mktEntries.filter(e => e.smartSignal === 'contradiction' && e.reviewReason !== 'manual').length;
  const cConfirmedSmart = mktEntries.filter(e => !e.reverseCandidate && e.smartSignal === 'confirmed' && e.reviewReason !== 'manual').length;
  const cReverse        = mktEntries.filter(e => e.reverseCandidate === true && e.reviewReason !== 'manual').length;
  const cManual         = mktEntries.filter(e => e.reviewReason === 'manual').length;
  const cAll            = mktEntries.length;
  const f               = state.procvFilter;

  document.getElementById('procv-body').innerHTML = `
    ${sectionTitle('PROCV — Revisão de Clientes de Marketing')}
    <div class="info-box" style="margin-bottom:16px">
      Todos os registros que o <strong>Ecorban classifica como MARKETING</strong>, mais os <strong>Marketing Perdido</strong> — clientes com outra origem no Ecorban (SMS, WhatsApp, Linha…) mas que o Smart confirma como marketing. O sinal do Smart indica se há dúvida ou contradição — revise os pendentes e confirme ou negue cada um.
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
          { value: 'pending',       label: `Pendentes (${cPending})`,         onclick: "setProcvFilter('pending')",       style: 'color:#f59e0b' },
          { value: 'doubt',         label: `Dúvida (${cDoubt})`,               onclick: "setProcvFilter('doubt')",         style: 'color:#f59e0b' },
          { value: 'contradiction', label: `Contradição (${cContradition})`,   onclick: "setProcvFilter('contradiction')", style: 'color:#ef4444' },
          { value: 'reverse',       label: `Marketing Perdido (${cReverse})`,  onclick: "setProcvFilter('reverse')",       style: 'color:#f97316' },
          { value: 'smart',         label: `Smart confirma (${cConfirmedSmart})`, onclick: "setProcvFilter('smart')",      style: 'color:#22c55e' },
          { value: 'manual',        label: `Revisados (${cManual})`,            onclick: "setProcvFilter('manual')",       style: 'color:#22c55e' },
          { value: 'all',           label: `Todos (${cAll})`,                     onclick: "setProcvFilter('all')" },
        ], f)}
      </div>
      <button class="btn-sm btn-ghost" onclick="exportProcvCSV()">${icon('download', 12)} Exportar CSV</button>
    </div>

    <div id="procv-results">${buildProcvResultsHTML(total, hasMore, capped, _selected)}</div>

    <div id="procv-batch-bar" style="display:none;position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:var(--surface2);border:1px solid var(--border);border-radius:12px;
      padding:10px 18px;gap:12px;align-items:center;z-index:300;
      box-shadow:0 8px 32px rgba(0,0,0,.55);white-space:nowrap">
      <span class="batch-count" style="color:var(--white);font-size:13px;font-family:var(--font-h);font-weight:700"></span>
      <button onclick="batchClassify(true)"
        style="background:#16a34a;color:#fff;border:none;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:var(--font-b)">
        ${icon('check', 12)} Confirmar como Marketing
      </button>
      <button onclick="batchClassify(false)"
        style="background:#dc2626;color:#fff;border:none;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-family:var(--font-b)">
        ${icon('x', 12)} Rejeitar todos
      </button>
      <button onclick="clearBatchSelection()"
        style="background:transparent;color:var(--gray);border:1px solid var(--border);border-radius:7px;padding:6px 10px;cursor:pointer;font-size:11px">
        ${icon('x', 12)}
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
  toast(isMkt ? 'Confirmado como Marketing — salvo!' : 'Confirmado como Não Marketing — salvo!');
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
    isMkt ? 'Sim, é Marketing' : 'Sim, não é Marketing',
    () => classifyFromProcv(idx, isMkt)
  );
}
