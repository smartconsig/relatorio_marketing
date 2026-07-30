import { state }             from '../state.js';
import { toast }             from '../utils/ui.js';
import { fmtBRL }            from '../utils/currency.js';
import { parseParceiros }    from '../core/parseParceiros.js';
import { saveParceiros, loadParceiros } from '../services/parceiros-svc.js';
import { sb }                from '../services/supabase.js';

const STORAGE_BASE = 'https://gfxfuzmoywdsiyctkrux.supabase.co/storage/v1/object/public';

// Modo "mostrar valores" — desligado por padrão (tela limpa para print). Uso interno.
let _showValues = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(nome) {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function initials(nome) {
  const parts = nome.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function rankColor(rank) {
  if (rank === 1) return '#f59e0b'; // ouro
  if (rank === 2) return '#9ca3af'; // prata
  if (rank === 3) return '#b45309'; // bronze
  return '#6b7280';
}

function medalIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  return '🥉';
}

const _logoCacheBust = {};

function logoHtml(p, size, editable = false) {
  const slug = normalizeName(p.nome);
  const bust = _logoCacheBust[slug];
  const url  = `${STORAGE_BASE}/avatars/parceiros/${slug}.jpg${bust ? '?t=' + bust : ''}`;
  const rc   = rankColor(p.rank);
  return `
    <div class="parc-logo" style="width:${size}px;height:${size}px;border-color:${rc}">
      <img src="${url}" alt="${p.nome}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="parc-logo-fallback" style="display:none;background:${rc}">${initials(p.nome)}</div>
      ${editable ? `<button type="button" class="parc-logo-edit" title="Editar logo"
        onclick="event.stopPropagation();startEditParceiroLogo(${p._i})">✎</button>` : ''}
    </div>`;
}

function metricsHtml(p, compact = false) {
  const rows = compact
    ? [['Integrado', p.integrado], ['Em andamento', p.emAndamento], ['Projeção', p.projecao]]
    : [
        ['Reprovado', p.reprovado],
        ['Cliente desistiu', p.clienteDesistiu],
        ['Pendência', p.pendencia],
        ['Risco de perda', p.riscoPerda],
        ['Em andamento', p.emAndamento],
        ['Integrado', p.integrado],
        ['Projeção', p.projecao],
      ];
  const cls = compact ? 'parc-metrics parc-metrics-row' : 'parc-metrics';
  return `<div class="${cls}">${rows.map(([l, v]) =>
    `<div><span>${l}</span><strong>${fmtBRL(v)}</strong></div>`).join('')}</div>`;
}

// ── Logo edit (upload to Supabase Storage) ─────────────────────────────────

let _editingLogoNome = null;

export function startEditParceiroLogo(i) {
  const p = state.parceiros?.partners?.[i];
  if (!p) return;
  _editingLogoNome = p.nome;
  document.getElementById('parc-logo-input').click();
}

export async function onParceiroLogoChange(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !_editingLogoNome) return;
  if (!file.type.startsWith('image/')) { toast('Selecione um arquivo de imagem', 'err'); return; }

  const slug = normalizeName(_editingLogoNome);
  try {
    const { error } = await sb.storage.from('avatars').upload(`parceiros/${slug}.jpg`, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    _logoCacheBust[slug] = Date.now();
    toast('✅ Logo atualizada');
    renderParceiros();
  } catch (err) {
    toast('Erro ao enviar logo: ' + err.message, 'err');
    console.error(err);
  }
}

// ── Import ─────────────────────────────────────────────────────────────────

export function importParceirosFile() {
  document.getElementById('parc-file-input').click();
}

export async function onParceirosFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const buf = ev.target.result;
      // Tenta UTF-8; se vier caractere de substituição (acentos quebrados),
      // reinterpreta como windows-1252 (é como o Excel exporta esse CSV).
      let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
      text = text.replace(/^﻿/, ''); // remove BOM

      const result = parseParceiros(text);
      if (!result.partners.length) { toast('Nenhum parceiro encontrado no arquivo', 'err'); return; }

      state.parceiros = { ...result, importedAt: new Date().toISOString(), importedBy: state.currentUser?.email || '' };
      try { localStorage.setItem('sc_parceiros_v1', JSON.stringify(state.parceiros)); } catch {}
      await saveParceiros(state.parceiros);
      renderParceiros();
      toast(`✅ Ranking importado: ${result.partners.length} parceiros`);
    } catch (err) {
      toast('Erro ao processar planilha: ' + err.message, 'err');
      console.error(err);
    }
  };
  r.readAsArrayBuffer(file);
  e.target.value = '';
}

export async function initParceiros() {
  try { _showValues = localStorage.getItem('sc_parceiros_showvals') === '1'; } catch {}

  // Carrega do localStorage primeiro (instantâneo)
  try {
    const raw = localStorage.getItem('sc_parceiros_v1');
    if (raw) state.parceiros = JSON.parse(raw);
  } catch {}

  // Sempre renderiza (mostra barra de import mesmo sem dados)
  renderParceiros();

  // Depois checa o Supabase por dado mais novo
  if (state.currentUser) {
    const remote = await loadParceiros();
    if (remote) {
      const localTs = state.parceiros?.importedAt || '';
      if (!localTs || (remote.importedAt || '') > localTs) {
        state.parceiros = remote;
        try { localStorage.setItem('sc_parceiros_v1', JSON.stringify(state.parceiros)); } catch {}
        renderParceiros();
      }
    }
  }
}

export function toggleParceirosValues() {
  _showValues = !_showValues;
  try { localStorage.setItem('sc_parceiros_showvals', _showValues ? '1' : '0'); } catch {}
  renderParceiros();
}

// ── Render ─────────────────────────────────────────────────────────────────

function importBar() {
  const p = state.parceiros;
  const updatedStr = p?.importedAt
    ? `Atualizado em ${new Date(p.importedAt).toLocaleString('pt-BR')}${p.importedBy ? ' por ' + p.importedBy : ''}`
    : 'Nenhum dado importado';
  const hasData = !!p?.partners?.length;
  return `
    <div class="bsc-import-bar">
      <div>
        <div class="bsc-import-period">🤝 Ranking Parceiros</div>
        <div class="bsc-import-info">${updatedStr}</div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${hasData ? `<button class="btn-sm btn-ghost" onclick="toggleParceirosValues()">${_showValues ? '🙈 Esconder valores' : '👁 Mostrar valores'}</button>` : ''}
        <button class="btn-sm btn-ghost" onclick="importParceirosFile()">📥 Importar planilha</button>
        <input type="file" id="parc-file-input" accept=".csv" style="display:none" onchange="onParceirosFileChange(event)">
        <input type="file" id="parc-logo-input" accept="image/*" style="display:none" onchange="onParceiroLogoChange(event)">
      </div>
    </div>`;
}

function podiumCard(p) {
  const rc  = rankColor(p.rank);
  const is1 = p.rank === 1;
  return `
    <div class="parc-podium-card ${is1 ? 'parc-podium-1st' : ''}" style="border-top:4px solid ${rc}">
      <div class="parc-podium-medal">${medalIcon(p.rank)}</div>
      <div style="display:flex;justify-content:center;margin:12px 0">
        ${logoHtml(p, is1 ? 96 : 78, true)}
      </div>
      <div class="parc-podium-rank" style="color:${rc}">${p.rank}º lugar</div>
      <div class="parc-podium-name">${p.nome}</div>
      ${_showValues ? metricsHtml(p) : ''}
    </div>`;
}

function listCard(p) {
  const rc = rankColor(p.rank);
  return `
    <div class="parc-list-card" style="border-left:4px solid ${rc}">
      <div class="parc-list-rank" style="color:${rc}">${p.rank || '–'}</div>
      ${logoHtml(p, 46, true)}
      <div class="parc-list-info">
        <div class="parc-list-name">${p.nome}</div>
        ${_showValues ? metricsHtml(p, true) : ''}
      </div>
    </div>`;
}

export function renderParceiros() {
  const el = document.getElementById('parceiros-body');
  if (!el) return;

  if (!state.parceiros?.partners?.length) {
    el.innerHTML = importBar() + `
      <div class="empty" style="margin-top:48px">
        <div class="empty-icon">🤝</div>
        <div class="empty-title">Nenhum ranking importado</div>
        <div class="empty-desc">Importe a planilha de produção de parceiros para visualizar o ranking.</div>
      </div>`;
    return;
  }

  const partners = state.parceiros.partners;
  partners.forEach((p, i) => { p._i = i; });

  const top3 = partners.filter(p => p.rank >= 1 && p.rank <= 3).sort((a, b) => a.rank - b.rank);
  const rest = partners.filter(p => !(p.rank >= 1 && p.rank <= 3))
                       .sort((a, b) => (a.rank - b.rank) || (b.integrado - a.integrado));
  // Ordem do pódio: 2º à esquerda, 1º ao centro, 3º à direita
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);

  let h = importBar();
  h += `<div class="section-title" style="margin-top:24px"><span class="bar"></span>Top 3 — Destaques</div>
        <div class="parc-podium">${podium.map(podiumCard).join('')}</div>`;
  if (rest.length) {
    h += `<div class="section-title" style="margin-top:28px"><span class="bar"></span>Classificação completa</div>
          <div class="parc-list">${rest.map(listCard).join('')}</div>`;
  }

  el.innerHTML = h;
}
