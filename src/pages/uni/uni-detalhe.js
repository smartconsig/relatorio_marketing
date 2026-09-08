// Detalhe do curso: carga assíncrona (curso + módulos + aulas + prova +
// tentativas/certificado), render e cliques nas aulas. O clique na aula toca
// via callback injetado (onPlayAula) — este módulo nunca importa o roteador.
import { fetchCursoDetalhe, fetchTentativasECertificado } from '../../services/uni-svc.js';
import { UV, NIVEL_LABEL, NIVEL_CLASS, fmtDur, ICONS, svg, renderComingSoon, spinnerHTML } from './uni-core.js';
import { provaSection } from './uni-prova.js';

// Callback registrado pelo orquestrador (uniPlayAula)
let _onPlayAula = () => {};
export function onPlayAula(fn) { _onPlayAula = fn; }

export async function renderDetailAsync(main, courseId) {
  main.innerHTML = spinnerHTML();

  try {
      const [{ data: curso }, { data: modulos }, { data: aulas }, { data: prova }] = await fetchCursoDetalhe(courseId);

      if (!curso) { main.innerHTML = renderComingSoon('default', 'Curso não encontrado', '', ''); return; }

      const modulosComAulas = (modulos || []).map(m => ({
        ...m,
        aulas: (aulas || []).filter(a => a.modulo_id === m.id),
      }));

      let tentativas = [], certificado = null;
      if (prova && UV.userId) {
        const [{ data: t }, { data: c }] = await fetchTentativasECertificado(prova.id, UV.userId, courseId);
        tentativas  = t || [];
        certificado = c || null;
      }

      UV.currentDetail = {
        curso,
        modulos: modulosComAulas,
        aulas: aulas || [],
        prova: prova || null,
        tentativas,
        certificado,
      };
      main.innerHTML = _renderDetailHTML(UV.currentDetail);
  } catch (_e) {
    main.innerHTML = renderComingSoon('default', 'Erro ao carregar o curso', 'Tente novamente em instantes', '');
  }

  main.scrollTo({ top: 0, behavior: 'instant' });
  _attachDetailListeners(main);
}

function _renderDetailHTML({ curso, modulos, aulas, prova, tentativas, certificado }) {
  const trilhaCor  = curso.uni_trilhas?.cor || '#E02020';
  const trilhaNome = curso.uni_trilhas?.nome || '';
  const img        = curso.hero_img || curso.capa_url || curso.img || '';
  const nivel      = curso.nivel || 'basico';
  const totalAulas = aulas.length || curso.total_aulas || 0;
  const totalMin   = curso.duracao_minutos || 0;

  const concluidas = aulas.filter(a => UV.progrAulas[a.id]).length;
  const pct        = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;

  // Barra de progresso geral do curso
  const progressBar = totalAulas > 0 ? `
    <div class="uni-detail-progress">
      <div class="uni-detail-progress-label">
        <span>${concluidas} de ${totalAulas} aulas concluídas</span>
        <span style="color:${trilhaCor};font-weight:700">${pct}%</span>
      </div>
      <div class="uni-detail-progress-track">
        <div class="uni-detail-progress-fill" style="width:${pct}%;background:${trilhaCor}"></div>
      </div>
    </div>
  ` : '';

  // Primeira aula incompleta (para botão Continuar)
  const primeiraAula = aulas.find(a => !UV.progrAulas[a.id]) || aulas[0];

  const btnLabel   = concluidas > 0 ? 'Continuar' : 'Começar curso';
  // ⚠ código-em-string: uniPlayAula PRECISA continuar global (main.js)
  const btnOnClick = primeiraAula ? `uniPlayAula('${primeiraAula.id}')` : '';

  // Módulos e aulas
  let aulaNum = 0;
  const modulosHtml = modulos.map(m => {
    const mAulas = m.aulas || [];
    return `
      <div class="uni-modulo-item">
        <div class="uni-modulo-header">
          <span>${m.titulo}</span>
          <span style="font-size:11px;color:#555;font-weight:400">${mAulas.length} aulas</span>
        </div>
        <div class="uni-modulo-aulas">
          ${mAulas.map(a => {
            aulaNum++;
            const concluida = !!UV.progrAulas[a.id];
            const temVideo  = !!a.bunny_video_id;
            const durSec    = a.duracao_segundos || 0;
            const durStr    = durSec ? fmtDur(Math.round(durSec / 60)) : '—';

            return `
              <div class="uni-aula-item ${concluida ? 'uni-aula-concluida' : ''} uni-aula-clicavel"
                   data-aula-id="${a.id}">
                <span class="uni-aula-num">${aulaNum}</span>
                ${concluida
                  ? svg(ICONS.check, 12, 12, 'class="uni-aula-check-icon"')
                  : (temVideo ? svg(ICONS.play, 12, 12, 'fill="currentColor" stroke="none" style="color:#555"') : svg(ICONS.lock, 12, 12, 'style="color:#444"'))
                }
                <span>${a.titulo}</span>
                <span class="uni-aula-dur">${durStr}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="uni-detail-hero" style="background-image:url('${img}')">
      <div class="uni-detail-gradient"></div>
      <button class="uni-detail-back" onclick="uniGoBack()">
        ${svg(ICONS.back, 14, 14)} Voltar
      </button>
    </div>
    <div class="uni-detail-content">
      <div class="uni-detail-meta">
        <span class="uni-nivel-badge ${NIVEL_CLASS[nivel]}">${NIVEL_LABEL[nivel]}</span>
        ${totalAulas ? `<span style="font-size:12px;color:#666;">${totalAulas} aulas</span><span style="color:#333">·</span>` : ''}
        ${totalMin   ? `<span style="font-size:12px;color:#666;">${fmtDur(totalMin)}</span><span style="color:#333">·</span>` : ''}
        <span style="font-size:11px;color:${trilhaCor};font-family:var(--font-h);font-weight:700;letter-spacing:0.5px;">${trilhaNome.toUpperCase()}</span>
      </div>
      <div class="uni-detail-title">${curso.titulo}</div>
      <p class="uni-detail-desc">${curso.descricao}</p>
      ${progressBar}
      <div class="uni-detail-actions">
        <button class="uni-btn-primary" onclick="${btnOnClick}">
          ${svg(ICONS.play, 15, 15, 'fill="currentColor" stroke="none"')} ${btnLabel}
        </button>
        <button class="uni-btn-ghost">+ Minha Lista</button>
      </div>
      ${prova ? provaSection(prova, tentativas || [], certificado, concluidas, totalAulas, trilhaCor) : ''}
      <div class="uni-modulos-title">Conteúdo do curso</div>
      <div class="uni-modulos">${modulosHtml}</div>
    </div>
  `;
}

function _attachDetailListeners(main) {
  main.querySelectorAll('.uni-aula-clicavel').forEach(el => {
    el.addEventListener('click', () => {
      const aulaId = el.dataset.aulaId;
      if (aulaId) _onPlayAula(aulaId);
    });
  });
}
