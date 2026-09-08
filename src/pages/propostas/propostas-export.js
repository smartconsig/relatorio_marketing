// Modal de exportação CSV das Propostas: seleção de colunas (persistida em
// localStorage — só conveniência de UI) e geração do arquivo.
import { filteredData } from '../../core/calcKPIs.js';
import { applyFilters, fmtDate, fmtCPF } from './propostas-filtros.js';

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
