// Tab "Conquistas": lista de badges + editor inline. Lista e editor ficam
// no MESMO módulo de propósito — eles se chamam mutuamente (recursão de
// re-render) e separá-los criaria import circular.
import { updConquista, insConquista, delConquista } from '../../services/uni-gam-svc.js';
import { G, emptyConquista, esc } from './ugam-core.js';

const CONDICAO_LABELS = {
  cursos_concluidos: 'Cursos concluídos',
  cursos_mes:        'Cursos em um mês',
  nota_maxima:       'Nota máxima na prova',
  xp_total:         'XP total acumulado',
  livros_lidos:      'Livros lidos',
  primeira_aula:     'Primeira aula concluída',
};

const ICONES = ['star','trophy','medal','zap','book','check','fire','crown','rocket','heart'];

export function renderConquistas(body) {
  if (G.editView === 'conquista') {
    _renderConquistaEditor(body);
    return;
  }

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-topbar">
        <div>
          <div class="uadm-card-title">Conquistas / Badges</div>
          <div class="uadm-card-sub">${G.conquistas.length} conquista${G.conquistas.length !== 1 ? 's' : ''} cadastrada${G.conquistas.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="uadm-btn-primary" id="btn-nova-conquista">+ Nova Conquista</button>
      </div>

      ${G.conquistas.length === 0 ? `
        <div class="uadm-empty" style="padding:48px 0">
          <div class="uadm-empty-title">Nenhuma conquista criada</div>
          <div class="uadm-empty-sub">Crie badges para motivar os colaboradores</div>
        </div>
      ` : `
        <div class="ugam-cards-grid">
          ${G.conquistas.map(c => `
            <div class="ugam-badge-card ${c.ativo ? '' : 'inativo'}">
              <div class="ugam-badge-icon">${iconeSvg(c.icone)}</div>
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
    G.conquista = emptyConquista();
    G.editView = 'conquista';
    renderConquistas(body);
  });

  body.querySelectorAll('[data-edit-conquista]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = G.conquistas.find(x => x.id === btn.dataset.editConquista);
      if (c) { G.conquista = { ...c }; G.editView = 'conquista'; renderConquistas(body); }
    });
  });

  body.querySelectorAll('.ugam-toggle-ativo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ativo = btn.dataset.ativo === 'true';
      await updConquista(btn.dataset.cid, { ativo: !ativo });
      const local = G.conquistas.find(x => x.id === btn.dataset.cid);
      if (local) local.ativo = !ativo;
      renderConquistas(body);
    });
  });
}

function _renderConquistaEditor(body) {
  const isNew = !G.conquista.id;

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-topbar" style="margin-bottom:20px;padding:0">
        <button class="uadm-btn-back" id="btn-voltar-conquista">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Conquistas
        </button>
        <div class="uadm-editor-title">${isNew ? 'Nova Conquista' : G.conquista.nome || 'Editar Conquista'}</div>
        <div></div>
      </div>

      <div class="uadm-grid-2">
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Nome da conquista *</label>
          <input class="uadm-input" id="cf-nome" type="text" placeholder='Ex: "Primeiro Passo"' value="${esc(G.conquista.nome)}">
        </div>
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Descrição</label>
          <input class="uadm-input" id="cf-desc" type="text" placeholder="Descreva o critério..." value="${esc(G.conquista.descricao || '')}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Condição</label>
          <select class="uadm-select" id="cf-cond-tipo">
            ${Object.entries(CONDICAO_LABELS).map(([v, l]) =>
              `<option value="${v}" ${G.conquista.condicao_tipo === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Valor da condição</label>
          <input class="uadm-input" id="cf-cond-valor" type="number" min="1" value="${G.conquista.condicao_valor}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">XP bônus ao conquistar</label>
          <input class="uadm-input" id="cf-xp-bonus" type="number" min="0" value="${G.conquista.xp_bonus}">
        </div>
        <div class="uadm-field">
          <label class="uadm-label">Ícone</label>
          <div class="ugam-icon-picker" id="cf-icon-picker">
            ${ICONES.map(ic => `
              <button class="ugam-icon-opt ${G.conquista.icone === ic ? 'sel' : ''}" data-ico="${ic}" title="${ic}">
                ${iconeSvg(ic)}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="cf-icone" value="${G.conquista.icone}">
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
    G.editView = null; renderConquistas(body);
  });
  body.querySelector('#btn-cancelar-conquista')?.addEventListener('click', () => {
    G.editView = null; renderConquistas(body);
  });

  body.querySelectorAll('.ugam-icon-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.ugam-icon-opt').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      document.getElementById('cf-icone').value = btn.dataset.ico;
      G.conquista.icone = btn.dataset.ico;
    });
  });

  body.querySelector('#btn-del-conquista')?.addEventListener('click', async () => {
    if (!confirm(`Excluir a conquista "${G.conquista.nome}"?`)) return;
    await delConquista(G.conquista.id);
    G.conquistas = G.conquistas.filter(x => x.id !== G.conquista.id);
    G.editView = null;
    renderConquistas(body);
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
      if (G.conquista.id) {
        await updConquista(G.conquista.id, payload);
        const idx = G.conquistas.findIndex(x => x.id === G.conquista.id);
        if (idx >= 0) G.conquistas[idx] = { ...G.conquistas[idx], ...payload };
      } else {
        const { data, error } = await insConquista(payload);
        if (error) throw error;
        G.conquistas.push(data);
      }
      G.editView = null;
      renderConquistas(body);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false;
      btn.textContent = G.conquista.id ? 'Salvar alterações' : 'Criar conquista';
    }
  });
}

// ── Ícones SVG ─────────────────────────────────────────────────────────────
export function iconeSvg(icone) {
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
