// Mostra/oculta itens de navegação e seções conforme o grupo do usuário.
import { can, canSeeGestao, perm } from '../services/permissions.js';
import { initAdminPage } from '../pages/admin-page.js';

/**
 * Aplica permissões à interface: mostra/oculta itens de nav e seções
 * conforme o grupo do usuário logado.
 */
export function applyPermissionsToUI() {
  const permMap = {
    home:      () => can('home'),
    import:    () => can('importacao_fb03') || can('importacao_ecorban') || can('importacao_processar'),
    overview:  () => can('visao_geral'),
    ranking:   () => can('ranking'),
    trafego:   () => perm.trafegoVisualizar(),
    gestao:    () => canSeeGestao(),
    quitacoes: () => can('quitacoes_visualizar'),
    conteudo:  () => perm.conteudoVisualizar(),
    bms:       () => perm.bmVisualizar(),
    perfil:    () => can('perfil_visualizar'),
    propostas: () => can('propostas'),
    goals:     () => can('metas_visualizar'),
    bsc:          () => can('bsc'),
    parceiros:    () => perm.parceiros(),
    liberacao:    () => can('liberacao_margem') || perm.isAdmin(),
    boletos:      () => can('quitacao_boleto') || perm.isAdmin(),
    residuos:     () => perm.residuosVisualizar(),
    universidade: () => can('universidade_acessar') || perm.isAdmin(),
    'uni-admin':       () => perm.isAdmin(),
    'uni-gamificacao': () => perm.isAdmin(),
    admin:             () => perm.isAdmin(),
  };

  // Sidebar nav items (standalone + filhos de grupos)
  document.querySelectorAll('.nav-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Oculta grupo se todos os filhos estiverem ocultos
  document.querySelectorAll('.nav-group').forEach(group => {
    const children = [...group.querySelectorAll('.nav-item[data-sec]')];
    const allHidden = children.length > 0 && children.every(el => el.style.display === 'none');
    const trigger = group.querySelector('.nav-group-trigger');
    if (trigger) trigger.style.display = allHidden ? 'none' : '';
  });

  // Float rail — itens standalone
  document.querySelectorAll('.nav-float-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Float rail — itens dentro do flyout de grupos
  document.querySelectorAll('.nav-float-flyout-item[data-sec]').forEach(el => {
    const checker = permMap[el.dataset.sec];
    if (checker) el.style.display = checker() ? '' : 'none';
  });

  // Oculta grupo do float rail se todos os filhos estiverem ocultos
  document.querySelectorAll('.nav-float-item.nav-float-group').forEach(groupEl => {
    const children = [...groupEl.querySelectorAll('.nav-float-flyout-item[data-sec]')];
    const allHidden = children.length > 0 && children.every(el => el.style.display === 'none');
    groupEl.style.display = allHidden ? 'none' : '';
  });

  // Card de Tráfego na tela de importação — só para quem pode lançar
  const trafegoCard = document.getElementById('card-trafego');
  if (trafegoCard) trafegoCard.style.display = perm.trafegoEditar() ? '' : 'none';

  // Sub-abas de Gestão
  const procvTab    = document.querySelector('.gestao-tab-btn[data-tab="procv"]');
  const revisaoTab  = document.querySelector('.gestao-tab-btn[data-tab="review"]');
  const clientesTab = document.querySelector('.gestao-tab-btn[data-tab="clientes"]');
  if (procvTab)    procvTab.style.display    = can('gestao_procv_visualizar')   ? '' : 'none';
  if (revisaoTab)  revisaoTab.style.display  = can('gestao_revisao_visualizar') ? '' : 'none';
  if (clientesTab) clientesTab.style.display = can('gestao_clientes')           ? '' : 'none';

  // Inicializa o admin modal uma vez
  initAdminPage();
}
