import { state } from '../state.js';
import { fmtBRL } from '../utils/currency.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { saveClassificationToSupabase } from '../services/classifications.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';

export function renderReview(toReview, unknownStatuses) {
  let h = '';

  if (unknownStatuses.length > 0) {
    h += `<div class="section-title"><span class="bar"></span>Status Não Mapeados</div>
    <div class="info-box">Os status abaixo não estão nas listas de Aprovados, Pagos ou Reprovados. Informe o desenvolvedor para que sejam categorizados.</div>
    <div class="table-card" style="margin-bottom:20px">
      <div class="table-wrap"><table>
        <thead><tr><th>Status</th><th>Situação</th></tr></thead>
        <tbody>${unknownStatuses.map(s =>
          `<tr><td><span class="badge badge-yellow">${s}</span></td>
           <td class="muted">Não categorizado — revisar manualmente</td></tr>`
        ).join('')}</tbody>
      </table></div>
    </div>`;
  }

  h += `<div class="section-title"><span class="bar"></span>Vendas a Revisar</div>`;

  if (toReview.length === 0) {
    h += `<div class="empty"><div class="empty-icon">✅</div>
      <div class="empty-title">Nenhuma venda pendente</div>
      <div class="empty-desc">Todas as vendas foram identificadas automaticamente.</div></div>`;
  } else {
    h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="color:var(--gray-light);font-size:12px">${toReview.length} ${toReview.length === 1 ? 'venda precisa' : 'vendas precisam'} de classificação manual</div>
      <button class="btn-sm btn-ghost" onclick="exportOverrides()">Exportar Classificações (.json)</button>
    </div>
    <div class="table-card">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Cliente</th><th>CPF</th><th>Telefone</th><th>Valor</th><th>Status</th><th>Origem Ecorban</th><th>Origem Smart</th><th>Motivo</th><th>Ação</th>
        </tr></thead>
        <tbody id="review-tbody">${toReview.map(r =>
          `<tr id="rrow-${r._idx}">
            <td><strong>${r.cliente || '—'}</strong></td>
            <td class="muted">${r.cpf || '—'}</td>
            <td class="muted">${r.phone || '—'}</td>
            <td>${fmtBRL(r.valor)}</td>
            <td><span class="badge ${r.statusCat === 'pago' ? 'badge-green' : r.statusCat === 'quase pago' ? 'badge-teal' : r.statusCat === 'aprovado' ? 'badge-yellow' : 'badge-gray'}">${r.rawStatus}</span></td>
            <td class="muted">${r.ecorbanOrigem || '—'}</td>
            <td class="muted">${r.origem || '—'}</td>
            <td class="muted" style="max-width:200px;white-space:normal;font-size:11px">${r.reviewReason || '—'}</td>
            <td style="display:flex;gap:6px">
              <button class="btn-mkt"   onclick="classify(${r._idx},true)">É Marketing</button>
              <button class="btn-nomkt" onclick="classify(${r._idx},false)">Não é</button>
            </td>
          </tr>`
        ).join('')}</tbody>
      </table></div>
    </div>`;
  }

  document.getElementById('review-body').innerHTML = h;
}

export function classify(idx, isMkt) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;
  entry.isMarketing  = isMkt;
  entry.reviewReason = 'manual';
  if (entry.cpf) state.overrides[entry.cpf] = isMkt;
  const row = document.getElementById(`rrow-${idx}`);
  if (row) row.remove();
  toast(isMkt ? 'Classificado como marketing ✓' : 'Classificado como não marketing ✓');
  saveState();
  saveClassificationToSupabase(entry.cpf, isMkt);
  scheduleSaveSnapshot();
  const fd = filteredData();
  if (fd) {
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }
  const badge = document.getElementById('review-badge');
  const cnt   = document.querySelectorAll('#review-tbody tr').length + state.result.unknownStatuses.length;
  badge.textContent = cnt;
  badge.classList.toggle('hidden', cnt === 0);
}

export function exportOverrides() {
  const blob = new Blob([JSON.stringify(state.overrides, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `classificacoes_${date}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('Classificações exportadas');
}
