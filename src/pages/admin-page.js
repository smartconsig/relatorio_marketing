import { sb } from '../services/supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { perm } from '../services/permissions.js';

// ── Árvore de permissões ─────────────────────────────────────────────────────
const PERM_TREE = [
  { label: 'Importação', children: [
    { key: 'importacao_fb03',      label: 'Importar FB03' },
    { key: 'importacao_fb06',      label: 'Importar FB06' },
    { key: 'importacao_ecorban',   label: 'Importar Ecorban' },
    { key: 'importacao_smart',     label: 'Importar Smart' },
    { key: 'importacao_processar', label: 'Processar Dados' },
  ]},
  { key: 'visao_geral', label: 'Visão Geral' },
  { key: 'ranking',     label: 'Ranking de Vendas' },
  { label: 'Gestão', children: [
    { label: 'PROCV', children: [
      { key: 'gestao_procv_visualizar', label: 'Visualizar' },
      { key: 'gestao_procv_confirmar',  label: 'Confirmar Divergência' },
      { key: 'gestao_procv_exportar',   label: 'Exportar' },
    ]},
    { label: 'Revisão Manual', children: [
      { key: 'gestao_revisao_visualizar',  label: 'Visualizar' },
      { key: 'gestao_revisao_classificar', label: 'Classificar Status' },
    ]},
    { key: 'gestao_clientes', label: 'Clientes — Visualizar' },
  ]},
  { key: 'propostas',      label: 'Propostas de Marketing' },
  { label: 'Metas', children: [
    { key: 'metas_visualizar', label: 'Visualizar' },
    { key: 'metas_editar',     label: 'Editar' },
  ]},
  { key: 'bsc', label: 'Ranking BSC' },
  { label: 'Administração', children: [
    { key: 'admin_usuarios', label: 'Gerenciar Usuários' },
    { key: 'admin_grupos',   label: 'Gerenciar Grupos de Acesso' },
  ]},
];

// Coleta todas as chaves folha de um nó
function leafKeys(node) {
  if (node.key) return [node.key];
  return (node.children || []).flatMap(leafKeys);
}

// ── Render da árvore de permissões ──────────────────────────────────────────
function renderPermTree(container, permissoes = {}) {
  container.innerHTML = '';

  function buildNode(node, depth = 0) {
    const wrap = document.createElement('div');
    wrap.className = `perm-node depth-${depth}`;

    if (node.key) {
      // Folha com checkbox direto
      const label = document.createElement('label');
      label.className = 'perm-leaf';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.key = node.key;
      cb.checked = permissoes[node.key] === true;
      label.append(cb, document.createTextNode(' ' + node.label));
      wrap.appendChild(label);
    } else {
      // Nó pai: checkbox de grupo + label expansível
      const header = document.createElement('div');
      header.className = 'perm-group-header';

      const cbGroup = document.createElement('input');
      cbGroup.type = 'checkbox';
      cbGroup.className = 'perm-group-cb';
      const keys = leafKeys(node);
      const allChecked = keys.every(k => permissoes[k] === true);
      const someChecked = keys.some(k => permissoes[k] === true);
      cbGroup.checked = allChecked;
      cbGroup.indeterminate = !allChecked && someChecked;

      const groupLabel = document.createElement('span');
      groupLabel.className = 'perm-group-label';
      groupLabel.textContent = node.label;

      const toggle = document.createElement('span');
      toggle.className = 'perm-toggle';
      toggle.textContent = '▼';

      header.append(cbGroup, groupLabel, toggle);
      wrap.appendChild(header);

      const children = document.createElement('div');
      children.className = 'perm-children';
      (node.children || []).forEach(child => children.appendChild(buildNode(child, depth + 1)));
      wrap.appendChild(children);

      // Toggle collapse
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        children.classList.toggle('collapsed');
        toggle.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
      });

      // Grupo checkbox: marca/desmarca todos os filhos
      cbGroup.addEventListener('change', () => {
        children.querySelectorAll('input[data-key]').forEach(cb => {
          cb.checked = cbGroup.checked;
        });
        _syncParents(container);
      });
    }

    return wrap;
  }

  PERM_TREE.forEach(node => container.appendChild(buildNode(node, 0)));

  // Ao mudar qualquer checkbox folha, sincroniza os pais
  container.addEventListener('change', (e) => {
    if (e.target.dataset?.key) _syncParents(container);
  });
}

function _syncParents(container) {
  container.querySelectorAll('.perm-group-header').forEach(header => {
    const cbGroup = header.querySelector('.perm-group-cb');
    if (!cbGroup) return;
    const children = header.nextElementSibling;
    const leaves = children.querySelectorAll('input[data-key]');
    const total   = leaves.length;
    const checked = [...leaves].filter(c => c.checked).length;
    cbGroup.checked = checked === total;
    cbGroup.indeterminate = checked > 0 && checked < total;
  });
}

function readPermissoes(container) {
  const result = {};
  container.querySelectorAll('input[data-key]').forEach(cb => {
    result[cb.dataset.key] = cb.checked;
  });
  return result;
}

// ── Estado local da tela ─────────────────────────────────────────────────────
let _grupos = [];
let _users  = [];
let _adminTab = 'usuarios';

// ── Render principal ─────────────────────────────────────────────────────────
export async function renderAdminPage() {
  const body = document.getElementById('admin-body');
  if (!body) return;

  if (!perm.isAdmin()) {
    body.innerHTML = '<div class="empty"><div class="empty-icon">🔒</div><div class="empty-title">Acesso negado</div><div class="empty-desc">Você não tem permissão para acessar esta área.</div></div>';
    return;
  }

  body.innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab-btn ${_adminTab === 'usuarios' ? 'active' : ''}" data-tab="usuarios">Usuários</button>
      <button class="admin-tab-btn ${_adminTab === 'grupos' ? 'active' : ''}" data-tab="grupos">Grupos de Acesso</button>
    </div>
    <div id="admin-tab-usuarios" class="admin-tab-content" style="${_adminTab !== 'usuarios' ? 'display:none' : ''}">
      <div class="admin-toolbar">
        <button class="btn-primary" id="btn-invite-user">+ Convidar Usuário</button>
      </div>
      <div id="users-list-wrap"></div>
    </div>
    <div id="admin-tab-grupos" class="admin-tab-content" style="${_adminTab !== 'grupos' ? 'display:none' : ''}">
      <div class="admin-toolbar">
        <button class="btn-primary" id="btn-new-grupo">+ Novo Grupo</button>
      </div>
      <div id="grupos-list-wrap"></div>
    </div>
  `;

  // Tabs
  body.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _adminTab = btn.dataset.tab;
      body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _adminTab));
      body.querySelectorAll('.admin-tab-content').forEach(c => {
        c.style.display = c.id === `admin-tab-${_adminTab}` ? '' : 'none';
      });
    });
  });

  document.getElementById('btn-invite-user')?.addEventListener('click', openInviteModal);
  document.getElementById('btn-new-grupo')?.addEventListener('click', () => openGrupoModal(null));

  await Promise.all([loadUsers(), loadGrupos()]);
}

// ── Usuários ─────────────────────────────────────────────────────────────────
async function loadUsers() {
  const wrap = document.getElementById('users-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="admin-loading">Carregando…</div>';

  const { data, error } = await sb
    .from('profiles')
    .select('*, grupos_acesso(nome)')
    .order('created_at', { ascending: false });

  if (error) { wrap.innerHTML = '<div class="admin-error">Erro ao carregar usuários.</div>'; return; }

  _users = data || [];

  if (!_users.length) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">👤</div><div class="empty-title">Nenhum usuário encontrado</div></div>';
    return;
  }

  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Nome</th><th>Email</th><th>Grupo</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>
        ${_users.map(u => `
          <tr class="${u.ativo === false ? 'user-inactive' : ''}">
            <td>${u.nome || '—'}</td>
            <td class="email-cell">${_getUserEmail(u.id)}</td>
            <td>${u.grupos_acesso?.nome || '<span class="badge-sem-grupo">Sem grupo</span>'}</td>
            <td><span class="badge-status ${u.ativo !== false ? 'ativo' : 'inativo'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
            <td class="actions-cell">
              <button class="btn-icon" title="Editar" onclick="window._adminEditUser('${u.id}')">✏️</button>
              <button class="btn-icon" title="${u.ativo !== false ? 'Desativar' : 'Ativar'}" onclick="window._adminToggleUser('${u.id}', ${u.ativo !== false})">
                ${u.ativo !== false ? '🚫' : '✅'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Registra callbacks globais
  window._adminEditUser   = (id) => openEditUserModal(id);
  window._adminToggleUser = (id, ativo) => toggleUser(id, ativo);
}

function _getUserEmail(userId) {
  // Nota: auth.users não é acessível via RLS normal — armazenamos o email no profile
  const u = _users.find(u => u.id === userId);
  return u?.email || userId.slice(0, 8) + '…';
}

async function toggleUser(id, currentAtivo) {
  const novoAtivo = !currentAtivo;
  const { error } = await sb.from('profiles').update({ ativo: novoAtivo }).eq('id', id);
  if (error) { toast('Erro ao atualizar usuário', 'err'); return; }
  toast(novoAtivo ? 'Usuário ativado' : 'Usuário desativado');
  await loadUsers();
}

// ── Modal: editar usuário ────────────────────────────────────────────────────
function openEditUserModal(userId) {
  const user = _users.find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('admin-modal');
  const content = document.getElementById('admin-modal-content');

  content.innerHTML = `
    <h2 class="modal-title">Editar Usuário</h2>
    <div class="form-group">
      <label>Nome</label>
      <input type="text" id="edit-user-nome" value="${user.nome || ''}" placeholder="Nome completo">
    </div>
    <div class="form-group">
      <label>Grupo de Acesso</label>
      <select id="edit-user-grupo">
        <option value="">— Sem grupo —</option>
        ${_grupos.map(g => `<option value="${g.id}" ${g.id === user.grupo_id ? 'selected' : ''}>${g.nome}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nome do Operador (para vincular ao ranking)</label>
      <input type="text" id="edit-user-operador" value="${user.operador_nome || ''}" placeholder="Nome exato como aparece no ranking">
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="document.getElementById('admin-modal').style.display='none'">Cancelar</button>
      <button class="btn-primary" id="btn-save-user">Salvar</button>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('btn-save-user').addEventListener('click', async () => {
    const nome         = document.getElementById('edit-user-nome').value.trim();
    const grupo_id     = document.getElementById('edit-user-grupo').value || null;
    const operador_nome = document.getElementById('edit-user-operador').value.trim() || null;

    const { error } = await sb.from('profiles')
      .update({ nome, grupo_id, operador_nome })
      .eq('id', userId);

    if (error) { toast('Erro ao salvar', 'err'); return; }
    toast('Usuário atualizado');
    modal.style.display = 'none';
    await loadUsers();
  });
}

// ── Modal: convidar usuário ──────────────────────────────────────────────────
function openInviteModal() {
  const modal = document.getElementById('admin-modal');
  const content = document.getElementById('admin-modal-content');

  content.innerHTML = `
    <h2 class="modal-title">Convidar Usuário</h2>
    <p class="modal-desc">O usuário receberá um e-mail com link para criar a senha e acessar o sistema.</p>
    <div class="form-group">
      <label>E-mail</label>
      <input type="email" id="invite-email" placeholder="email@exemplo.com">
    </div>
    <div class="form-group">
      <label>Nome</label>
      <input type="text" id="invite-nome" placeholder="Nome completo">
    </div>
    <div class="form-group">
      <label>Grupo de Acesso</label>
      <select id="invite-grupo">
        <option value="">— Sem grupo —</option>
        ${_grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="document.getElementById('admin-modal').style.display='none'">Cancelar</button>
      <button class="btn-primary" id="btn-send-invite">Enviar Convite</button>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('btn-send-invite').addEventListener('click', async () => {
    const email    = document.getElementById('invite-email').value.trim();
    const nome     = document.getElementById('invite-nome').value.trim();
    const grupo_id = document.getElementById('invite-grupo').value || null;

    if (!email) { toast('Informe o e-mail', 'err'); return; }

    const btn = document.getElementById('btn-send-invite');
    btn.textContent = 'Enviando…'; btn.disabled = true;

    // Usa a API de admin do Supabase para convidar (precisa de service role — via edge function)
    const { data, error } = await sb.functions.invoke('invite-user', {
      body: { email, nome, grupo_id },
    });

    if (error || data?.error) {
      toast('Erro ao enviar convite: ' + (data?.error || error?.message), 'err');
      btn.textContent = 'Enviar Convite'; btn.disabled = false;
      return;
    }

    toast(`Convite enviado para ${email}`);
    modal.style.display = 'none';
    await loadUsers();
  });
}

// ── Grupos de acesso ─────────────────────────────────────────────────────────
async function loadGrupos() {
  const wrap = document.getElementById('grupos-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="admin-loading">Carregando…</div>';

  const { data, error } = await sb
    .from('grupos_acesso')
    .select('*')
    .order('nome');

  if (error) { wrap.innerHTML = '<div class="admin-error">Erro ao carregar grupos.</div>'; return; }

  _grupos = data || [];

  if (!_grupos.length) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">Nenhum grupo cadastrado</div></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="grupos-grid">
      ${_grupos.map(g => `
        <div class="grupo-card">
          <div class="grupo-card-header">
            <span class="grupo-nome">${g.nome}</span>
            <div class="grupo-actions">
              <button class="btn-icon" title="Editar" onclick="window._adminEditGrupo('${g.id}')">✏️</button>
              <button class="btn-icon btn-danger" title="Excluir" onclick="window._adminDeleteGrupo('${g.id}', '${g.nome.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
          </div>
          <div class="grupo-perms-summary">
            ${_summarizePerms(g.permissoes)}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  window._adminEditGrupo   = (id) => openGrupoModal(id);
  window._adminDeleteGrupo = (id, nome) => deleteGrupo(id, nome);
}

function _summarizePerms(permissoes) {
  const sections = [
    { key: 'importacao_processar', label: 'Importar' },
    { key: 'visao_geral',          label: 'Visão Geral' },
    { key: 'ranking',              label: 'Ranking' },
    { key: 'gestao_procv_visualizar', label: 'PROCV' },
    { key: 'gestao_revisao_visualizar', label: 'Revisão' },
    { key: 'propostas',            label: 'Propostas' },
    { key: 'metas_visualizar',     label: 'Metas' },
    { key: 'bsc',                  label: 'BSC' },
    { key: 'admin_usuarios',       label: 'Admin' },
  ];
  return sections
    .filter(s => permissoes[s.key] === true)
    .map(s => `<span class="perm-badge">${s.label}</span>`)
    .join('') || '<span class="perm-none">Sem permissões</span>';
}

// ── Modal: criar/editar grupo ────────────────────────────────────────────────
function openGrupoModal(grupoId) {
  const grupo = grupoId ? _grupos.find(g => g.id === grupoId) : null;
  const isNew = !grupo;

  const modal = document.getElementById('admin-modal');
  const content = document.getElementById('admin-modal-content');

  content.innerHTML = `
    <h2 class="modal-title">${isNew ? 'Novo Grupo de Acesso' : 'Editar Grupo: ' + grupo.nome}</h2>
    <div class="form-group">
      <label>Nome do Grupo</label>
      <input type="text" id="grupo-nome-input" value="${grupo?.nome || ''}" placeholder="Ex: Gestor, Operador…">
    </div>
    <div class="form-group">
      <label>Permissões</label>
      <div id="perm-tree-container" class="perm-tree"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="document.getElementById('admin-modal').style.display='none'">Cancelar</button>
      <button class="btn-primary" id="btn-save-grupo">Salvar Grupo</button>
    </div>
  `;

  modal.style.display = 'flex';

  const treeContainer = document.getElementById('perm-tree-container');
  renderPermTree(treeContainer, grupo?.permissoes || {});

  document.getElementById('btn-save-grupo').addEventListener('click', async () => {
    const nome = document.getElementById('grupo-nome-input').value.trim();
    if (!nome) { toast('Informe o nome do grupo', 'err'); return; }

    const permissoes = readPermissoes(treeContainer);
    const btn = document.getElementById('btn-save-grupo');
    btn.textContent = 'Salvando…'; btn.disabled = true;

    let error;
    if (isNew) {
      ({ error } = await sb.from('grupos_acesso').insert({ nome, permissoes }));
    } else {
      ({ error } = await sb.from('grupos_acesso').update({ nome, permissoes }).eq('id', grupoId));
    }

    if (error) {
      toast('Erro ao salvar grupo: ' + error.message, 'err');
      btn.textContent = 'Salvar Grupo'; btn.disabled = false;
      return;
    }

    toast(isNew ? 'Grupo criado' : 'Grupo atualizado');
    modal.style.display = 'none';
    await loadGrupos();
  });
}

async function deleteGrupo(id, nome) {
  // Usa o confirm overlay existente do sistema
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) {
    const titleEl = document.getElementById('confirm-title');
    const descEl  = document.getElementById('confirm-desc');
    const okBtn   = document.getElementById('confirm-ok-btn');
    if (titleEl) titleEl.textContent = 'Excluir Grupo';
    if (descEl)  descEl.textContent  = `Excluir o grupo "${nome}"? Os usuários desse grupo ficarão sem permissões.`;
    overlay.style.display = 'flex';
    // Substitui o handler padrão temporariamente
    const original = okBtn.onclick;
    okBtn.onclick = async () => {
      overlay.style.display = 'none';
      okBtn.onclick = original;
      const { error } = await sb.from('grupos_acesso').delete().eq('id', id);
      if (error) { toast('Erro ao excluir: ' + error.message, 'err'); return; }
      toast('Grupo excluído');
      await loadGrupos();
    };
  }
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
