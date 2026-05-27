// ── Universidade Smart — Painel Criador ───────────────────────────────────
// Interface CMS completa para gestão de cursos, módulos, aulas e uploads.

import { sb } from '../services/supabase.js';

// ── Estado ─────────────────────────────────────────────────────────────────
let _trilhas  = [];
let _cursos   = [];
let _view     = 'list'; // 'list' | 'editor'

// Estado do editor
let _curso    = _emptyCurso();
let _modulos  = [];          // ver _emptyModulo()
let _deletes  = { modulos: [], aulas: [] };
let _saving   = false;

function _emptyCurso() {
  return {
    id: null, titulo: '', descricao: '', trilha_id: '',
    nivel: 'basico', instrutor: '', ativo: false,
    destaque: false, capa_url: '', hero_img: '',
  };
}
function _emptyModulo(ordem) {
  return { _key: `m${Date.now()}${Math.random()}`, id: null, titulo: '', ordem, aulas: [] };
}
function _emptyAula(ordem) {
  return {
    _key: `a${Date.now()}${Math.random()}`, id: null, titulo: '',
    tipo: 'video', bunny_video_id: '', duracao_segundos: '',
    ordem, _up: null,  // _up: estado do upload em andamento
  };
}

// ── Entry ──────────────────────────────────────────────────────────────────
export async function renderUniAdmin() {
  const el = document.getElementById('sec-uni-admin');
  if (!el) return;
  el.innerHTML = _spinner();
  await _loadData();
  _showList(el);
}

async function _loadData() {
  const [{ data: t }, { data: c }] = await Promise.all([
    sb.from('uni_trilhas').select('*').order('id'),
    sb.from('uni_cursos').select('*, uni_trilhas(nome, cor)').order('criado_em', { ascending: false }),
  ]);
  _trilhas = t || [];
  _cursos  = c || [];
}

// ── VIEW: Lista de cursos ──────────────────────────────────────────────────
function _showList(el) {
  _view = 'list';
  _curso   = _emptyCurso();
  _modulos = [];
  _deletes = { modulos: [], aulas: [] };

  const rows = _cursos.map(c => `
    <tr class="uadm-tr">
      <td>
        <div class="uadm-curso-thumb" style="background-image:url('${c.capa_url || ''}')">
          ${!c.capa_url ? '<span style="color:#444;font-size:10px">Sem capa</span>' : ''}
        </div>
      </td>
      <td>
        <div class="uadm-curso-nome">${c.titulo}</div>
        <div class="uadm-curso-meta">${c.instrutor || '&mdash;'}</div>
      </td>
      <td><span class="uadm-trilha-tag" style="--cor:${c.uni_trilhas?.cor || '#555'}">${c.uni_trilhas?.nome || '—'}</span></td>
      <td>${_nivelBadge(c.nivel)}</td>
      <td>${c.total_aulas || 0} aulas</td>
      <td>${c.ativo
        ? '<span class="uadm-badge-pub">Publicado</span>'
        : '<span class="uadm-badge-ras">Rascunho</span>'}</td>
      <td><button class="uadm-btn-sm" data-edit="${c.id}">Editar</button></td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="uadm-page">
      <div class="uadm-topbar">
        <div>
          <h1 class="uadm-h1">Criador de Cursos</h1>
          <p class="uadm-sub">${_cursos.length} curso${_cursos.length !== 1 ? 's' : ''} cadastrado${_cursos.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="uadm-btn-primary" id="btn-novo">+ Novo Curso</button>
      </div>

      ${_cursos.length === 0 ? `
        <div class="uadm-empty">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" stroke-width="1.5">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          <div class="uadm-empty-title">Nenhum curso criado ainda</div>
          <div class="uadm-empty-sub">Crie o primeiro curso da Universidade Smart</div>
          <button class="uadm-btn-primary" id="btn-novo-2">+ Criar Primeiro Curso</button>
        </div>
      ` : `
        <div class="uadm-table-wrap">
          <table class="uadm-table">
            <thead><tr>
              <th style="width:60px"></th><th>Curso</th><th>Trilha</th>
              <th>Nível</th><th>Conteúdo</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `}
    </div>
  `;

  el.querySelector('#btn-novo')?.addEventListener('click', () => _openEditor(null, el));
  el.querySelector('#btn-novo-2')?.addEventListener('click', () => _openEditor(null, el));
  el.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = _cursos.find(x => x.id === btn.dataset.edit);
      if (c) await _openEditor(c, el);
    });
  });
}

// ── VIEW: Editor de curso ──────────────────────────────────────────────────
async function _openEditor(cursoExistente, el) {
  _view = 'editor';
  el.innerHTML = _spinner();

  if (cursoExistente) {
    _curso = { ...cursoExistente };
    // Carrega módulos e aulas do DB
    const [{ data: mods }, { data: aulas }] = await Promise.all([
      sb.from('uni_modulos').select('*').eq('curso_id', cursoExistente.id).order('ordem'),
      sb.from('uni_aulas').select('*').eq('curso_id', cursoExistente.id).order('ordem'),
    ]);
    _modulos = (mods || []).map(m => ({
      _key: m.id,
      ...m,
      aulas: (aulas || [])
        .filter(a => a.modulo_id === m.id)
        .map(a => ({ _key: a.id, ...a, _up: null })),
    }));
  } else {
    _curso   = _emptyCurso();
    _modulos = [];
  }
  _deletes = { modulos: [], aulas: [] };

  _renderEditor(el);
}

function _renderEditor(el) {
  const isNew = !_curso.id;

  el.innerHTML = `
    <div class="uadm-page">

      <!-- Topbar do editor -->
      <div class="uadm-topbar">
        <button class="uadm-btn-back" id="btn-voltar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Todos os cursos
        </button>
        <div class="uadm-editor-title">${isNew ? 'Novo Curso' : _curso.titulo || 'Editar Curso'}</div>
        <div class="uadm-topbar-actions">
          <button class="uadm-btn-ghost" id="btn-rascunho">Salvar rascunho</button>
          <button class="uadm-btn-primary" id="btn-publicar">Publicar curso</button>
        </div>
      </div>

      <div class="uadm-editor-body">

        <!-- Seção: Informações gerais -->
        <div class="uadm-card">
          <div class="uadm-card-title">Informações Gerais</div>
          <div class="uadm-grid-2">
            <div class="uadm-field uadm-col-2">
              <label class="uadm-label">Título do curso *</label>
              <input class="uadm-input" id="f-titulo" type="text" placeholder="Ex: Fundamentos do Crédito Consignado" value="${_esc(_curso.titulo)}">
            </div>
            <div class="uadm-field uadm-col-2">
              <label class="uadm-label">Descrição</label>
              <textarea class="uadm-textarea" id="f-desc" rows="3" placeholder="Descreva o que o colaborador vai aprender neste curso...">${_esc(_curso.descricao)}</textarea>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Trilha *</label>
              <select class="uadm-select" id="f-trilha">
                <option value="">Selecionar trilha...</option>
                ${_trilhas.map(t => `<option value="${t.id}" ${_curso.trilha_id === t.id ? 'selected' : ''}>${t.nome}</option>`).join('')}
              </select>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Nível</label>
              <div class="uadm-radio-group">
                ${[['basico','Básico'],['intermediario','Intermediário'],['avancado','Avançado']].map(([v, l]) => `
                  <label class="uadm-radio ${_curso.nivel === v ? 'checked' : ''}">
                    <input type="radio" name="nivel" value="${v}" ${_curso.nivel === v ? 'checked' : ''}> ${l}
                  </label>
                `).join('')}
              </div>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Instrutor</label>
              <input class="uadm-input" id="f-instrutor" type="text" placeholder="Nome do instrutor" value="${_esc(_curso.instrutor || '')}">
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Opções</label>
              <div class="uadm-toggle-group">
                <label class="uadm-toggle">
                  <input type="checkbox" id="f-destaque" ${_curso.destaque ? 'checked' : ''}>
                  <span class="uadm-toggle-slider"></span>
                  Destaque na home
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção: Imagens -->
        <div class="uadm-card">
          <div class="uadm-card-title">Imagens</div>
          <div class="uadm-imagens-grid">

            <div class="uadm-img-slot">
              <div class="uadm-img-label">Capa do curso <span class="uadm-img-dim">Retrato — 400×600px</span></div>
              <div class="uadm-img-preview uadm-img-portrait" id="preview-capa"
                   style="${_curso.capa_url ? `background-image:url('${_curso.capa_url}')` : ''}">
                ${!_curso.capa_url ? '<span class="uadm-img-placeholder">Nenhuma imagem</span>' : ''}
              </div>
              <div class="uadm-img-actions">
                <label class="uadm-btn-upload" for="upload-capa">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload capa
                </label>
                <input type="file" id="upload-capa" accept="image/*" style="display:none">
                ${_curso.capa_url ? `<button class="uadm-btn-sm-ghost" id="rm-capa">Remover</button>` : ''}
              </div>
              <div class="uadm-img-hint">Aparece nos cards dos cursos. Proporção 2:3 recomendada.</div>
            </div>

            <div class="uadm-img-slot">
              <div class="uadm-img-label">Imagem Hero <span class="uadm-img-dim">Paisagem — 1600×600px</span></div>
              <div class="uadm-img-preview uadm-img-hero" id="preview-hero"
                   style="${_curso.hero_img ? `background-image:url('${_curso.hero_img}')` : ''}">
                ${!_curso.hero_img ? '<span class="uadm-img-placeholder">Nenhuma imagem</span>' : ''}
              </div>
              <div class="uadm-img-actions">
                <label class="uadm-btn-upload" for="upload-hero">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload hero
                </label>
                <input type="file" id="upload-hero" accept="image/*" style="display:none">
                ${_curso.hero_img ? `<button class="uadm-btn-sm-ghost" id="rm-hero">Remover</button>` : ''}
              </div>
              <div class="uadm-img-hint">Aparece no banner grande ao abrir o curso.</div>
            </div>

          </div>
        </div>

        <!-- Seção: Módulos e Aulas -->
        <div class="uadm-card">
          <div class="uadm-card-title">Conteúdo do Curso</div>
          <div class="uadm-card-sub">Organize o curso em módulos. Cada módulo contém aulas com vídeo ou PDF.</div>
          <div id="uadm-modulos-wrap"></div>
          <button class="uadm-btn-add-modulo" id="btn-add-modulo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Adicionar módulo
          </button>
        </div>

        <!-- Rodapé de ações -->
        <div class="uadm-editor-footer">
          <button class="uadm-btn-ghost" id="btn-cancelar">Cancelar</button>
          <div style="display:flex;gap:10px">
            <button class="uadm-btn-ghost" id="btn-rascunho-2">Salvar rascunho</button>
            <button class="uadm-btn-primary" id="btn-publicar-2">Publicar curso</button>
          </div>
        </div>

      </div>
    </div>
  `;

  // Renderiza módulos
  _syncModulosUI();

  // Event listeners
  _attachEditorListeners(el);
}

// ── Módulos & Aulas builder ────────────────────────────────────────────────
function _syncModulosUI() {
  const wrap = document.getElementById('uadm-modulos-wrap');
  if (!wrap) return;

  if (_modulos.length === 0) {
    wrap.innerHTML = `<div class="uadm-modulos-empty">Nenhum módulo. Clique em "Adicionar módulo" para começar.</div>`;
    return;
  }

  wrap.innerHTML = _modulos.map((m, mi) => `
    <div class="uadm-modulo" data-mkey="${m._key}">
      <div class="uadm-modulo-head">
        <span class="uadm-modulo-num">Módulo ${mi + 1}</span>
        <input class="uadm-input uadm-modulo-titulo" type="text"
               placeholder="Título do módulo (ex: Introdução)"
               value="${_esc(m.titulo)}" data-mkey="${m._key}" data-field="titulo">
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

  // Attach listeners para os elementos do builder
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
             placeholder="Título da aula" value="${_esc(a.titulo)}"
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
  // Remover módulo
  wrap.querySelectorAll('[data-rm-modulo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rmModulo;
      const m = _modulos.find(x => x._key === key);
      if (m?.id) _deletes.modulos.push(m.id);
      _modulos = _modulos.filter(x => x._key !== key);
      _modulos.forEach((x, i) => { x.ordem = i + 1; });
      _syncModulosUI();
    });
  });

  // Adicionar aula
  wrap.querySelectorAll('[data-add-aula]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkey = btn.dataset.addAula;
      const m = _modulos.find(x => x._key === mkey);
      if (m) { m.aulas.push(_emptyAula(m.aulas.length + 1)); _syncModulosUI(); }
    });
  });

  // Remover aula
  wrap.querySelectorAll('[data-rm-aula]').forEach(btn => {
    btn.addEventListener('click', () => {
      const akey = btn.dataset.rmAula;
      const mkey = btn.dataset.mkey;
      const m = _modulos.find(x => x._key === mkey);
      if (!m) return;
      const a = m.aulas.find(x => x._key === akey);
      if (a?.id) _deletes.aulas.push(a.id);
      m.aulas = m.aulas.filter(x => x._key !== akey);
      m.aulas.forEach((x, i) => { x.ordem = i + 1; });
      _syncModulosUI();
    });
  });

  // Editar campo de módulo (título)
  wrap.querySelectorAll('[data-field="titulo"][data-mkey]').forEach(input => {
    if (input.tagName === 'INPUT' && !input.dataset.akey) {
      input.addEventListener('input', () => {
        const m = _modulos.find(x => x._key === input.dataset.mkey);
        if (m) m.titulo = input.value;
      });
    }
  });

  // Editar campos de aula
  wrap.querySelectorAll('[data-akey]').forEach(input => {
    if (!input.dataset.field) return;
    input.addEventListener('change', () => {
      const m = _modulos.find(x => x._key === input.dataset.mkey);
      if (!m) return;
      const a = m.aulas.find(x => x._key === input.dataset.akey);
      if (!a) return;
      const field = input.dataset.field;
      if (field === 'titulo') a.titulo = input.value;
      else if (field === 'tipo') { a.tipo = input.value; _syncModulosUI(); }
      else if (field === 'duracao_minutos') a.duracao_segundos = (parseInt(input.value) || 0) * 60;
    });
    input.addEventListener('input', () => {
      const m = _modulos.find(x => x._key === input.dataset.mkey);
      const a = m?.aulas.find(x => x._key === input.dataset.akey);
      if (a && input.dataset.field === 'titulo') a.titulo = input.value;
    });
  });

  // Upload de vídeo (TUS via Bunny.net)
  wrap.querySelectorAll('[data-upload-vid]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const akey = input.dataset.uploadVid;
      const mkey = input.dataset.mkey;
      await _uploadVideo(file, akey, mkey);
    });
  });

  // Upload de PDF (Supabase Storage)
  wrap.querySelectorAll('[data-upload-pdf]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const akey = input.dataset.uploadPdf;
      const mkey = input.dataset.mkey;
      await _uploadPdf(file, akey, mkey);
    });
  });
}

// ── Upload de vídeo (TUS → Bunny.net) ─────────────────────────────────────
async function _uploadVideo(file, akey, mkey) {
  const m = _modulos.find(x => x._key === mkey);
  const a = m?.aulas.find(x => x._key === akey);
  if (!a) return;

  a._up = { status: 'uploading', pct: 0 };
  _syncModulosUI();

  try {
    // 1. Cria entrada no Bunny via Vercel Function
    const initRes = await fetch('/api/bunny-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: a.titulo || file.name }),
    });

    if (!initRes.ok) throw new Error(await initRes.text());

    const { videoId, authSignature, authExpire, libraryId } = await initRes.json();

    // 2. Upload via TUS (carrega tus-js-client dinamicamente)
    await _loadTusClient();

    await new Promise((resolve, reject) => {
      const upload = new window.tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000],
        chunkSize: 5 * 1024 * 1024, // 5MB por chunk
        headers: {
          AuthorizationSignature: authSignature,
          AuthorizationExpire:    String(authExpire),
          VideoId:                videoId,
          LibraryId:              String(libraryId),
        },
        metadata: { filetype: file.type, title: a.titulo || file.name },
        onProgress: (sent, total) => {
          const pct = Math.round((sent / total) * 100);
          const mm = _modulos.find(x => x._key === mkey);
          const aa = mm?.aulas.find(x => x._key === akey);
          if (aa?._up) {
            aa._up.pct = pct;
            // Atualiza só a barra de progresso sem re-render completo
            const bar = document.querySelector(`[data-akey="${akey}"] .uadm-upload-fill`);
            const lbl = document.querySelector(`[data-akey="${akey}"] .uadm-upload-label`);
            if (bar) bar.style.width = `${pct}%`;
            if (lbl) lbl.textContent = `Enviando... ${pct}%`;
          }
        },
        onSuccess: () => resolve(),
        onError:   (err) => reject(err),
      });
      upload.start();
    });

    // 3. Sucesso — salva o videoId
    const mm = _modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) {
      aa.bunny_video_id = videoId;
      aa._up = null;
    }
    _syncModulosUI();

  } catch (err) {
    const mm = _modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) aa._up = { status: 'error', pct: 0 };
    _syncModulosUI();
    console.error('Erro no upload:', err);
    alert(`Erro no upload do vídeo: ${err.message || err}`);
  }
}

function _loadTusClient() {
  return new Promise(resolve => {
    if (window.tus) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.1.0/dist/tus.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ── Upload de PDF (Supabase Storage) ──────────────────────────────────────
async function _uploadPdf(file, akey, mkey) {
  const m = _modulos.find(x => x._key === mkey);
  const a = m?.aulas.find(x => x._key === akey);
  if (!a) return;

  a._up = { status: 'uploading', pct: 50 };
  _syncModulosUI();

  try {
    const path = `pdfs/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await sb.storage.from('uni-assets').upload(path, file, { upsert: true });
    if (error) throw error;

    const { data: { publicUrl } } = sb.storage.from('uni-assets').getPublicUrl(path);
    a.bunny_video_id = publicUrl; // reutilizamos o campo para PDF URL
    a._up = null;
    _syncModulosUI();
  } catch (err) {
    const mm = _modulos.find(x => x._key === mkey);
    const aa = mm?.aulas.find(x => x._key === akey);
    if (aa) aa._up = { status: 'error', pct: 0 };
    _syncModulosUI();
    alert(`Erro no upload do PDF: ${err.message}`);
  }
}

// ── Upload de imagem (Supabase Storage) ───────────────────────────────────
async function _uploadImagem(file, tipo) {
  const ext  = file.name.split('.').pop();
  const path = `imagens/${tipo}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('uni-assets').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from('uni-assets').getPublicUrl(path);
  return publicUrl;
}

// ── Salvar curso ───────────────────────────────────────────────────────────
async function _salvar(publicar, el) {
  if (_saving) return;

  // Coleta os dados do formulário antes de salvar
  _curso.titulo    = document.getElementById('f-titulo')?.value?.trim() || '';
  _curso.descricao = document.getElementById('f-desc')?.value?.trim()   || '';
  _curso.trilha_id = document.getElementById('f-trilha')?.value         || '';
  _curso.nivel     = document.querySelector('input[name="nivel"]:checked')?.value || 'basico';
  _curso.instrutor = document.getElementById('f-instrutor')?.value?.trim() || '';
  _curso.destaque  = document.getElementById('f-destaque')?.checked ?? false;
  _curso.ativo     = publicar;

  // Coleta títulos de módulos/aulas do DOM (para não perder edições em andamento)
  _modulos.forEach(m => {
    const tituloEl = document.querySelector(`input[data-mkey="${m._key}"]:not([data-akey])`);
    if (tituloEl) m.titulo = tituloEl.value;
    m.aulas.forEach(a => {
      const aTitulo = document.querySelector(`input[data-akey="${a._key}"][data-field="titulo"]`);
      const aDur    = document.querySelector(`input[data-akey="${a._key}"][data-field="duracao_minutos"]`);
      if (aTitulo) a.titulo = aTitulo.value;
      if (aDur)    a.duracao_segundos = (parseInt(aDur.value) || 0) * 60;
    });
  });

  if (!_curso.titulo) { alert('Informe o título do curso.'); return; }
  if (!_curso.trilha_id) { alert('Selecione uma trilha.'); return; }

  _saving = true;
  const btnP = document.getElementById('btn-publicar');
  const btnP2 = document.getElementById('btn-publicar-2');
  const btnR = document.getElementById('btn-rascunho');
  const btnR2 = document.getElementById('btn-rascunho-2');
  [btnP, btnP2, btnR, btnR2].forEach(b => { if (b) { b.disabled = true; b.textContent = 'Salvando…'; } });

  try {
    // 1. Total de aulas
    const totalAulas = _modulos.reduce((s, m) => s + m.aulas.length, 0);
    const totalMin   = _modulos.reduce((s, m) => s + m.aulas.reduce((ss, a) => ss + (a.duracao_segundos || 0), 0), 0);

    const cursoPayload = {
      titulo:           _curso.titulo,
      descricao:        _curso.descricao,
      trilha_id:        _curso.trilha_id,
      nivel:            _curso.nivel,
      instrutor:        _curso.instrutor,
      destaque:         _curso.destaque,
      ativo:            _curso.ativo,
      capa_url:         _curso.capa_url || null,
      hero_img:         _curso.hero_img || null,
      total_aulas:      totalAulas,
      duracao_minutos:  Math.round(totalMin / 60),
    };

    let cursoId = _curso.id;

    if (cursoId) {
      await sb.from('uni_cursos').update(cursoPayload).eq('id', cursoId);
    } else {
      const { data, error } = await sb.from('uni_cursos').insert(cursoPayload).select().single();
      if (error) throw error;
      cursoId = data.id;
      _curso.id = cursoId;
    }

    // 2. Deletes
    if (_deletes.aulas.length)   await sb.from('uni_aulas').delete().in('id', _deletes.aulas);
    if (_deletes.modulos.length) await sb.from('uni_modulos').delete().in('id', _deletes.modulos);

    // 3. Salva módulos e aulas
    for (let mi = 0; mi < _modulos.length; mi++) {
      const m = _modulos[mi];
      m.ordem = mi + 1;
      const mPayload = { titulo: m.titulo, curso_id: cursoId, ordem: m.ordem };

      if (m.id) {
        await sb.from('uni_modulos').update(mPayload).eq('id', m.id);
      } else {
        const { data, error } = await sb.from('uni_modulos').insert(mPayload).select().single();
        if (error) throw error;
        m.id = data.id;
        m._key = data.id;
      }

      for (let ai = 0; ai < m.aulas.length; ai++) {
        const a = m.aulas[ai];
        a.ordem = ai + 1;
        const aPayload = {
          titulo:          a.titulo,
          modulo_id:       m.id,
          curso_id:        cursoId,
          tipo:            a.tipo,
          bunny_video_id:  a.bunny_video_id || null,
          duracao_segundos: a.duracao_segundos || 0,
          ordem:           a.ordem,
          ativo:           true,
        };

        if (a.id) {
          await sb.from('uni_aulas').update(aPayload).eq('id', a.id);
        } else {
          const { data, error } = await sb.from('uni_aulas').insert(aPayload).select().single();
          if (error) throw error;
          a.id = data.id;
          a._key = data.id;
        }
      }
    }

    // 4. Volta para a lista
    await _loadData();
    _showList(el);

  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert(`Erro ao salvar: ${err.message}`);
    _saving = false;
    [btnP, btnP2].forEach(b => { if (b) { b.disabled = false; b.textContent = 'Publicar curso'; } });
    [btnR, btnR2].forEach(b => { if (b) { b.disabled = false; b.textContent = 'Salvar rascunho'; } });
  } finally {
    _saving = false;
  }
}

// ── Listeners do editor ────────────────────────────────────────────────────
function _attachEditorListeners(el) {
  el.querySelector('#btn-voltar')?.addEventListener('click', () => _showList(el));
  el.querySelector('#btn-cancelar')?.addEventListener('click', () => _showList(el));

  el.querySelector('#btn-publicar')?.addEventListener('click',   () => _salvar(true, el));
  el.querySelector('#btn-publicar-2')?.addEventListener('click', () => _salvar(true, el));
  el.querySelector('#btn-rascunho')?.addEventListener('click',   () => _salvar(false, el));
  el.querySelector('#btn-rascunho-2')?.addEventListener('click', () => _salvar(false, el));

  el.querySelector('#btn-add-modulo')?.addEventListener('click', () => {
    _modulos.push(_emptyModulo(_modulos.length + 1));
    _syncModulosUI();
  });

  // Upload imagem capa
  el.querySelector('#upload-capa')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      _showImgLoading('preview-capa');
      _curso.capa_url = await _uploadImagem(file, 'capa');
      _updateImgPreview('preview-capa', _curso.capa_url);
    } catch (err) { alert(`Erro no upload: ${err.message}`); }
  });

  // Upload imagem hero
  el.querySelector('#upload-hero')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      _showImgLoading('preview-hero');
      _curso.hero_img = await _uploadImagem(file, 'hero');
      _updateImgPreview('preview-hero', _curso.hero_img);
    } catch (err) { alert(`Erro no upload: ${err.message}`); }
  });

  // Remover imagens
  el.querySelector('#rm-capa')?.addEventListener('click', () => { _curso.capa_url = ''; _renderEditor(el); });
  el.querySelector('#rm-hero')?.addEventListener('click', () => { _curso.hero_img = ''; _renderEditor(el); });

  // Radio nivel
  el.querySelectorAll('input[name="nivel"]').forEach(r => {
    r.addEventListener('change', () => {
      _curso.nivel = r.value;
      el.querySelectorAll('.uadm-radio').forEach(l => l.classList.remove('checked'));
      r.closest('.uadm-radio')?.classList.add('checked');
    });
  });
}

function _showImgLoading(previewId) {
  const el = document.getElementById(previewId);
  if (el) { el.style.backgroundImage = ''; el.innerHTML = '<span class="uadm-img-placeholder">Enviando...</span>'; }
}
function _updateImgPreview(previewId, url) {
  const el = document.getElementById(previewId);
  if (el) { el.style.backgroundImage = `url('${url}')`; el.innerHTML = ''; }
}

// ── Utils ──────────────────────────────────────────────────────────────────
function _nivelBadge(nivel) {
  const map = { basico: ['#22c55e','Básico'], intermediario: ['#fbbf24','Intermediário'], avancado: ['#f87171','Avançado'] };
  const [cor, label] = map[nivel] || ['#555','—'];
  return `<span style="font-size:10px;font-family:var(--font-h);font-weight:700;color:${cor}">${label}</span>`;
}
function _spinner() {
  return `<div style="display:flex;align-items:center;justify-content:center;height:60vh">
    <div style="width:24px;height:24px;border:2px solid #1e1e1e;border-top-color:var(--red);border-radius:50%;animation:uni-spin .7s linear infinite"></div>
  </div>`;
}
function _esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
