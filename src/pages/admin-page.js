// Administração — shell das 4 abas. Cada aba vive em src/pages/admin/:
//   users-tab.js       Usuários (lista, criar, editar, ativar, excluir)
//   grupos-tab.js      Grupos de Acesso (+ perm-tree.js, a árvore de permissões)
//   mapeamento-tab.js  Mapeamento de Vendedores Ecorban↔Smart
//   versoes-tab.js     Histórico de versões (changelog)
//   admin-store.js     cache de grupos compartilhado entre as abas
// O acesso a dados foi movido para src/services/admin-svc.js.
import { icon } from '../utils/icons.js';
import { perm } from '../services/permissions.js';
import { loadUsers, openInviteModal } from './admin/users-tab.js';
import { loadGrupos, openGrupoModal } from './admin/grupos-tab.js';
import { renderMapeamento } from './admin/mapeamento-tab.js';
import { renderVersions } from './admin/versoes-tab.js';

let _adminTab = 'usuarios';

export async function renderAdminPage() {
  const body = document.getElementById('admin-body');
  if (!body) return;

  if (!perm.isAdmin()) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">${icon('lock')}</div><div class="empty-title">Acesso negado</div><div class="empty-desc">Você não tem permissão para acessar esta área.</div></div>`;
    return;
  }

  body.innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab-btn ${_adminTab === 'usuarios'   ? 'active' : ''}" data-tab="usuarios">Usuários</button>
      <button class="admin-tab-btn ${_adminTab === 'grupos'     ? 'active' : ''}" data-tab="grupos">Grupos de Acesso</button>
      <button class="admin-tab-btn ${_adminTab === 'mapeamento' ? 'active' : ''}" data-tab="mapeamento">Mapeamento de Vendedores</button>
      <button class="admin-tab-btn ${_adminTab === 'versoes'    ? 'active' : ''}" data-tab="versoes">Versões</button>
    </div>
    <div id="admin-tab-usuarios" class="admin-tab-content" style="${_adminTab !== 'usuarios' ? 'display:none' : ''}">
      <div class="admin-toolbar">
        <button class="btn-primary" id="btn-invite-user">+ Novo Usuário</button>
      </div>
      <div id="users-list-wrap"></div>
    </div>
    <div id="admin-tab-grupos" class="admin-tab-content" style="${_adminTab !== 'grupos' ? 'display:none' : ''}">
      <div class="admin-toolbar">
        <button class="btn-primary" id="btn-new-grupo">+ Novo Grupo</button>
      </div>
      <div id="grupos-list-wrap"></div>
    </div>
    <div id="admin-tab-mapeamento" class="admin-tab-content" style="${_adminTab !== 'mapeamento' ? 'display:none' : ''}"></div>
    <div id="admin-tab-versoes"    class="admin-tab-content" style="${_adminTab !== 'versoes'    ? 'display:none' : ''}">${renderVersions()}</div>
  `;

  // Tabs
  body.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _adminTab = btn.dataset.tab;
      body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _adminTab));
      body.querySelectorAll('.admin-tab-content').forEach(c => {
        c.style.display = c.id === `admin-tab-${_adminTab}` ? '' : 'none';
      });
      if (_adminTab === 'mapeamento') renderMapeamento();
      if (_adminTab === 'versoes') {
        const el = document.getElementById('admin-tab-versoes');
        if (el && !el.dataset.built) { el.innerHTML = renderVersions(); el.dataset.built = '1'; }
      }
    });
  });

  document.getElementById('btn-invite-user')?.addEventListener('click', openInviteModal);
  document.getElementById('btn-new-grupo')?.addEventListener('click', () => openGrupoModal(null));

  const tasks = [loadUsers(), loadGrupos()];
  if (_adminTab === 'mapeamento') renderMapeamento();
  await Promise.all(tasks);
}

// ── Init ─────────────────────────────────────────────────────────────────────
export function initAdminPage() {
  // Fecha modal ao clicar no overlay
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }
}
