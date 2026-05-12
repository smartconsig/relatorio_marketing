/**
 * Parses the BSC_OPER sheet from the Ana Julia Excel file.
 * Structure:
 *   Row 0: Title ("INDICADORES - BALANCED SCORECARD - Abril/26")
 *   Row 1: Column headers
 *   Row 2: Targets / period label ("* Ranking de Vendedores - ...")
 *   Row 3+: Vendor data
 *
 * Column indices (0-based):
 *   0=VENDEDOR  1=EQUIPE  2=TEMPO ADMISSÃO  4=RNK  5=QUARTIL  6=NOTA
 *   11=PROPOSTAS(R$)  13=ESTEIRA(R$)  17=PGTOS(R$)
 */
export function parseBSC(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, raw: false });
  const sheetName = wb.SheetNames.find(s => s.toUpperCase().includes('BSC_OPER')) || wb.SheetNames[0];
  const ws  = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Extract month/year from title row
  const titleCell = String(rows[0]?.[1] || rows[0]?.[0] || '').trim();
  const monthYear = titleCell.replace(/.*BALANCED SCORECARD\s*[-–]\s*/i, '').trim() || 'BSC';

  const sellers = [];
  for (let i = 3; i < rows.length; i++) {
    const r    = rows[i];
    const nome = String(r[0] || '').trim();
    if (!nome || nome.startsWith('*') || nome.startsWith('#')) continue;

    const rank = parseInt(r[4]) || 0;
    if (!rank) continue;

    const toNum = v => parseFloat(String(v || 0).replace(',', '.')) || 0;

    sellers.push({
      nome,
      equipe:        String(r[1]  || '').trim(),
      tempoAdmissao: String(r[2]  || '').trim(),
      rank,
      quartil:  parseInt(r[5])  || 0,
      nota:     toNum(r[6]),
      propostas: toNum(r[11]),
      esteira:   toNum(r[13]),
      pgtos:     toNum(r[17]),
    });
  }

  sellers.sort((a, b) => a.rank - b.rank);
  return { sellers, monthYear };
}
