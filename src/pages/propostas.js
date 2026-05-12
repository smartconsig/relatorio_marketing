import { state }        from '../state.js';
import { filteredData } from '../core/calcKPIs.js';
import { fmtBRL, fmtN } from '../utils/currency.js';

// ── Column definitions ─────────────────────────────────────────────────────
const COLS = [
  { key: 'cliente',       label: 'Cliente'          },
  { key: 'cpf',           label: 'CPF'              },
  { key: 'saleDate',      label: 'Data'             },
  { key: 'rawStatus',     label: 'Status'           },
  { key: 'valor',         label: 'Valor (R$)'       },
  { key: 'banco',         label: 'Banco'            },
  { key: 'produto',       label: 'Produto'          },
  { key: 'loja',          label: 'Loja'             },
  { key: 'vendedor',      label: 'Vendedor'         },
  { key: 'ecorbanOrigem', label: 'Origem Ecorban'   },
  { key: 'origem',        label: 'Origem Smart'     },
  { key: 'audiencia',     label: 'Audiência Smart'  },
  { key: 'smartSignal',   label: 'Sinal Smart'      },
  { key: 'phone',         label: 'Telefone'         },
];

function loadExportCols() {
  try {
    const s = localStorage.getItem('sc_propostas_export_cols');
    if (s) return new Set(JSON.parse(s));
  } catch {}
  return new Set(['cliente','cpf','saleDate','rawStatus','valor','banco','produto','loja','vendedor']);
}
function saveExportCols(set) {
  try { localStorage.setItem('sc_propostas_export_cols', JSON.stringify([...set])); } catch {}
}

// ── Helpers ────────────────────────────────────────────────────────────────
function statusBadge(cat) {
  if (cat === 'pago')        return { cls: 'badge-green',  label: 'Pago'         };
  if (cat === 'quase pago')  return { cls: 'badge-teal',   label: 'Quase Pago'   };
  if (cat === 'aprovado')    return { cls: 'badge-yellow', label: 'Aprovado'     };
  if (cat === 'reprovado')   return { cls: 'badge-red',    label: 'Reprovado'    };
  return                            { cls: 'badge-gray',   label: 'Desconhecido' };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtCPF(cpf) {
  if (!cpf || cpf.length !== 11) return cpf || '—';
  return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
}

// ── Filters ────────────────────────────────────────────────────────────────
function applyFilters(entries) {
  let r = entries.filter(e => e.isMarketing === true);
  const { status, produto, search } = state.propostasFilter;
  if (status  !== 'all') r = r.filter(e => e.statusCat === status);
  if (produto !== 'all') r = r.filter(e => (e.produto || '').trim() === produto);
  const q = (search || '').trim().toLowerCase();
  if (q) r = r.filter(e => (e.cliente||'').toLowerCase().includes(q) || (e.cpf||'').includes(q));
  return r;
}

function uniqueProducts(entries) {
  const s = new Set(entries.filter(e => e.isMarketing === true).map(e => (e.produto||'').trim()).filter(Boolean));
  return [...s].sort();
}

// ── Card ───────────────────────────────────────────────────────────────────
function propostaCard(e) {
  const sb = statusBadge(e.statusCat);
  return `
    <div class="proposta-card">
      <div class="proposta-header">
        <div class="proposta-identity">
          <span class="proposta-name">${e.cliente || '—'}</span>
          <span class="proposta-cpf">${fmtCPF(e.cpf)}</span>
        </div>
        <div class="proposta-header-right">
          <span class="badge ${sb.cls}">${e.rawStatus || sb.label}</span>
          <span class="proposta-valor">${e.valor ? fmtBRL(e.valor) : '—'}</span>
        </div>
      </div>
      <div class="proposta-body">
        <div class="proposta-field"><span class="pf-label">Data</span><span>${fmtDate(e.saleDate)}</span></div>
        <div class="proposta-field"><span class="pf-label">Banco</span><span>${e.banco || '—'}</span></div>
        <div class="proposta-field"><span class="pf-label">Produto</span><span>${e.produto || '—'}</span></div>
        <div class="proposta-field"><span class="pf-label">Loja</span><span>${e.loja || '—'}</span></div>
      </div>
      <div class="proposta-footer">
        <span class="pf-item">👤 <strong>${e.vendedor || '—'}</strong></span>
        <span class="pf-item">📍 ${e.ecorbanOrigem || '—'}</span>
        ${e.origem ? `<span class="pf-item">📱 ${e.origem}${e.audiencia ? ' / '+e.audiencia : ''}</span>` : ''}
      </div>
    </div>`;
}

// ── Export modal ───────────────────────────────────────────────────────────
export function openExportModal() {
  const sel = loadExportCols();
  document.getElementById('export-cols-list').innerHTML = COLS.map(c => `
    <label class="export-col-item">
      <input type="checkbox" value="${c.key}" ${sel.has(c.key) ? 'checked' : ''}>
      ${c.label}
    </label>`).join('');
  document.getElementById('propostas-export-modal').style.display = 'flex';
}

export function closeExportModal() {
  document.getElementById('propostas-export-modal').style.display = 'none';
}

export function doExportCSV() {
  const checked = [...document.querySelectorAll('#export-cols-list input:checked')].map(el => el.value);
  if (!checked.length) { alert('Selecione ao menos uma coluna.'); return; }
  saveExportCols(new Set(checked));

  const fd = filteredData();
  if (!fd) return;
  const filtered = applyFilters(fd.entries);
  const colDefs  = COLS.filter(c => checked.includes(c.key));

  const header = colDefs.map(c => c.label).join(';');
  const rows   = filtered.map(e => colDefs.map(c => {
    let v = e[c.key];
    if (c.key === 'saleDate') v = fmtDate(v);
    else if (c.key === 'valor') v = v != null ? v.toFixed(2).replace('.', ',') : '';
    else if (c.key === 'cpf')   v = fmtCPF(v);
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }).join(';')).join('\n');

  const csv  = '﻿' + header + '\n' + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `propostas_marketing_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  closeExportModal();
}

// ── Render ─────────────────────────────────────────────────────────────────
export function renderPropostas(entries) {
  const el = document.getElementById('propostas-body');
  if (!el) return;

  if (!entries?.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>
      <div class="empty-title">Nenhum dado processado</div>
      <div class="empty-desc">Importe os arquivos e processe os dados primeiro.</div></div>`;
    return;
  }

  const allMkt   = entries.filter(e => e.isMarketing === true);
  const filtered = applyFilters(entries);
  const prods    = uniqueProducts(entries);
  const { status, produto } = state.propostasFilter;

  const statusOpts = [
    { v: 'all',          l: `Todos os status` },
    { v: 'pago',         l: 'Pago'            },
    { v: 'quase pago',   l: 'Quase Pago'      },
    { v: 'aprovado',     l: 'Aprovado'        },
    { v: 'reprovado',    l: 'Reprovado'       },
    { v: 'desconhecido', l: 'Desconhecido'    },
  ].map(o => `<option value="${o.v}" ${status === o.v ? 'selected' : ''}>${o.l}</option>`).join('');

  const prodOpts = [
    `<option value="all" ${produto === 'all' ? 'selected' : ''}>Todos os produtos</option>`,
    ...prods.map(p => `<option value="${p.replace(/"/g,'&quot;')}" ${produto === p ? 'selected':''}>${p}</option>`)
  ].join('');

  const cards = filtered.length
    ? filtered.map(propostaCard).join('')
    : `<div class="empty" style="grid-column:1/-1;margin-top:24px">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Nenhuma proposta encontrada</div>
        <div class="empty-desc">Tente ajustar os filtros.</div>
       </div>`;

  const selectStyle = `background:var(--surface);border:1px solid var(--border);color:var(--white);
    padding:8px 12px;border-radius:7px;font-size:13px;font-family:var(--font-b);cursor:pointer;outline:none`;

  el.innerHTML = `
    <div class="section-title"><span class="bar"></span>Propostas de Marketing</div>

    <div class="propostas-toolbar">
      <div style="position:relative;flex:1;min-width:200px;max-width:320px">
        <input type="text" placeholder="Buscar por nome ou CPF…"
          value="${(state.propostasFilter.search||'').replace(/"/g,'&quot;')}"
          oninput="setPropostasSearch(this.value)"
          style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--white);
                 padding:8px 12px 8px 34px;border-radius:7px;font-size:13px;font-family:var(--font-b);outline:none"
          onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--gray);pointer-events:none"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <select onchange="setPropostasStatus(this.value)" style="${selectStyle}">${statusOpts}</select>
      <select onchange="setPropostasProduto(this.value)" style="${selectStyle}">${prodOpts}</select>
      <span style="color:var(--gray);font-size:13px;white-space:nowrap">${fmtN(filtered.length)} de ${fmtN(allMkt.length)}</span>
      <button class="btn-sm btn-primary" onclick="openExportModal()">⬇ Exportar CSV</button>
    </div>

    <div class="propostas-grid">${cards}</div>

    <!-- Export Modal -->
    <div id="propostas-export-modal" style="display:none;position:fixed;inset:0;z-index:1000;
         background:rgba(0,0,0,.6);align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;
                  padding:28px;width:500px;max-height:80vh;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,.4)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--white)">Selecionar Colunas para Exportar</div>
          <button onclick="closeExportModal()" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:20px;line-height:1">✕</button>
        </div>
        <div id="export-cols-list"
             style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow-y:auto;max-height:340px;padding-right:4px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:14px">
          <button class="btn-sm btn-ghost" onclick="closeExportModal()">Cancelar</button>
          <button class="btn-sm btn-primary" onclick="doExportCSV()">⬇ Exportar</button>
        </div>
      </div>
    </div>
  `;
}

export function setPropostasSearch(v) {
  state.propostasFilter.search = v;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasStatus(v) {
  state.propostasFilter.status = v;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
export function setPropostasProduto(v) {
  state.propostasFilter.produto = v;
  const fd = filteredData(); if (fd) renderPropostas(fd.entries);
}
