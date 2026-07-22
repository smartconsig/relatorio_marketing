import { sb } from '../services/supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { perm } from '../services/permissions.js';
import { normStr } from '../utils/string.js';
import changelog from '../data/changelog.json';
import { saveState } from '../core/storage.js';
import { saveSnapshotToSupabase } from '../services/snapshot.js';

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
  { key: 'bsc',                  label: 'Ranking BSC' },
  { key: 'perfil_visualizar',    label: 'Perfil de Cliente' },
  { key: 'quitacoes_visualizar', label: 'Quitações' },
  { label: 'Esteira de Conteúdo', children: [
    { key: 'conteudo_visualizar', label: 'Visualizar o board' },
    { key: 'conteudo_editar',     label: 'Criar e mover cards' },
    { key: 'conteudo_aprovar',    label: 'Aprovar / pedir ajustes' },
  ]},
  { key: 'liberacao_margem',    label: 'Liberação de Margem Master' },
  { label: 'Universidade Smart', children: [
    { key: 'universidade_acessar',    label: 'Acessar Universidade' },
    { key: 'universidade_criador',    label: 'Criador de Cursos (Admin)' },
    { key: 'universidade_gamificacao',label: 'Gamificação (Admin)' },
  ]},
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

// ── Helpers de mapeamento ────────────────────────────────────────────────────
function _buildMapeamentoData() {
  const smartLeads = state.result?.smartLeadsByOperador || {};
  const entries    = state.result?.entries || [];
  const mappings   = state.vendorMappings || {};

  // Ecorban: normName → displayName (primeiro encontrado)
  const ecorbanMap = {};
  for (const e of entries.filter(e => e.isMarketing && e.vendedor)) {
    const norm = normStr(e.vendedor);
    if (!ecorbanMap[norm]) ecorbanMap[norm] = e.vendedor;
  }

  const mappedSmartNames  = new Set(Object.values(mappings));
  const mappedEcorbanNames = new Set(Object.keys(mappings));

  const unmatchedSmart   = Object.keys(smartLeads).filter(sn => !ecorbanMap[sn] && !mappedSmartNames.has(sn));
  const unmatchedEcorban = Object.keys(ecorbanMap).filter(en => !smartLeads[en] && !mappedEcorbanNames.has(en));

  return { smartLeads, ecorbanMap, mappings, unmatchedSmart, unmatchedEcorban };
}

function _renderMapeamento() {
  const wrap = document.getElementById('admin-tab-mapeamento');
  if (!wrap) return;

  const noData = !state.result;
  const { smartLeads, ecorbanMap, mappings, unmatchedSmart, unmatchedEcorban } = _buildMapeamentoData();

  // ── Tabela de mapeamentos existentes
  const currentMappings = Object.entries(mappings);
  const mappingsHtml = currentMappings.length === 0
    ? `<div style="padding:24px;text-align:center;color:var(--gray);font-size:13px">Nenhum mapeamento configurado ainda.</div>`
    : `<table class="admin-table">
        <thead><tr><th>Vendedor (Ecorban)</th><th>Operador (Smart)</th><th>Leads Smart</th><th></th></tr></thead>
        <tbody>
          ${currentMappings.map(([ecNorm, smNorm]) => `
            <tr>
              <td><strong>${ecorbanMap[ecNorm] || ecNorm}</strong></td>
              <td style="color:var(--gray)">${smNorm}</td>
              <td>${smartLeads[smNorm] || 0}</td>
              <td>
                <button class="btn-icon btn-danger" title="Remover" onclick="window._removeMapeamento('${ecNorm}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

  // ── Formulário de novo mapeamento
  const smartOptions   = unmatchedSmart.map(sn =>
    `<option value="${sn}">${sn} (${smartLeads[sn]} leads)</option>`).join('');
  const ecorbanOptions = unmatchedEcorban.map(en =>
    `<option value="${en}">${ecorbanMap[en] || en}</option>`).join('');

  const canAdd = unmatchedSmart.length > 0 && unmatchedEcorban.length > 0;
  const addHtml = !canAdd
    ? `<div style="padding:14px;color:var(--gray);font-size:13px">
        ${unmatchedSmart.length === 0   ? 'Todos os operadores do Smart já estão mapeados. ' : ''}
        ${unmatchedEcorban.length === 0 ? 'Todos os vendedores do Ecorban já têm correspondência.' : ''}
       </div>`
    : `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Operador Smart</div>
          <select id="map-smart-select" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--white);font-size:13px">
            <option value="">— Selecione —</option>${smartOptions}
          </select>
        </div>
        <div style="padding-bottom:10px;color:var(--gray);font-size:18px">→</div>
        <div style="flex:1;min-width:180px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Vendedor Ecorban</div>
          <select id="map-ecorban-select" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--white);font-size:13px">
            <option value="">— Selecione —</option>${ecorbanOptions}
          </select>
        </div>
        <div>
          <button class="btn-primary" id="btn-add-mapeamento">Adicionar</button>
        </div>
      </div>`;

  // ── Listas de sem correspondência
  const listSmartHtml = unmatchedSmart.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--gray);font-size:13px">Todos mapeados ✓</div>`
    : unmatchedSmart.map(sn =>
        `<div style="padding:8px 16px;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
          <span style="color:var(--gray-light)">${sn}</span>
          <span style="color:var(--gray);font-size:11px">${smartLeads[sn]} leads</span>
        </div>`).join('');

  const listEcorbanHtml = unmatchedEcorban.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--gray);font-size:13px">Todos com leads ✓</div>`
    : unmatchedEcorban.map(en =>
        `<div style="padding:8px 16px;font-size:13px;border-bottom:1px solid var(--border);color:var(--gray-light)">${ecorbanMap[en] || en}</div>`).join('');

  wrap.innerHTML = `
    <div style="padding:24px;max-width:900px">
      ${noData ? `<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#f59e0b">
        ⚠ Processe os dados primeiro para ver os nomes disponíveis para mapeamento.
      </div>` : ''}

      <div class="card" style="margin-bottom:20px">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-family:var(--font-h);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.4px">Mapeamentos Configurados</span>
        </div>
        ${mappingsHtml}
      </div>

      ${!noData ? `
      <div class="card" style="margin-bottom:20px">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-family:var(--font-h);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.4px">Adicionar Mapeamento</span>
        </div>
        <div style="padding:16px 20px">${addHtml}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--gray)">
            Smart sem correspondência (${unmatchedSmart.length})
          </div>
          <div style="max-height:220px;overflow-y:auto">${listSmartHtml}</div>
        </div>
        <div class="card">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--gray)">
            Ecorban sem leads Smart (${unmatchedEcorban.length})
          </div>
          <div style="max-height:220px;overflow-y:auto">${listEcorbanHtml}</div>
        </div>
      </div>
      ` : ''}
    </div>`;

  document.getElementById('btn-add-mapeamento')?.addEventListener('click', () => {
    const smNorm = document.getElementById('map-smart-select')?.value;
    const ecNorm = document.getElementById('map-ecorban-select')?.value;
    if (!smNorm || !ecNorm) { toast('Selecione os dois nomes para criar o mapeamento', 'err'); return; }
    if (!state.vendorMappings) state.vendorMappings = {};
    state.vendorMappings[ecNorm] = smNorm;
    _persistMapeamento();
    _renderMapeamento();
    toast('Mapeamento adicionado');
  });

  window._removeMapeamento = (ecNorm) => {
    if (state.vendorMappings) delete state.vendorMappings[ecNorm];
    _persistMapeamento();
    _renderMapeamento();
    toast('Mapeamento removido');
  };
}

async function _persistMapeamento() {
  saveState();
  await saveSnapshotToSupabase();
}

// ── Histórico de versões ─────────────────────────────────────────────────────
function _renderVersions() {
  const TYPE_CFG = {
    feat:     { label: 'Nova funcionalidade', color: '#22c55e' },
    fix:      { label: 'Correção',            color: '#f59e0b' },
    security: { label: 'Segurança',           color: '#ef4444' },
  };

  const fmtDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return `
    <div style="max-width:720px;padding:8px 0 32px">
      <div class="section-title" style="margin-bottom:24px"><span class="bar"></span>Histórico de Versões</div>
      <div style="display:flex;flex-direction:column;gap:0">
        ${changelog.map((v, vi) => `
          <div style="display:flex;gap:0;position:relative">
            <!-- linha vertical -->
            <div style="display:flex;flex-direction:column;align-items:center;width:40px;flex-shrink:0">
              <div style="width:12px;height:12px;border-radius:50%;background:${vi === 0 ? 'var(--red)' : 'var(--border)'};
                border:2px solid ${vi === 0 ? 'var(--red)' : 'var(--gray)'};margin-top:4px;flex-shrink:0;z-index:1"></div>
              ${vi < changelog.length - 1 ? `<div style="width:2px;flex:1;background:var(--border);min-height:24px"></div>` : ''}
            </div>
            <!-- conteúdo -->
            <div style="padding:0 0 32px 16px;flex:1">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
                <span style="font-family:var(--font-h);font-weight:800;font-size:15px;color:${vi === 0 ? 'var(--red)' : 'var(--white)'}">
                  v${v.version}
                </span>
                <span style="font-family:var(--font-h);font-weight:700;font-size:13px;color:var(--white)">
                  ${v.label}
                </span>
                ${vi === 0 ? `<span style="font-size:10px;font-family:var(--font-b);background:var(--red);color:#fff;
                  padding:2px 7px;border-radius:20px;letter-spacing:0.5px">ATUAL</span>` : ''}
                <span style="font-size:11px;color:var(--gray);margin-left:auto">${fmtDate(v.date)}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${v.items.map(item => {
                  const cfg = TYPE_CFG[item.type] || TYPE_CFG.feat;
                  return `
                    <div style="display:flex;align-items:flex-start;gap:8px">
                      <span style="font-size:10px;font-family:var(--font-b);font-weight:700;
                        color:${cfg.color};background:${cfg.color}1a;padding:2px 6px;
                        border-radius:4px;white-space:nowrap;margin-top:1px;flex-shrink:0">
                        ${cfg.label}
                      </span>
                      <span style="font-size:13px;color:var(--white);line-height:1.5;font-family:var(--font-b)">
                        ${item.text}
                      </span>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

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
      <button class="admin-tab-btn ${_adminTab === 'usuarios'   ? 'active' : ''}" data-tab="usuarios">Usuários</button>
      <button class="admin-tab-btn ${_adminTab === 'grupos'     ? 'active' : ''}" data-tab="grupos">Grupos de Acesso</button>
      <button class="admin-tab-btn ${_adminTab === 'mapeamento' ? 'active' : ''}" data-tab="mapeamento">Mapeamento de Vendedores</button>
      <button class="admin-tab-btn ${_adminTab === 'versoes'    ? 'active' : ''}" data-tab="versoes">Versões</button>
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
    <div id="admin-tab-mapeamento" class="admin-tab-content" style="${_adminTab !== 'mapeamento' ? 'display:none' : ''}"></div>
    <div id="admin-tab-versoes"    class="admin-tab-content" style="${_adminTab !== 'versoes'    ? 'display:none' : ''}">${_renderVersions()}</div>
  `;

  // Tabs
  body.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _adminTab = btn.dataset.tab;
      body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _adminTab));
      body.querySelectorAll('.admin-tab-content').forEach(c => {
        c.style.display = c.id === `admin-tab-${_adminTab}` ? '' : 'none';
      });
      if (_adminTab === 'mapeamento') _renderMapeamento();
      if (_adminTab === 'versoes') {
        const el = document.getElementById('admin-tab-versoes');
        if (el && !el.dataset.built) { el.innerHTML = _renderVersions(); el.dataset.built = '1'; }
      }
    });
  });

  document.getElementById('btn-invite-user')?.addEventListener('click', openInviteModal);
  document.getElementById('btn-new-grupo')?.addEventListener('click', () => openGrupoModal(null));

  const tasks = [loadUsers(), loadGrupos()];
  if (_adminTab === 'mapeamento') _renderMapeamento();
  await Promise.all(tasks);
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
  const { error } = await sb.from('profiles').update({ ativo: novoAtivo }).eq('id', id);
  if (error) { toast('Erro ao atualizar usuário', 'err'); return; }
  toast(novoAtivo ? 'Usuário ativado' : 'Usuário desativado');
  await loadUsers();
}

// ── Modal: editar usuário ────────────────────────────────────────────────────
async function openEditUserModal(userId) {
  const user = _users.find(u => u.id === userId);
  if (!user) return;

  // Garante que os grupos estão carregados
  if (!_grupos.length) {
    const { data } = await sb.from('grupos_acesso').select('*').order('nome');
    _grupos = data || [];
  }

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
async function openInviteModal() {
  // Garante que os grupos estão carregados
  if (!_grupos.length) {
    const { data } = await sb.from('grupos_acesso').select('*').order('nome');
    _grupos = data || [];
  }

  const modal   = document.getElementById('admin-modal');
  const content = document.getElementById('admin-modal-content');

  content.innerHTML = `
    <h2 class="modal-title">Convidar Usuário</h2>
    <p class="modal-desc">O usuário receberá um e-mail com link para criar a senha e acessar o sistema.</p>
    <div class="form-group">
      <label>E-mail *</label>
      <input type="email" id="invite-email" placeholder="email@exemplo.com" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Nome completo *</label>
      <input type="text" id="invite-nome" placeholder="Ex: João Silva" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Grupo de Acesso *</label>
      <select id="invite-grupo">
        <option value="">— Selecione um grupo —</option>
        ${_grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nome do Operador <span style="font-weight:400;text-transform:none">(opcional — para vincular ao ranking)</span></label>
      <input type="text" id="invite-operador" placeholder="Nome exato como aparece no ranking" autocomplete="off">
    </div>
    <div id="invite-feedback" style="display:none;padding:10px 12px;border-radius:7px;font-size:13px;margin-bottom:4px"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="document.getElementById('admin-modal').style.display='none'">Cancelar</button>
      <button class="btn-primary" id="btn-send-invite">Enviar Convite</button>
    </div>
  `;

  modal.style.display = 'flex';
  document.getElementById('invite-email').focus();

  document.getElementById('btn-send-invite').addEventListener('click', async () => {
    const email         = document.getElementById('invite-email').value.trim().toLowerCase();
    const nome          = document.getElementById('invite-nome').value.trim();
    const grupo_id      = document.getElementById('invite-grupo').value || null;
    const operador_nome = document.getElementById('invite-operador').value.trim() || null;
    const feedback      = document.getElementById('invite-feedback');
    const btn           = document.getElementById('btn-send-invite');

    // Validação
    if (!email || !email.includes('@')) {
      _showFeedback(feedback, 'Informe um e-mail válido.', 'err'); return;
    }
    if (!nome) {
      _showFeedback(feedback, 'Informe o nome do usuário.', 'err'); return;
    }
    if (!grupo_id) {
      _showFeedback(feedback, 'Selecione um grupo de acesso.', 'err'); return;
    }

    btn.textContent = 'Enviando…'; btn.disabled = true;
    feedback.style.display = 'none';

    const { data, error } = await sb.functions.invoke('invite-user', {
      body: { email, nome, grupo_id, operador_nome },
    });

    btn.textContent = 'Enviar Convite'; btn.disabled = false;

    if (error || data?.error) {
      // supabase-js v2 CDN: quando a função retorna não-2xx, error.message
      // pode ser o próprio body JSON serializado como string
      let msg = data?.error || 'Erro ao enviar convite';
      if (!data?.error) {
        try {
          const parsed = JSON.parse(error?.message || '');
          msg = parsed.error || error?.message || msg;
        } catch {
          msg = error?.message || msg;
        }
      }
      _showFeedback(feedback, msg, 'err');
      return;
    }

    // Sucesso — mostra feedback antes de fechar
    const msg = data.resent
      ? `✅ ${email} já está cadastrado. Um link de redefinição de senha foi enviado.`
      : `✅ Convite enviado para ${email}. O usuário receberá um e-mail com o link de acesso.`;
    _showFeedback(feedback, msg, 'ok');
    btn.textContent = 'Enviado!'; btn.disabled = true;

    setTimeout(async () => {
      modal.style.display = 'none';
      await loadUsers();
    }, 2000);
  });
}

function _showFeedback(el, msg, type) {
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'err' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';
  el.style.color       = type === 'err' ? '#ef4444' : '#22c55e';
  el.style.border      = `1px solid ${type === 'err' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`;
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

      const { data, error } = await sb.functions.invoke('delete-user', {
        body: { user_id: id },
      });

      let errMsg = null;
      if (error || data?.error) {
        try { errMsg = JSON.parse(error?.message || '').error; } catch {}
        errMsg = errMsg || data?.error || error?.message || 'Erro ao excluir';
      }

      if (errMsg) { toast(errMsg, 'err'); return; }
      toast('Usuário excluído');
      await loadUsers();
    };
  }
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
    { key: 'quitacoes_visualizar',     label: 'Quitações' },
    { key: 'conteudo_visualizar',      label: 'Conteúdo' },
    { key: 'liberacao_margem',         label: 'Lib. Margem' },
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
