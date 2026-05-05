import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { normPhone, getCol } from '../utils/string.js';
import { parseBRL } from '../utils/currency.js';
import { parseExcelDate } from '../utils/date.js';
import { classifyStatus } from './calcKPIs.js';

export function buildResult() {
  const byCPF   = {};
  const byPhone = {};

  const smartCols = state.raw.smart.length ? Object.keys(state.raw.smart[0]) : [];
  const diagSmart = { total: state.raw.smart.length, cpfIndexed: 0, phoneIndexed: 0, cols: smartCols.slice(0, 8) };

  for (const row of state.raw.smart) {
    const cpf   = normCPF(getCol(row, 'CPF', 'cpf', 'Cpf'));
    const phone = normPhone(String(getCol(row, 'Telefone', 'telefone', 'Fone', 'fone') || ''));
    if (cpf && cpf !== '00000000000') {
      if (!byCPF[cpf]) { byCPF[cpf] = []; diagSmart.cpfIndexed++; }
      byCPF[cpf].push(row);
    }
    if (phone && phone.length >= 8) {
      if (!byPhone[phone]) { byPhone[phone] = []; diagSmart.phoneIndexed++; }
      byPhone[phone].push(row);
    }
  }

  const fbRows = [];
  if (state.raw.fb03) state.raw.fb03.forEach(r => fbRows.push({ ...r, _bm: 'BM-03' }));
  if (state.raw.fb06) state.raw.fb06.forEach(r => fbRows.push({ ...r, _bm: 'BM-06' }));

  const entries      = [];
  const unknownStats = new Set();
  const ecorbanCols  = state.raw.ecorban.length ? Object.keys(state.raw.ecorban[0]) : [];
  let matched = 0;

  for (let i = 0; i < state.raw.ecorban.length; i++) {
    const row = state.raw.ecorban[i];
    const cpf       = normCPF(getCol(row, 'CPF/CNPJ', 'CPF', 'cpf'));
    const phone     = normPhone(String(getCol(row, 'Cliente - Telefones', 'Telefone', 'telefone') || ''));
    const rawStatus = String(getCol(row, 'Status', 'status') || '').trim();
    const statusCat = classifyStatus(rawStatus);
    if (statusCat === 'desconhecido' && rawStatus) unknownStats.add(rawStatus);

    const valor    = parseBRL(getCol(row, 'Multiplicador', 'Valor Multiplicador', 'Valor'));
    const saleDate = parseExcelDate(getCol(row, 'Data', 'data', 'Data Cadastro'));

    const entry = {
      _idx: i, cpf, phone,
      cliente:       String(getCol(row, 'Cliente', 'cliente', 'Nome') || ''),
      rawStatus, statusCat, valor, saleDate,
      banco:         String(getCol(row, 'Banco', 'banco') || ''),
      produto:       String(getCol(row, 'Produto', 'produto') || ''),
      loja:          String(getCol(row, 'Loja', 'loja', 'Time') || ''),
      vendedor:      String(getCol(row, 'Vendedor', 'vendedor', 'Consultor') || ''),
      isMarketing:   null,
      matchMethod:   null,
      origem:        null,
      audiencia:     null,
      ecorbanOrigem: String(getCol(row, 'Origem', 'origem', 'Canal', 'canal', 'Mídia', 'midia') || ''),
      smartPhone:    null,
      reviewReason:  null,
    };

    if (cpf && state.overrides[cpf] !== undefined) {
      entry.isMarketing  = state.overrides[cpf];
      entry.reviewReason = 'manual';
      entries.push(entry);
      matched++;
      continue;
    }

    let smartMatches = null;
    if (cpf && cpf !== '00000000000' && byCPF[cpf]) {
      smartMatches = byCPF[cpf];
      entry.matchMethod = 'cpf';
    } else if (phone && byPhone[phone]) {
      smartMatches = byPhone[phone];
      entry.matchMethod = 'telefone';
    }

    if (!smartMatches) {
      entry.reviewReason = 'Não encontrado no Smart';
      entries.push(entry);
      continue;
    }

    matched++;

    const oldest = smartMatches.slice().sort((a, b) => {
      const da = parseExcelDate(getCol(a, 'Data de Criação', 'Data Criação', 'DataCriacao'));
      const db = parseExcelDate(getCol(b, 'Data de Criação', 'Data Criação', 'DataCriacao'));
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    })[0];

    const origem    = String(getCol(oldest, 'Origem', 'origem') || '').trim();
    const audiencia = String(getCol(oldest, 'Audiencia', 'Audiência', 'audiencia') || '').trim();
    entry.origem     = origem;
    entry.audiencia  = audiencia;
    entry.smartPhone = normPhone(String(getCol(oldest, 'Telefone', 'telefone', 'Fone', 'fone') || ''));

    if (['Instagram', 'Storie Instagram', 'Sem Origem'].includes(origem)) {
      entry.isMarketing = true;
    } else if (origem === 'NÃO MAPEADO' && audiencia === 'NÃO MAPEADO') {
      entry.isMarketing = true;
    } else {
      entry.isMarketing = false;
    }

    entries.push(entry);
  }

  const statusDist = {};
  for (const e of entries) {
    statusDist[e.statusCat] = (statusDist[e.statusCat] || 0) + 1;
  }
  const statusSample = [...new Set(entries.map(e => e.rawStatus).filter(Boolean))].slice(0, 10);

  const diag = {
    smart:   diagSmart,
    ecorban: { total: state.raw.ecorban.length, matched, toReview: state.raw.ecorban.length - matched, cols: ecorbanCols.slice(0, 8) },
    facebook: { total: fbRows.length, bm03: state.raw.fb03?.length || 0, bm06: state.raw.fb06?.length || 0 },
    statusDist,
    statusSample,
  };

  return { entries, facebook: fbRows, unknownStatuses: [...unknownStats], diag };
}
