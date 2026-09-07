// Overlay "Top Parceiros" (tela cheia estilo modo TV): pódio 2º-1º-3º + grid,
// botões Top 10/25/50, relógio, valores ocultos por padrão. Só exibição —
// não persiste nada. Overlay #parc-tv-overlay vem do index.html.
import { state } from '../../state.js';
import { toast } from '../../utils/ui.js';
import { fmtBRL } from '../../utils/currency.js';
import { LOGO_URL, rankColor, medalIcon, logoHtml, annotateGaps } from './parc-shared.js';

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
