// ── Universidade Smart — Gamificação ──────────────────────────────────────
// Página de configuração de regras: XP, Níveis, Conquistas e Prêmios.

import { sb } from '../services/supabase.js';

// ── Estado ─────────────────────────────────────────────────────────────────
let _tab   = 'xp';      // 'xp' | 'niveis' | 'conquistas' | 'premios'
let _saving = false;

// dados carregados
let _xpConfig   = [];
let _niveis     = [];
let _conquistas = [];
let _premios    = [];

// estado de edição inline
let _conquista = _emptyConquista();
let _premio    = _emptyPremio();
let _editView  = null;  // null | 'conquista' | 'premio'

function _emptyConquista() {
  return { id: null, nome: '', descricao: '', icone: 'star', condicao_tipo: 'cursos_concluidos', condicao_valor: 1, xp_bonus: 0, ativo: true };
}
function _emptyPremio() {
  return { id: null, nome: '', descricao: '', xp_necessario: 0, ativo: true };
}

// ── Entry ──────────────────────────────────────────────────────────────────
export async function renderUniGamificacao(container) {
  const el = container || document.getElementById('sec-uni-gamificacao');
  if (!el) return;
  el.innerHTML = _spinner();
  await _loadAll();
  _render(el);
}

async function _loadAll() {
  const [r1, r2, r3, r4] = await Promise.all([
    sb.from('uni_config_xp').select('*').order('acao'),
    sb.from('uni_niveis_config').select('*').order('ordem'),
    sb.from('uni_conquistas').select('*').order('criado_em'),
    sb.from('uni_premios').select('*').order('xp_necessario'),
  ]);
  _xpConfig   = r1.data || [];
  _niveis     = r2.data || [];
  _conquistas = r3.data || [];
  _premios    = r4.data || [];
}

// ── Render principal ───────────────────────────────────────────────────────
function _render(el) {
  el.innerHTML = `
    <div class="uadm-page">
      <div class="uadm-topbar">
        <div>
          <h1 class="uadm-h1">Gamificação</h1>
          <p class="uadm-sub">Configure as regras de XP, níveis, conquistas e prêmios da plataforma.</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ugam-tabs">
        ${[
          ['xp',         '⚡', 'Configurar XP'],
          ['niveis',     '🏆', 'Níveis'],
          ['conquistas', '🎖️', 'Conquistas'],
          ['premios',    '🎁', 'Prêmios'],
        ].map(([id, ico, label]) => `
          <button class="ugam-tab ${_tab === id ? 'active' : ''}" data-tab="${id}">
            <span class="ugam-tab-ico">${ico}</span>
            <span class="ugam-tab-label">${label}</span>
          </button>
        `).join('')}
      </div>

      <!-- Conteúdo da tab -->
      <div id="ugam-body"></div>
    </div>
  `;

  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.tab;
      _editView = null;
      el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === _tab));
      _renderTabBody(document.getElementById('ugam-body'));
    });
  });

  _renderTabBody(document.getElementById('ugam-body'));
}

function _renderTabBody(body) {
  if (!body) return;
  if (_tab === 'xp')         _renderXP(body);
  else if (_tab === 'niveis')     _renderNiveis(body);
  else if (_tab === 'conquistas') _renderConquistas(body);
  else if (_tab === 'premios')    _renderPremios(body);
}

// ── Tab: XP Config ─────────────────────────────────────────────────────────
function _renderXP(body) {
  const LABELS = {
    aula_concluida:           { label: 'Concluir uma aula',               icon: '📹' },
    curso_concluido:          { label: 'Concluir um curso completo',       icon: '🎓' },
    prova_primeira_tentativa: { label: 'Passar na prova na 1ª tentativa', icon: '✅' },
    prova_nota_maxima:        { label: 'Nota máxima na prova (100%)',      icon: '💯' },
    livro_lido:               { label: 'Ler um livro da biblioteca',       icon: '📚' },
    primeiro_curso_mes:       { label: 'Primeiro curso concluído do mês',  icon: '📅' },
  };

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-title">Pontuação por Ação</div>
      <div class="uadm-card-sub">Defina quantos XP o colaborador ganha para cada ação realizada na plataforma.</div>

      <div class="ugam-xp-list" id="ugam-xp-list">
        ${_xpConfig.map(row => {
          const meta = LABELS[row.acao] || { label: row.acao, icon: '⚙️' };
          return `
            <div class="ugam-xp-row">
              <span class="ugam-xp-ico">${meta.icon}</span>
              <div class="ugam-xp-info">
                <div class="ugam-xp-label">${meta.label}</div>
                <div class="ugam-xp-desc">${row.descricao || ''}</div>
              </div>
              <div class="ugam-xp-input-wrap">
                <input class="uadm-input ugam-xp-input" type="number" min="0" max="9999"
                       value="${row.xp}" data-acao="${row.acao}">
                <span class="ugam-xp-unit">XP</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="uadm-editor-footer" style="margin-top:24px;padding:0">
        <div></div>
        <button class="uadm-btn-primary" id="btn-salvar-xp">Salvar configuração de XP</button>
      </div>
    </div>
  `;

  body.querySelector('#btn-salvar-xp')?.addEventListener('click', async () => {
    const btn = body.querySelector('#btn-salvar-xp');
    btn.disabled = true; btn.textContent = 'Salvando…';

    try {
      const updates = [...body.querySelectorAll('.ugam-xp-input')].map(inp => ({
        acao: inp.dataset.acao,
        xp: parseInt(inp.value) || 0,
      }));

      for (const u of updates) {
        await sb.from('uni_config_xp').update({ xp: u.xp }).eq('acao', u.acao);
        const local = _xpConfig.find(r => r.acao === u.acao);
        if (local) local.xp = u.xp;
      }

      btn.textContent = '✓ Salvo!';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Salvar configuração de XP'; }, 2000);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false; btn.textContent = 'Salvar configuração de XP';
    }
  });
}

// ── Tab: Níveis ─────────────────────────────────────────────────────────────
function _renderNiveis(body) {
  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-title">Níveis de Progressão</div>
      <div class="uadm-card-sub">Configure os nomes e faixas de XP para cada nível. Elas são ordenadas automaticamente.</div>

      <div class="ugam-niveis-list" id="ugam-niveis-list">
        ${_niveis.map((n, i) => `
          <div class="ugam-nivel-row" data-nid="${n.id}">
            <div class="ugam-nivel-ordem">${i + 1}</div>
            <input class="uadm-input ugam-nivel-nome" type="text"
                   placeholder="Nome do nível" value="${_esc(n.nome)}" data-nid="${n.id}" data-field="nome">
            <div class="ugam-nivel-range">
              <input class="uadm-input ugam-nivel-xp" type="number" min="0"
                     placeholder="XP mín" value="${n.xp_min}" data-nid="${n.id}" data-field="xp_min">
              <span class="ugam-nivel-sep">→</span>
              <input class="uadm-input ugam-nivel-xp" type="number" min="0"
                     placeholder="${i === _niveis.length - 1 ? '∞' : 'XP máx'}"
                     value="${n.xp_max ?? ''}" data-nid="${n.id}" data-field="xp_max"
                     ${i === _niveis.length - 1 ? 'disabled placeholder="Sem limite"' : ''}>
            </div>
            <div class="ugam-nivel-preview" style="background:${_nivelGradient(i)}">
              ${n.nome || 'Nível'}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="uadm-editor-footer" style="margin-top:24px;padding:0">
        <div></div>
        <button class="uadm-btn-primary" id="btn-salvar-niveis">Salvar níveis</button>
      </div>
    </div>
  `;

  body.querySelector('#btn-salvar-niveis')?.addEventListener('click', async () => {
    const btn = body.querySelector('#btn-salvar-niveis');
    btn.disabled = true; btn.textContent = 'Salvando…';

    try {
      for (const n of _niveis) {
        const nomeEl   = body.querySelector(`input[data-nid="${n.id}"][data-field="nome"]`);
        const xpMinEl  = body.querySelector(`input[data-nid="${n.id}"][data-field="xp_min"]`);
        const xpMaxEl  = body.querySelector(`input[data-nid="${n.id}"][data-field="xp_max"]`);
        const nome     = nomeEl?.value?.trim() || n.nome;
        const xp_min   = parseInt(xpMinEl?.value) || 0;
        const xp_max   = xpMaxEl?.value ? parseInt(xpMaxEl.value) : null;
        await sb.from('uni_niveis_config').update({ nome, xp_min, xp_max }).eq('id', n.id);
        n.nome = nome; n.xp_min = xp_min; n.xp_max = xp_max;
      }
      btn.textContent = '✓ Salvo!';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Salvar níveis'; }, 2000);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false; btn.textContent = 'Salvar níveis';
    }
  });
}

function _nivelGradient(i) {
  const gradients = [
    'linear-gradient(135deg,#374151,#1f2937)',
    'linear-gradient(135deg,#1d4ed8,#1e40af)',
    'linear-gradient(135deg,#047857,#065f46)',
    'linear-gradient(135deg,#b45309,#92400e)',
    'linear-gradient(135deg,#7c3aed,#6d28d9)',
  ];
  return gradients[i % gradients.length];
}

// ── Tab: Conquistas ─────────────────────────────────────────────────────────
const CONDICAO_LABELS = {
  cursos_concluidos: 'Cursos concluídos',
  cursos_mes:        'Cursos em um mês',
  nota_maxima:       'Nota máxima na prova',
  xp_total:         'XP total acumulado',
  livros_lidos:      'Livros lidos',
  primeira_aula:     'Primeira aula concluída',
};

const ICONES = ['star','trophy','medal','zap','book','check','fire','crown','rocket','heart'];

function _renderConquistas(body) {
  if (_editView === 'conquista') {
    _renderConquistaEditor(body);
    return;
  }

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-topbar">
        <div>
          <div class="uadm-card-title">Conquistas / Badges</div>
          <div class="uadm-card-sub">${_conquistas.length} conquista${_conquistas.length !== 1 ? 's' : ''} cadastrada${_conquistas.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="uadm-btn-primary" id="btn-nova-conquista">+ Nova Conquista</button>
      </div>

      ${_conquistas.length === 0 ? `
        <div class="uadm-empty" style="padding:48px 0">
          <div class="uadm-empty-title">Nenhuma conquista criada</div>
          <div class="uadm-empty-sub">Crie badges para motivar os colaboradores</div>
        </div>
      ` : `
        <div class="ugam-cards-grid">
          ${_conquistas.map(c => `
            <div class="ugam-badge-card ${c.ativo ? '' : 'inativo'}">
              <div class="ugam-badge-icon">${_iconeSvg(c.icone)}</div>
              <div class="ugam-badge-info">
                <div class="ugam-badge-nome">${c.nome}</div>
                <div class="ugam-badge-cond">${CONDICAO_LABELS[c.condicao_tipo] || c.condicao_tipo}: <strong>${c.condicao_valor}</strong></div>
                ${c.xp_bonus > 0 ? `<div class="ugam-badge-xp">+${c.xp_bonus} XP bônus</div>` : ''}
              </div>
              <div class="ugam-badge-actions">
                <button class="uadm-btn-sm" data-edit-conquista="${c.id}">Editar</button>
                <button class="uadm-btn-sm-ghost ugam-toggle-ativo" data-cid="${c.id}" data-ativo="${c.ativo}">
                  ${c.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  body.querySelector('#btn-nova-conquista')?.addEventListener('click', () => {
    _conquista = _emptyConquista();
    _editView = 'conquista';
    _renderConquistas(body);
  });

  body.querySelectorAll('[data-edit-conquista]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = _conquistas.find(x => x.id === btn.dataset.editConquista);
      if (c) { _conquista = { ...c }; _editView = 'conquista'; _renderConquistas(body); }
    });
  });

  body.querySelectorAll('.ugam-toggle-ativo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ativo = btn.dataset.ativo === 'true';
      await sb.from('uni_conquistas').update({ ativo: !ativo }).eq('id', btn.dataset.cid);
      const local = _conquistas.find(x => x.id === btn.dataset.cid);
      if (local) local.ativo = !ativo;
      _renderConquistas(body);
    });
  });
}

function _renderConquistaEditor(body) {
  const isNew = !_conquista.id;

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-topbar" style="margin-bottom:20px;padding:0">
        <button class="uadm-btn-back" id="btn-voltar-conquista">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Conquistas
        </button>
        <div class="uadm-editor-title">${isNew ? 'Nova Conquista' : _conquista.nome || 'Editar Conquista'}</div>
        <div></div>
      </div>

      <div class="uadm-grid-2">
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Nome da conquista *</label>
          <input class="uadm-input" id="cf-nome" type="text" placeholder='Ex: "Primeiro Passo"' value="${_esc(_conquista.nome)}">
        </div>
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Descrição</label>
          <input class="uadm-input" id="cf-desc" type="text" placeholder="Descreva o critério..." value="${_esc(_conquista.descricao || '')}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Condição</label>
          <select class="uadm-select" id="cf-cond-tipo">
            ${Object.entries(CONDICAO_LABELS).map(([v, l]) =>
              `<option value="${v}" ${_conquista.condicao_tipo === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Valor da condição</label>
          <input class="uadm-input" id="cf-cond-valor" type="number" min="1" value="${_conquista.condicao_valor}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">XP bônus ao conquistar</label>
          <input class="uadm-input" id="cf-xp-bonus" type="number" min="0" value="${_conquista.xp_bonus}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Ícone</label>
          <div class="ugam-icon-picker" id="cf-icon-picker">
            ${ICONES.map(ic => `
              <button class="ugam-icon-opt ${_conquista.icone === ic ? 'sel' : ''}" data-ico="${ic}" title="${ic}">
                ${_iconeSvg(ic)}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="cf-icone" value="${_conquista.icone}">
        </div>
      </div>

      <div class="uadm-editor-footer" style="margin-top:24px;padding:0">
        <button class="uadm-btn-ghost" id="btn-cancelar-conquista">Cancelar</button>
        <div style="display:flex;gap:10px">
          ${!isNew ? `<button class="uadm-btn-danger" id="btn-del-conquista">Excluir</button>` : ''}
          <button class="uadm-btn-primary" id="btn-salvar-conquista">
            ${isNew ? 'Criar conquista' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  `;

  body.querySelector('#btn-voltar-conquista')?.addEventListener('click', () => {
    _editView = null; _renderConquistas(body);
  });
  body.querySelector('#btn-cancelar-conquista')?.addEventListener('click', () => {
    _editView = null; _renderConquistas(body);
  });

  body.querySelectorAll('.ugam-icon-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.ugam-icon-opt').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      document.getElementById('cf-icone').value = btn.dataset.ico;
      _conquista.icone = btn.dataset.ico;
    });
  });

  body.querySelector('#btn-del-conquista')?.addEventListener('click', async () => {
    if (!confirm(`Excluir a conquista "${_conquista.nome}"?`)) return;
    await sb.from('uni_conquistas').delete().eq('id', _conquista.id);
    _conquistas = _conquistas.filter(x => x.id !== _conquista.id);
    _editView = null;
    _renderConquistas(body);
  });

  body.querySelector('#btn-salvar-conquista')?.addEventListener('click', async () => {
    const btn = body.querySelector('#btn-salvar-conquista');
    const nome = document.getElementById('cf-nome')?.value?.trim();
    if (!nome) { alert('Informe o nome da conquista.'); return; }

    btn.disabled = true; btn.textContent = 'Salvando…';

    const payload = {
      nome,
      descricao:      document.getElementById('cf-desc')?.value?.trim() || '',
      icone:          document.getElementById('cf-icone')?.value || 'star',
      condicao_tipo:  document.getElementById('cf-cond-tipo')?.value || 'cursos_concluidos',
      condicao_valor: parseInt(document.getElementById('cf-cond-valor')?.value) || 1,
      xp_bonus:       parseInt(document.getElementById('cf-xp-bonus')?.value) || 0,
      ativo:          true,
    };

    try {
      if (_conquista.id) {
        await sb.from('uni_conquistas').update(payload).eq('id', _conquista.id);
        const idx = _conquistas.findIndex(x => x.id === _conquista.id);
        if (idx >= 0) _conquistas[idx] = { ..._conquistas[idx], ...payload };
      } else {
        const { data, error } = await sb.from('uni_conquistas').insert(payload).select().single();
        if (error) throw error;
        _conquistas.push(data);
      }
      _editView = null;
      _renderConquistas(body);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false;
      btn.textContent = _conquista.id ? 'Salvar alterações' : 'Criar conquista';
    }
  });
}

// ── Tab: Prêmios ────────────────────────────────────────────────────────────
function _renderPremios(body) {
  if (_editView === 'premio') {
    _renderPremioEditor(body);
    return;
  }

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-topbar">
        <div>
          <div class="uadm-card-title">Prêmios por XP</div>
          <div class="uadm-card-sub">Cadastre prêmios vinculados a marcos de XP. O sistema notifica quando o colaborador os alcança.</div>
        </div>
        <button class="uadm-btn-primary" id="btn-novo-premio">+ Novo Prêmio</button>
      </div>

      ${_premios.length === 0 ? `
        <div class="uadm-empty" style="padding:48px 0">
          <div class="uadm-empty-title">Nenhum prêmio cadastrado</div>
          <div class="uadm-empty-sub">Crie prêmios para incentivar o engajamento</div>
        </div>
      ` : `
        <div class="ugam-premios-list">
          ${_premios.map(p => `
            <div class="ugam-premio-row ${p.ativo ? '' : 'inativo'}">
              <div class="ugam-premio-xp">
                <span class="ugam-premio-xp-val">${p.xp_necessario.toLocaleString('pt-BR')}</span>
                <span class="ugam-premio-xp-unit">XP</span>
              </div>
              <div class="ugam-premio-info">
                <div class="ugam-premio-nome">${p.nome}</div>
                ${p.descricao ? `<div class="ugam-premio-desc">${p.descricao}</div>` : ''}
              </div>
              <div class="ugam-badge-actions">
                <button class="uadm-btn-sm" data-edit-premio="${p.id}">Editar</button>
                <button class="uadm-btn-sm-ghost ugam-toggle-premio" data-pid="${p.id}" data-ativo="${p.ativo}">
                  ${p.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  body.querySelector('#btn-novo-premio')?.addEventListener('click', () => {
    _premio = _emptyPremio();
    _editView = 'premio';
    _renderPremios(body);
  });

  body.querySelectorAll('[data-edit-premio]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _premios.find(x => x.id === btn.dataset.editPremio);
      if (p) { _premio = { ...p }; _editView = 'premio'; _renderPremios(body); }
    });
  });

  body.querySelectorAll('.ugam-toggle-premio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ativo = btn.dataset.ativo === 'true';
      await sb.from('uni_premios').update({ ativo: !ativo }).eq('id', btn.dataset.pid);
      const local = _premios.find(x => x.id === btn.dataset.pid);
      if (local) local.ativo = !ativo;
      _renderPremios(body);
    });
  });
}

function _renderPremioEditor(body) {
  const isNew = !_premio.id;

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-topbar" style="margin-bottom:20px;padding:0">
        <button class="uadm-btn-back" id="btn-voltar-premio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Prêmios
        </button>
        <div class="uadm-editor-title">${isNew ? 'Novo Prêmio' : _premio.nome || 'Editar Prêmio'}</div>
        <div></div>
      </div>

      <div class="uadm-grid-2">
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Nome do prêmio *</label>
          <input class="uadm-input" id="pf-nome" type="text" placeholder='Ex: "Voucher de R$ 50"' value="${_esc(_premio.nome)}">
        </div>
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Descrição</label>
          <textarea class="uadm-textarea" id="pf-desc" rows="2" placeholder="Descreva o prêmio...">${_esc(_premio.descricao || '')}</textarea>
        </div>
        <div class="uadm-field">
          <label class="uadm-label">XP necessário para ganhar *</label>
          <div class="uadm-nota-wrap">
            <input class="uadm-input uadm-nota-input" id="pf-xp" type="number" min="1" value="${_premio.xp_necessario || ''}">
            <span class="uadm-nota-pct">XP</span>
          </div>
        </div>
      </div>

      <div class="uadm-editor-footer" style="margin-top:24px;padding:0">
        <button class="uadm-btn-ghost" id="btn-cancelar-premio">Cancelar</button>
        <div style="display:flex;gap:10px">
          ${!isNew ? `<button class="uadm-btn-danger" id="btn-del-premio">Excluir</button>` : ''}
          <button class="uadm-btn-primary" id="btn-salvar-premio">
            ${isNew ? 'Criar prêmio' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  `;

  body.querySelector('#btn-voltar-premio')?.addEventListener('click', () => {
    _editView = null; _renderPremios(body);
  });
  body.querySelector('#btn-cancelar-premio')?.addEventListener('click', () => {
    _editView = null; _renderPremios(body);
  });

  body.querySelector('#btn-del-premio')?.addEventListener('click', async () => {
    if (!confirm(`Excluir o prêmio "${_premio.nome}"?`)) return;
    await sb.from('uni_premios').delete().eq('id', _premio.id);
    _premios = _premios.filter(x => x.id !== _premio.id);
    _editView = null;
    _renderPremios(body);
  });

  body.querySelector('#btn-salvar-premio')?.addEventListener('click', async () => {
    const btn = body.querySelector('#btn-salvar-premio');
    const nome = document.getElementById('pf-nome')?.value?.trim();
    const xp   = parseInt(document.getElementById('pf-xp')?.value);
    if (!nome) { alert('Informe o nome do prêmio.'); return; }
    if (!xp || xp < 1) { alert('Informe o XP necessário.'); return; }

    btn.disabled = true; btn.textContent = 'Salvando…';

    const payload = {
      nome,
      descricao: document.getElementById('pf-desc')?.value?.trim() || '',
      xp_necessario: xp,
      ativo: true,
    };

    try {
      if (_premio.id) {
        await sb.from('uni_premios').update(payload).eq('id', _premio.id);
        const idx = _premios.findIndex(x => x.id === _premio.id);
        if (idx >= 0) _premios[idx] = { ..._premios[idx], ...payload };
      } else {
        const { data, error } = await sb.from('uni_premios').insert(payload).select().single();
        if (error) throw error;
        _premios.push(data);
        _premios.sort((a, b) => a.xp_necessario - b.xp_necessario);
      }
      _editView = null;
      _renderPremios(body);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false;
      btn.textContent = _premio.id ? 'Salvar alterações' : 'Criar prêmio';
    }
  });
}

// ── Ícones SVG ─────────────────────────────────────────────────────────────
function _iconeSvg(icone) {
  const paths = {
    star:   '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/>',
    medal:  '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
    zap:    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    book:   '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    check:  '<polyline points="20 6 9 17 4 12"/>',
    fire:   '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-7 7c-1.53 0-2.94-.55-4-1.46A5 5 0 018.5 14.5z"/>',
    crown:  '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM3 20h18"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    heart:  '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  };
  const p = paths[icone] || paths.star;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="20" height="20">${p}</svg>`;
}

// ── Utils ──────────────────────────────────────────────────────────────────
function _spinner() {
  return `<div style="display:flex;align-items:center;justify-content:center;height:60vh">
    <div style="width:24px;height:24px;border:2px solid #1e1e1e;border-top-color:var(--red);border-radius:50%;animation:uni-spin .7s linear infinite"></div>
  </div>`;
}
function _esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
