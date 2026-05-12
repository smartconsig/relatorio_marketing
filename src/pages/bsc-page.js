import { state }       from '../state.js';
import { toast }        from '../utils/ui.js';
import { fmtBRL }       from '../utils/currency.js';
import { parseBSC }     from '../core/parseBSC.js';
import { saveBSC, loadBSC } from '../services/bsc-svc.js';

const STORAGE_BASE = 'https://gfxfuzmoywdsiyctkrux.supabase.co/storage/v1/object/public';
const LOGO_URL     = `${STORAGE_BASE}/assets/logo.png`;

// ── Brand / team config ────────────────────────────────────────────────────

const TEAM_COLORS = {
  FENIX:  '#940b10',
  ZION:   '#eab308',
  ALFA:   '#6b7280',
  TITA:   '#7c3aed',
  THEMIS: '#f97316',
};

const TEAM_LABELS = {
  FENIX:  'Fênix',
  ZION:   'Zion',
  ALFA:   'Alfa',
  TITA:   'Titã',
  THEMIS: 'Thêmis',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function normEquipe(eq) {
  return (eq || '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeName(nome) {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function teamColor(equipe)  { return TEAM_COLORS[normEquipe(equipe)]  || '#6b7280'; }
function teamLabel(equipe)  { return TEAM_LABELS[normEquipe(equipe)]  || equipe;    }

function tempoInfo(tempo) {
  const t = (tempo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('menos de 1'))  return { label: '< 1 mês',    color: '#6b7280' };
  if (t.includes('entre 1 e 3')) return { label: '1–3 meses',  color: '#94a3b8' };
  if (t.includes('entre 3 e 6')) return { label: '3–6 meses',  color: '#a78bfa' };
  if (t.includes('entre 6'))     return { label: '6–12 meses', color: '#22c55e' };
  if (t.includes('mais de 1'))   return { label: '+ 1 ano ⭐', color: '#f59e0b' };
  return { label: tempo, color: '#6b7280' };
}

function quartilInfo(q) {
  if (q === 1) return { label: 'Excelente', color: '#f59e0b' };
  if (q === 2) return { label: 'Bom',       color: '#22c55e' };
  if (q === 3) return { label: 'Atenção',   color: '#f97316' };
  return         { label: 'Crítico',  color: '#ef4444' };
}

function initials(nome) {
  const parts = nome.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function avatarHtml(seller, size) {
  const url = `${STORAGE_BASE}/avatars/${normalizeName(seller.nome)}.jpg`;
  const tc  = teamColor(seller.equipe);
  return `
    <div class="bsc-avatar" style="width:${size}px;height:${size}px;border:3px solid ${tc}">
      <img src="${url}" alt="${seller.nome}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="bsc-avatar-fallback" style="display:none;background:${tc}">${initials(seller.nome)}</div>
    </div>`;
}

function medalIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  return '🥉';
}

// ── Import ─────────────────────────────────────────────────────────────────

export function importBSCFile() {
  document.getElementById('bsc-file-input').click();
}

export async function onBSCFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const result = parseBSC(ev.target.result);
      if (!result.sellers.length) { toast('Nenhum vendedor encontrado no arquivo', 'err'); return; }
      state.bsc = { ...result, importedAt: new Date().toISOString(), importedBy: state.currentUser?.email || '' };
      try { localStorage.setItem('sc_bsc_v1', JSON.stringify(state.bsc)); } catch {}
      await saveBSC(state.bsc);
      renderBSC();
      toast(`✅ BSC importado: ${result.sellers.length} vendedores · ${result.monthYear}`);
    } catch (err) {
      toast('Erro ao processar BSC: ' + err.message, 'err');
      console.error(err);
    }
  };
  r.readAsArrayBuffer(file);
  e.target.value = '';
}

export async function initBSC() {
  // Load from localStorage first (instant)
  try {
    const raw = localStorage.getItem('sc_bsc_v1');
    if (raw) state.bsc = JSON.parse(raw);
  } catch {}

  // Always render (shows import bar even with no data)
  renderBSC();

  // Then check Supabase for newer data
  if (state.currentUser) {
    const remote = await loadBSC();
    if (remote) {
      const localTs = state.bsc?.importedAt || '';
      if (!localTs || (remote.importedAt || '') > localTs) {
        state.bsc = remote;
        try { localStorage.setItem('sc_bsc_v1', JSON.stringify(state.bsc)); } catch {}
        renderBSC();
      }
    }
  }
}

// ── Normal mode render ─────────────────────────────────────────────────────

function importBar() {
  const bsc = state.bsc;
  const updatedStr = bsc?.importedAt
    ? `Atualizado em ${new Date(bsc.importedAt).toLocaleString('pt-BR')}${bsc.importedBy ? ' por ' + bsc.importedBy : ''}`
    : 'Nenhum dado importado';
  return `
    <div class="bsc-import-bar">
      <div>
        <div class="bsc-import-period">${bsc?.monthYear ? '📅 ' + bsc.monthYear : 'Ranking BSC'}</div>
        <div class="bsc-import-info">${updatedStr}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn-sm btn-ghost" onclick="importBSCFile()">📥 Importar BSC</button>
        <input type="file" id="bsc-file-input" accept=".xlsx,.xls" style="display:none" onchange="onBSCFileChange(event)">
        ${bsc ? `<button class="btn-sm btn-primary" onclick="enterTVMode()">📺 Modo TV</button>` : ''}
      </div>
    </div>`;
}

function podiumCard(seller) {
  const tc  = teamColor(seller.equipe);
  const ti  = tempoInfo(seller.tempoAdmissao);
  const qi  = quartilInfo(seller.quartil);
  const is1 = seller.rank === 1;
  return `
    <div class="bsc-podium-card ${is1 ? 'bsc-podium-1st' : ''}" style="border-top:4px solid ${tc}">
      <div class="bsc-podium-medal">${medalIcon(seller.rank)}</div>
      <div style="display:flex;justify-content:center;margin:12px 0">
        ${avatarHtml(seller, is1 ? 88 : 72)}
      </div>
      <div class="bsc-podium-name">${seller.nome}</div>
      <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:8px 0">
        <span class="bsc-badge" style="background:${tc}20;color:${tc};border-color:${tc}40">${teamLabel(seller.equipe)}</span>
        <span class="bsc-badge" style="background:${ti.color}20;color:${ti.color};border-color:${ti.color}40">${ti.label}</span>
      </div>
      <div class="bsc-podium-nota">${seller.nota.toFixed(1)}</div>
      <div class="bsc-podium-quartil" style="color:${qi.color}">${qi.label}</div>
      <div class="bsc-podium-metrics">
        <div><span>Pagamentos</span><strong>${fmtBRL(seller.pgtos)}</strong></div>
        <div><span>Propostas</span><strong>${fmtBRL(seller.propostas)}</strong></div>
      </div>
    </div>`;
}

function listCard(seller) {
  const tc  = teamColor(seller.equipe);
  const ti  = tempoInfo(seller.tempoAdmissao);
  const pct = Math.min((seller.nota / 100) * 100, 100).toFixed(1);
  return `
    <div class="bsc-list-card" style="border-left:4px solid ${tc}">
      <div class="bsc-list-rank" style="color:${tc}">${seller.rank}</div>
      ${avatarHtml(seller, 48)}
      <div class="bsc-list-info">
        <div class="bsc-list-name">${seller.nome}</div>
        <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap">
          <span class="bsc-badge" style="background:${tc}20;color:${tc};border-color:${tc}40">${teamLabel(seller.equipe)}</span>
          <span class="bsc-badge" style="background:${ti.color}20;color:${ti.color};border-color:${ti.color}40">${ti.label}</span>
        </div>
        <div class="bsc-bar-wrap"><div class="bsc-bar" style="width:${pct}%;background:${tc}"></div></div>
      </div>
      <div class="bsc-list-nota" style="color:${tc}">${seller.nota.toFixed(1)}</div>
    </div>`;
}

export function renderBSC() {
  const el = document.getElementById('bsc-body');
  if (!el) return;

  if (!state.bsc?.sellers?.length) {
    el.innerHTML = importBar() + `
      <div class="empty" style="margin-top:48px">
        <div class="empty-icon">🏆</div>
        <div class="empty-title">Nenhum ranking importado</div>
        <div class="empty-desc">Importe a planilha BSC para visualizar o ranking.</div>
      </div>`;
    return;
  }

  const { sellers } = state.bsc;
  const top3  = sellers.filter(s => s.rank <= 3).sort((a, b) => a.rank - b.rank);
  const top10 = sellers.filter(s => s.rank >= 4 && s.rank <= 10).sort((a, b) => a.rank - b.rank);
  // Podium order: 2nd left, 1st center, 3rd right
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);

  let h = importBar();
  h += `<div class="section-title" style="margin-top:24px"><span class="bar"></span>Top 3 — Destaques</div>
        <div class="bsc-podium">${podium.map(s => podiumCard(s)).join('')}</div>`;
  if (top10.length) {
    h += `<div class="section-title" style="margin-top:28px"><span class="bar"></span>Top 4 – 10</div>
          <div class="bsc-list">${top10.map(s => listCard(s)).join('')}</div>`;
  }

  el.innerHTML = h;
}

// ── TV mode ────────────────────────────────────────────────────────────────

let _tvClock = null;

export function enterTVMode() {
  if (!state.bsc?.sellers?.length) { toast('Importe o BSC antes de entrar no Modo TV', 'err'); return; }
  renderTV();
  document.getElementById('bsc-tv-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updateTVClock();
  _tvClock = setInterval(updateTVClock, 1000);
  document.addEventListener('keydown', _escHandler);
}

export function exitTVMode() {
  document.getElementById('bsc-tv-overlay').style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(_tvClock);
  document.removeEventListener('keydown', _escHandler);
}

function _escHandler(e) { if (e.key === 'Escape') exitTVMode(); }

function updateTVClock() {
  const el = document.getElementById('tv-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  const top3  = sellers.filter(s => s.rank <= 3).sort((a, b) => a.rank - b.rank);
  const top10 = sellers.filter(s => s.rank >= 4 && s.rank <= 10).sort((a, b) => a.rank - b.rank);
  const podium = [top3[1], top3[0], top3[2]];

  document.getElementById('bsc-tv-body').innerHTML = `
    <div class="tv-header">
      <img src="${LOGO_URL}" class="tv-logo" onerror="this.style.display='none'" alt="Smart Consig">
      <div class="tv-title">🏆 RANKING BSC — ${(monthYear || '').toUpperCase()}</div>
      <div id="tv-clock" class="tv-clock"></div>
    </div>
    <div class="tv-content">
      <div class="tv-podium">
        ${podium.map(s => tvPodiumCard(s)).join('')}
      </div>
      ${top10.length ? `
      <div class="tv-strip-title">Top 4 – 10</div>
      <div class="tv-strip">
        ${top10.map(s => tvListCard(s)).join('')}
      </div>` : ''}
      ${teamScoreboard(sellers)}
    </div>
    <button class="tv-exit-btn" onclick="exitTVMode()" title="Sair (Esc)">✕</button>
  `;
}
