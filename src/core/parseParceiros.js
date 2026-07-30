/**
 * Parseia o CSV "Relatório de produção - Parceiros".
 *
 * Estrutura do arquivo (separador ';', codificação Latin-1/windows-1252):
 *   Linha  Título ("Relatório de produção - Parceiros")
 *   ...    linhas em branco / "STATUS"
 *   Header "Parceiro;REPROVADO;CLIENTE DESISTIU;PENDENCIA;RISCO DE PERDA;EM ANDAMENTO;INTEGRADO;PROJEÇÃO;RANKING"
 *   Dados  uma linha por parceiro
 *   "TOTAL" (rodapé, ignorado)
 *
 * Índices de coluna (0-based) nas linhas de dados:
 *   0=Parceiro  1=REPROVADO  2=CLIENTE DESISTIU  3=PENDENCIA  4=RISCO DE PERDA
 *   5=EM ANDAMENTO  6=INTEGRADO  7=PROJEÇÃO  8=RANKING
 *
 * O ranking usa a coluna RANKING da planilha (já ordenada por INTEGRADO).
 * Recebe o CSV já decodificado como string.
 */
export function parseParceiros(csvText) {
  // Converte "R$ 1.234.567,89" → 1234567.89 ; "R$ -   " → 0
  const parseMoney = v => {
    let s = String(v == null ? '' : v).replace(/r\$/i, '').replace(/\s/g, '');
    if (!s || s === '-') return 0;
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const lines = csvText.split(/\r?\n/);
  const partners = [];
  let headerFound = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols  = line.split(';');
    const first = (cols[0] || '').trim();

    if (!headerFound) {
      if (first.toLowerCase().startsWith('parceiro')) headerFound = true;
      continue;
    }

    const nome = first;
    if (!nome) continue;
    const up = nome.toUpperCase();
    if (up === 'TOTAL' || up.startsWith('STATUS')) continue;

    partners.push({
      nome,
      reprovado:       parseMoney(cols[1]),
      clienteDesistiu: parseMoney(cols[2]),
      pendencia:       parseMoney(cols[3]),
      riscoPerda:      parseMoney(cols[4]),
      emAndamento:     parseMoney(cols[5]),
      integrado:       parseMoney(cols[6]),
      projecao:        parseMoney(cols[7]),
      rank:            parseInt((cols[8] || '').trim()) || 0,
    });
  }

  // Ordena pela posição da planilha; desempate por integrado desc, depois nome
  partners.sort((a, b) => {
    if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
    return (b.integrado - a.integrado) || a.nome.localeCompare(b.nome);
  });

  return { partners };
}
