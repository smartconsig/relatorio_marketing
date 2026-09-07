// Modo TV do Ranking BSC: overlay #bsc-tv-overlay (index.html) com 3 telas
// rotativas (pódio+times / destaque / carrossel). Timers e listeners de
// teclado/clique vivem todos aqui — enterTVMode registra, exitTVMode desfaz.
import { state } from '../../state.js';
import { toast } from '../../utils/ui.js';
import { fmtBRL } from '../../utils/currency.js';
import {
  LOGO_URL, TEAM_COLORS, TEAM_LABELS,
  normEquipe, teamColor, teamLabel, tempoInfo, quartilInfo,
  medalIcon, avatarHtml,
} from './bsc-shared.js';

let _tvClock    = null;
let _tvRotation = null;
let _tvScreen   = 0;
// Mutado no lugar (nunca reatribuído) — importBar lê a ligação viva.
export const TV_DURATIONS = [15000, 15000, 20000];

export function loadTVDurations() {
  try {
    const s = localStorage.getItem('sc_tv_durations');
    if (s) { const d = JSON.parse(s); TV_DURATIONS[0] = d[0]; TV_DURATIONS[1] = d[1]; TV_DURATIONS[2] = d[2]; }
  } catch {}
}

export function saveTVDurations() {
  const get = id => Math.max(5, parseInt(document.getElementById(id)?.value) || 15) * 1000;
  TV_DURATIONS[0] = get('tv-dur-0');
  TV_DURATIONS[1] = get('tv-dur-1');
  TV_DURATIONS[2] = get('tv-dur-2');
  try { localStorage.setItem('sc_tv_durations', JSON.stringify(TV_DURATIONS)); } catch {}
  toast('Durações salvas');
}

export function enterTVMode() {
  if (!state.bsc?.sellers?.length) { toast('Importe o BSC antes de entrar no Modo TV', 'err'); return; }
  loadTVDurations();
  _tvScreen = 0;
  document.getElementById('bsc-tv-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _renderTVScreen(0);
  updateTVClock();
  _tvClock = setInterval(updateTVClock, 1000);
  _scheduleNext();
  document.addEventListener('keydown', _escHandler);
  document.getElementById('bsc-tv-overlay').addEventListener('click', _tvClickHandler);
}

function _scheduleNext() {
  clearTimeout(_tvRotation);
  _tvRotation = setTimeout(() => {
    _tvScreen = (_tvScreen + 1) % 3;
    _renderTVScreen(_tvScreen);
    _scheduleNext();
  }, TV_DURATIONS[_tvScreen]);
}

function _renderTVScreen(n) {
  const body = document.getElementById('bsc-tv-body');
  body.style.opacity = '0';
  setTimeout(() => {
    if (n === 0) renderTV();
    else if (n === 1) renderTVSpotlight();
    else renderTVCarousel();
    body.style.transition = 'opacity 0.6s ease';
    body.style.opacity = '1';
  }, 300);
}

export function exitTVMode() {
  document.getElementById('bsc-tv-overlay').style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(_tvClock);
  clearTimeout(_tvRotation);
  document.removeEventListener('keydown', _escHandler);
  document.getElementById('bsc-tv-overlay').removeEventListener('click', _tvClickHandler);
}

function _tvClickHandler(e) {
  // Ignore clicks on the exit button
  if (e.target.closest('.tv-exit-btn')) return;
  _tvScreen = (_tvScreen + 1) % 3;
  _renderTVScreen(_tvScreen);
  _scheduleNext();
}

function _escHandler(e) {
  if (e.key === 'Escape') { exitTVMode(); return; }
  if (e.key === 'ArrowRight' || e.key === ' ') {
    _tvScreen = (_tvScreen + 1) % 3;
    _renderTVScreen(_tvScreen);
    _scheduleNext();
  }
  if (e.key === 'ArrowLeft') {
    _tvScreen = (_tvScreen + 2) % 3;
    _renderTVScreen(_tvScreen);
    _scheduleNext();
  }
}

function updateTVClock() {
  const el = document.getElementById('tv-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function _tvHeader(title, monthYear) {
  return `
    <div class="tv-header">
      <img src="${LOGO_URL}" class="tv-logo" onerror="this.style.display='none'" alt="Smart Consig">
      <div class="tv-title">${title} — ${(monthYear || '').toUpperCase()}</div>
      <div id="tv-clock" class="tv-clock"></div>
    </div>`;
}

function _tvDots(active) {
  return `<div class="tv-dots">
    <span class="tv-dot ${active===0?'tv-dot-on':''}"></span>
    <span class="tv-dot ${active===1?'tv-dot-on':''}"></span>
    <span class="tv-dot ${active===2?'tv-dot-on':''}"></span>
  </div>`;
}

function tvPodiumCard(seller) {
  if (!seller) return '<div></div>';
  const tc  = teamColor(seller.equipe);
  const ti  = tempoInfo(seller.tempoAdmissao);
  const qi  = quartilInfo(seller.quartil);
  const is1 = seller.rank === 1;
  const avatarSize = is1 ? 140 : 110;
  return `
    <div class="tv-podium-card ${is1 ? 'tv-podium-1st' : ''}" style="border-left:6px solid ${tc}">
      <!-- Left: medal + avatar -->
      <div class="tv-podium-left">
        <div class="tv-medal">${medalIcon(seller.rank)}</div>
        ${avatarHtml(seller, avatarSize)}
      </div>
      <!-- Right: info -->
      <div class="tv-podium-right">
        <div class="tv-seller-name">${seller.nome}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
          <span class="bsc-badge tv-badge" style="background:${tc}20;color:${tc};border-color:${tc}50">${teamLabel(seller.equipe)}</span>
          <span class="bsc-badge tv-badge" style="background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3)">${ti.label}</span>
        </div>
        <div class="tv-nota">${seller.nota.toFixed(1)}</div>
        <div class="tv-quartil" style="color:${qi.color}">${qi.label}</div>
        <div class="tv-metrics">
          <div><span>Pagamentos</span><strong>${fmtBRL(seller.pgtos)}</strong></div>
          <div><span>Propostas</span><strong>${fmtBRL(seller.propostas)}</strong></div>
        </div>
      </div>
    </div>`;
}

function tvListCard(seller) {
  const tc = teamColor(seller.equipe);
  const ti = tempoInfo(seller.tempoAdmissao);
  return `
    <div class="tv-list-card" style="border-top:3px solid ${tc}">
      <div class="tv-list-rank" style="color:${tc}">${seller.rank}</div>
      ${avatarHtml(seller, 52)}
      <div class="tv-list-name">${seller.nome}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:4px">
        <span class="bsc-badge" style="font-size:11px;background:${tc}20;color:${tc};border-color:${tc}40">${teamLabel(seller.equipe)}</span>
        <span class="bsc-badge" style="font-size:11px;background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3)">${ti.label}</span>
      </div>
      <div class="tv-list-nota" style="color:${tc}">${seller.nota.toFixed(1)}</div>
    </div>`;
}

function teamScoreboard(sellers) {
  // Build stats per team from all sellers in the ranking
  const stats = {};
  sellers.forEach(s => {
    const key = normEquipe(s.equipe);
    if (!key) return;
    if (!stats[key]) stats[key] = { total: 0, count: 0 };
    stats[key].total += s.nota;
    stats[key].count += 1;
  });

  const teams = Object.entries(stats)
    .map(([key, v]) => ({ key, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  if (!teams.length) return '';

  const maxAvg = teams[0].avg;

  const cards = teams.map((t, i) => {
    const tc  = TEAM_COLORS[t.key] || '#6b7280';
    const lbl = TEAM_LABELS[t.key] || t.key;
    const pct = ((t.avg / maxAvg) * 100).toFixed(1);
    const medal = i === 0 ? '🏆 ' : '';
    return `
      <div class="tv-team-card" style="border-top:4px solid ${tc}">
        <div class="tv-team-name" style="color:${tc}">${medal}${lbl}</div>
        <div class="tv-team-avg">${t.avg.toFixed(1)}</div>
        <div class="tv-team-bar-wrap">
          <div class="tv-team-bar" style="width:${pct}%;background:${tc}"></div>
        </div>
        <div class="tv-team-count">${t.count} vendedor${t.count > 1 ? 'es' : ''}</div>
      </div>`;
  }).join('');

  return `
    <div class="tv-strip-title" style="margin-top:14px">Placar por Equipes</div>
    <div class="tv-teams">${cards}</div>`;
}

function renderTV() {
  const { sellers, monthYear } = state.bsc;
  const top3   = sellers.filter(s => s.rank <= 3).sort((a, b) => a.rank - b.rank);
  const top10  = sellers.filter(s => s.rank >= 4 && s.rank <= 10).sort((a, b) => a.rank - b.rank);
  const podium = [top3[1], top3[0], top3[2]];

  document.getElementById('bsc-tv-body').innerHTML = `
    ${_tvHeader('🏆 RANKING BSC', monthYear)}
    <div class="tv-content">
      <div class="tv-podium">
        ${podium.map(s => tvPodiumCard(s)).join('')}
      </div>
      ${top10.length ? `
      <div class="tv-strip-title">Top 4 – 10</div>
      <div class="tv-strip">${top10.map(s => tvListCard(s)).join('')}</div>` : ''}
      ${teamScoreboard(sellers)}
    </div>
    ${_tvDots(0)}
    <button class="tv-exit-btn" onclick="exitTVMode()" title="Sair (Esc)">✕</button>
  `;
}

function renderTVSpotlight() {
  const { sellers, monthYear } = state.bsc;
  const first = sellers.find(s => s.rank === 1);
  if (!first) return renderTV();
  const tc = teamColor(first.equipe);
  const ti = tempoInfo(first.tempoAdmissao);
  const qi = quartilInfo(first.quartil);

  document.getElementById('bsc-tv-body').innerHTML = `
    ${_tvHeader('🥇 DESTAQUE DO MÊS', monthYear)}
    <div class="tv-spotlight">
      <div class="tv-spotlight-left">
        <div style="font-size:72px;line-height:1">🥇</div>
        ${avatarHtml(first, 200)}
      </div>
      <div class="tv-spotlight-right">
        <div class="tv-spotlight-name">${first.nome}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:14px 0">
          <span class="bsc-badge" style="font-size:15px;padding:6px 18px;background:${tc}20;color:${tc};border-color:${tc}50">${teamLabel(first.equipe)}</span>
          <span class="bsc-badge" style="font-size:15px;padding:6px 18px;background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3)">${ti.label}</span>
        </div>
        <div class="tv-spotlight-nota" style="color:${tc}">${first.nota.toFixed(1)}</div>
        <div class="tv-spotlight-quartil" style="color:${qi.color}">${qi.label}</div>
        <div class="tv-spotlight-metrics">
          <div><span>Pagamentos</span><strong>${fmtBRL(first.pgtos)}</strong></div>
          <div><span>Propostas</span><strong>${fmtBRL(first.propostas)}</strong></div>
        </div>
      </div>
    </div>
    ${_tvDots(1)}
    <button class="tv-exit-btn" onclick="exitTVMode()" title="Sair (Esc)">✕</button>
  `;
}

function renderTVCarousel() {
  const { sellers, monthYear } = state.bsc;
  const rest = sellers.filter(s => s.rank >= 11).sort((a, b) => a.rank - b.rank);
  if (!rest.length) { _tvScreen = 0; renderTV(); return; }

  // Duplicate for seamless infinite loop
  const cardHtml = s => {
    const tc = teamColor(s.equipe);
    const ti = tempoInfo(s.tempoAdmissao);
    return `
      <div class="tv-carousel-card" style="border-top:4px solid ${tc}">
        <div class="tv-carousel-rank" style="color:${tc}">${s.rank}</div>
        ${avatarHtml(s, 80)}
        <div class="tv-carousel-name">${s.nome}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:6px 0">
          <span class="bsc-badge" style="font-size:11px;background:${tc}20;color:${tc};border-color:${tc}40">${teamLabel(s.equipe)}</span>
          <span class="bsc-badge" style="font-size:11px;background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3)">${ti.label}</span>
        </div>
        <div class="tv-carousel-nota" style="color:${tc}">${s.nota.toFixed(1)}</div>
      </div>`;
  };
  const cards = [...rest, ...rest].map(cardHtml).join('');
  // Animation duration: ~12s per card width so it scrolls slowly
  const dur = rest.length * 6;

  document.getElementById('bsc-tv-body').innerHTML = `
    ${_tvHeader('👥 TODOS OS VENDEDORES', monthYear)}
    <div class="tv-content" style="justify-content:center">
      <div class="tv-strip-title">Desempenho completo da equipe</div>
      <div class="tv-carousel-wrap">
        <div class="tv-carousel-track" style="animation-duration:${dur}s">
          ${cards}
        </div>
      </div>
    </div>
    ${_tvDots(2)}
    <button class="tv-exit-btn" onclick="exitTVMode()" title="Sair (Esc)">✕</button>
  `;
}
