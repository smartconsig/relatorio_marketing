// Liberação de Margem — acesso a dados (tabela liberacao_margem_master).
// Wrappers finos sobre o cliente Supabase, no mesmo padrão do boletos-svc:
// cada função devolve o { data, error } original; quem trata erro é a tela.
// Resíduo dentro da Liberação: RPCs liberacao_residuo_* (migration 015), no fim deste arquivo.
import { sb } from './supabase.js';
import { lerTudo } from './paginacao.js';

const TABELA = 'liberacao_margem_master';

/** Página de registros ordenada por data_quitado e created_at (desc). */
export function fetchLiberacoesPage(from, to) {
  return sb
    .from(TABELA)
    .select('*')
    .order('data_quitado', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
}

/** Tabela inteira em paralelo (ordem total: data_quitado, created_at, id). */
export function fetchTodasLiberacoes() {
  return lerTudo({ tabela: TABELA, montar: () => sb.from(TABELA).select('*')
    .order('data_quitado', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: true }) });
}

/** Uma linha (refresca só o cliente que mudou depois de uma ação). */
export function fetchLiberacao(id) {
  return sb.from(TABELA).select('*').eq('id', id).maybeSingle();
}

export function insertLiberacao(row) {
  return sb.from(TABELA).insert(row);
}

/** Insert em lote (import de planilha manda fatias de até 500). */
export function insertLiberacoes(rows) {
  return sb.from(TABELA).insert(rows);
}

export function updateLiberacao(id, campos) {
  return sb.from(TABELA).update(campos).eq('id', id);
}

export function deleteLiberacao(id) {
  return sb.from(TABELA).delete().eq('id', id);
}

export function limparBaseLiberacao() {
  return sb.from(TABELA).delete().not('id', 'is', null);
}

// ── Resíduo dentro da Liberação (migration 015) ──────────────────────────
// Devolvem { data, error }. O banco valida papel (parceiro dono x Smart) e etapa.
export function rpcResiduoIniciar(id, valor, enquadrada) {
  return sb.rpc('liberacao_residuo_iniciar', { p_liberacao_id: String(id), p_valor: valor, p_enquadrada: enquadrada });
}

export function rpcResiduoAvancar(id, novo, valorPago = null) {
  return sb.rpc('liberacao_residuo_avancar', { p_liberacao_id: String(id), p_novo: novo, p_valor_pago: valorPago });
}

const ERROS_RESIDUO = [
  ['RESIDUO_VALOR_OBRIGATORIO',      'Informe o valor que ficou pendente.'],
  ['RESIDUO_ENQUADRADA_OBRIGATORIA', 'Informe se a conta está enquadrada.'],
  ['RESIDUO_LIBERACAO_OK',           'Este cliente já está OK — não dá para abrir resíduo.'],
  ['RESIDUO_JA_EXISTE',              'Este cliente já tem um resíduo em andamento.'],
  ['RESIDUO_SOMENTE_SMART',          'Só a Smart pode marcar o resíduo como enviado.'],
  ['RESIDUO_TRANSICAO_INVALIDA',     'Esta mudança não é permitida nesta etapa. Atualize a tela.'],
  ['RESIDUO_SEM_PERMISSAO',          'Sem permissão para agir neste cliente.'],
  ['RESIDUO_CPF_INVALIDO',           'CPF do cliente é inválido — corrija antes.'],
  ['RESIDUO_STATUS_SOMENTE_RPC',     'O resíduo só muda pelos botões da tela.'],
  ['liberacao_residuo_',             'As funções de resíduo ainda não existem no banco — rode a migration 015 no Supabase.'],
];

export function msgErroResiduo(error) {
  const m = error?.message || '';
  const hit = ERROS_RESIDUO.find(([marca]) => m.includes(marca));
  return hit ? hit[1] : (m || 'Erro inesperado.');
}
