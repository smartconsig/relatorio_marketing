// Teste de caracterização do núcleo de cálculo (classifyStatus, calcKPIs,
// parseExcelDate, parseBRL). Fotografa o comportamento ATUAL em um JSON e,
// nas execuções seguintes, falha se qualquer número mudar.
//
// Uso:
//   node scripts/caracterizacao-kpis.mjs --save   # grava a fotografia (baseline)
//   node scripts/caracterizacao-kpis.mjs          # compara com a fotografia
//
// A comparação depende do fuso horário local (parseExcelDate devolve datas
// locais de propósito) — rode sempre na mesma máquina/fuso (America/Recife).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(ROOT, 'scripts', 'baseline', 'caracterizacao-kpis.json');

// services/supabase.js roda window.supabase.createClient() no topo do módulo;
// em Node não existe window — o stub abaixo permite importar o núcleo sem
// tocar em rede ou banco. Nenhuma função do client é chamada pelos cálculos.
globalThis.window = { supabase: { createClient: () => ({}) } };

const { state } = await import('../src/state.js');
const status = await import('../src/config/status.js');
const { classifyStatus, calcKPIs } = await import('../src/core/calcKPIs.js');
const { parseExcelDate, inRange } = await import('../src/utils/date.js');
const { parseBRL } = await import('../src/utils/currency.js');

// ---------------------------------------------------------------------------
// 1. classifyStatus — todos os literais dos 4 conjuntos + variações + inéditos
// ---------------------------------------------------------------------------
const statusInputs = [
  ...status.STATUS_PAID,
  ...status.STATUS_ALMOST_PAID,
  ...status.STATUS_APPROVED,
  ...status.STATUS_REJECTED,
].flatMap((s) => [s, s.toUpperCase(), `  ${s}  `]);
statusInputs.push('', '   ', 'status inventado xyz', 'ANUÊNCIA', 'Reapresentar Conta', 'PAGO');

const classifySnapshot = {};
for (const input of statusInputs) {
  classifySnapshot[JSON.stringify(input)] = classifyStatus(input);
}
classifySnapshot['<null>'] = classifyStatus(null);
classifySnapshot['<undefined>'] = classifyStatus(undefined);

// ---------------------------------------------------------------------------
// 2. calcKPIs — fixture fixa de entries cobrindo todas as categorias,
//    marketing true/false/null, e os TRÊS ramos de fonte de investimento
// ---------------------------------------------------------------------------
const ENTRIES = [
  { isMarketing: true,  statusCat: 'pago',        valor: 1000.5 },
  { isMarketing: true,  statusCat: 'pago',        valor: 2500 },
  { isMarketing: true,  statusCat: 'quase pago',  valor: 800.25 },
  { isMarketing: true,  statusCat: 'aprovado',    valor: 1200 },
  { isMarketing: true,  statusCat: 'aprovado',    valor: 300.75 },
  { isMarketing: true,  statusCat: 'sem status',  valor: 150 },
  { isMarketing: true,  statusCat: 'reprovado',   valor: 999 },
  { isMarketing: true,  statusCat: 'desconhecido', valor: 77 },
  { isMarketing: false, statusCat: 'pago',        valor: 5000 },
  { isMarketing: false, statusCat: 'quase pago',  valor: 640 },
  { isMarketing: false, statusCat: 'aprovado',    valor: 2200 },
  { isMarketing: false, statusCat: 'sem status',  valor: 90 },
  { isMarketing: false, statusCat: 'reprovado',   valor: 130 },
  { isMarketing: null,  statusCat: 'pago',        valor: 400 },  // reclassificado: 3º estado
  { isMarketing: null,  statusCat: 'aprovado',    valor: 250 },
];

const FACEBOOK = [
  { 'Montante gasto (BRL)': 'R$ 1.500,00', 'Resultados': '30', 'Custo por resultado': 'R$ 50,00', 'Tipo de resultado': 'Mensagens iniciadas' },
  { 'Montante gasto (BRL)': '2.000,50',    'Resultados': '45', 'Custo por resultado': '44,45',    'Tipo de resultado': 'Conversas por mensagem' },
  { 'Montante gasto (BRL)': '350,00',      'Resultados': '99', 'Custo por resultado': '3,54',     'Tipo de resultado': 'Cliques no link' },
];

function rodarCenario(nome, { trafego, metaAds, facebook }) {
  state.filterDates = { start: '2026-09-01', end: '2026-09-30' };
  state.trafego = trafego;
  state.metaAds = metaAds;
  return { cenario: nome, kpis: calcKPIs(ENTRIES, facebook) };
}

const kpisSnapshot = [
  rodarCenario('A-trafego-digitado (vence mesmo com metaAds presente)', {
    trafego: [
      { dia: '2026-09-05', investimento: 1000, leads: 20, cliques: 500, impressoes: 10000, alcance: 8000 },
      { dia: '2026-09-10', investimento: 500.5, leads: 15, cliques: 300, impressoes: 6000, alcance: 4500 },
      { dia: '2026-08-31', investimento: 9999, leads: 999, cliques: 1, impressoes: 1, alcance: 1 }, // fora do período
    ],
    metaAds: { invest: 123, leads: 4 },
    facebook: FACEBOOK,
  }),
  rodarCenario('B-api-meta (sem dias digitados no período)', {
    trafego: [],
    metaAds: { invest: 3200.75, leads: 64 },
    facebook: FACEBOOK,
  }),
  rodarCenario('C-planilha-facebook (fallback)', {
    trafego: [],
    metaAds: null,
    facebook: FACEBOOK,
  }),
  rodarCenario('D-nenhuma-fonte', {
    trafego: [],
    metaAds: null,
    facebook: [],
  }),
];

// ---------------------------------------------------------------------------
// 3. parseExcelDate — seriais do Excel, strings BR/ISO, inválidos
// ---------------------------------------------------------------------------
const ymd = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const dateSnapshot = {};
for (const input of [45000, 45911, 45912.999, 25569, '05/09/2026', '2026-09-05', '31/12/2025', 'texto invalido', '', 0]) {
  dateSnapshot[JSON.stringify(input)] = ymd(parseExcelDate(input));
}

// inRange: a regra "sem data só aparece sem filtro" é comportamento de negócio
const rangeSnapshot = {
  'null sem filtro': inRange(null, null, null),
  'null com filtro': inRange(null, '2026-09-01', null),
  'dentro': inRange(new Date(2026, 8, 15), '2026-09-01', '2026-09-30'),
  'limite inicial': inRange(new Date(2026, 8, 1), '2026-09-01', '2026-09-30'),
  'limite final': inRange(new Date(2026, 8, 30, 23, 59), '2026-09-01', '2026-09-30'),
  'fora antes': inRange(new Date(2026, 7, 31), '2026-09-01', '2026-09-30'),
  'fora depois': inRange(new Date(2026, 9, 1), '2026-09-01', '2026-09-30'),
};

// ---------------------------------------------------------------------------
// 4. parseBRL — inclui o caso do ponto de milhar sem vírgula (comportamento
//    atual PRECIFICADO nos números históricos: '1.234' → 1.234, não 1234)
// ---------------------------------------------------------------------------
const brlSnapshot = {};
for (const input of ['R$ 1.234,56', '1.234,56', '10,00', 'R$ 10', '1.234', '1234', '0,01', '', 'abc', '  R$  2.500,00 ']) {
  brlSnapshot[JSON.stringify(input)] = parseBRL(input);
}

// ---------------------------------------------------------------------------
const snapshot = { classifySnapshot, kpisSnapshot, dateSnapshot, rangeSnapshot, brlSnapshot };
const json = JSON.stringify(snapshot, null, 2);

if (process.argv.includes('--save')) {
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, json);
  process.stdout.write(`Fotografia gravada em ${SNAPSHOT}\n`);
  process.exit(0);
}

let baseline;
try {
  baseline = readFileSync(SNAPSHOT, 'utf8');
} catch {
  process.stderr.write('Fotografia não encontrada. Rode com --save primeiro.\n');
  process.exit(2);
}

if (baseline === json) {
  process.stdout.write('OK — cálculos idênticos à fotografia (classifyStatus, calcKPIs x4 cenários, datas, BRL).\n');
  process.exit(0);
}

// Diff simples por linha para apontar o que mudou
const a = baseline.split('\n');
const b = json.split('\n');
const max = Math.max(a.length, b.length);
let shown = 0;
for (let i = 0; i < max && shown < 30; i++) {
  if (a[i] !== b[i]) {
    process.stderr.write(`linha ${i + 1}:\n  antes: ${a[i] ?? '<fim>'}\n  agora: ${b[i] ?? '<fim>'}\n`);
    shown++;
  }
}
process.stderr.write('\nFALHA — os cálculos divergiram da fotografia. NÃO prossiga com o refactor até entender o porquê.\n');
process.exit(1);
