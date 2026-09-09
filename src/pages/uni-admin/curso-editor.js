// Editor de curso: carga dos dados relacionados, render das seções
// (informações, imagens, módulos, prova) e listeners do editor.
import { fetchCursoRelacionado, fetchQuestoes } from '../../services/uni-admin-svc.js';
import { uploadImagemAsset } from '../../services/uni-upload-svc.js';
import { U, emptyCurso, emptyProva, emptyModulo, emptyQuestao, esc, spinner } from './uadm-core.js';
import { showList } from './curso-lista.js';
import { syncModulosUI } from './modulos-builder.js';
import { syncQuestoesUI } from './quiz-builder.js';
import { salvar } from './uadm-salvar.js';

export async function openEditor(cursoExistente, el) {
  el.innerHTML = spinner();

  if (cursoExistente) {
    U.curso = { ...cursoExistente };
    const [{ data: mods }, { data: aulas }, { data: provaData }] = await fetchCursoRelacionado(cursoExistente.id);
    U.modulos = (mods || []).map(m => ({
      _key: m.id, ...m,
      aulas: (aulas || [])
        .filter(a => a.modulo_id === m.id)
        .map(a => ({ _key: a.id, ...a, _up: null })),
    }));

    if (provaData) {
      U.prova = { ...provaData, ativa: true };
      const { data: questoesData } = await fetchQuestoes(provaData.id);
      U.questoes = (questoesData || []).map(q => ({
        _key: q.id, ...q,
        alternativas: Array.isArray(q.alternativas) ? q.alternativas : ['', '', '', ''],
      }));
    } else {
      U.prova = emptyProva();
      U.questoes = [];
    }
  } else {
    U.curso   = emptyCurso();
    U.modulos = [];
    U.prova   = emptyProva();
    U.questoes = [];
  }
  U.deletes = { modulos: [], aulas: [], questoes: [] };

  _renderEditor(el);
}

// Slot de upload de imagem (capa retrato / hero paisagem) — mesmo markup dos
// dois blocos originais, parametrizado.
function _imgSlotHTML({ id, label, dim, klass, url, hint }) {
  return `
            <div class="uadm-img-slot">
              <div class="uadm-img-label">${label} <span class="uadm-img-dim">${dim}</span></div>
              <div class="uadm-img-preview ${klass}" id="preview-${id}"
                   style="${url ? `background-image:url('${url}')` : ''}">
                ${!url ? '<span class="uadm-img-placeholder">Nenhuma imagem</span>' : ''}
              </div>
              <div class="uadm-img-actions">
                <label class="uadm-btn-upload" for="upload-${id}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload ${id}
                </label>
                <input type="file" id="upload-${id}" accept="image/*" style="display:none">
                ${url ? `<button class="uadm-btn-sm-ghost" id="rm-${id}">Remover</button>` : ''}
              </div>
              <div class="uadm-img-hint">${hint}</div>
            </div>
`;
}

function _secaoImagensHTML() {
  return `
        <div class="uadm-card">
          <div class="uadm-card-title">Imagens</div>
          <div class="uadm-imagens-grid">
${_imgSlotHTML({ id: 'capa', label: 'Capa do curso', dim: 'Retrato — 400×600px', klass: 'uadm-img-portrait', url: U.curso.capa_url, hint: 'Aparece nos cards dos cursos. Proporção 2:3 recomendada.' })}
${_imgSlotHTML({ id: 'hero', label: 'Imagem Hero', dim: 'Paisagem — 1600×600px', klass: 'uadm-img-hero', url: U.curso.hero_img, hint: 'Aparece no banner grande ao abrir o curso.' })}
          </div>
        </div>
`;
}

function _renderEditor(el) {
  const isNew = !U.curso.id;

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
        <div class="uadm-editor-title">${isNew ? 'Novo Curso' : U.curso.titulo || 'Editar Curso'}</div>
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
              <input class="uadm-input" id="f-titulo" type="text" placeholder="Ex: Fundamentos do Crédito Consignado" value="${esc(U.curso.titulo)}">
            </div>
            <div class="uadm-field uadm-col-2">
              <label class="uadm-label">Descrição</label>
              <textarea class="uadm-textarea" id="f-desc" rows="3" placeholder="Descreva o que o colaborador vai aprender neste curso...">${esc(U.curso.descricao)}</textarea>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Trilha *</label>
              <select class="uadm-select" id="f-trilha">
                <option value="">Selecionar trilha...</option>
                ${U.trilhas.map(t => `<option value="${t.id}" ${U.curso.trilha_id === t.id ? 'selected' : ''}>${t.nome}</option>`).join('')}
              </select>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Nível</label>
              <div class="uadm-radio-group">
                ${[['basico','Básico'],['intermediario','Intermediário'],['avancado','Avançado']].map(([v, l]) => `
                  <label class="uadm-radio ${U.curso.nivel === v ? 'checked' : ''}">
                    <input type="radio" name="nivel" value="${v}" ${U.curso.nivel === v ? 'checked' : ''}> ${l}
                  </label>
                `).join('')}
              </div>
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Instrutor</label>
              <input class="uadm-input" id="f-instrutor" type="text" placeholder="Nome do instrutor" value="${esc(U.curso.instrutor || '')}">
            </div>
            <div class="uadm-field">
              <label class="uadm-label">Opções</label>
              <div class="uadm-toggle-group">
                <label class="uadm-toggle">
                  <input type="checkbox" id="f-destaque" ${U.curso.destaque ? 'checked' : ''}>
                  <span class="uadm-toggle-slider"></span>
                  Destaque na home
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção: Imagens -->
        ${_secaoImagensHTML()}

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

        <!-- Seção: Prova & Certificado -->
        <div class="uadm-card">
          <div class="uadm-card-title-row">
            <div>
              <div class="uadm-card-title">Prova &amp; Certificado</div>
              <div class="uadm-card-sub">Configure a avaliação final e a emissão automática do certificado.</div>
            </div>
            <label class="uadm-toggle uadm-toggle-lg">
              <input type="checkbox" id="f-tem-prova" ${U.prova.ativa ? 'checked' : ''}>
              <span class="uadm-toggle-slider"></span>
              <span class="uadm-toggle-label">${U.prova.ativa ? 'Ativada' : 'Desativada'}</span>
            </label>
          </div>

          <div id="uadm-prova-body" style="display:${U.prova.ativa ? 'block' : 'none'}">

            <!-- Config da prova -->
            <div class="uadm-prova-config">
              <div class="uadm-field">
                <label class="uadm-label">Nota mínima para aprovação (%)</label>
                <div class="uadm-nota-wrap">
                  <input class="uadm-input uadm-nota-input" id="f-nota-minima" type="number" min="1" max="100" value="${U.prova.nota_minima}">
                  <span class="uadm-nota-pct">%</span>
                </div>
              </div>
              <div class="uadm-field">
                <label class="uadm-label">Máx. tentativas</label>
                <input class="uadm-input" id="f-max-tentativas" type="number" min="1" max="99" value="${U.prova.max_tentativas}">
              </div>
              <div class="uadm-field">
                <label class="uadm-label">Dias para nova tentativa</label>
                <input class="uadm-input" id="f-dias-retry" type="number" min="0" max="365" value="${U.prova.dias_para_retry}">
              </div>
              <div class="uadm-field">
                <label class="uadm-label">Certificado</label>
                <label class="uadm-toggle">
                  <input type="checkbox" id="f-tem-certificado" ${U.prova.tem_certificado ? 'checked' : ''}>
                  <span class="uadm-toggle-slider"></span>
                  Emitir certificado ao passar
                </label>
              </div>
            </div>

            <!-- Quiz builder -->
            <div class="uadm-questoes-header">
              <span class="uadm-questoes-count" id="uadm-questoes-count">${U.questoes.length} questão${U.questoes.length !== 1 ? 'ões' : ''}</span>
              <span class="uadm-questoes-hint">Clique na alternativa correta para marcá-la</span>
            </div>

            <div id="uadm-questoes-wrap"></div>

            <button class="uadm-btn-add-modulo" id="btn-add-questao">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar questão
            </button>
          </div>
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

  syncModulosUI();
  syncQuestoesUI();
  _attachEditorListeners(el);
}

// ── Listeners do editor ────────────────────────────────────────────────────
function _attachAcoesPrincipais(el) {
  el.querySelector('#btn-voltar')?.addEventListener('click', () => showList(el));
  el.querySelector('#btn-cancelar')?.addEventListener('click', () => showList(el));

  el.querySelector('#btn-publicar')?.addEventListener('click',   () => salvar(true, el));
  el.querySelector('#btn-publicar-2')?.addEventListener('click', () => salvar(true, el));
  el.querySelector('#btn-rascunho')?.addEventListener('click',   () => salvar(false, el));
  el.querySelector('#btn-rascunho-2')?.addEventListener('click', () => salvar(false, el));
}

function _attachEditorListeners(el) {
  _attachAcoesPrincipais(el);

  el.querySelector('#btn-add-modulo')?.addEventListener('click', () => {
    U.modulos.push(emptyModulo(U.modulos.length + 1));
    syncModulosUI();
  });

  // Toggle prova
  el.querySelector('#f-tem-prova')?.addEventListener('change', e => {
    U.prova.ativa = e.target.checked;
    const body = document.getElementById('uadm-prova-body');
    const lbl  = e.target.closest('.uadm-toggle')?.querySelector('.uadm-toggle-label');
    if (body) body.style.display = U.prova.ativa ? 'block' : 'none';
    if (lbl)  lbl.textContent = U.prova.ativa ? 'Ativada' : 'Desativada';
  });

  // Adicionar questão
  el.querySelector('#btn-add-questao')?.addEventListener('click', () => {
    U.questoes.push(emptyQuestao(U.questoes.length + 1));
    syncQuestoesUI();
  });

  // Upload imagem capa
  el.querySelector('#upload-capa')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      _showImgLoading('preview-capa');
      U.curso.capa_url = await uploadImagemAsset(file, 'capa');
      _updateImgPreview('preview-capa', U.curso.capa_url);
    } catch (err) { alert(`Erro no upload: ${err.message}`); }
  });

  el.querySelector('#upload-hero')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      _showImgLoading('preview-hero');
      U.curso.hero_img = await uploadImagemAsset(file, 'hero');
      _updateImgPreview('preview-hero', U.curso.hero_img);
    } catch (err) { alert(`Erro no upload: ${err.message}`); }
  });

  el.querySelector('#rm-capa')?.addEventListener('click', () => { U.curso.capa_url = ''; _renderEditor(el); });
  el.querySelector('#rm-hero')?.addEventListener('click', () => { U.curso.hero_img = ''; _renderEditor(el); });

  el.querySelectorAll('input[name="nivel"]').forEach(r => {
    r.addEventListener('change', () => {
      U.curso.nivel = r.value;
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
