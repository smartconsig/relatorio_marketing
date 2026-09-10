// Aba Usuários da Administração: lista, editar, ativar/desativar, criar
// (senha direta ou convite por e-mail) e excluir. Os globais window._admin*
// são registrados aqui, no mesmo módulo das funções-alvo.
import { icon } from '../../utils/icons.js';
import { toast } from '../../utils/ui.js';
import {
  fetchProfiles, updateProfileAtivo, updateProfile, invokeDeleteUser,
} from '../../services/admin-svc.js';
import { ensureGrupos } from './admin-store.js';

// Modal "Novo Usuario" (senha direta ou convite por e-mail) vive em
// users-invite.js; re-export mantem o nome publico original.
export { openInviteModal } from './users-invite.js';

let _users = [];

export async function loadUsers() {
  const wrap = document.getElementById('users-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="admin-loading">Carregando…</div>';

  const { data, error } = await fetchProfiles();

  if (error) { wrap.innerHTML = '<div class="admin-error">Erro ao carregar usuários.</div>'; return; }

  _users = data || [];

  if (!_users.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">${icon('user')}</div><div class="empty-title">Nenhum usuário encontrado</div></div>`;
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
              <button class="btn-icon" title="Editar" onclick="window._adminEditUser('${u.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon" title="${u.ativo !== false ? 'Desativar' : 'Ativar'}" onclick="window._adminToggleUser('${u.id}', ${u.ativo !== false})">
                ${u.ativo !== false
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
                }
              </button>
              <button class="btn-icon btn-danger" title="Excluir usuário" onclick="window._adminDeleteUser('${u.id}', '${(u.nome || u.email || '').replace(/'/g, "\\'")}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
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
  window._adminDeleteUser = (id, nome) => deleteUser(id, nome);
}

function _getUserEmail(userId) {
  // Nota: auth.users não é acessível via RLS normal — armazenamos o email no profile
  const u = _users.find(u => u.id === userId);
  return u?.email || userId.slice(0, 8) + '…';
}

async function toggleUser(id, currentAtivo) {
  const novoAtivo = !currentAtivo;
  const { error } = await updateProfileAtivo(id, novoAtivo);
  if (error) { toast('Erro ao atualizar usuário', 'err'); return; }
  toast(novoAtivo ? 'Usuário ativado' : 'Usuário desativado');
  await loadUsers();
}

// ── Modal: editar usuário ────────────────────────────────────────────────────
async function openEditUserModal(userId) {
  const user = _users.find(u => u.id === userId);
  if (!user) return;

  // Garante que os grupos estão carregados
  const grupos = await ensureGrupos();

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
        ${grupos.map(g => `<option value="${g.id}" ${g.id === user.grupo_id ? 'selected' : ''}>${g.nome}</option>`).join('')}
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

    const { error } = await updateProfile(userId, { nome, grupo_id, operador_nome });

    if (error) { toast('Erro ao salvar', 'err'); return; }
    toast('Usuário atualizado');
    modal.style.display = 'none';
    await loadUsers();
  });
}

function _msgErroExclusao(data, error) {
  if (!error && !data?.error) return null;
  let errMsg = null;
  try { errMsg = JSON.parse(error?.message || '').error; } catch {}
  return errMsg || data?.error || error?.message || 'Erro ao excluir';
}

async function deleteUser(id, nome) {
  const confirmEl = document.getElementById('confirm-overlay');
  if (confirmEl) {
    const titleEl = document.getElementById('confirm-title');
    const descEl  = document.getElementById('confirm-desc');
    const okBtn   = document.getElementById('confirm-ok-btn');
    if (titleEl) titleEl.textContent = 'Excluir Usuário';
    if (descEl)  descEl.textContent  = `Excluir "${nome}" permanentemente? O usuário perderá o acesso imediatamente e não poderá recuperar a conta.`;
    confirmEl.style.display = 'flex';
    const original = okBtn.onclick;
    okBtn.onclick = async () => {
      confirmEl.style.display = 'none';
      okBtn.onclick = original;

      const { data, error } = await invokeDeleteUser(id);

      const errMsg = _msgErroExclusao(data, error);
      if (errMsg) { toast(errMsg, 'err'); return; }
      toast('Usuário excluído');
      await loadUsers();
    };
  }
}
