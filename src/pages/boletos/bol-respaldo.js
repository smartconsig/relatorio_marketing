// Importar Respaldo (Fase 2, só Smart/admin): lê o "Relatório de Faturas Smart"
// (colunas CPF, Protocolo, Status, Detalhes por cartão, Convênio, Observação),
// junta as linhas do mesmo CPF e grava o respaldo nas propostas ABERTAS do CPF
// (boleto solicitado/enviado) pela RPC boleto_importar_respaldo (migration 014).
// O novo substitui o anterior. Nada é gravado antes da conferência.
import * as XLSX from 'xlsx';
import { toast } from '../../utils/ui.js';
import { dsImportReport } from '../../components/ds/index.js';
import { rpcImportarRespaldo, msgErroBanco } from '../../services/boletos-svc.js';
import { BO, isAdmin, fmtCpf } from './bol-core.js';
import { BOL_STATUS } from './bol-linha.js';

const ABERTOS = ['boleto_solicitado', 'boleto_enviado'];
const _norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const _cpf = v => String(v ?? '').replace(/\D/g, '').padStart(11, '0');
const _cpfValido = c => /^\d{11}$/.test(c) && c !== '00000000000';

// Colunas aceitas (cabeçalho normalizado → campo)
const COLUNAS = { 'CPF': 'cpf', 'PROTOCOLO': 'protocolo', 'STATUS': 'status', 'DETALHES POR CARTAO': 'detalhes',
  'DETALHES': 'detalhes', 'OBSERVACAO': 'obs', 'OBS': 'obs' };

export function bolImportarRespaldo() {
  if (!isAdmin()) { toast('Só a Smart importa o respaldo.', 'err'); return; }
  const inp = document.getElementById('bol-respaldo-input');
  if (inp) { inp.value = ''; inp.click(); }
}

// Acha a aba que tem CPF + Protocolo no cabeçalho (o relatório vem em "Planilha1";
// a aba auxiliar "_dados_emissao" só tem CPF/Cliente e é ignorada)
function _lerLinhas(wb) {
  for (const nome of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' });
    const idx = rows.findIndex(r => r.map(_norm).includes('CPF') && r.map(_norm).includes('PROTOCOLO'));
    if (idx < 0) continue;
    const mapa = rows[idx].map(h => COLUNAS[_norm(h)] || null);
    return rows.slice(idx + 1).map(r => {
      const o = {};
      mapa.forEach((campo, i) => { if (campo && !o[campo]) o[campo] = String(r[i] ?? '').trim(); });
      return o;
    }).filter(o => Object.values(o).some(Boolean));
  }
  return null;
}

const _junta = (vals, sep) => [...new Set(vals.map(v => String(v || '').trim()).filter(v => v && v !== '-'))].join(sep);

// Agrupa por CPF (o relatório pode repetir o CPF — vira um respaldo só)
function _agrupar(linhas) {
  const porCpf = new Map();
  let semCpf = 0;
  for (const l of linhas) {
    const c = _cpf(l.cpf);
    if (!_cpfValido(c)) { semCpf++; continue; }
    if (!porCpf.has(c)) porCpf.set(c, []);
    porCpf.get(c).push(l);
  }
  const grupos = [...porCpf].map(([cpf, ls]) => ({
    cpf, repetido: ls.length > 1,
    protocolo: _junta(ls.map(l => l.protocolo), ' / '),
    status: _junta(ls.map(l => l.status), ' / '),
    detalhes: _junta(ls.flatMap(l => String(l.detalhes || '').split(/\r?\n/)), '\n'),
    obs: _junta(ls.map(l => l.obs), ' · '),
  }));
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
  for (let i = 0; i < prontos.length; i++) {
    const g = prontos[i];
    const { error } = await rpcImportarRespaldo(g);
    if (error) falhas.push({ titulo: g.nome, detalhe: msgErroBanco(error) });
    progresso(i + 1, prontos.length, 'Gravando');
  }
  return { gravados: prontos.length - falhas.length, falhas };
}

async function _lerArquivo(file) {
  try {
    const linhas = _lerLinhas(XLSX.read(await file.arrayBuffer(), { type: 'array' }));
    if (!linhas) toast('Planilha fora do modelo: não achei as colunas CPF e Protocolo.', 'err');
    return linhas;
  } catch (e) {
    toast('Não foi possível ler a planilha: ' + (e?.message || e), 'err');
    return null;
  }
}

export async function bolOnRespaldoFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const linhas = await _lerArquivo(file);
  if (!linhas) return;
  const { grupos, semCpf } = _agrupar(linhas);
  const r = await _conferir(file.name, grupos, semCpf);
  if (r.gravou) await window.bolRecarregar?.();
}

function _conferir(arquivo, grupos, semCpf) {
  const { prontos, semAberta, naoAchados } = _classificar(grupos);
  const repetidos = grupos.filter(g => g.repetido);
  return dsImportReport({
    eyebrow: 'Importar respaldo', title: arquivo,
    sub: 'O respaldo novo substitui o anterior. Só entra nas propostas abertas (boleto solicitado ou enviado).',
    resumo: [{ n: prontos.length, label: 'prontos para gravar', tone: 'ok' },
      { n: semAberta.length, label: 'sem proposta aberta', tone: semAberta.length ? 'warn' : 'ok' },
      { n: naoAchados.length + semCpf, label: 'CPF não encontrado ou inválido', tone: naoAchados.length + semCpf ? 'bad' : 'ok' }],
    grupos: [
      { label: 'Prontos para gravar', itens: prontos.map(g => ({ titulo: g.nome, detalhe: `${g.status || 'sem status'}${g.n > 1 ? ` · ${g.n} propostas` : ''}` })) },
      { label: 'Sem proposta aberta (não serão gravados)', itens: semAberta.map(g => ({ titulo: g.nome, detalhe: g.st })) },
      { label: 'CPF não encontrado na Quitação de Boleto', itens: naoAchados.map(g => ({ titulo: fmtCpf(g.cpf), detalhe: g.status })) },
      { label: 'CPF repetido na planilha (linhas juntadas)', itens: repetidos.map(g => ({ titulo: fmtCpf(g.cpf), detalhe: g.protocolo })) },
    ],
    okLabel: prontos.length ? `Gravar ${prontos.length} respaldo${prontos.length > 1 ? 's' : ''}` : null,
    rotuloOk: 'respaldos gravados',
    gravar: progresso => _gravar(prontos, progresso),
  });
}
