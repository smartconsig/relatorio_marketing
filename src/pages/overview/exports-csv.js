// Exports CSV da Visão Geral (globais: chamados por onclick — nomes fixos).
import { state } from '../../state.js';
import { fmtN } from '../../utils/currency.js';
import { toast } from '../../utils/ui.js';
import { filteredData } from '../../core/calcKPIs.js';

export function exportNoValueCSV() {
  const fd = filteredData();
  if (!fd) return;
  const noValue = fd.entries.filter(r => r.statusCat !== 'desconhecido' && !r.valor);
  if (!noValue.length) { toast('Nenhuma entrada sem valor no período'); return; }
  const header = ['Cliente','CPF','Status','Categoria','Data','Produto','Banco','Loja','Vendedor','Origem Ecorban','É Marketing'];
  const rows   = noValue.map(e => [
    e.cliente||'', e.cpf||'', e.rawStatus||'', e.statusCat||'',
    e.saleDate ? new Date(e.saleDate).toLocaleDateString('pt-BR') : '',
    e.produto||'', e.banco||'', e.loja||'', e.vendedor||'',
    e.ecorbanOrigem||'', e.isMarketing ? 'Sim' : 'Não',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `sem_valor_multiplicador_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${fmtN(noValue.length)} entradas exportadas`);
}

export function exportNoDatesCSV() {
  if (!state.result) return;
  const noDate = state.result.entries.filter(e => !e.saleDate);
  if (!noDate.length) { toast('Nenhuma entrada sem data'); return; }
  const header = ['Cliente', 'CPF', 'Status', 'Categoria', 'Valor', 'Origem Ecorban', 'Loja', 'Vendedor', 'É Marketing'];
  const rows   = noDate.map(e => [
    e.cliente || '', e.cpf || '', e.rawStatus || '', e.statusCat || '',
    e.valor || 0, e.ecorbanOrigem || '', e.loja || '', e.vendedor || '',
    e.isMarketing ? 'Sim' : 'Não',
  ]);
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `entradas_sem_data_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${fmtN(noDate.length)} entradas exportadas`);
}
