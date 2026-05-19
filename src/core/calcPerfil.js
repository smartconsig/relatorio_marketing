/**
 * calcPerfil.js
 * Agrega dados de perfil de cliente (faixa etária, estado, LTV, tempo de conversão)
 * a partir de entries já processados pelo buildResult.
 *
 * Considera APENAS entradas de marketing (isMarketing === true).
 * O LTV analisa o histórico completo (ignora filtro de datas) — recebe allEntries.
 */

const FAIXAS_ORDER = ['18–30', '31–40', '41–50', '51–60', '61+'];

/**
 * @param {Array} filteredEntries - entries já filtrados por data (para análises do período)
 * @param {Array} allEntries      - todos os entries acumulados (para LTV histórico)
 */
export function calcPerfil(filteredEntries, allEntries) {
  const mkt   = filteredEntries.filter(e => e.isMarketing);
  const pagos  = mkt.filter(e => e.statusCat === 'pago');

  // ── Cobertura dos dados ────────────────────────────────────────────────────
  const cobertura = {
    totalMkt:      mkt.length,
    comIdade:      mkt.filter(e => e.faixaEtaria).length,
    comEstado:     mkt.filter(e => e.estado).length,
    pagoComDias:   pagos.filter(e => e.diasConversao !== null).length,
    totalPagos:    pagos.length,
  };

  // ── Por faixa etária ───────────────────────────────────────────────────────
  const faixaMap = {};
  mkt.forEach(e => {
    if (!e.faixaEtaria) return;
    if (!faixaMap[e.faixaEtaria]) faixaMap[e.faixaEtaria] = { leads: 0, pagos: 0, valor: 0 };
    faixaMap[e.faixaEtaria].leads++;
    if (e.statusCat === 'pago') {
      faixaMap[e.faixaEtaria].pagos++;
      faixaMap[e.faixaEtaria].valor += e.valor || 0;
    }
  });
  const faixas = FAIXAS_ORDER
    .filter(f => faixaMap[f])
    .map(f => ({
      label:       f,
      leads:       faixaMap[f].leads,
      pagos:       faixaMap[f].pagos,
      taxa:        faixaMap[f].leads > 0 ? faixaMap[f].pagos / faixaMap[f].leads : 0,
      valorTotal:  faixaMap[f].valor,
      ticketMedio: faixaMap[f].pagos > 0 ? faixaMap[f].valor / faixaMap[f].pagos : 0,
    }))
    .sort((a, b) => b.pagos - a.pagos || b.taxa - a.taxa);

  // ── Por estado ─────────────────────────────────────────────────────────────
  const estadoMap = {};
  mkt.forEach(e => {
    if (!e.estado) return;
    if (!estadoMap[e.estado]) estadoMap[e.estado] = { leads: 0, pagos: 0, valor: 0, regiao: e.regiao || '' };
    estadoMap[e.estado].leads++;
    if (e.statusCat === 'pago') {
      estadoMap[e.estado].pagos++;
      estadoMap[e.estado].valor += e.valor || 0;
    }
  });
  const estados = Object.entries(estadoMap)
    .map(([uf, d]) => ({
      uf,
      regiao:      d.regiao,
      leads:       d.leads,
      pagos:       d.pagos,
      taxa:        d.leads > 0 ? d.pagos / d.leads : 0,
      valorTotal:  d.valor,
      ticketMedio: d.pagos > 0 ? d.valor / d.pagos : 0,
    }))
    .sort((a, b) => b.pagos - a.pagos || b.taxa - a.taxa);

  // ── Por região ─────────────────────────────────────────────────────────────
  const regiaoMap = {};
  mkt.forEach(e => {
    const r = e.regiao || '';
    if (!r) return;
    if (!regiaoMap[r]) regiaoMap[r] = { leads: 0, pagos: 0, valor: 0 };
    regiaoMap[r].leads++;
    if (e.statusCat === 'pago') {
      regiaoMap[r].pagos++;
      regiaoMap[r].valor += e.valor || 0;
    }
  });
  const regioes = Object.entries(regiaoMap)
    .map(([nome, d]) => ({
      nome,
      leads:      d.leads,
      pagos:      d.pagos,
      taxa:       d.leads > 0 ? d.pagos / d.leads : 0,
      valorTotal: d.valor,
    }))
    .sort((a, b) => b.pagos - a.pagos);

  // ── Tempo de conversão ─────────────────────────────────────────────────────
  const diasArr = pagos
    .filter(e => e.diasConversao !== null && e.diasConversao >= 0 && e.diasConversao <= 365)
    .map(e => e.diasConversao);
  const mediaDias = diasArr.length > 0
    ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length)
    : null;
  const sorted = [...diasArr].sort((a, b) => a - b);
  const medianaDias = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;

  // ── LTV — histórico completo (ignora filtro de datas) ─────────────────────
  const cpfMap = {};
  allEntries
    .filter(e => e.isMarketing && e.statusCat === 'pago' && e.cpf && e.cpf !== '00000000000')
    .forEach(e => {
      if (!cpfMap[e.cpf]) {
        cpfMap[e.cpf] = { cpf: e.cpf, cliente: e.cliente || '', compras: 0, ltv: 0, datas: [] };
      }
      cpfMap[e.cpf].compras++;
      cpfMap[e.cpf].ltv += e.valor || 0;
      if (e.pagamentoData) cpfMap[e.cpf].datas.push(e.pagamentoData);
    });

  const clientesLtv  = Object.values(cpfMap);
  const recorrentes  = clientesLtv.filter(c => c.compras > 1);
  const topLtv       = [...clientesLtv].sort((a, b) => b.ltv - a.ltv).slice(0, 10);

  // Tempo médio entre recompras
  const intervalos = [];
  recorrentes.forEach(c => {
    const ds = c.datas.filter(Boolean).sort((a, b) => a - b);
    for (let i = 1; i < ds.length; i++) {
      intervalos.push(Math.round((ds[i] - ds[i - 1]) / 864e5));
    }
  });
  const tempMedioRecompra = intervalos.length > 0
    ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length)
    : null;

  return {
    faixas,
    estados,
    regioes,
    conversao: { mediaDias, medianaDias },
    ltv: {
      totalClientes:    clientesLtv.length,
      recorrentes:      recorrentes.length,
      taxaRecorrencia:  clientesLtv.length > 0 ? recorrentes.length / clientesLtv.length : 0,
      topClientes:      topLtv,
      tempMedioRecompra,
    },
    cobertura,
  };
}
