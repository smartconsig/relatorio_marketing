// Quiz builder do editor de curso: questões com 4 alternativas; clicar na
// alternativa correta a marca.
import { U, esc } from './uadm-core.js';

export function syncQuestoesUI() {
  const wrap = document.getElementById('uadm-questoes-wrap');
  if (!wrap) return;

  const cnt = document.getElementById('uadm-questoes-count');
  if (cnt) cnt.textContent = `${U.questoes.length} questão${U.questoes.length !== 1 ? 'ões' : ''}`;

  if (U.questoes.length === 0) {
    wrap.innerHTML = `<div class="uadm-modulos-empty">Nenhuma questão. Clique em "+ Adicionar questão" para começar.</div>`;
    return;
  }

  wrap.innerHTML = U.questoes.map((q, qi) => `
    <div class="uadm-questao" data-qkey="${q._key}">
      <div class="uadm-questao-head">
        <span class="uadm-questao-num">Questão ${qi + 1}</span>
        <button class="uadm-btn-icon-danger" data-rm-questao="${q._key}" title="Remover questão">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <textarea class="uadm-textarea uadm-questao-enunciado" rows="2"
                placeholder="Digite o enunciado da questão..."
                data-qkey="${q._key}" data-qfield="enunciado">${esc(q.enunciado)}</textarea>
      <div class="uadm-alternativas">
        ${['A', 'B', 'C', 'D'].map((letra, i) => `
          <div class="uadm-alt-row ${q.correta === i ? 'correta' : ''}" data-qkey="${q._key}" data-alt-idx="${i}">
            <span class="uadm-alt-letra ${q.correta === i ? 'correta' : ''}">${letra}</span>
            <input class="uadm-input uadm-alt-input" type="text"
                   placeholder="Alternativa ${letra}..."
                   value="${esc(q.alternativas[i] || '')}"
                   data-qkey="${q._key}" data-qfield="alternativa" data-alt-i="${i}">
            <button class="uadm-alt-check ${q.correta === i ? 'correta' : ''}"
                    data-qkey="${q._key}" data-set-correta="${i}" title="Marcar como correta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  _attachQuestoesListeners(wrap);
}

function _attachQuestoesListeners(wrap) {
  wrap.querySelectorAll('[data-rm-questao]').forEach(btn => {
    btn.addEventListener('click', () => {
      const qkey = btn.dataset.rmQuestao;
      const q = U.questoes.find(x => x._key === qkey);
      if (q?.id) U.deletes.questoes.push(q.id);
      U.questoes = U.questoes.filter(x => x._key !== qkey);
      U.questoes.forEach((x, i) => { x.ordem = i + 1; });
      syncQuestoesUI();
    });
  });

  wrap.querySelectorAll('[data-qfield="enunciado"]').forEach(ta => {
    ta.addEventListener('input', () => {
      const q = U.questoes.find(x => x._key === ta.dataset.qkey);
      if (q) q.enunciado = ta.value;
    });
  });

  wrap.querySelectorAll('[data-qfield="alternativa"]').forEach(input => {
    input.addEventListener('input', () => {
      const q = U.questoes.find(x => x._key === input.dataset.qkey);
      if (q) q.alternativas[parseInt(input.dataset.altI)] = input.value;
    });
  });

  wrap.querySelectorAll('[data-set-correta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = U.questoes.find(x => x._key === btn.dataset.qkey);
      if (q) {
        q.correta = parseInt(btn.dataset.setCorreta);
        syncQuestoesUI();
      }
    });
  });
}
