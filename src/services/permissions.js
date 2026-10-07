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
  propostas:           () => can('propostas'),
  bsc:                 () => can('bsc'),

  // Gestão
  procvVisualizar:     () => can('gestao_procv_visualizar'),
  procvConfirmar:      () => can('gestao_procv_confirmar'),
  procvExportar:       () => can('gestao_procv_exportar'),
  revisaoVisualizar:   () => can('gestao_revisao_visualizar'),
  revisaoClassificar:  () => can('gestao_revisao_classificar'),
  clientesVisualizar:  () => can('gestao_clientes'),

  // Esteira de Conteúdo
  conteudoVisualizar:  () => can('conteudo_visualizar') || can('admin_usuarios') || can('admin_grupos'),
  conteudoEditar:      () => can('conteudo_editar')     || can('admin_usuarios') || can('admin_grupos'),
  conteudoAprovar:     () => can('conteudo_aprovar')    || can('admin_usuarios') || can('admin_grupos'),

  // Central de BMs (números oficiais)
  bmVisualizar:        () => can('bm_visualizar') || can('admin_usuarios') || can('admin_grupos'),
  bmEditar:            () => can('bm_editar')     || can('admin_usuarios') || can('admin_grupos'),

  // Tráfego (Ads) — dados diários digitados
  trafegoVisualizar:   () => can('trafego_visualizar') || can('admin_usuarios') || can('admin_grupos'),
  trafegoEditar:       () => can('trafego_editar')     || can('admin_usuarios') || can('admin_grupos'),

  // Liberação de Margem Master
  liberacaoMargem:     () => can('liberacao_margem') || can('admin_usuarios') || can('admin_grupos'),

  // Quitação de Boleto
  quitacaoBoleto:      () => can('quitacao_boleto') || can('admin_usuarios') || can('admin_grupos'),

  // Resíduos (tela interna — parceiros não têm acesso)
  residuosVisualizar:  () => can('residuos_visualizar') || can('admin_usuarios') || can('admin_grupos'),
  residuosEditar:      () => can('residuos_editar')     || can('admin_usuarios') || can('admin_grupos'),

  // Administração
  adminUsuarios:       () => can('admin_usuarios'),
  adminGrupos:         () => can('admin_grupos'),
  isAdmin:             () => can('admin_usuarios') || can('admin_grupos'),
};

// Telas que leem as propostas/leads de marketing (state.result). Quem não tem
// nenhuma delas (parceiros, alunos, esteira…) não baixa esses dados no login.
const CHAVES_DADOS_MARKETING = [
  'visao_geral', 'propostas',
  'gestao_procv_visualizar', 'gestao_revisao_visualizar', 'gestao_clientes',
  'importacao_processar', 'admin_usuarios', 'admin_grupos',
];

export function usaDadosMarketing() {
  return CHAVES_DADOS_MARKETING.some(can);
}

/**
 * Retorna true se o usuário tem acesso à seção 'gestao'
 * (basta ter acesso a qualquer sub-aba)
 */
export function canSeeGestao() {
  return can('gestao_procv_visualizar') || can('gestao_revisao_visualizar') || can('gestao_clientes');
}

/**
 * Permissões padrão para usuários sem grupo atribuído.
 * Acesso mínimo: Home, visão geral, propostas e BSC.
 */
export const DEFAULT_PERMISSIONS = {
  home: true,
  importacao_fb03: false,
  importacao_fb06: false,
  importacao_ecorban: false,
  importacao_smart: false,
  importacao_processar: false,
  visao_geral: true,
  gestao_procv_visualizar: false,
  gestao_procv_confirmar: false,
  gestao_procv_exportar: false,
  gestao_revisao_visualizar: false,
  gestao_revisao_classificar: false,
  gestao_clientes: false,
  propostas: true,
  bsc: true,
  conteudo_visualizar: false,
  conteudo_editar: false,
  conteudo_aprovar: false,
  bm_visualizar: false,
  bm_editar: false,
  trafego_visualizar: false,
  trafego_editar: false,
  liberacao_margem: false,
  quitacao_boleto: false,
  residuos_visualizar: false,
  residuos_editar: false,
  admin_usuarios: false,
  admin_grupos: false,
};
