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
const _toNum = v => parseFloat(String(v || 0).replace(',', '.')) || 0;

// Converte uma linha da planilha em vendedor; null para linhas ignoradas
// (nome vazio, comentários * / #, sem rank).
function _linhaParaVendedor(r) {
  const nome = String(r[0] || '').trim();
  if (!nome || nome.startsWith('*') || nome.startsWith('#')) return null;

  const rank = parseInt(r[4]) || 0;
  if (!rank) return null;

  return {
    nome,
    equipe:        String(r[1]  || '').trim(),
    tempoAdmissao: String(r[2]  || '').trim(),
    rank,
    quartil:  parseInt(r[5])  || 0,
    nota:     _toNum(r[6]),
    propostas: _toNum(r[11]),
    esteira:   _toNum(r[13]),
    pgtos:     _toNum(r[17]),
  };
}

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
    const seller = _linhaParaVendedor(rows[i]);
    if (seller) sellers.push(seller);
  }

  sellers.sort((a, b) => a.rank - b.rank);
  return { sellers, monthYear };
}
