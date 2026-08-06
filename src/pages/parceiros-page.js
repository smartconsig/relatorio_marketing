import { state }             from '../state.js';
import { toast }             from '../utils/ui.js';
import { fmtBRL }            from '../utils/currency.js';
import * as XLSX             from 'xlsx';
import { parseParceiros, parseParceirosRows } from '../core/parseParceiros.js';
import { saveParceiros, loadParceiros } from '../services/parceiros-svc.js';
import { sb }                from '../services/supabase.js';

const STORAGE_BASE = 'https://gfxfuzmoywdsiyctkrux.supabase.co/storage/v1/object/public';
const LOGO_URL     = `${STORAGE_BASE}/assets/logo.png`;

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

// Anota em cada parceiro a diferença de INTEGRADO para o parceiro imediatamente
// acima no ranking (`_gapAbove`) e o rank desse parceiro de cima (`_aboveRank`).
// O líder fica com `_gapAbove = null`. Deve receber a lista completa.
function annotateGaps(partners) {
  const sorted = partners.slice()
    .sort((a, b) => (a.rank - b.rank) || (b.integrado - a.integrado));
  sorted.forEach((p, idx) => {
    if (idx === 0) {
      p._gapAbove = null;
      p._aboveRank = null;
    } else {
      const above = sorted[idx - 1];
      p._gapAbove = above.integrado - p.integrado;
      p._aboveRank = above.rank;
    }
  });
}

// Número único em destaque: diferença de produção (Integrado) para o de cima.
function gapHtml(p, compact = false) {
  const cls = 'parc-gap' + (compact ? ' parc-gap-compact' : '');
  if (p._gapAbove == null) {
    return `<div class="${cls} parc-gap-leader">🏆 Líder</div>`;
  }
  return `<div class="${cls}">
    <span class="parc-gap-caption">atrás do ${p._aboveRank}º</span>
    <strong class="parc-gap-value">${fmtBRL(p._gapAbove)}</strong>
  </div>`;
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
      const bytes = new Uint8Array(buf);
      let result;
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        // Assinatura "PK" → arquivo .xlsx. O ranking fica na aba "Resumo";
        // valores brutos das células (raw) evitam problemas de formato de moeda.
        const wb    = XLSX.read(buf, { type: 'array' });
        const sheet = wb.SheetNames.find(n => n.trim().toLowerCase() === 'resumo') || wb.SheetNames[0];
        const rows  = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null });
        result = parseParceirosRows(rows);
      } else {
        // CSV: tenta UTF-8; se vier caractere de substituição (acentos quebrados),
        // reinterpreta como windows-1252 (é como o Excel exporta esse CSV).
        let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
        text = text.replace(/^﻿/, ''); // remove BOM
        result = parseParceiros(text);
      }
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
        ${hasData ? `<button class="btn-sm btn-ghost" onclick="enterParceirosTop()">🏆 Top Parceiros</button>` : ''}
        ${hasData ? `<button class="btn-sm btn-ghost" onclick="toggleParceirosValues()">${_showValues ? '🙈 Esconder valores' : '👁 Mostrar valores'}</button>` : ''}
        <button class="btn-sm btn-ghost" onclick="importParceirosFile()">📥 Importar planilha</button>
        <input type="file" id="parc-file-input" accept=".csv,.xlsx" style="display:none" onchange="onParceirosFileChange(event)">
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
      ${_showValues ? gapHtml(p) : ''}
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
      </div>
      ${_showValues ? gapHtml(p, true) : ''}
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
  annotateGaps(partners);

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

// ── Top Parceiros (overlay tela cheia, estilo modo TV) ──────────────────────

const PARC_TOP_OPTIONS = [10, 25, 50];
let _topN          = 10;
let _topShowValues = false; // valores ocultos por padrão (tela limpa para print)
let _parcClock     = null;

export function enterParceirosTop() {
  if (!state.parceiros?.partners?.length) { toast('Importe o ranking antes de abrir o Top Parceiros', 'err'); return; }
  _topN = 10;
  document.getElementById('parc-tv-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _renderParcTop();
  updateParcClock();
  _parcClock = setInterval(updateParcClock, 1000);
  document.addEventListener('keydown', _parcEscHandler);
}

export function exitParceirosTop() {
  document.getElementById('parc-tv-overlay').style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(_parcClock);
  document.removeEventListener('keydown', _parcEscHandler);
}

export function setParceirosTopN(n) {
  _topN = n;
  _renderParcTop();
}

export function toggleParceirosTopValues() {
  _topShowValues = !_topShowValues;
  _renderParcTop();
}

function _parcEscHandler(e) {
  if (e.key === 'Escape') exitParceirosTop();
}

function updateParcClock() {
  const el = document.getElementById('parc-tv-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parcTopPodiumCard(p) {
  if (!p) return '<div></div>';
  const rc  = rankColor(p.rank);
  const is1 = p.rank === 1;
  return `
    <div class="parc-tv-podium-card ${is1 ? 'parc-tv-podium-1st' : ''}" style="border-top:5px solid ${rc}">
      <div class="parc-tv-medal">${medalIcon(p.rank)}</div>
      <div style="display:flex;justify-content:center;margin:10px 0">
        ${logoHtml(p, is1 ? 120 : 96, false)}
      </div>
      <div class="parc-tv-podium-rank" style="color:${rc}">${p.rank}º lugar</div>
      <div class="parc-tv-podium-name">${p.nome}</div>
      ${_topShowValues ? tvGapHtml(p) : ''}
    </div>`;
}

function tvGapHtml(p) {
  if (p._gapAbove == null) {
    return `<div class="parc-tv-gap parc-tv-gap-leader">🏆 Líder</div>`;
  }
  return `<div class="parc-tv-gap">
    <span class="parc-tv-gap-caption">atrás do ${p._aboveRank}º</span>
    <strong class="parc-tv-gap-value">${fmtBRL(p._gapAbove)}</strong>
  </div>`;
}

function parcTopListCard(p) {
  const rc = rankColor(p.rank);
  return `
    <div class="parc-tv-list-card" style="border-top:3px solid ${rc}">
      <div class="parc-tv-list-rank" style="color:${rc}">${p.rank || '–'}</div>
      ${logoHtml(p, 56, false)}
      <div class="parc-tv-list-name">${p.nome}</div>
      ${_topShowValues ? tvGapHtml(p) : ''}
    </div>`;
}

function _renderParcTop() {
  const all = (state.parceiros?.partners || [])
    .slice()
    .sort((a, b) => (a.rank - b.rank) || (b.integrado - a.integrado));
  annotateGaps(all);
  const shown = all.slice(0, _topN);

  const top3   = shown.filter(p => p.rank >= 1 && p.rank <= 3).sort((a, b) => a.rank - b.rank);
  const rest   = shown.filter(p => !(p.rank >= 1 && p.rank <= 3));
  const podium = [top3[1], top3[0], top3[2]]; // 2º-1º-3º (mantém posições vazias)

  const buttons = PARC_TOP_OPTIONS.map(n => {
    const disabled = all.length < n && n !== PARC_TOP_OPTIONS[0];
    return `<button class="parc-tv-qbtn ${n === _topN ? 'parc-tv-qbtn-on' : ''}"
      ${disabled ? 'disabled' : ''} onclick="setParceirosTopN(${n})">Top ${n}</button>`;
  }).join('');

  document.getElementById('parc-tv-body').innerHTML = `
    <div class="parc-tv-header">
      <img src="${LOGO_URL}" class="parc-tv-logo" onerror="this.style.display='none'" alt="Smart Consig">
      <div class="parc-tv-title">🏆 TOP PARCEIROS</div>
      <div id="parc-tv-clock" class="parc-tv-clock"></div>
    </div>
    <div class="parc-tv-qbar">
      ${buttons}
      <button class="parc-tv-qbtn ${_topShowValues ? 'parc-tv-qbtn-on' : ''}"
        onclick="toggleParceirosTopValues()">${_topShowValues ? '🙈 Ocultar valores' : '👁 Valores'}</button>
    </div>
    <div class="parc-tv-content">
      <div class="parc-tv-podium">${podium.map(parcTopPodiumCard).join('')}</div>
      ${rest.length ? `
        <div class="parc-tv-strip-title">Top 4 – ${shown[shown.length - 1]?.rank || _topN}</div>
        <div class="parc-tv-grid">${rest.map(parcTopListCard).join('')}</div>` : ''}
    </div>
    <button class="parc-tv-exit-btn" onclick="exitParceirosTop()" title="Sair (Esc)">✕</button>
  `;
}
