// Liberação de Margem — acesso a dados (tabela liberacao_margem_master).
// Wrappers finos sobre o cliente Supabase, no mesmo padrão do boletos-svc:
// cada função devolve o { data, error } original; quem trata erro é a tela.
// (A ida/volta para Resíduos NÃO vive aqui — usa as RPCs do residuos-svc.)
import { sb } from './supabase.js';

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
