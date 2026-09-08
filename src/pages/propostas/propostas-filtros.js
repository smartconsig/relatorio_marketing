// Filtros, ordenação e helpers puros das Propostas de Marketing.
import { state } from '../../state.js';

export function statusBadge(cat) {
  if (cat === 'pago')        return { cls: 'badge-green',  label: 'Pago'         };
  if (cat === 'quase pago')  return { cls: 'badge-teal',   label: 'Quase Pago'   };
  if (cat === 'aprovado')    return { cls: 'badge-yellow', label: 'Aprovado'     };
  if (cat === 'reprovado')   return { cls: 'badge-red',    label: 'Reprovado'    };
  return                            { cls: 'badge-gray',   label: 'Desconhecido' };
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export function fmtCPF(cpf) {
  if (!cpf || cpf.length !== 11) return cpf || '—';
  return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
}

export function applyFilters(entries) {
  let r = entries.filter(e => e.isMarketing === true);
  const { status, produto, origem, audiencia, search } = state.propostasFilter;
  if (status   !== 'all') r = r.filter(e => e.statusCat === status);
  if (produto  !== 'all') r = r.filter(e => (e.produto  || '').trim() === produto);
  if (origem   !== 'all') r = r.filter(e => (e.origem   || '').trim() === origem);
  if (audiencia !== 'all') r = r.filter(e => (e.audiencia || '').trim() === audiencia);
  const q = (search || '').trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  if (q) r = r.filter(e =>
    (e.cliente || '').toLowerCase().includes(q) ||
    (qDigits && (e.cpf || '').includes(qDigits)) ||
    (qDigits && (e.smartPhone || '').replace(/\D/g, '').includes(qDigits))
  );
  const { col, dir } = state.propostasSort;
  if (col) r = [...r].sort((a, b) => {
    const va = a[col], vb = b[col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
    return dir === 'desc' ? -cmp : cmp;
  });
  return r;
}

export function uniqueProducts(entries) {
  const s = new Set(entries.filter(e => e.isMarketing === true).map(e => (e.produto||'').trim()).filter(Boolean));
  return [...s].sort();
}
export function uniqueOrigens(entries) {
  const s = new Set(entries.filter(e => e.isMarketing === true).map(e => (e.origem||'').trim()).filter(Boolean));
  return [...s].sort();
}
export function uniqueAudiencias(entries) {
  const s = new Set(entries.filter(e => e.isMarketing === true).map(e => (e.audiencia||'').trim()).filter(Boolean));
  return [...s].sort();
}
