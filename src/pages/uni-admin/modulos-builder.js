// Builder de módulos e aulas do editor de curso, incluindo os uploads de
// vídeo (TUS → Bunny) e PDF com barra de progresso.
// ⚠ O onProgress do TUS atualiza o DOM por [data-akey] — se _syncModulosUI
// rodar no meio do upload, o nó é substituído e a barra congela
// (comportamento pré-existente, preservado).
import { uploadVideoBunny, uploadPdfAsset } from '../../services/uni-upload-svc.js';
import { U, emptyAula, esc } from './uadm-core.js';

export function syncModulosUI() {
  const wrap = document.getElementById('uadm-modulos-wrap');
  if (!wrap) return;

  if (U.modulos.length === 0) {
    wrap.innerHTML = `<div class="uadm-modulos-empty">Nenhum módulo. Clique em "Adicionar módulo" para começar.</div>`;
    return;
  }

  wrap.innerHTML = U.modulos.map((m, mi) => `
    <div class="uadm-modulo" data-mkey="${m._key}">
      <div class="uadm-modulo-head">
        <span class="uadm-modulo-num">Módulo ${mi + 1}</span>
        <input class="uadm-input uadm-modulo-titulo" type="text"
               placeholder="Título do módulo (ex: Introdução)"
               value="${esc(m.titulo)}" data-mkey="${m._key}" data-field="titulo">
        <button class="uadm-btn-icon-danger" data-rm-modulo="${m._key}" title="Remover módulo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      <div class="uadm-aulas-list">
        ${m.aulas.length === 0
          ? `<div class="uadm-aulas-empty">Nenhuma aula. Clique em "+ Adicionar aula" abaixo.</div>`
          : m.aulas.map((a, ai) => _aulaRow(a, ai, m._key)).join('')
        }
      </div>

      <button class="uadm-btn-add-aula" data-add-aula="${m._key}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar aula
      </button>
    </div>
  `).join('');

  _attachBuilderListeners(wrap);
}

function _aulaRow(a, ai, mkey) {
  const up = a._up;
  const temVideo = !!a.bunny_video_id;

  const uploadArea = a.tipo === 'video' ? `
    <div class="uadm-aula-upload-area">
      ${temVideo && !up ? `
        <div class="uadm-video-ok">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Vídeo enviado
          <span class="uadm-video-id">${a.bunny_video_id.substring(0, 8)}…</span>
          <label class="uadm-btn-replace" for="upload-vid-${a._key}">Substituir</label>
        </div>
      ` : up ? `
        <div class="uadm-upload-progress">
          <div class="uadm-upload-label">${up.status === 'error' ? 'Erro no upload' : `Enviando... ${up.pct}%`}</div>
          <div class="uadm-upload-track">
            <div class="uadm-upload-fill ${up.status === 'error' ? 'error' : ''}"
                 style="width:${up.pct}%"></div>
          </div>
        </div>
      ` : `
        <label class="uadm-btn-upload-video" for="upload-vid-${a._key}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Fazer upload de vídeo
        </label>
      `}
      <input type="file" id="upload-vid-${a._key}" accept="video/*" style="display:none"
             data-upload-vid="${a._key}" data-mkey="${mkey}">
    </div>
  ` : `
    <div class="uadm-aula-upload-area">
      ${a.bunny_video_id ? `
        <div class="uadm-video-ok">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          PDF enviado
          <label class="uadm-btn-replace" for="upload-pdf-${a._key}">Substituir</label>
        </div>
      ` : `
        <label class="uadm-btn-upload-video" for="upload-pdf-${a._key}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Fazer upload de PDF
        </label>
      `}
      <input type="file" id="upload-pdf-${a._key}" accept=".pdf" style="display:none"
             data-upload-pdf="${a._key}" data-mkey="${mkey}">
    </div>
  `;

  return `
    <div class="uadm-aula-row" data-akey="${a._key}">
      <span class="uadm-aula-num">${ai + 1}</span>
      <input class="uadm-input uadm-aula-titulo" type="text"
             placeholder="Título da aula" value="${esc(a.titulo)}"
             data-akey="${a._key}" data-mkey="${mkey}" data-field="titulo">
      <select class="uadm-select uadm-aula-tipo" data-akey="${a._key}" data-mkey="${mkey}" data-field="tipo">
        <option value="video" ${a.tipo === 'video' ? 'selected' : ''}>Vídeo</option>
        <option value="pdf"   ${a.tipo === 'pdf'   ? 'selected' : ''}>PDF</option>
      </select>
      <input class="uadm-input uadm-aula-dur" type="number" min="0"
             placeholder="min" value="${a.duracao_segundos ? Math.round(a.duracao_segundos / 60) : ''}"
             data-akey="${a._key}" data-mkey="${mkey}" data-field="duracao_minutos"
             title="Duração em minutos">
      <button class="uadm-btn-icon-danger" data-rm-aula="${a._key}" data-mkey="${mkey}" title="Remover aula">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      ${uploadArea}
    </div>
  `;
}

function _attachBuilderListeners(wrap) {
  wrap.querySelectorAll('[data-rm-modulo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rmModulo;
      const m = U.modulos.find(x => x._key === key);
      if (m?.id) U.deletes.modulos.push(m.id);
      U.modulos = U.modulos.filter(x => x._key !== key);
      U.modulos.forEach((x, i) => { x.ordem = i + 1; });
      syncModulosUI();
    });
  });

  wrap.querySelectorAll('[data-add-aula]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkey = btn.dataset.addAula;
      const m = U.modulos.find(x => x._key === mkey);
      if (m) { m.aulas.push(emptyAula(m.aulas.length + 1)); syncModulosUI(); }
    });
  });

  wrap.querySelectorAll('[data-rm-aula]').forEach(btn => {
    btn.addEventListener('click', () => {
      const akey = btn.dataset.rmAula;
      const mkey = btn.dataset.mkey;
      const m = U.modulos.find(x => x._key === mkey);
      if (!m) return;
      const a = m.aulas.find(x => x._key === akey);
      if (a?.id) U.deletes.aulas.push(a.id);
      m.aulas = m.aulas.filter(x => x._key !== akey);
      m.aulas.forEach((x, i) => { x.ordem = i + 1; });
      syncModulosUI();
    });
  });

  wrap.querySelectorAll('[data-field="titulo"][data-mkey]').forEach(input => {
    if (input.tagName === 'INPUT' && !input.dataset.akey) {
      input.addEventListener('input', () => {
        const m = U.modulos.find(x => x._key === input.dataset.mkey);
        if (m) m.titulo = input.value;
      });
    }
  });

  wrap.querySelectorAll('[data-akey]').forEach(input => {
    if (!input.dataset.field) return;
    input.addEventListener('change', () => {
      const m = U.modulos.find(x => x._key === input.dataset.mkey);
      if (!m) return;
      const a = m.aulas.find(x => x._key === input.dataset.akey);
      if (!a) return;
      const field = input.dataset.field;
      if (field === 'titulo') a.titulo = input.value;
      else if (field === 'tipo') { a.tipo = input.value; syncModulosUI(); }
      else if (field === 'duracao_minutos') a.duracao_segundos = (parseInt(input.value) || 0) * 60;
    });
    input.addEventListener('input', () => {
      const m = U.modulos.find(x => x._key === input.dataset.mkey);
      const a = m?.aulas.find(x => x._key === input.dataset.akey);
      if (a && input.dataset.field === 'titulo') a.titulo = input.value;
    });
  });

  wrap.querySelectorAll('[data-upload-vid]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      await _uploadVideo(file, input.dataset.uploadVid, input.dataset.mkey);
    });
  });

  wrap.querySelectorAll('[data-upload-pdf]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      await _uploadPdf(file, input.dataset.uploadPdf, input.dataset.mkey);
    });
  });
}

// ── Upload de vídeo (TUS → Bunny.net) ─────────────────────────────────────
async function _uploadVideo(file, akey, mkey) {
  const m = U.modulos.find(x => x._key === mkey);
  const a = m?.aulas.find(x => x._key === akey);
  if (!a) return;

  a._up = { status: 'uploading', pct: 0 };
  syncModulosUI();

  try {
    const videoId = await uploadVideoBunny(file, a.titulo, pct => {
      const mm = U.modulos.find(x => x._key === mkey);
      const aa = mm?.aulas.find(x => x._key === akey);
      if (aa?._up) {
        aa._up.pct = pct;
        const bar = document.querySelector(`[data-akey="${akey}"] .uadm-upload-fill`);
        const lbl = document.querySelector(`[data-akey="${akey}"] .uadm-upload-label`);
        if (bar) bar.style.width = `${pct}%`;
        if (lbl) lbl.textContent = `Enviando... ${pct}%`;
      }
    });

    const mm = U.modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) { aa.bunny_video_id = videoId; aa._up = null; }
    syncModulosUI();

  } catch (err) {
    const mm = U.modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) aa._up = { status: 'error', pct: 0 };
    syncModulosUI();
    console.error('Erro no upload:', err);
    alert(`Erro no upload do vídeo: ${err.message || err}`);
  }
}

// ── Upload de PDF (Supabase Storage) ──────────────────────────────────────
async function _uploadPdf(file, akey, mkey) {
  const m = U.modulos.find(x => x._key === mkey);
  const a = m?.aulas.find(x => x._key === akey);
  if (!a) return;

  a._up = { status: 'uploading', pct: 50 };
  syncModulosUI();

  try {
    const publicUrl = await uploadPdfAsset(file);
    a.bunny_video_id = publicUrl;
    a._up = null;
    syncModulosUI();
  } catch (err) {
    const mm = U.modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) aa._up = { status: 'error', pct: 0 };
    syncModulosUI();
    alert(`Erro no upload do PDF: ${err.message}`);
  }
}
