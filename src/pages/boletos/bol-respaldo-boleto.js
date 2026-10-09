// Importar Respaldo BOLETO (out/2026, só Smart/admin): lê o "Relatório Boleto Smart"
//   aba CPFs      → CPF, Protocolo, Status, Mensagem, Alerta emissão (uma linha por CPF)
//   aba Contratos → CPF, Nº contrato, Modalidade, Empregador, Matrícula, Parcela,
//                   Saldo devedor emitido, Resultado/Erro da emissão (uma linha por contrato)
// e grava nas propostas ABERTAS do CPF pela RPC boleto_importar_respaldo_boleto
// (migration 019). "Sem contratos" + "Nenhum contrato encontrado…" REPROVA o
// cliente (o banco decide; aqui é só o espelho para a conferência). Colunas
// achadas pelo NOME do cabeçalho — a versão "TRATADA" (com a coluna de empresa e
// sem a aba Contratos) também entra. Nada é gravado antes da conferência.
import * as XLSX from 'xlsx';
import { toast } from '../../utils/ui.js';
import { dsImportReport } from '../../components/ds/index.js';
import { rpcImportarRespaldoBoleto, msgErroBanco } from '../../services/boletos-svc.js';
import { BO, isAdmin, fmtCpf } from './bol-core.js';
import { BOL_STATUS } from './bol-linha.js';

const ABERTOS = ['boleto_solicitado', 'boleto_enviado'];
const _norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const _cpf = v => String(v ?? '').replace(/\D/g, '').padStart(11, '0');
const _cpfValido = c => /^\d{11}$/.test(c) && c !== '00000000000';
const _junta = (vals, sep) => [...new Set(vals.map(v => String(v || '').trim()).filter(v => v && v !== '-'))].join(sep);

// Cabeçalho normalizado → campo (o primeiro teste que casar vence)
const COLS_CPFS = [[h => h === 'CPF', 'cpf'], [h => h === 'PROTOCOLO', 'protocolo'], [h => h === 'STATUS', 'status'],
  [h => h === 'MENSAGEM', 'mensagem'], [h => h.startsWith('ALERTA'), 'alerta']];
const COLS_CONTRATOS = [[h => h === 'CPF', 'cpf'], [h => h.includes('CONTRATO'), 'contrato'], [h => h === 'MODALIDADE', 'modalidade'],
  [h => h === 'EMPREGADOR', 'empregador'], [h => h.startsWith('MATRICULA'), 'matricula'], [h => h === 'PARCELA', 'parcela'],
  [h => h.startsWith('SALDO'), 'saldo'], [h => h.startsWith('RESULTADO'), 'resultado'], [h => h.startsWith('ERRO'), 'erro']];

export const ehSemContratos = g => _norm(g.status) === 'SEM CONTRATOS' && _norm(g.mensagem).startsWith('NENHUM CONTRATO ENCONTRADO');

export function bolImportarRespaldoBoleto() {
  if (!isAdmin()) { toast('Só a Smart importa o respaldo.', 'err'); return; }
  const inp = document.getElementById('bol-respaldo-boleto-input');
  if (inp) { inp.value = ''; inp.click(); }
}

// Lê a primeira aba cujo cabeçalho tem todas as colunas exigidas
function _lerAba(wb, colunas, exigidas) {
  for (const nome of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' });
    const idx = rows.findIndex(r => exigidas.every(e => r.map(_norm).some(e)));
    if (idx < 0) continue;
    const mapa = rows[idx].map(h => colunas.find(([teste]) => teste(_norm(h)))?.[1] || null);
    return rows.slice(idx + 1).map(r => {
      const o = {};
      mapa.forEach((campo, i) => { if (campo && !o[campo]) o[campo] = String(r[i] ?? '').trim(); });
      return o;
    }).filter(o => Object.values(o).some(Boolean));
  }
  return null;
}

function _contratosPorCpf(linhas) {
  const m = new Map();
  for (const l of linhas || []) {
    const c = _cpf(l.cpf);
    if (!_cpfValido(c)) continue;
    const { cpf: _c, ...k } = l;
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(k);
  }
  return m;
}

// Um grupo por CPF. Linha "Duplicado" (o relatório repete o CPF) só conta se for a única.
function _agrupar(linhas, contratos) {
  const porCpf = new Map();
  let semCpf = 0;
  for (const l of linhas) {
    const c = _cpf(l.cpf);
    if (!_cpfValido(c)) { semCpf++; continue; }
    if (!porCpf.has(c)) porCpf.set(c, []);
    porCpf.get(c).push(l);
  }
  const grupos = [...porCpf].map(([cpf, todas]) => {
    const ls = todas.filter(l => _norm(l.status) !== 'DUPLICADO');
    const usa = ls.length ? ls : todas;
    return { cpf, repetido: todas.length > 1,
      protocolo: _junta(usa.map(l => l.protocolo), ' / '), status: _junta(usa.map(l => l.status), ' / '),
      mensagem: _junta(usa.map(l => l.mensagem), ' · '), alerta: _junta(usa.map(l => l.alerta), ' · '),
      contratos: contratos.get(cpf) || [] };
  });
  return { grupos, semCpf };
}

function _classificar(grupos) {
  const prontos = [], semAberta = [], naoAchados = [];
  for (const g of grupos) {
    const props = BO.registros.filter(r => r.cpf === g.cpf);
    const abertas = props.filter(r => ABERTOS.includes(r.status));
    if (abertas.length) prontos.push({ ...g, nome: abertas[0].nome, n: abertas.length });
    else if (props.length) semAberta.push({ ...g, nome: props[0].nome, st: BOL_STATUS[props[0].status]?.label });
    else naoAchados.push(g);
  }
  return { prontos, semAberta, naoAchados };
}

async function _gravar(prontos, progresso) {
  const falhas = [];
  let reprovadas = 0;
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    const { data, error } = await rpcImportarRespaldoBoleto(g);
    if (error) falhas.push({ titulo: g.nome, detalhe: msgErroBanco(error) });
    else reprovadas += data?.reprovadas || 0;
    progresso(i + 1, prontos.length, 'Gravando');
  }
  if (reprovadas) toast(`${reprovadas} cliente${reprovadas > 1 ? 's' : ''} reprovado${reprovadas > 1 ? 's' : ''} por "sem contratos".`);
  return { gravados: prontos.length - falhas.length, falhas };
}

/** Lê o workbook já aberto → { grupos, semCpf, temContratos } ou null se faltar a aba CPFs. */
export function lerRespaldoBoleto(wb) {
  const cpfs = _lerAba(wb, COLS_CPFS, [h => h === 'CPF', h => h === 'PROTOCOLO', h => h === 'MENSAGEM']);
  if (!cpfs) return null;
  const contratos = _lerAba(wb, COLS_CONTRATOS, [h => h === 'CPF', h => h.includes('CONTRATO'), h => h === 'MODALIDADE']);
  return { ..._agrupar(cpfs, _contratosPorCpf(contratos)), temContratos: !!contratos };
}

async function _lerArquivo(file) {
  try {
    const lido = lerRespaldoBoleto(XLSX.read(await file.arrayBuffer(), { type: 'array' }));
    if (!lido) toast('Planilha fora do modelo: não achei a aba com CPF, Protocolo e Mensagem.', 'err');
    return lido;
  } catch (e) {
    toast('Não foi possível ler a planilha: ' + (e?.message || e), 'err');
    return null;
  }
}

export async function bolOnRespaldoBoletoFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const lido = await _lerArquivo(file);
  if (!lido) return;
  const r = await _conferir(file.name, lido.grupos, lido);
  if (r.gravou) await window.bolRecarregar?.();
}

const _qtdContratos = g => (g.contratos.length ? ` · ${g.contratos.length} contrato${g.contratos.length > 1 ? 's' : ''}` : '');

function _conferir(arquivo, grupos, { semCpf, temContratos }) {
  const { prontos, semAberta, naoAchados } = _classificar(grupos);
  const reprovar = prontos.filter(ehSemContratos);
  return dsImportReport({
    eyebrow: 'Importar respaldo boleto', title: arquivo,
    sub: 'O respaldo novo substitui o anterior e só aparece na exportação. Entra nas propostas abertas (boleto solicitado ou enviado).'
      + (temContratos ? '' : ' Atenção: a planilha não tem a aba Contratos — contrato, modalidade, empregador e matrícula ficarão vazios.'),
    resumo: [{ n: prontos.length, label: 'prontos para gravar', tone: 'ok' },
      { n: reprovar.length, label: 'serão reprovados (sem contratos)', tone: reprovar.length ? 'bad' : 'ok' },
      { n: semAberta.length, label: 'sem proposta aberta', tone: semAberta.length ? 'warn' : 'ok' },
      { n: naoAchados.length + semCpf, label: 'CPF não encontrado ou inválido', tone: naoAchados.length + semCpf ? 'bad' : 'ok' }],
    grupos: [
      { label: 'Serão REPROVADOS: "Nenhum contrato encontrado para o CPF"', itens: reprovar.map(g => ({ titulo: g.nome, detalhe: fmtCpf(g.cpf) })), aberto: true },
      { label: 'Prontos para gravar', itens: prontos.map(g => ({ titulo: g.nome, detalhe: `${g.status || 'sem status'}${_qtdContratos(g)}${g.n > 1 ? ` · ${g.n} propostas` : ''}` })) },
      { label: 'Sem proposta aberta (não serão gravados)', itens: semAberta.map(g => ({ titulo: g.nome, detalhe: g.st })) },
      { label: 'CPF não encontrado na Quitação de Boleto', itens: naoAchados.map(g => ({ titulo: fmtCpf(g.cpf), detalhe: g.status })) },
      { label: 'CPF repetido na planilha (linhas juntadas)', itens: grupos.filter(g => g.repetido).map(g => ({ titulo: fmtCpf(g.cpf), detalhe: g.protocolo })) },
    ],
    okLabel: prontos.length ? `Gravar ${prontos.length} respaldo${prontos.length > 1 ? 's' : ''}` : null,
    rotuloOk: 'respaldos gravados',
    gravar: progresso => _gravar(prontos, progresso),
  });
}
