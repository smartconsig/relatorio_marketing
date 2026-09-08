// Tabela do PROCV: badges, ordenação, filtros de aba/busca e o HTML dos
// resultados. Funções puras de leitura — NENHUMA lógica de classificação
// vive aqui (ela fica em procv.js, junto das travas de persistência).
// Contrato de DOM: setProcvSearch (procv.js) filtra as linhas geradas aqui
// via tr[data-procv-row] e .table-header-title.
import { state } from '../../state.js';
import { icon } from '../../utils/icons.js';
import { fmtN, fmtBRL } from '../../utils/currency.js';

function signalBadge(e) {
  if (e.reviewReason === 'manual')         return `<span class="badge badge-green">${icon('check', 10)} Revisado</span>`;
  if (e.reverseCandidate)                   return `<span class="badge badge-yellow">${icon('alert', 10)} Smart confirma / Ecorban: ${e.ecorbanOrigem || 'sem origem'}</span>`;
  if (e.smartSignal === 'confirmed')        return `<span class="badge badge-green">${icon('check', 10)} Smart confirma</span>`;
  if (e.smartSignal === 'contradiction')    return `<span class="badge badge-red">${icon('alert', 10)} Smart contradiz</span>`;
  if (e.smartSignal === 'not_found')        return `<span class="badge badge-yellow">${icon('search', 10)} Não encontrado</span>`;
  return `<span class="badge badge-yellow">? Dúvida</span>`;
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
    const va = a[col], vb = b[col];
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
export function applyProcvFilters(entries) {
  // 'reclassified' = proposta enviada de volta ao PROCV pelo usuário — deve reaparecer para revisão
  // reverseCandidate = Ecorban ≠ MARKETING mas Smart confirma — só aparece na aba "Marketing Perdido"
  const mktEntries = entries.filter(e => e.isMarketing === true || e.reverseCandidate === true || e.reviewReason === 'manual' || e.reviewReason === 'reclassified');
  const f    = state.procvFilter;
  const here = (e) => e._justConfirmed && e._confirmedInFilter === f;

  let filtered = mktEntries;
  if (f === 'pending')       filtered = mktEntries.filter(e => (!e.reverseCandidate && e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual') || here(e));
  if (f === 'doubt')         filtered = mktEntries.filter(e => (!e.reverseCandidate && (e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual') || here(e));
  if (f === 'contradiction') filtered = mktEntries.filter(e => (e.smartSignal === 'contradiction' && e.reviewReason !== 'manual') || here(e));
  if (f === 'smart')         filtered = mktEntries.filter(e => (!e.reverseCandidate && e.smartSignal === 'confirmed' && e.reviewReason !== 'manual') || here(e));
  if (f === 'reverse')       filtered = mktEntries.filter(e => (e.reverseCandidate === true && e.reviewReason !== 'manual') || here(e));
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

/** Constrói apenas o HTML da tabela de resultados (sem a barra de pesquisa).
 *  `selected` é o Set de e._idx marcados (vive em procv.js). */
export function buildProcvResultsHTML(total, hasMore, capped, selected) {
  const rowsHtml = capped.length === 0
    ? `<tr><td colspan="13" style="text-align:center;padding:36px;color:var(--gray)">Nenhum cliente encontrado com os filtros aplicados.</td></tr>`
    : capped.map((e, i) => {
        const safeName   = (e.cliente || '').replace(/'/g, "\\'");
        const canSelect  = e.reviewReason !== 'manual';
        const isChecked  = selected.has(e._idx);
        return `
      <tr data-procv-row data-name="${(e.cliente || '').toLowerCase().replace(/"/g, '')}" data-cpf="${e.cpf || ''}" data-phone="${(e.smartPhone || '').replace(/\D/g, '')}">
        <td style="width:28px;padding:0 4px;text-align:center">
          ${canSelect
            ? `<input type="checkbox" data-batch-idx="${e._idx}" ${isChecked ? 'checked' : ''}
                 onchange="toggleBatchSelect(${e._idx},this.checked)"
                 style="cursor:pointer;accent-color:var(--red);width:14px;height:14px">`
            : `<span style="color:var(--gray)">${icon('check', 11)}</span>`}
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
              ? `<span class="badge badge-green">${icon('check', 10)} Confirmado: Marketing</span>`
              : `<span class="badge badge-red">${icon('x', 10)} Confirmado: Não é Marketing</span>`
            : `<div class="procv-actions-desktop" style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn-mkt"   onclick="askClassify(${e._idx},true)"  style="font-size:11px;padding:4px 8px">${icon('check', 11)} É Marketing</button>
                <button class="btn-nomkt" onclick="askClassify(${e._idx},false)" style="font-size:11px;padding:4px 8px">${icon('x', 11)} Não é Marketing</button>
               </div>
               <button class="procv-actions-mobile btn-dots" onclick="openBottomSheet({title:'${safeName}',sub:'Confirmar classificação',actions:[{id:'mkt',label:'É Marketing',cls:'ms-btn-mkt',onClick:()=>askClassify(${e._idx},true)},{id:'nomkt',label:'Não é Marketing',cls:'ms-btn-nomkt',onClick:()=>askClassify(${e._idx},false)},{id:'cancel',label:'Cancelar',cls:'ms-btn-cancel',onClick:()=>{}}]})">⋯</button>`
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
