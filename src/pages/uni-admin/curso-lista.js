// Lista de cursos do Criador. O botão "Editar"/"Novo Curso" abre o editor
// via callback injetado (onEditarCurso) — este módulo nunca importa o
// editor, evitando ciclo.
import { fetchTrilhas, fetchCursos } from '../../services/uni-admin-svc.js';
import { U, emptyCurso, emptyProva, nivelBadge } from './uadm-core.js';

// Callback registrado pelo orquestrador (abre o editor; null = curso novo)
let _onEditar = () => {};
export function onEditarCurso(fn) { _onEditar = fn; }

export async function reloadLista() {
  const [{ data: t }, { data: c }] = await Promise.all([fetchTrilhas(), fetchCursos()]);
  U.trilhas = t || [];
  U.cursos  = c || [];
}

export function showList(el) {
  U.curso   = emptyCurso();
  U.modulos = [];
  U.prova   = emptyProva();
  U.questoes = [];
  U.deletes = { modulos: [], aulas: [], questoes: [] };

  const rows = U.cursos.map(c => `
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
      <td>${nivelBadge(c.nivel)}</td>
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
          <p class="uadm-sub">${U.cursos.length} curso${U.cursos.length !== 1 ? 's' : ''} cadastrado${U.cursos.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="uadm-btn-primary" id="btn-novo">+ Novo Curso</button>
      </div>

      ${U.cursos.length === 0 ? `
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

  el.querySelector('#btn-novo')?.addEventListener('click', () => _onEditar(null, el));
  el.querySelector('#btn-novo-2')?.addEventListener('click', () => _onEditar(null, el));
  el.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = U.cursos.find(x => x.id === btn.dataset.edit);
      if (c) await _onEditar(c, el);
    });
  });
}
