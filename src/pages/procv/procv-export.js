// Export CSV do PROCV (respeita a aba ativa e a busca).
import { state } from '../../state.js';
import { toast } from '../../utils/ui.js';
import { filteredData } from '../../core/calcKPIs.js';

// Mesmo funil da tabela: aba ativa (state.procvFilter) + busca (state.procvSearch)
function _filtrarParaExport(fd) {
  let filtered = fd.entries.filter(e => e.isMarketing === true || e.reverseCandidate === true || e.reviewReason === 'manual' || e.reviewReason === 'reclassified');
  if (state.procvFilter === 'pending')       filtered = filtered.filter(e => !e.reverseCandidate && e.smartSignal !== 'confirmed' && e.reviewReason !== 'manual');
  if (state.procvFilter === 'doubt')         filtered = filtered.filter(e => (e.smartSignal === 'doubt' || e.smartSignal === 'not_found') && e.reviewReason !== 'manual');
  if (state.procvFilter === 'contradiction') filtered = filtered.filter(e => e.smartSignal === 'contradiction' && e.reviewReason !== 'manual');
  if (state.procvFilter === 'smart')         filtered = filtered.filter(e => !e.reverseCandidate && e.smartSignal === 'confirmed');
  if (state.procvFilter === 'reverse')       filtered = filtered.filter(e => e.reverseCandidate === true && e.reviewReason !== 'manual');
  if (state.procvFilter === 'manual')        filtered = filtered.filter(e => e.reviewReason === 'manual');
  const q = state.procvSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) || (e.cpf || '').includes(q)
  );
  return filtered;
}

export function exportProcvCSV() {
  const fd = filteredData();
  if (!fd) return;
  const filtered = _filtrarParaExport(fd);

  const header = ['Cliente', 'CPF', 'Status', 'Categoria', 'Origem Ecorban', 'Telefone Smart', 'Origem Smart', 'Audiencia Smart', 'Sinal Smart'];
  const rows   = filtered.map(e => [
    e.cliente || '', e.cpf || '', e.rawStatus || '', e.statusCat || '',
    e.ecorbanOrigem || '', e.smartPhone || '', e.origem || '', e.audiencia || '',
    e.reviewReason === 'manual' ? 'Revisado' : (e.reverseCandidate ? 'Marketing Perdido' : (e.smartSignal || 'desconhecido')),
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
