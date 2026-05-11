export function parseExcelDate(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    const utcMs = Math.round((v - 25569) * 864e5);
    const tmp = new Date(utcMs);
    if (isNaN(tmp)) return null;
    return new Date(tmp.getUTCFullYear(), tmp.getUTCMonth(), tmp.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function inRange(date, start, end) {
  if (!date) return !start && !end;
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (start) {
    const [sy, sm, sd] = start.split('-').map(Number);
    if (d < new Date(sy, sm - 1, sd, 0, 0, 0, 0)) return false;
  }
  if (end) {
    const [ey, em, ed] = end.split('-').map(Number);
    if (d > new Date(ey, em - 1, ed, 23, 59, 59, 999)) return false;
  }
  return true;
}
