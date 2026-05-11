import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { normPhone, getCol, normStr } from '../utils/string.js';
import { parseBRL } from '../utils/currency.js';
import { parseExcelDate } from '../utils/date.js';
import { classifyStatus } from './calcKPIs.js';

/**
 * Returns 'confirmed' | 'doubt' | 'contradiction' based on Smart origem/audiencia.
 *
 * confirmed     → Smart corrobora que é marketing (Instagram, Storie, NÃO MAPEADO + público numerado/remarketing)
 * contradiction → Smart nega explicitamente (Disparo Compra / Disparo Margem)
 * doubt         → Smart não sabe (Sem Origem, NÃO MAPEADO+NÃO MAPEADO, vazios, etc.)
 */
function getSmartSignal(origem, audiencia) {
  const o = normStr(origem);
  const a = normStr(audiencia);

  if (o === 'instagram' || o === 'storie instagram') return 'confirmed';

  if (o === 'nao mapeado') {
    // Público 01–10, Públicos 01, Remarketing, Remarketing Storie → confirma
    if (/^publicos? \d+$/.test(a) || a === 'remarketing' || a === 'remarketing storie') return 'confirmed';
    // NÃO MAPEADO + Polícia Militar ou NÃO MAPEADO → dúvida
    return 'doubt';
  }

  if (o === 'disparo compra' || o === 'disparo margem') return 'contradiction';

  // Sem Origem, vazios, qualquer outra coisa
  return 'doubt';
}

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

    const valor         = parseBRL(getCol(row, 'Multiplicador', 'Valor Multiplicador', 'Valor'));
    const saleDate      = parseExcelDate(
      getCol(row,
        'Data Cadastro', 'Data de Cadastro', 'data cadastro', 'data de cadastro',
        'DT_CADASTRO', 'dt_cadastro',
      )
    );
    const ecorbanOrigem = String(getCol(row, 'Origem', 'origem', 'Canal', 'canal', 'Mídia', 'midia') || '').trim();

    // ── Critério primário: Origem do Ecorban ──────────────────────────────
    const isMarketingByEcorban = ecorbanOrigem.toUpperCase() === 'MARKETING';

    const entry = {
      _idx: i, cpf, phone,
      cliente:       String(getCol(row, 'Cliente', 'cliente', 'Nome') || ''),
      rawStatus, statusCat, valor, saleDate,
      banco:         String(getCol(row, 'Banco', 'banco') || ''),
      produto:       String(getCol(row, 'Produto', 'produto') || ''),
      loja:          String(getCol(row, 'Loja', 'loja', 'Time') || ''),
      vendedor:      String(getCol(row, 'Vendedor', 'vendedor', 'Consultor') || ''),
      isMarketing:   isMarketingByEcorban,
      matchMethod:   null,
      origem:        null,
      audiencia:     null,
      ecorbanOrigem,
      smartPhone:    null,
      reviewReason:  null,
      smartSignal:   null,   // 'confirmed' | 'doubt' | 'contradiction' | 'not_found'
    };

    // ── Override manual tem prioridade absoluta ───────────────────────────
    if (cpf && state.overrides[cpf] !== undefined) {
      entry.isMarketing  = state.overrides[cpf];
      entry.reviewReason = 'manual';
    }

    // ── Cruzamento com Smart (sinalização, não mais decisão) ──────────────
    let smartMatches = null;
    if (cpf && cpf !== '00000000000' && byCPF[cpf]) {
      smartMatches = byCPF[cpf];
      entry.matchMethod = 'cpf';
      matched++;
    } else if (phone && byPhone[phone]) {
      smartMatches = byPhone[phone];
      entry.matchMethod = 'telefone';
      matched++;
    }

    if (!smartMatches) {
      // CPF/telefone não encontrado no Smart
      if (isMarketingByEcorban && entry.reviewReason !== 'manual') {
        entry.smartSignal  = 'not_found';
        entry.reviewReason = 'CPF não encontrado no Smart';
      }
    } else {
      // Pega o registro mais antigo do Smart para obter a origem real
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
      entry.origem        = origem;
      entry.audiencia     = audiencia;
      entry.smartPhone    = normPhone(String(getCol(oldest, 'Telefone', 'telefone', 'Fone', 'fone') || ''));
      entry.smartOperador = normStr(getCol(oldest, 'Operador', 'operador') || '');
      entry.smartTime     = normStr(getCol(oldest, 'Time', 'time') || '');

      // Sinal Smart só é relevante para registros de marketing ainda não revisados
      if (isMarketingByEcorban && entry.reviewReason !== 'manual') {
        const sig = getSmartSignal(origem, audiencia);
        entry.smartSignal = sig;
        if (sig !== 'confirmed') {
          entry.reviewReason = sig === 'contradiction'
            ? `Smart diz: ${origem}`
            : `Dúvida: ${origem || 'sem origem'} / ${audiencia || 'sem audiência'}`;
        }
      }
    }

    entries.push(entry);
  }

  // ── Leads de marketing por Operador e Time (todo o Smart, sem filtro de data) ──
  const smartLeadsByOperador = {};
  const smartLeadsByTime     = {};
  for (const row of state.raw.smart) {
    const o = String(getCol(row, 'Origem', 'origem') || '').trim();
    const a = String(getCol(row, 'Audiencia', 'Audiência', 'audiencia') || '').trim();
    if (getSmartSignal(o, a) !== 'contradiction') {
      const op = normStr(getCol(row, 'Operador', 'operador') || '');
      const tm = normStr(getCol(row, 'Time', 'time') || '');
      if (op) smartLeadsByOperador[op] = (smartLeadsByOperador[op] || 0) + 1;
      if (tm) smartLeadsByTime[tm]     = (smartLeadsByTime[tm]     || 0) + 1;
    }
  }

  const statusDist = {};
  for (const e of entries) {
    statusDist[e.statusCat] = (statusDist[e.statusCat] || 0) + 1;
  }
  const statusSample = [...new Set(entries.map(e => e.rawStatus).filter(Boolean))].slice(0, 10);

  const diag = {
    smart:   diagSmart,
    ecorban: { total: state.raw.ecorban.length, matched, toReview: state.raw.ecorban.length - matched, cols: ecorbanCols, withDate: entries.filter(e => e.saleDate).length },
    facebook: { total: fbRows.length, bm03: state.raw.fb03?.length || 0, bm06: state.raw.fb06?.length || 0 },
    statusDist,
    statusSample,
  };

  return { entries, facebook: fbRows, unknownStatuses: [...unknownStats], diag, smartLeadsByOperador, smartLeadsByTime };
}
