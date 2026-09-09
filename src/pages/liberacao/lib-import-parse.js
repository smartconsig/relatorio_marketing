// Parser puro da planilha de clientes da Liberacao de Margem: cabecalhos,
// mapa de colunas, normalizacoes (CPF, dinheiro, data, empresa), linha
// verde e coleta das linhas validas. Sem estado e sem DOM - quem importa
// e o lib-import.js.
import * as XLSX from 'xlsx';

// ── Helpers puros do parser (mesma lógica que vivia dentro da função) ──────
const _normStrPlanilha = s => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, '').trim();

export const padCpf = v => String(v).replace(/\D/g, '').padStart(11, '0');

const _parseMoneyLib = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Remove R$, espaços (incl. NBSP), letras e qualquer símbolo — mantém só dígitos, vírgula, ponto e sinal
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

const _parseDateLib = v => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};

// Normaliza nome da empresa para bater com os grupos do sistema
// (primeira marca que casar vence — mesma ordem da corrente original)
const _EMPRESAS = [
  [['smart'],                  'Smart Consig'],
  [['vital'],                  'Vital Cred'],
  [['rz', 'r z'],              'RZ Cred'],
  [['cred vale', 'credvale'],  'Cred Vale'],
  [['tem cred', 'temcred'],    'Tem Credito'],
  [['alg'],                    'ALG Promotora'],
  [['neg'],                    'Negócio Certo'],
  [['pnl'],                    'PNL Credito'],
  [['ita'],                    'ITA Promotora'],
];

const _normalizeEmpresa = v => {
  if (!v) return 'Smart Consig';
  const s = String(v).toLowerCase();
  const hit = _EMPRESAS.find(([marcas]) => marcas.some(m => s.includes(m)));
  return hit ? hit[1] : String(v).trim();
};

const _getVal = (ws, r, colI) => {
  if (colI < 0) return undefined;
  return ws[XLSX.utils.encode_cell({ r, c: colI })]?.v;
};

// Detecta linha verde pela cor FF00B050 (verde padrão do template)
function _isGreenRow(ws, range, r) {
  for (let c = range.s.c; c <= Math.min(range.e.c, 4); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    const rgb  = (cell?.s?.fgColor?.rgb || cell?.s?.bgColor?.rgb || '').toUpperCase();
    if (rgb.includes('00B050')) return true;
  }
  return false;
}

// Lê cabeçalhos da linha 1
export function lerCabecalhos(ws, range) {
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v ? _normStrPlanilha(cell.v) : '');
  }
  return headers;
}

// Localiza cada coluna PELO NOME (aceita as variações de sempre)
export function mapearColunas(headers) {
  const colIdx = (...names) => {
    for (const n of names) {
      const idx = headers.indexOf(_normStrPlanilha(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return {
    iCpf:    colIdx('cpf'),
    iNome:   colIdx('nome', 'nome completo'),
    iEmp:    colIdx('empresa', 'empresa parceira'),
    iSd:     colIdx('saldo devedor', 'saldo devedor r'),
    iTroco:  colIdx('troco', 'troco r'),
    iAcerto: colIdx('acerto'),
    iDq:     colIdx('data quitado'),
    iObs:    colIdx('obs', 'observacoes', 'observações'),
    iConvenio: colIdx('convenio', 'convênio'),
    iProduto:  colIdx('produto'),
  };
}

// Converte a linha r num candidato a registro; null para linha vazia.
function _linhaParaCandidato(plan, r) {
  const { ws, cols } = plan;
  const cpfRaw = _getVal(ws, r, cols.iCpf);
  const nome   = String(_getVal(ws, r, cols.iNome) || '').trim();
  if (!cpfRaw && !nome) return null;

  return {
    cpf:  padCpf(cpfRaw),
    nome,
    convenio: String(_getVal(ws, r, cols.iConvenio) || '').trim(),
    produto:  String(_getVal(ws, r, cols.iProduto)  || '').trim(),
    empresa_parceira: plan.admin ? _normalizeEmpresa(_getVal(ws, r, cols.iEmp)) : plan.empresaParceiro,
    saldo_devedor: _parseMoneyLib(_getVal(ws, r, cols.iSd)),
    troco:         _parseMoneyLib(_getVal(ws, r, cols.iTroco)),
    data_quitado:  _parseDateLib(_getVal(ws, r, cols.iDq)) || plan.hoje,
    acerto:        _parseDateLib(_getVal(ws, r, cols.iAcerto)),
    obs: String(_getVal(ws, r, cols.iObs) || '').trim() || null,
    aprovado: _isGreenRow(ws, plan.range, r),
  };
}

// Mesmas regras de descarte do fluxo original
function _candidatoValido(c) {
  return !!c.cpf && c.cpf !== '00000000000' && !!c.nome
    && c.saldo_devedor > 0 && !!c.convenio && !!c.produto;
}

export function coletarLinhas(plan) {
  const seen  = new Set();
  const valid = [];
  let skipped = 0;

  for (let r = plan.range.s.r + 1; r <= plan.range.e.r; r++) {
    const c = _linhaParaCandidato(plan, r);
    if (!c) continue;
    if (!_candidatoValido(c)) { skipped++; continue; }

    const dupKey = `${c.cpf}|${c.saldo_devedor}`;
    if (seen.has(dupKey)) { skipped++; continue; }
    seen.add(dupKey);

    valid.push(c);
  }
  return { valid, skipped };
}

