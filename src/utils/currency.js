export function parseBRL(v) {
  const s = String(v || '').replace(/[R$\s]/g, '').trim();
  if (!s) return 0;
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

export const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const fmtN   = v => new Intl.NumberFormat('pt-BR').format(v || 0);
export const fmtPct = v => (+(v || 0)).toFixed(1) + '%';
