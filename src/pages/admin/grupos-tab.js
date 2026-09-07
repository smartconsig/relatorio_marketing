// Aba Grupos de Acesso: lista de cards, modal criar/editar com árvore de
// permissões, exclusão via confirm-overlay. Os globais window._adminEditGrupo
// e _adminDeleteGrupo são registrados aqui, junto das funções-alvo.
import { icon } from '../../utils/icons.js';
import { toast } from '../../utils/ui.js';
import { fetchGrupos, insertGrupo, updateGrupo, deleteGrupoRow } from '../../services/admin-svc.js';
import { getGrupos, setGrupos } from './admin-store.js';
import { renderPermTree, readPermissoes } from './perm-tree.js';

export async function loadGrupos() {
  const wrap = document.getElementById('grupos-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="admin-loading">Carregando…</div>';

  const { data, error } = await fetchGrupos();

  if (error) { wrap.innerHTML = '<div class="admin-error">Erro ao carregar grupos.</div>'; return; }

  setGrupos(data || []);
  const grupos = getGrupos();

  if (!grupos.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">${icon('lock')}</div><div class="empty-title">Nenhum grupo cadastrado</div></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="grupos-grid">
      ${grupos.map(g => `
        <div class="grupo-card">
          <div class="grupo-card-header">
            <span class="grupo-nome">${g.nome}</span>
            <div class="grupo-actions">
              <button class="btn-icon" title="Editar" onclick="window._adminEditGrupo('${g.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon btn-danger" title="Excluir" onclick="window._adminDeleteGrupo('${g.id}', '${g.nome.replace(/'/g, "\\'")}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
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
    { key: 'parceiros',            label: 'Parceiros' },
    { key: 'quitacoes_visualizar',     label: 'Quitações' },
    { key: 'conteudo_visualizar',      label: 'Conteúdo' },
    { key: 'trafego_visualizar',       label: 'Tráfego' },
    { key: 'bm_visualizar',            label: 'BMs' },
    { key: 'liberacao_margem',         label: 'Lib. Margem' },
    { key: 'quitacao_boleto',          label: 'Quit. Boleto' },
    { key: 'residuos_visualizar',      label: 'Resíduos' },
    { key: 'universidade_acessar',     label: 'Universidade' },
    { key: 'universidade_criador',     label: 'Criador' },
    { key: 'universidade_gamificacao', label: 'Gamificação' },
    { key: 'admin_usuarios',           label: 'Admin' },
  ];
  return sections
    .filter(s => permissoes[s.key] === true)
    .map(s => `<span class="perm-badge">${s.label}</span>`)
    .join('') || '<span class="perm-none">Sem permissões</span>';
}

// ── Modal: criar/editar grupo ────────────────────────────────────────────────
export function openGrupoModal(grupoId) {
  const grupo = grupoId ? getGrupos().find(g => g.id === grupoId) : null;
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
      ({ error } = await insertGrupo({ nome, permissoes }));
    } else {
      ({ error } = await updateGrupo(grupoId, { nome, permissoes }));
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
      const { error } = await deleteGrupoRow(id);
      if (error) { toast('Erro ao excluir: ' + error.message, 'err'); return; }
      toast('Grupo excluído');
      await loadGrupos();
    };
  }
}
