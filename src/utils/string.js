export function normStr(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normPhone(v) {
  if (!v) return '';
  const first = String(v).split(';')[0].trim();
  let d = first.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  return d;
}

export function toTitle(s) {
  return String(s || '').toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

export function getCol(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
    const trimmed = Object.keys(row).find(k => k.trim() === name.trim());
    if (trimmed !== undefined) return row[trimmed];
    const lower = name.trim().toLowerCase();
    const ci = Object.keys(row).find(k => k.trim().toLowerCase() === lower);
    if (ci !== undefined) return row[ci];
  }
  return '';
}
