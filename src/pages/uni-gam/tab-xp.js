// Tab "Configurar XP": pontuação por ação da plataforma.
import { updXP } from '../../services/uni-gam-svc.js';
import { G } from './ugam-core.js';

export function renderXP(body) {
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
        ${G.xpConfig.map(row => {
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
        await updXP(u.acao, u.xp);
        const local = G.xpConfig.find(r => r.acao === u.acao);
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
