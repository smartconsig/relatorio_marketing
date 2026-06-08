import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';
import { normPhone, getCol, normStr } from '../utils/string.js';
import { parseBRL } from '../utils/currency.js';
import { parseExcelDate } from '../utils/date.js';
import { classifyStatus } from './calcKPIs.js';

// ── Helpers de perfil ─────────────────────────────────────────────────────────
const REGIAO_MAP = {
  AC:'Norte', AM:'Norte', AP:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste', PB:'Nordeste',
  PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  DF:'Centro-Oeste', GO:'Centro-Oeste', MS:'Centro-Oeste', MT:'Centro-Oeste',
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  PR:'Sul', RS:'Sul', SC:'Sul',
};

function _calcIdade(nascimento) {
  if (!nascimento) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return (idade > 0 && idade < 120) ? idade : null;
}

function _faixaEtaria(idade) {
  if (!idade) return null;
  if (idade < 31) return '18–30';
  if (idade < 41) return '31–40';
  if (idade < 51) return '41–50';
  if (idade < 61) return '51–60';
  return '61+';
}

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

  const smartRows = state.raw.smart || [];

  const diagSmart = {
    total:        smartRows.length,
    cpfIndexed:   0,
    phoneIndexed: 0,
    source:       'excel',
    cols:         smartRows.length ? Object.keys(smartRows[0]) : [],
  };

  for (const row of smartRows) {
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
        'Data', 'data',
        'Data Cadastro', 'Data de Cadastro', 'DT_CADASTRO',
      )
    );
    const ecorbanOrigem  = String(getCol(row, 'Origem', 'origem', 'Canal', 'canal', 'Mídia', 'midia') || '').trim();
    const statusObs      = String(getCol(row, 'Observações ultimo status', 'Observacoes ultimo status') || '').trim();
    const statusUpdatedAt = parseExcelDate(getCol(row, 'Ultimo status atualizado em'));
    const statusUpdatedBy = String(getCol(row, 'Ultimo status atualizado por') || '').trim();

    // ── Campos de perfil ──────────────────────────────────────────────────
    const nascimento    = parseExcelDate(getCol(row, 'Cliente - Data de Nascimento', 'Data de Nascimento', 'Nascimento'));
    const idade         = _calcIdade(nascimento);
    const faixaEt       = _faixaEtaria(idade);
    const estado        = String(getCol(row, 'Cliente - Estado', 'Estado', 'UF') || '').trim().toUpperCase();
    const bairro        = String(getCol(row, 'Cliente - Bairro', 'Bairro') || '').trim();
    const cep           = String(getCol(row, 'Cliente - CEP', 'CEP', 'Cep') || '').trim();
    const regiaoRaw     = String(getCol(row, 'Região', 'Regiao', 'Região') || '').trim();
    const regiao        = regiaoRaw || REGIAO_MAP[estado] || '';
    const cadastradoEm  = parseExcelDate(getCol(row, 'Cadastrado em', 'Cadastrado Em', 'Data de Cadastro'));
    const pagamentoData = parseExcelDate(getCol(row, 'Pagamento ao Cliente', 'Pagamento'));
    const diasConversao = (cadastradoEm && pagamentoData && pagamentoData >= cadastradoEm)
      ? Math.round((pagamentoData - cadastradoEm) / 864e5)
      : null;

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
      statusObs, statusUpdatedAt, statusUpdatedBy,
      matchMethod:   null,
      origem:        null,
      audiencia:     null,
      ecorbanOrigem,
      smartPhone:    null,
      reviewReason:  null,
      smartSignal:   null,   // 'confirmed' | 'doubt' | 'contradiction' | 'not_found'
      // perfil
      nascimento, idade, faixaEtaria: faixaEt,
      estado, bairro, cep, regiao,
      cadastradoEm, pagamentoData, diasConversao,
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
        const da = parseExcelDate(getCol(a, 'Data de Criação', 'Data Criação', 'DataCriacao', 'Data'));
        const db = parseExcelDate(getCol(b, 'Data de Criação', 'Data Criação', 'DataCriacao', 'Data'));
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
      entry.smartOperador = normStr(getCol(oldest, 'Operador', 'operador', 'Operator') || '');
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

    if (cpf && state.confirmedDivergences[normCPF(cpf)]) {
      entry.divergenceConfirmed = true;
    }

    entries.push(entry);
  }

  // ── Leads de marketing por Operador e Time (todo o Smart, sem filtro de data) ──
  const smartLeadsByOperador = {};
  const smartLeadsByTime     = {};
  const smartLeads           = []; // dados estruturados para o funil

  for (const row of smartRows) {
    const o = String(getCol(row, 'Origem', 'origem') || '').trim();
    const a = String(getCol(row, 'Audiencia', 'Audiência', 'audiencia') || '').trim();
    if (getSmartSignal(o, a) !== 'contradiction') {
      const op = normStr(getCol(row, 'Operador', 'operador') || '');
      const tm = normStr(getCol(row, 'Time', 'time') || '');
      if (op) smartLeadsByOperador[op] = (smartLeadsByOperador[op] || 0) + 1;
      if (tm) smartLeadsByTime[tm]     = (smartLeadsByTime[tm]     || 0) + 1;
    }

    // Coleta dados para o funil — todos os Smart rows
    const op          = normStr(getCol(row, 'Operador', 'operador') || '');
    const tm          = normStr(getCol(row, 'Time', 'time') || '');
    const estagio     = String(getCol(row, 'Estágio', 'Estagio', 'estagio', 'Estgio') || '').trim();
    const andamento   = String(getCol(row, 'Status', 'status') || '').trim();
    const dataCriacao = parseExcelDate(getCol(row, 'Data de Criação', 'Data Criação', 'DataCriacao', 'Data de Criacao'));
    if (op || tm) {
      smartLeads.push({ operador: op, time: tm, estagio, andamento, dataCriacao });
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

  return { entries, facebook: fbRows, unknownStatuses: [...unknownStats], diag, smartLeadsByOperador, smartLeadsByTime, smartLeads };
}
