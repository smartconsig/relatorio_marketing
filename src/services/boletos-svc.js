// Domínio e acesso a dados da Quitação de Boleto. As regras críticas
// (visibilidade por empresa, bloqueio de CPF, transições de status) são
// garantidas no banco (migration 006) — aqui ficam os wrappers finos e os
// espelhos declarados dessas regras.
import { sb } from './supabase.js';
import { lerTudo } from './paginacao.js';

// ── Status ─────────────────────────────────────────────────────────────────
export const STATUS_META = {
  solicitar_boleto:  { label: 'Solicitar Boleto',  cls: 'bol-st-sol'  },
  boleto_solicitado: { label: 'Boleto Solicitado', cls: 'bol-st-ped'  },
  boleto_enviado:    { label: 'Boleto Enviado',    cls: 'bol-st-env'  },
  boleto_quitado:    { label: 'Boleto Quitado',    cls: 'bol-st-quit' },
  boleto_reprovado:  { label: 'Boleto Reprovado',  cls: 'bol-st-rep'  },
};
export const STATUS_ORDER = ['solicitar_boleto','boleto_solicitado','boleto_enviado','boleto_quitado','boleto_reprovado'];

// ── Produtos oficiais ──────────────────────────────────────────────────────
// Lista fechada — o cadastro manual usa dropdown e a importação traduz
// apelidos para o nome oficial (espelho da função boleto_canon_produto no banco).
export const PRODUTOS = ['CARTÃO BENEFÍCIO', 'CARTÃO CONSIGNADO'];

export function canonProduto(v) {
  let n = String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  n = n.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const CB = ['CB', 'C BENEFICIO', 'CART BENEFICIO', 'CARTAO BENEFICIO', 'CARTAO DE BENEFICIO', 'BENEFICIO'];
  const CC = ['CC', 'C CONSIGNADO', 'CART CONSIGNADO', 'CARTAO CONSIGNADO', 'CARTAO DE CONSIGNADO', 'CONSIGNADO'];
  if (CB.includes(n)) return 'CARTÃO BENEFÍCIO';
  if (CC.includes(n)) return 'CARTÃO CONSIGNADO';
  return null;
}

// Traduz os erros levantados pelos triggers/RPC do banco (primeira marca
// que casar vence — mesma ordem da corrente de ifs original)
const ERROS_BANCO = [
  ['BOLETO_CPF_MESMO_PRODUTO',   'CPF já cadastrado neste produto pela sua empresa.'],
  ['BOLETO_CPF_JA_LIBERACAO',    'CPF já está na Liberação de Margem neste produto.'],
  ['BOLETO_PRODUTO_INVALIDO',    'Produto não reconhecido. Use Cartão Benefício ou Cartão Consignado.'],
  ['BOLETO_CPF_INVALIDO',        'CPF inválido.'],
  ['BOLETO_MOTIVO_OBRIGATORIO',  'Informe o motivo da reprovação.'],
  ['BOLETO_TRANSICAO_INVALIDA',  'Mudança de status não permitida nesta fase.'],
  ['BOLETO_SOMENTE_ADMIN',       'Apenas o admin pode executar esta ação.'],
  ['BOLETO_SEM_PERMISSAO',       'Sem permissão para agir neste registro.'],
  ['BOLETO_REGISTRO_FINALIZADO', 'Registro finalizado — somente admin pode editar.'],
  ['BOLETO_STATUS_SOMENTE_RPC',  'Status não pode ser alterado diretamente.'],
  ['BOLETO_RESPALDO_SOMENTE_RPC', 'O respaldo só pode ser alterado pela importação.'],
  ['BOLETO_NAO_REPROVADO',        'Este cliente não está mais reprovado — atualize a tela.'],
  ['BOLETO_SALDO_INVALIDO',       'Informe o saldo devedor.'],
  ['boleto_importar_respaldo_boleto', 'A função de respaldo boleto ainda não existe no banco — rode a migration 019 no Supabase.'],
  ['boleto_reprovados_existentes', 'A função de reprovados ainda não existe no banco — rode a migration 019 no Supabase.'],
  ['boleto_reabrir_reprovado',     'A função de reabrir ainda não existe no banco — rode a migration 019 no Supabase.'],
  ['boleto_importar_respaldo',    'A função de respaldo ainda não existe no banco — rode a migration 014 no Supabase.'],
];

export function msgErroBanco(error) {
  const m = error?.message || '';
  if (m.includes('BOLETO_CPF_OUTRA_EMPRESA')) {
    const emp = m.split('BOLETO_CPF_OUTRA_EMPRESA:')[1]?.split(/[\n"]/)[0]?.trim();
    return emp ? `CPF já cadastrado pela empresa ${emp}.` : 'CPF já cadastrado por outra empresa.';
  }
  const hit = ERROS_BANCO.find(([marca]) => m.includes(marca));
  return hit ? hit[1] : (m || 'Erro inesperado.');
}

// ── Acesso a dados (wrappers finos — call sites checam { error }) ─────────
export function fetchBoletosPage(from, to) {
  return sb
    .from('quitacao_boletos')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);
}

/** Tabela inteira em paralelo (ordem total: created_at, id). */
export function fetchTodosBoletos() {
  return lerTudo({ tabela: 'quitacao_boletos', montar: () => sb.from('quitacao_boletos').select('*')
    .order('created_at', { ascending: false }).order('id', { ascending: true }) });
}

/** Uma linha (refresca só o cliente que mudou depois de uma ação). */
export function fetchBoleto(id) {
  return sb.from('quitacao_boletos').select('*').eq('id', id).maybeSingle();
}

export function rpcMudarStatus(id, novo, motivo) {
  return sb.rpc('boleto_mudar_status', { p_id: id, p_novo: novo, p_motivo: motivo });
}

// Respaldo (migration 014): grava protocolo/status/detalhes nas propostas ABERTAS do CPF.
// Devolve { data: { ok, propostas }, error }. Só admin (o banco valida).
export function rpcImportarRespaldo({ cpf, protocolo, status, detalhes, obs }) {
  return sb.rpc('boleto_importar_respaldo', {
    p_cpf: cpf, p_protocolo: protocolo, p_status: status, p_detalhes: detalhes, p_obs: obs || null,
  });
}

// Respaldo BOLETO (migration 019): status/mensagem/alerta + contratos (jsonb) nas
// propostas abertas do CPF; "Sem contratos / Nenhum contrato encontrado" reprova no banco.
// Devolve { data: { ok, propostas, reprovadas }, error }. Só admin.
export function rpcImportarRespaldoBoleto({ cpf, protocolo, status, mensagem, alerta, contratos }) {
  return sb.rpc('boleto_importar_respaldo_boleto', {
    p_cpf: cpf, p_protocolo: protocolo || null, p_status: status || null, p_mensagem: mensagem || null,
    p_alerta: alerta || null, p_contratos: contratos?.length ? contratos : null,
  });
}

/** itens: [{ cpf, produto }] → [{ id, cpf, produto, nome, data_reprovado, motivo, empresa }] que só existem como REPROVADO. */
export function rpcReprovadosExistentes(itens) {
  return sb.rpc('boleto_reprovados_existentes', { p_itens: itens });
}

/** Reabre o registro reprovado com os dados novos (volta para "Solicitar boleto"; anexos ficam). */
export function rpcReabrirReprovado(id, dados) {
  return sb.rpc('boleto_reabrir_reprovado', { p_id: id, p_dados: dados });
}

export function limparBaseBoletos() {
  return sb.from('quitacao_boletos').delete().not('id', 'is', null);
}

export function deleteBoleto(id) {
  return sb.from('quitacao_boletos').delete().eq('id', id);
}

export function insertBoleto(reg) {
  return sb.from('quitacao_boletos').insert(reg);
}

export function updateBoleto(id, dados) {
  return sb.from('quitacao_boletos').update(dados).eq('id', id);
}
