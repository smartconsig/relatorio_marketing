// Domínio e acesso a dados da Quitação de Boleto. As regras críticas
// (visibilidade por empresa, bloqueio de CPF, transições de status) são
// garantidas no banco (migration 006) — aqui ficam os wrappers finos e os
// espelhos declarados dessas regras.
import { sb } from './supabase.js';

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

export function rpcMudarStatus(id, novo, motivo) {
  return sb.rpc('boleto_mudar_status', { p_id: id, p_novo: novo, p_motivo: motivo });
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
