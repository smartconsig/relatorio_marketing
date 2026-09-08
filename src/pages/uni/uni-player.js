// Player de vídeo (Bunny.net): view, tracking de progresso (conclui aos 90%)
// e persistência do progresso/XP da aula e do curso.
import { upsertProgressoAula, insertXpLog, upsertProgressoCurso } from '../../services/uni-svc.js';
import { UV, fmtDur, ICONS, svg, showToast } from './uni-core.js';

const BUNNY_LIB_ID = 670540;
// CDN usado para thumbnails: https://{BUNNY_CDN}/{videoId}/thumbnail.jpg
// const BUNNY_CDN = 'vz-1236dc06-5dd.b-cdn.net'; // reservado para Fase 2

export function renderPlayerView(main, { aula }) {
  if (!UV.currentDetail) return;
  const { curso, aulas } = UV.currentDetail;
  const idx      = aulas.findIndex(a => a.id === aula.id);
  const nextAula = aulas[idx + 1] || null;
  const concluida = !!UV.progrAulas[aula.id];

  const trilhaCor = curso.uni_trilhas?.cor || '#E02020';
  const durSec    = aula.duracao_segundos || 0;

  const iframeHtml = aula.bunny_video_id
    ? `<iframe
         id="bunny-player-iframe"
         class="uni-player-iframe"
         src="https://iframe.mediadelivery.net/embed/${BUNNY_LIB_ID}/${aula.bunny_video_id}?autoplay=true&responsive=true&captions=false&preload=true"
         frameborder="0"
         allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
         allowfullscreen>
       </iframe>`
    : `<div class="uni-player-no-video">
         ${svg(ICONS.clock, 48, 48, 'style="color:#333;margin-bottom:16px"')}
         <div style="font-family:var(--font-h);font-size:17px;color:#555;margin-bottom:8px">Vídeo em preparação</div>
         <div style="font-size:12px;color:#3a3a3a;font-family:var(--font-b)">O conteúdo desta aula será disponibilizado em breve.</div>
         ${!concluida ? `<button class="uni-btn-ghost" style="margin-top:24px" id="btn-marcar-concluida">
           ${svg(ICONS.check, 13, 13)} Marcar como lida
         </button>` : `<div style="margin-top:24px;color:#4ade80;font-size:13px;display:flex;align-items:center;gap:6px">${svg(ICONS.check, 14, 14, 'style="color:#4ade80"')} Aula concluída</div>`}
       </div>`;

  main.innerHTML = `
    <div class="uni-player-wrap">
      <div class="uni-player-topbar">
        <button class="uni-player-back-btn" onclick="uniGoBack()">
          ${svg(ICONS.back, 14, 14)} Voltar
        </button>
        <div class="uni-player-course-info">
          <span class="uni-player-course-name" style="color:${trilhaCor}">${curso.titulo}</span>
        </div>
      </div>

      <div class="uni-player-stage">
        ${iframeHtml}
      </div>

      <div class="uni-player-info">
        <div class="uni-player-aula-header">
          <div>
            <div class="uni-player-aula-title">${aula.titulo}</div>
            ${durSec ? `<div class="uni-player-aula-meta">${svg(ICONS.clock, 11, 11)} ${fmtDur(Math.round(durSec / 60))}</div>` : ''}
          </div>
          <div id="uni-player-complete-badge" class="uni-player-complete-badge" style="display:${concluida ? 'flex' : 'none'}">
            ${svg(ICONS.check, 13, 13)} Concluída
          </div>
        </div>
        ${aula.bunny_video_id ? `
          <div class="uni-player-progress-track">
            <div class="uni-player-progress-fill" id="uni-player-progress-bar" style="width:${concluida ? '100' : '0'}%"></div>
          </div>
          <div class="uni-player-progress-label" id="uni-player-progress-label">
            ${concluida ? 'Aula já concluída' : 'Assista 90% para concluir'}
          </div>
        ` : ''}
      </div>

      ${nextAula ? `
        <div class="uni-player-next" id="uni-player-next" onclick="uniPlayAula('${nextAula.id}')"
             ${!concluida && aula.bunny_video_id ? 'style="opacity:.4;pointer-events:none"' : ''}>
          <div class="uni-player-next-label">Próxima aula</div>
          <div class="uni-player-next-title">${nextAula.titulo}</div>
          ${svg(ICONS.next, 16, 16)}
        </div>
      ` : `
        <div class="uni-player-next uni-player-fim" id="uni-player-fim-block">
          ${svg(ICONS.check, 16, 16, 'style="color:#4ade80"')}
          <div style="flex:1">
            <div class="uni-player-next-label">Última aula do curso</div>
            <div class="uni-player-next-title" id="uni-player-fim-sub">Parabéns! Você concluiu todas as aulas.</div>
          </div>
        </div>
      `}
    </div>
  `;

  main.scrollTo({ top: 0, behavior: 'instant' });

  // Botão "Marcar como lida" (para aulas sem vídeo)
  const btnMarcar = main.querySelector('#btn-marcar-concluida');
  if (btnMarcar) {
    btnMarcar.addEventListener('click', () => _markAulaComplete(aula.id, curso.id, aulas));
  }

  // Inicializa player Bunny.net se tiver vídeo
  if (aula.bunny_video_id && !concluida) {
    _initBunnyPlayer(aula.id, curso.id, aulas);
  }
}

// ── Bunny.net player tracking ───────────────────────────────────────────────
function _loadPlayerJs() {
  return new Promise(resolve => {
    if (window.playerjs) return resolve();
    const s = document.createElement('script');
    s.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
    s.onload = resolve;
    s.onerror = resolve; // falha silenciosa — fallback sem tracking
    document.head.appendChild(s);
  });
}

async function _initBunnyPlayer(aulaId, cursoId, aulas) {
  await _loadPlayerJs();

  const iframe = document.getElementById('bunny-player-iframe');
  if (!iframe || !window.playerjs) return;

  const player = new window.playerjs.Player(iframe);
  let maxPct = 0;

  player.on('ready', () => {
    player.on('timeupdate', ({ seconds, duration }) => {
      if (!duration) return;
      const pct = seconds / duration;
      if (pct > maxPct) maxPct = pct;

      // Atualiza barra de progresso
      const bar = document.getElementById('uni-player-progress-bar');
      if (bar) bar.style.width = `${Math.min(maxPct * 100, 100).toFixed(1)}%`;

      // Libera ao chegar em 90%
      if (maxPct >= 0.9 && !UV.progrAulas[aulaId]) {
        _markAulaComplete(aulaId, cursoId, aulas);
      }
    });

    player.on('ended', () => {
      if (!UV.progrAulas[aulaId]) {
        _markAulaComplete(aulaId, cursoId, aulas);
      }
    });
  });
}

async function _markAulaComplete(aulaId, cursoId, aulas) {
  if (UV.progrAulas[aulaId] || !UV.userId) return;
  UV.progrAulas[aulaId] = true;

  // UI imediata
  const badge = document.getElementById('uni-player-complete-badge');
  if (badge) { badge.style.display = 'flex'; }
  const bar = document.getElementById('uni-player-progress-bar');
  if (bar) { bar.style.width = '100%'; }
  const lbl = document.getElementById('uni-player-progress-label');
  if (lbl) { lbl.textContent = 'Aula concluída!'; lbl.style.color = '#4ade80'; }
  // Desbloqueia "próxima aula"
  const nxt = document.getElementById('uni-player-next');
  if (nxt) { nxt.style.opacity = '1'; nxt.style.pointerEvents = 'auto'; }

  // Toast
  showToast(`+10 XP — Aula concluída!`);

  // Persiste no Supabase
  try {
    await upsertProgressoAula({
      user_id: UV.userId, aula_id: aulaId, curso_id: cursoId,
      pct_assistido: 100, concluida: true,
      concluida_em: new Date().toISOString(),
    });

    await insertXpLog({
      user_id: UV.userId, tipo: 'aula_concluida', referencia_id: aulaId, xp: 10,
    });

    // Atualiza progresso do curso
    const aulasConcl = aulas.filter(a => UV.progrAulas[a.id]).length;
    const totalAulas = aulas.length;
    const pct        = totalAulas > 0 ? Math.round((aulasConcl / totalAulas) * 100) : 0;
    const concluido  = aulasConcl >= totalAulas;

    await upsertProgressoCurso({
      user_id: UV.userId, curso_id: cursoId,
      aulas_concluidas: aulasConcl, total_aulas: totalAulas,
      pct_concluido: pct, concluido,
      ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
    });

    UV.progresso[cursoId] = { aulas_concluidas: aulasConcl, total_aulas: totalAulas, pct_concluido: pct, concluido };

    // XP extra: curso completo
    if (concluido) {
      await insertXpLog({
        user_id: UV.userId, tipo: 'curso_concluido', referencia_id: cursoId, xp: 100,
      });
      showToast(`+100 XP — Curso concluído! Parabéns!`, true);
    }
  } catch (_e) {
    // falha silenciosa — XP será recalculado na próxima carga
  }
}
