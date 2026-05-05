export const normCPF = v => {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  return d.padStart(11, '0');
};
