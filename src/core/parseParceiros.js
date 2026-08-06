/**
 * Parseia o relatório "Relatório de produção - Parceiros".
 *
 * Dois formatos de arquivo são aceitos:
 *   - CSV (separador ';', codificação Latin-1/windows-1252) — formato antigo
 *   - XLSX (aba "Resumo") — formato novo; a página converte a aba em linhas
 *     (array de arrays, valores brutos) e chama parseParceirosRows()
 *
 * Estrutura comum:
 *   Linha  Título ("Relatório de produção - Parceiros" / "RELATÓRIO DE PRODUÇÃO...")
 *   ...    linhas em branco / "STATUS"
 *   Header "Parceiro;REPROVADO;CLIENTE DESISTIU;PENDENCIA;RISCO DE PERDA;
 *           EM ANDAMENTO;INTEGRADO;PROJEÇÃO;[Diferença p/ 1º Lugar;]RANKING"
 *   Dados  uma linha por parceiro
 *   "TOTAL" (rodapé, ignorado)
 *
 * As colunas são localizadas PELO NOME no cabeçalho (não por índice fixo),
 * então colunas extras ou reordenadas não quebram o parse. O cabeçalho de
 * ranking aceita variações ("RANKING", "RANKINK"). A coluna "Diferença p/ 1º
 * Lugar" da planilha nova é ignorada — a tela calcula a diferença para o
 * parceiro imediatamente acima.
 *
 * O ranking usa a coluna RANKING da planilha (já ordenada por INTEGRADO).
 */

// Converte valor monetário em número.
// Aceita número bruto (célula do xlsx) ou string "R$ 1.234.567,89" / "R$ -   ".
function parseMoney(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v == null ? '' : v).replace(/r\$/i, '').replace(/\s/g, '');
  if (!s || s === '-') return 0;
  s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normaliza nome de coluna do cabeçalho: maiúsculas, sem acento, espaços únicos.
function normHeader(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// Mapeia cabeçalho normalizado → campo do parceiro.
function fieldFor(h) {
  if (h.startsWith('RANK'))            return 'rank';      // RANKING / RANKINK
  if (h === 'REPROVADO')               return 'reprovado';
  if (h === 'CLIENTE DESISTIU')        return 'clienteDesistiu';
  if (h === 'PENDENCIA')               return 'pendencia';
  if (h === 'RISCO DE PERDA')          return 'riscoPerda';
  if (h === 'EM ANDAMENTO')            return 'emAndamento';
  if (h === 'INTEGRADO')               return 'integrado';
  if (h.startsWith('PROJECAO'))        return 'projecao';
  return null; // colunas desconhecidas (ex.: "Diferença p/ 1º Lugar") são ignoradas
}

/**
 * Parse a partir de linhas já tabuladas (array de arrays) — usado pelo XLSX.
 */
export function parseParceirosRows(rows) {
  const partners = [];
  let colMap = null; // índice da coluna → nome do campo

  for (const cols of rows) {
    if (!cols || !cols.length) continue;
    const first = String(cols[0] == null ? '' : cols[0]).trim();

    if (!colMap) {
      if (normHeader(first).startsWith('PARCEIRO')) {
        colMap = {};
        cols.forEach((h, i) => {
          const f = fieldFor(normHeader(h));
          if (f) colMap[i] = f;
        });
      }
      continue;
    }

    const nome = first;
    if (!nome) continue;
    const up = nome.toUpperCase();
    if (up === 'TOTAL' || up.startsWith('STATUS')) continue;

    const p = {
      nome,
      reprovado: 0, clienteDesistiu: 0, pendencia: 0, riscoPerda: 0,
      emAndamento: 0, integrado: 0, projecao: 0, rank: 0,
    };
    for (const [i, f] of Object.entries(colMap)) {
      const v = cols[i];
      p[f] = f === 'rank' ? (parseInt(String(v == null ? '' : v).trim()) || 0) : parseMoney(v);
    }
    partners.push(p);
  }

  // Ordena pela posição da planilha; desempate por integrado desc, depois nome
  partners.sort((a, b) => {
    if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
    return (b.integrado - a.integrado) || a.nome.localeCompare(b.nome);
  });

  return { partners };
}

/**
 * Parse a partir do CSV decodificado como string (formato antigo).
 */
export function parseParceiros(csvText) {
  const rows = csvText.split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => l.split(';'));
  return parseParceirosRows(rows);
}
