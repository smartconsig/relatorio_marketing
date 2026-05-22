import { state } from '../state.js';
import { STATUS_PAID, STATUS_ALMOST_PAID, STATUS_APPROVED, STATUS_REJECTED } from '../config/status.js';
import { normStr } from '../utils/string.js';
import { parseBRL, fmtBRL, fmtN } from '../utils/currency.js';
import { parseExcelDate, inRange } from '../utils/date.js';
import { getCol } from '../utils/string.js';
import { HIERARCHY } from '../config/status.js';

const _PAID        = new Set([...STATUS_PAID].map(normStr));
const _ALMOST_PAID = new Set([...STATUS_ALMOST_PAID].map(normStr));
const _APPROVED    = new Set([...STATUS_APPROVED].map(normStr));
const _REJECTED    = new Set([...STATUS_REJECTED].map(normStr));

export function classifyStatus(raw) {
  const s = normStr(raw);
  if (_PAID.has(s))        return 'pago';
  if (_ALMOST_PAID.has(s)) return 'quase pago';
  if (_APPROVED.has(s))    return 'aprovado';
  if (_REJECTED.has(s))    return 'reprovado';
  return 'desconhecido';
}

export function getHierarchy(loja) {
  const s = normStr(loja);
  for (const [key, val] of Object.entries(HIERARCHY)) {
    const k = normStr(key);
    if (s.includes(k)) return val;
  }
  return { supervisor: '—', gerente: '—' };
}

export function filteredData() {
  if (!state.result) return null;
  const { start, end } = state.filterDates;
  const entries  = state.result.entries.filter(r => inRange(r.saleDate, start, end));
  const facebook = state.result.facebook.filter(r => {
    const d = parseExcelDate(r['Dia'] || r['Início dos relatórios'] || r['Inicio dos relatórios']);
    return inRange(d, start, end);
  });
  return { entries, facebook };
}

export function calcKPIs(entries, facebook) {
  let invest = 0, leads = 0, fbCpl = 0, cplCalc = 0;

  if (state.metaAds) {
    // Dados em tempo real da API do Meta — substitui a planilha do Facebook
    invest   = state.metaAds.invest;
    leads    = state.metaAds.leads;
    cplCalc  = leads ? invest / leads : 0;
  } else {
    // Fallback: planilha do Facebook importada manualmente
    let fbCplSum = 0, fbCplCount = 0;
    const msgRows = facebook.filter(r => {
      const tipo = String(getCol(r, 'Tipo de resultado') || '').toLowerCase();
      return !tipo || tipo.includes('mensagem') || tipo.includes('conversa') || tipo.includes('message');
    });
    const leadsRows = msgRows.length > 0 ? msgRows : facebook;
    for (const r of facebook) {
      invest += parseBRL(getCol(r, 'Montante gasto (BRL)', 'Montante Gasto (BRL)'));
    }
    for (const r of leadsRows) {
      const res = parseInt(String(getCol(r, 'Resultados', 'resultados') || '').replace(/\D/g, '')) || 0;
      leads += res;
      const cpr = parseBRL(getCol(r, 'Custo por resultado', 'Custo Por Resultado'));
      if (cpr > 0) { fbCplSum += cpr; fbCplCount++; }
    }
    fbCpl   = fbCplCount ? fbCplSum / fbCplCount : 0;
    cplCalc = leads ? invest / leads : 0;
  }

  const inProgMkt      = entries.filter(r => r.isMarketing && r.statusCat === 'aprovado');
  const almostPaidMkt  = entries.filter(r => r.isMarketing && r.statusCat === 'quase pago');
  const paidMkt        = entries.filter(r => r.isMarketing && r.statusCat === 'pago');
  const rejMkt         = entries.filter(r => r.isMarketing && r.statusCat === 'reprovado');
  const valueInProgMkt      = inProgMkt.reduce((s, r)     => s + r.valor, 0);
  const valueAlmostPaidMkt  = almostPaidMkt.reduce((s, r) => s + r.valor, 0);
  const valueMkt            = paidMkt.reduce((s, r)       => s + r.valor, 0);
  const valueRejMkt         = rejMkt.reduce((s, r)        => s + r.valor, 0);
  const valueValidMkt  = valueInProgMkt + valueAlmostPaidMkt + valueMkt;
  const countValidMkt  = inProgMkt.length + almostPaidMkt.length + paidMkt.length;
  const ticketMkt      = paidMkt.length ? valueMkt / paidMkt.length : 0;
  const cac            = paidMkt.length ? invest / paidMkt.length : 0;
  const roas           = invest ? (valueMkt * 0.21) / invest : 0;
  const convRate       = leads ? (paidMkt.length / leads) * 100 : 0;

  const inProgAll      = entries.filter(r => r.statusCat === 'aprovado');
  const almostPaidAll  = entries.filter(r => r.statusCat === 'quase pago');
  const paidAll        = entries.filter(r => r.statusCat === 'pago');
  const rejAll         = entries.filter(r => r.statusCat === 'reprovado');
  const valueInProgAll     = inProgAll.reduce((s, r)     => s + r.valor, 0);
  const valueAlmostPaidAll = almostPaidAll.reduce((s, r) => s + r.valor, 0);
  const valuePaidAll       = paidAll.reduce((s, r)       => s + r.valor, 0);
  const valueRejAll        = rejAll.reduce((s, r)        => s + r.valor, 0);
  const valueValidAll  = valueInProgAll + valueAlmostPaidAll + valuePaidAll;
  const countValidAll  = inProgAll.length + almostPaidAll.length + paidAll.length;
  const ticketAll      = paidAll.length ? valuePaidAll / paidAll.length : 0;

  // Revisões agora acontecem no PROCV; toReview só serve para compatibilidade
  const toReview = [];

  return {
    invest, leads, fbCpl, cplCalc,
    inProgMkt: inProgMkt.length, almostPaidMkt: almostPaidMkt.length, paidMkt: paidMkt.length, rejMkt: rejMkt.length,
    valueInProgMkt, valueAlmostPaidMkt,
    valueMkt, valueRejMkt, valueValidMkt, countValidMkt,
    ticketMkt, cac, roas, convRate,
    inProgAll: inProgAll.length, almostPaidAll: almostPaidAll.length, paidAll: paidAll.length, rejAll: rejAll.length,
    valueInProgAll, valueAlmostPaidAll,
    valuePaidAll, valueRejAll, valueValidAll, countValidAll,
    ticketAll,
    approvedMkt: inProgMkt.length + paidMkt.length,
    approvedAll: inProgAll.length + paidAll.length,
    toReview,
  };
}
