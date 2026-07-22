import { state } from '../state.js';

/**
 * Verifica se o usuário logado tem uma permissão específica.
 * @param {string} key - chave da permissão (ex: 'importacao_fb03', 'admin_usuarios')
 * @returns {boolean}
 */
export function can(key) {
  if (!state.currentUser?.permissoes) return false;
  return state.currentUser.permissoes[key] === true;
}

/** Atalhos semânticos */
export const perm = {
  // Importação
  importacaoFb03:      () => can('importacao_fb03'),
  importacaoFb06:      () => can('importacao_fb06'),
  importacaoEcorban:   () => can('importacao_ecorban'),
  importacaoSmart:     () => can('importacao_smart'),
  importacaoProcessar: () => can('importacao_processar'),

  // Seções principais
  visaoGeral:          () => can('visao_geral'),
  ranking:             () => can('ranking'),
  propostas:           () => can('propostas'),
  metasVisualizar:     () => can('metas_visualizar'),
  metasEditar:         () => can('metas_editar'),
  bsc:                 () => can('bsc'),

  // Gestão
  procvVisualizar:     () => can('gestao_procv_visualizar'),
  procvConfirmar:      () => can('gestao_procv_confirmar'),
  procvExportar:       () => can('gestao_procv_exportar'),
  revisaoVisualizar:   () => can('gestao_revisao_visualizar'),
  revisaoClassificar:  () => can('gestao_revisao_classificar'),
  clientesVisualizar:  () => can('gestao_clientes'),

  // Dashboard avançado
  perfilCliente:       () => can('perfil_visualizar'),

  // Quitações
  quitacoesVisualizar: () => can('quitacoes_visualizar'),

  // Esteira de Conteúdo
  conteudoVisualizar:  () => can('conteudo_visualizar') || can('admin_usuarios') || can('admin_grupos'),
  conteudoEditar:      () => can('conteudo_editar')     || can('admin_usuarios') || can('admin_grupos'),
  conteudoAprovar:     () => can('conteudo_aprovar')    || can('admin_usuarios') || can('admin_grupos'),

  // Liberação de Margem Master
  liberacaoMargem:     () => can('liberacao_margem') || can('admin_usuarios') || can('admin_grupos'),

  // Administração
  adminUsuarios:       () => can('admin_usuarios'),
  adminGrupos:         () => can('admin_grupos'),
  isAdmin:             () => can('admin_usuarios') || can('admin_grupos'),
};

/**
 * Retorna true se o usuário tem acesso à seção 'gestao'
 * (basta ter acesso a qualquer sub-aba)
 */
export function canSeeGestao() {
  return can('gestao_procv_visualizar') || can('gestao_revisao_visualizar') || can('gestao_clientes');
}

/**
 * Permissões padrão para usuários sem grupo atribuído.
 * Acesso mínimo: apenas visão geral e ranking.
 */
export const DEFAULT_PERMISSIONS = {
  importacao_fb03: false,
  importacao_fb06: false,
  importacao_ecorban: false,
  importacao_smart: false,
  importacao_processar: false,
  visao_geral: true,
  ranking: true,
  gestao_procv_visualizar: false,
  gestao_procv_confirmar: false,
  gestao_procv_exportar: false,
  gestao_revisao_visualizar: false,
  gestao_revisao_classificar: false,
  gestao_clientes: false,
  propostas: true,
  metas_visualizar: true,
  metas_editar: false,
  bsc: true,
  perfil_visualizar: false,
  quitacoes_visualizar: false,
  conteudo_visualizar: false,
  conteudo_editar: false,
  conteudo_aprovar: false,
  liberacao_margem: false,
  admin_usuarios: false,
  admin_grupos: false,
};
