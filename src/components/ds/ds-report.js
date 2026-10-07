// Design system RYC — relatório de importação (modelo único para planilha,
// lote ZIP, respaldo, pendências e acerto). Três momentos na mesma janela:
//   1. Conferência: resumo em números + listas por motivo. NADA foi gravado ainda.
//   2. Gravação: barra de progresso ("Gravando 55 de 88…"), sem poder fechar.
//   3. Resultado: quantos gravaram e QUAIS falharam (para refazer só esses).
import { esc } from './ds-html.js';
import { _dsJanela } from './ds-modal.js';

const _resumo = itens => '<div class="ds-sum">' + itens.map(i =>
  `<div class="is-${i.tone || 'ok'}"><b>${i.n}</b><span>${esc(i.label)}</span></div>`).join('') + '</div>';

const _linha = it => `<div><span>${esc(it.titulo)}</span><small>${esc(it.detalhe || '')}</small></div>`;

const _grupo = g => !g.itens.length ? '' :
  `<details class="ds-group"${g.aberto ? ' open' : ''}><summary>${esc(g.label)} <span class="ds-chip__n">${g.itens.length}</span></summary>`
  + `<div class="ds-list">${g.itens.map(_linha).join('')}</div></details>`;

function _telaProgresso(box) {
  box.querySelector('.ds-modal__body').innerHTML =
    '<div class="ds-progress"><i data-ds-bar></i></div><div class="ds-hint" data-ds-prog>Preparando…</div>';
  box.querySelectorAll('[data-ds-close], [data-ds-ok]').forEach(b => { b.disabled = true; });
  return (feitos, total, rotulo = 'Gravando') => {
    box.querySelector('[data-ds-bar]').style.width = (total ? Math.round(feitos / total * 100) : 0) + '%';
    box.querySelector('[data-ds-prog]').textContent = `${rotulo} ${feitos} de ${total}…`;
  };
}

function _telaResultado(box, { gravados, falhas, rotuloOk }) {
  box.querySelector('.ds-modal__body').innerHTML =
    _resumo([{ n: gravados, label: rotuloOk, tone: 'ok' }, { n: falhas.length, label: 'falharam', tone: falhas.length ? 'bad' : 'ok' }])
    + _grupo({ label: 'Não foram gravados. Tente de novo só estes', itens: falhas, aberto: true });
  const foot = box.querySelector('.ds-modal__foot');
  foot.innerHTML = '<button type="button" class="ds-btn ds-btn--primary" data-ds-fim>Fechar</button>';
  return foot.querySelector('[data-ds-fim]');
}

/**
 * opts: { eyebrow, title, sub?, resumo:[{n,label,tone}], grupos:[{label,itens:[{titulo,detalhe}],aberto?}],
 *         okLabel, rotuloOk?: 'gravados', gravar: async (progresso) => ({ gravados, falhas:[{titulo,detalhe}] }) }
 * Se não houver nada para gravar, passe okLabel = null: só mostra a conferência com "Fechar".
 * Resolve com { gravou: false } (cancelou) ou { gravou: true, gravados, falhas }.
 */
export function dsImportReport({ resumo = [], grupos = [], gravar, okLabel, rotuloOk = 'gravados', ...janela }) {
  return new Promise(resolve => {
    const corpo = _resumo(resumo) + grupos.map(_grupo).join('');
    const box = _dsJanela.abrir({ wide: true, okLabel: okLabel || 'Fechar', cancelLabel: 'Cancelar', ...janela, corpo });
    const sair = v => { _dsJanela.fechar(); resolve(v); };
    _dsJanela.setFechar(() => sair({ gravou: false }));
    box.querySelectorAll('[data-ds-close]').forEach(b => b.addEventListener('click', () => sair({ gravou: false })));
    box.querySelector('[data-ds-ok]').addEventListener('click', async () => {
      if (!okLabel) return sair({ gravou: false });
      _dsJanela.setFechar(null);
      const progresso = _telaProgresso(box);
      let r;
      try { r = await gravar(progresso); } catch (e) {
        r = { gravados: 0, falhas: [{ titulo: 'A gravação parou no meio', detalhe: e?.message || 'erro desconhecido' }] };
      }
      const falhas = r?.falhas || [];
      const fim = _telaResultado(box, { gravados: r?.gravados ?? 0, falhas, rotuloOk });
      _dsJanela.setFechar(() => sair({ gravou: true, ...r }));
      fim.addEventListener('click', () => sair({ gravou: true, gravados: r?.gravados ?? 0, falhas }));
    });
  });
}
