// Tab "Níveis": nomes e faixas de XP por nível de progressão.
// ⚠ O último nível tem o campo xp_max desabilitado de propósito ("Sem
// limite") — o valor vazio vira null no save e significa infinito.
import { updNivel } from '../../services/uni-gam-svc.js';
import { G, esc } from './ugam-core.js';

export function renderNiveis(body) {
  body.innerHTML = `
    <div class="uadm-card ugam-card-wide">
      <div class="uadm-card-title">Níveis de Progressão</div>
      <div class="uadm-card-sub">Configure os nomes e faixas de XP para cada nível. Elas são ordenadas automaticamente.</div>

      <div class="ugam-niveis-list" id="ugam-niveis-list">
        ${G.niveis.map((n, i) => `
          <div class="ugam-nivel-row" data-nid="${n.id}">
            <div class="ugam-nivel-ordem">${i + 1}</div>
            <input class="uadm-input ugam-nivel-nome" type="text"
                   placeholder="Nome do nível" value="${esc(n.nome)}" data-nid="${n.id}" data-field="nome">
            <div class="ugam-nivel-range">
              <input class="uadm-input ugam-nivel-xp" type="number" min="0"
                     placeholder="XP mín" value="${n.xp_min}" data-nid="${n.id}" data-field="xp_min">
              <span class="ugam-nivel-sep">→</span>
              <input class="uadm-input ugam-nivel-xp" type="number" min="0"
                     placeholder="${i === G.niveis.length - 1 ? '∞' : 'XP máx'}"
                     value="${n.xp_max ?? ''}" data-nid="${n.id}" data-field="xp_max"
                     ${i === G.niveis.length - 1 ? 'disabled placeholder="Sem limite"' : ''}>
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
      for (const n of G.niveis) {
        const nomeEl   = body.querySelector(`input[data-nid="${n.id}"][data-field="nome"]`);
        const xpMinEl  = body.querySelector(`input[data-nid="${n.id}"][data-field="xp_min"]`);
        const xpMaxEl  = body.querySelector(`input[data-nid="${n.id}"][data-field="xp_max"]`);
        const nome     = nomeEl?.value?.trim() || n.nome;
        const xp_min   = parseInt(xpMinEl?.value) || 0;
        const xp_max   = xpMaxEl?.value ? parseInt(xpMaxEl.value) : null;
        await updNivel(n.id, { nome, xp_min, xp_max });
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
