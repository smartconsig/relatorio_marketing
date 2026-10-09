// Solicitar de novo um cliente REPROVADO (out/2026, migration 019).
// Regra do responsável: só quando o cliente está reprovado (CPF + produto); qualquer
// parceiro ou a Smart pode; sempre com uma confirmação de que está ciente. O MESMO
// registro é reaberto (volta para "Solicitar boleto" com os dados novos) — assim os
// boletos e faturas já anexados continuam, e o detalhe mostra "Já foi reprovado antes".
// Usado pelo cadastro um por um (bol-modais) e pela planilha (bol-import).
import { dsConfirm, dsImportReport } from '../../components/ds/index.js';
import { rpcReprovadosExistentes, rpcReabrirReprovado, msgErroBanco } from '../../services/boletos-svc.js';
import { fmtCpf, fmtDate } from './bol-core.js';

const _chave = (cpf, produto) => `${cpf}|${produto}`;
const _quando = info => `reprovado em ${fmtDate(info.data_reprovado)}${info.motivo ? ` · ${info.motivo}` : ''}`;

/** itens: [{ cpf, produto }] → Map "cpf|produto" → info do registro reprovado (vazio se não houver ou se der erro). */
export async function buscarReprovados(itens) {
  const { data, error } = await rpcReprovadosExistentes(itens.map(i => ({ cpf: i.cpf, produto: i.produto })));
  if (error) { console.warn('boleto_reprovados_existentes:', error.message); return new Map(); }
  return new Map((data || []).map(info => [_chave(info.cpf, info.produto), info]));
}

export const reprovadoDe = (mapa, reg) => mapa.get(_chave(reg.cpf, reg.produto)) || null;

// Campos que o banco aceita na reabertura (empresa: o banco decide — parceiro fica com o cliente)
function _dados(reg) {
  const { nome, email, contrato, valor_parcela, saldo_devedor, troco, convenio, obs, empresa_parceira } = reg;
  return { nome, email, contrato, valor_parcela, saldo_devedor, troco, convenio, obs, empresa_parceira };
}

export const reabrir = (info, reg) => rpcReabrirReprovado(info.id, _dados(reg));

/** Cadastro um por um: pergunta se está ciente. */
export function confirmarUm(info) {
  return dsConfirm({
    eyebrow: 'Cliente já reprovado', title: `${info.nome || fmtCpf(info.cpf)} já foi reprovado`,
    desc: `Este cliente foi ${_quando(info)}. Se continuar, ele volta para "Solicitar boleto" com os dados novos `
      + 'e fica marcado como "já reprovado antes". Os boletos e faturas já anexados continuam. Está ciente?',
    okLabel: 'Estou ciente, solicitar de novo',
  });
}

async function _reabrirTodos(lista, mapa, progresso) {
  const falhas = [];
  for (let i = 0; i < lista.length; i++) {
    const reg = lista[i];
    const { error } = await reabrir(reprovadoDe(mapa, reg), reg);
    if (error) falhas.push({ titulo: reg.nome, detalhe: msgErroBanco(error), cpf: reg.cpf });
    progresso(i + 1, lista.length, 'Solicitando de novo');
  }
  return { gravados: lista.length - falhas.length, falhas };
}

/**
 * Planilha: separa os clientes que já foram reprovados, mostra a lista e pede
 * "Estou ciente". Devolve { normais, reabertos, pulados:[{cpf,nome,motivo}] }.
 */
export async function separarReprovados(valid) {
  const mapa = await buscarReprovados(valid);
  const paraReabrir = valid.filter(r => reprovadoDe(mapa, r));
  const normais = valid.filter(r => !reprovadoDe(mapa, r));
  if (!paraReabrir.length) return { normais, reabertos: 0, pulados: [] };

  const n = paraReabrir.length;
  const r = await dsImportReport({
    eyebrow: 'Clientes já reprovados', title: `${n} cliente${n > 1 ? 's' : ''} desta planilha já ${n > 1 ? 'foram reprovados' : 'foi reprovado'}`,
    sub: 'Se continuar, eles voltam para "Solicitar boleto" com os dados da planilha e ficam marcados como "já reprovado antes". '
      + 'Os boletos e faturas já anexados continuam. Os outros clientes da planilha entram normalmente em seguida.',
    resumo: [{ n, label: 'já reprovados antes', tone: 'warn' }, { n: normais.length, label: 'clientes novos', tone: 'ok' }],
    grupos: [{ label: 'Já reprovados', aberto: true,
      itens: paraReabrir.map(reg => ({ titulo: reg.nome, detalhe: `${fmtCpf(reg.cpf)} · ${_quando(reprovadoDe(mapa, reg))}` })) }],
    okLabel: `Estou ciente, solicitar de novo ${n}`, cancelLabel: 'Pular estes clientes', rotuloOk: 'solicitados de novo',
    gravar: progresso => _reabrirTodos(paraReabrir, mapa, progresso),
  });
  if (!r.gravou) {
    return { normais, reabertos: 0, pulados: paraReabrir.map(reg => ({ cpf: reg.cpf, nome: reg.nome, motivo: 'Já reprovado antes — pulado (sem confirmação)' })) };
  }
  return { normais, reabertos: r.gravados, pulados: (r.falhas || []).map(f => ({ cpf: f.cpf, nome: f.titulo, motivo: f.detalhe })) };
}
