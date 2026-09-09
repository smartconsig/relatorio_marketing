// Tab "Prêmios": lista de prêmios por marco de XP + editor inline. Lista e
// editor ficam no MESMO módulo de propósito (recursão de re-render).
import { updPremio, insPremio, delPremio } from '../../services/uni-gam-svc.js';
import { G, emptyPremio, esc } from './ugam-core.js';

export function renderPremios(body) {
  if (G.editView === 'premio') {
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

      ${G.premios.length === 0 ? `
        <div class="uadm-empty" style="padding:48px 0">
          <div class="uadm-empty-title">Nenhum prêmio cadastrado</div>
          <div class="uadm-empty-sub">Crie prêmios para incentivar o engajamento</div>
        </div>
      ` : `
        <div class="ugam-premios-list">
          ${G.premios.map(p => `
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
    G.premio = emptyPremio();
    G.editView = 'premio';
    renderPremios(body);
  });

  body.querySelectorAll('[data-edit-premio]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = G.premios.find(x => x.id === btn.dataset.editPremio);
      if (p) { G.premio = { ...p }; G.editView = 'premio'; renderPremios(body); }
    });
  });

  body.querySelectorAll('.ugam-toggle-premio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ativo = btn.dataset.ativo === 'true';
      await updPremio(btn.dataset.pid, { ativo: !ativo });
      const local = G.premios.find(x => x.id === btn.dataset.pid);
      if (local) local.ativo = !ativo;
      renderPremios(body);
    });
  });
}

function _renderPremioEditor(body) {
  const isNew = !G.premio.id;

  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-topbar" style="margin-bottom:20px;padding:0">
        <button class="uadm-btn-back" id="btn-voltar-premio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Prêmios
        </button>
        <div class="uadm-editor-title">${isNew ? 'Novo Prêmio' : G.premio.nome || 'Editar Prêmio'}</div>
        <div></div>
      </div>

      <div class="uadm-grid-2">
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Nome do prêmio *</label>
          <input class="uadm-input" id="pf-nome" type="text" placeholder='Ex: "Voucher de R$ 50"' value="${esc(G.premio.nome)}">
        </div>
        <div class="uadm-field uadm-col-2">
          <label class="uadm-label">Descrição</label>
          <textarea class="uadm-textarea" id="pf-desc" rows="2" placeholder="Descreva o prêmio...">${esc(G.premio.descricao || '')}</textarea>
        </div>
        <div class="uadm-field">
          <label class="uadm-label">XP necessário para ganhar *</label>
          <div class="uadm-nota-wrap">
            <input class="uadm-input uadm-nota-input" id="pf-xp" type="number" min="1" value="${G.premio.xp_necessario || ''}">
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
    G.editView = null; renderPremios(body);
  });
  body.querySelector('#btn-cancelar-premio')?.addEventListener('click', () => {
    G.editView = null; renderPremios(body);
  });

  body.querySelector('#btn-del-premio')?.addEventListener('click', async () => {
    if (!confirm(`Excluir o prêmio "${G.premio.nome}"?`)) return;
    await delPremio(G.premio.id);
    G.premios = G.premios.filter(x => x.id !== G.premio.id);
    G.editView = null;
    renderPremios(body);
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
      await _persistirPremio(payload);
      G.editView = null;
      renderPremios(body);
    } catch (err) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      btn.disabled = false;
      btn.textContent = G.premio.id ? 'Salvar alterações' : 'Criar prêmio';
    }
  });
}

async function _persistirPremio(payload) {
  if (G.premio.id) {
    await updPremio(G.premio.id, payload);
    const idx = G.premios.findIndex(x => x.id === G.premio.id);
    if (idx >= 0) G.premios[idx] = { ...G.premios[idx], ...payload };
    return;
  }
  const { data, error } = await insPremio(payload);
  if (error) throw error;
  G.premios.push(data);
  G.premios.sort((a, b) => a.xp_necessario - b.xp_necessario);
}
