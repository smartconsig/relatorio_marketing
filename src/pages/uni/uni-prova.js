// Prova final: seção de status no detalhe do curso (5 estados), formulário,
// correção client-side, XP e emissão do certificado.
import {
  fetchProvaComQuestoes, fetchPrimeiraTentativa, insertTentativa,
  insertXpLog, upsertCertificado,
} from '../../services/uni-svc.js';
import { UV, ICONS, svg, renderComingSoon, spinnerHTML } from './uni-core.js';
import { uniVerCertificado } from './uni-certificado.js';

// ── Os 5 estados da seção de prova (um template por estado) ────────────────
function _provaAprovadaHTML(prova, ultimaTentativa, certificado) {
  return `
      <div class="uni-prova-section uni-prova-aprovado">
        <div class="uni-prova-icon">🏆</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Prova concluída — Aprovado!</div>
          <div class="uni-prova-sub">Nota: ${ultimaTentativa?.nota ?? '—'}% · ${prova.tem_certificado ? 'Certificado disponível' : 'Parabéns!'}</div>
        </div>
        ${prova.tem_certificado && certificado ? `
          <button class="uni-btn-primary" style="background:#4ade80;color:#000;flex-shrink:0"
                  onclick="uniVerCertificado('${certificado.id}')">
            Ver certificado
          </button>
        ` : ''}
      </div>
    `;
}

function _provaBloqueadaHTML(totalAulas) {
  return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">📝</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Prova disponível ao concluir o curso</div>
          <div class="uni-prova-sub">Complete todas as ${totalAulas} aulas para desbloquear a prova final.</div>
        </div>
      </div>
    `;
}

function _provaCooldownHTML(prova, ultimaTentativa) {
  const diasRestantes = Math.ceil(prova.dias_para_retry - (Date.now() - new Date(ultimaTentativa.criado_em).getTime()) / 86400000);
  return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">⏳</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Aguarde para tentar novamente</div>
          <div class="uni-prova-sub">Última nota: ${ultimaTentativa.nota}% · Nova tentativa em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
}

function _provaEsgotadaHTML(prova) {
  return `
      <div class="uni-prova-section uni-prova-bloqueada">
        <div class="uni-prova-icon">❌</div>
        <div class="uni-prova-info">
          <div class="uni-prova-titulo">Limite de tentativas atingido</div>
          <div class="uni-prova-sub">Você usou todas as ${prova.max_tentativas} tentativas. Entre em contato com seu gestor.</div>
        </div>
      </div>
    `;
}

function _provaDisponivelHTML(prova, numTentativas, ultimaTentativa) {
  const labelBtn = numTentativas === 0 ? 'Fazer prova final' : `Tentar novamente (${numTentativas}/${prova.max_tentativas})`;
  const subText  = numTentativas > 0
    ? `Última nota: ${ultimaTentativa.nota}% · Mínimo para passar: ${prova.nota_minima}%`
    : `Nota mínima: ${prova.nota_minima}% · ${prova.max_tentativas} tentativa${prova.max_tentativas !== 1 ? 's' : ''}`;

  return `
    <div class="uni-prova-section uni-prova-disponivel">
      <div class="uni-prova-icon">📝</div>
      <div class="uni-prova-info">
        <div class="uni-prova-titulo">Prova final disponível</div>
        <div class="uni-prova-sub">${subText}</div>
      </div>
      <button class="uni-btn-primary" style="flex-shrink:0" onclick="uniStartProva('${prova.id}')">
        ${svg(ICONS.play, 13, 13, 'fill="currentColor" stroke="none"')} ${labelBtn}
      </button>
    </div>
  `;
}

// Cooldown (dias_para_retry): bloqueia nova tentativa por N dias após reprovar.
function _estaEmCooldown(prova, jaPassou, ultimaTentativa) {
  if (jaPassou || !ultimaTentativa || !(prova.dias_para_retry > 0)) return false;
  const diasPassados = (Date.now() - new Date(ultimaTentativa.criado_em).getTime()) / 86400000;
  return diasPassados < prova.dias_para_retry;
}

/**
 * Seção de status da prova no detalhe do curso.
 * `progresso` = { concluidas, totalAulas } (agrupado para caber no teto de parâmetros).
 */
export function provaSection(prova, tentativas, certificado, progresso) {
  const { concluidas, totalAulas } = progresso;
  const todasConcluidas = totalAulas > 0 && concluidas >= totalAulas;
  const jaPassou        = tentativas.some(t => t.aprovado);
  const ultimaTentativa = tentativas[0] || null;
  const numTentativas   = tentativas.length;
  const podeRefazer     = !jaPassou && numTentativas < prova.max_tentativas;
  const emCooldown      = _estaEmCooldown(prova, jaPassou, ultimaTentativa);

  if (jaPassou)         return _provaAprovadaHTML(prova, ultimaTentativa, certificado);
  if (!todasConcluidas) return _provaBloqueadaHTML(totalAulas);
  if (emCooldown)       return _provaCooldownHTML(prova, ultimaTentativa);
  if (!podeRefazer && numTentativas >= prova.max_tentativas) return _provaEsgotadaHTML(prova);
  return _provaDisponivelHTML(prova, numTentativas, ultimaTentativa);
}

export async function uniStartProva(provaId) {
  const main = document.getElementById('uni-main');
  if (!main) return;
  main.innerHTML = spinnerHTML();

  try {
    const [{ data: prova }, { data: questoes }] = await fetchProvaComQuestoes(provaId);

    if (!prova || !questoes?.length) {
      main.innerHTML = renderComingSoon('default', 'Prova não encontrada', 'Esta prova ainda não possui questões cadastradas.', '');
      return;
    }

    _renderProvaView(main, prova, questoes);
  } catch (_e) {
    main.innerHTML = renderComingSoon('default', 'Erro ao carregar prova', 'Tente novamente em instantes.', '');
  }
}

function _renderProvaView(main, prova, questoes) {
  const letras = ['A', 'B', 'C', 'D'];

  main.innerHTML = `
    <div class="uni-prova-wrap">
      <div class="uni-prova-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar ao curso
        </button>
        <div class="uni-prova-topbar-title">Prova Final</div>
        <div style="width:120px"></div>
      </div>

      <div class="uni-prova-body">
        <div class="uni-prova-header">
          <div class="uni-prova-badge">📝 ${questoes.length} questões</div>
          <div class="uni-prova-nota-info">Nota mínima: <strong>${prova.nota_minima}%</strong></div>
        </div>

        <form id="uni-prova-form">
          ${questoes.map((q, qi) => `
            <div class="uni-questao-wrap" data-qi="${qi}">
              <div class="uni-questao-enunciado">
                <span class="uni-questao-num">${qi + 1}</span>
                ${q.enunciado}
              </div>
              <div class="uni-questao-alts">
                ${(Array.isArray(q.alternativas) ? q.alternativas : []).map((alt, ai) => `
                  <label class="uni-alt-label" data-qi="${qi}" data-ai="${ai}">
                    <input type="radio" name="q${qi}" value="${ai}" required>
                    <span class="uni-alt-letra">${letras[ai]}</span>
                    <span class="uni-alt-text">${alt}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}

          <div class="uni-prova-footer">
            <div class="uni-prova-footer-info">Responda todas as questões antes de enviar.</div>
            <button type="submit" class="uni-btn-primary uni-prova-submit" id="btn-enviar-prova">
              Enviar prova
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Highlight ao selecionar alternativa
  main.querySelectorAll('.uni-alt-label').forEach(lbl => {
    lbl.querySelector('input')?.addEventListener('change', () => {
      const qi = lbl.dataset.qi;
      main.querySelectorAll(`[data-qi="${qi}"]`).forEach(l => {
        if (l.classList.contains('uni-alt-label')) l.classList.remove('selecionada');
      });
      lbl.classList.add('selecionada');
    });
  });

  main.querySelector('#uni-prova-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = main.querySelector('#btn-enviar-prova');
    btn.disabled = true; btn.textContent = 'Corrigindo…';

    const respostas = questoes.map((_, qi) => {
      const sel = main.querySelector(`input[name="q${qi}"]:checked`);
      return sel ? parseInt(sel.value) : -1;
    });

    await _submitProva(main, prova, questoes, respostas);
  });
}

async function _emitirCertificado(prova) {
  if (!prova.tem_certificado || !UV.currentDetail?.curso?.id) return { certCodigo: null, certId: null };
  const { data: cert } = await upsertCertificado(UV.userId, UV.currentDetail.curso.id);
  return { certCodigo: cert?.codigo || null, certId: cert?.id || null };
}

// XP de aprovação + emissão do certificado; devolve o que foi concedido.
async function _processarAprovacao(prova, nota, primeiraT) {
  const xpBase = primeiraT ? 50 : 0;
  const xpMax  = nota === 100 ? 30 : 0;

  if (xpBase > 0) await insertXpLog({ user_id: UV.userId, tipo: 'prova_primeira_tentativa', referencia_id: prova.id, xp: xpBase });
  if (xpMax  > 0) await insertXpLog({ user_id: UV.userId, tipo: 'prova_nota_maxima',        referencia_id: prova.id, xp: xpMax });

  const { certCodigo, certId } = await _emitirCertificado(prova);
  return { xpBase, xpMax, certCodigo, certId };
}

async function _submitProva(main, prova, questoes, respostas) {
  const acertos   = questoes.filter((q, i) => respostas[i] === q.correta).length;
  const nota      = Math.round((acertos / questoes.length) * 100);
  const aprovado  = nota >= prova.nota_minima;
  const primeiraT = !UV.userId ? false : !(await fetchPrimeiraTentativa(prova.id, UV.userId)).data?.length;
  const base      = { nota, acertos, total: questoes.length, prova };

  try {
    if (!UV.userId) return;
    await insertTentativa({
      user_id: UV.userId, prova_id: prova.id,
      nota, aprovado, respostas,
    });

    if (aprovado) {
      const premios = await _processarAprovacao(prova, nota, primeiraT);
      _renderProvaResultado(main, { aprovado: true, ...base, primeiraT, ...premios });
    } else {
      _renderProvaResultado(main, { aprovado: false, ...base });
    }
  } catch (err) {
    console.error(err);
    _renderProvaResultado(main, { aprovado, ...base, erro: true });
  }
}

function _xpPillsHTML(aprovado, xpBase, xpMax) {
  if (!aprovado || xpBase + xpMax <= 0) return '';
  return `
            <div class="uni-resultado-xp">
              ${xpBase > 0 ? `<span class="uni-xp-pill">+${xpBase} XP — Aprovado na prova</span>` : ''}
              ${xpMax  > 0 ? `<span class="uni-xp-pill">+${xpMax} XP — Nota máxima!</span>` : ''}
            </div>
          `;
}

function _certificadoHTML(aprovado, certCodigo, certId) {
  if (!aprovado || !certId) return '';
  return `
            <div class="uni-resultado-cert">
              <div class="uni-resultado-cert-label">🎓 Certificado emitido!</div>
              <div class="uni-resultado-cert-code">Código: <strong>${certCodigo}</strong></div>
            </div>
            <button class="uni-btn-primary" style="width:100%;background:#4ade80;color:#000"
                    onclick="uniVerCertificado('${certId}')">
              🎓 Ver meu certificado
            </button>
          `;
}

function _dicaReprovadoHTML(aprovado, prova) {
  if (aprovado) return '';
  return `
            <div class="uni-resultado-dica">
              Mínimo para aprovação: <strong>${prova.nota_minima}%</strong><br>
              ${prova.dias_para_retry > 0 ? `Você poderá tentar novamente em <strong>${prova.dias_para_retry} dia${prova.dias_para_retry !== 1 ? 's' : ''}</strong>.` : 'Você pode tentar novamente a qualquer momento.'}
            </div>
          `;
}

function _renderProvaResultado(main, { aprovado, nota, acertos, total, prova, xpBase = 0, xpMax = 0, certCodigo, certId }) {
  main.innerHTML = `
    <div class="uni-prova-wrap">
      <div class="uni-prova-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar ao curso
        </button>
        <div class="uni-prova-topbar-title">Resultado da Prova</div>
        <div style="width:120px"></div>
      </div>

      <div class="uni-resultado-body">
        <div class="uni-resultado-card">
          <div class="uni-resultado-icon">${aprovado ? '🏆' : '📖'}</div>
          <div class="uni-resultado-status ${aprovado ? 'aprovado' : 'reprovado'}">
            ${aprovado ? 'Aprovado!' : 'Não aprovado'}
          </div>
          <div class="uni-resultado-nota">${nota}<span class="uni-resultado-pct">%</span></div>
          <div class="uni-resultado-detalhe">${acertos} de ${total} questões corretas</div>

          ${_xpPillsHTML(aprovado, xpBase, xpMax)}

          ${_certificadoHTML(aprovado, certCodigo, certId)}

          ${_dicaReprovadoHTML(aprovado, prova)}

          <button class="uni-btn-ghost" style="margin-top:8px;width:100%" onclick="uniGoBack()">
            Voltar ao curso
          </button>
        </div>
      </div>
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Abre o certificado automaticamente quando aprovada
  if (aprovado && certId) {
    setTimeout(() => uniVerCertificado(certId), 800);
  }
}
