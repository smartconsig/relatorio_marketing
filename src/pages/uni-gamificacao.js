// ── Universidade Smart — Gamificação (orquestrador) ───────────────────────
// Página de configuração de regras. As tabs vivem em src/pages/uni-gam/:
//   ugam-core.js      estado compartilhado (G) + factories + helpers
//   tab-xp.js         pontuação por ação
//   tab-niveis.js     níveis de progressão (último nível = sem limite)
//   tab-conquistas.js badges: lista + editor inline (mesmo módulo, recursão)
//   tab-premios.js    prêmios por XP: lista + editor inline
// Acesso a dados em services/uni-gam-svc.js. Export público:
// renderUniGamificacao(container).
import { fetchGamificacao } from '../services/uni-gam-svc.js';
import { G, spinner } from './uni-gam/ugam-core.js';
import { renderXP } from './uni-gam/tab-xp.js';
import { renderNiveis } from './uni-gam/tab-niveis.js';
import { renderConquistas } from './uni-gam/tab-conquistas.js';
import { renderPremios } from './uni-gam/tab-premios.js';

export async function renderUniGamificacao(container) {
  const el = container || document.getElementById('sec-uni-gamificacao');
  if (!el) return;
  el.innerHTML = spinner();
  await _loadAll();
  _render(el);
}

async function _loadAll() {
  const [r1, r2, r3, r4] = await fetchGamificacao();
  G.xpConfig   = r1.data || [];
  G.niveis     = r2.data || [];
  G.conquistas = r3.data || [];
  G.premios    = r4.data || [];
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
          <button class="ugam-tab ${G.tab === id ? 'active' : ''}" data-tab="${id}">
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
      G.tab = btn.dataset.tab;
      G.editView = null;
      el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === G.tab));
      _renderTabBody(document.getElementById('ugam-body'));
    });
  });

  _renderTabBody(document.getElementById('ugam-body'));
}

function _renderTabBody(body) {
  if (!body) return;
  if (G.tab === 'xp')         renderXP(body);
  else if (G.tab === 'niveis')     renderNiveis(body);
  else if (G.tab === 'conquistas') renderConquistas(body);
  else if (G.tab === 'premios')    renderPremios(body);
}
