// Ranking BSC — modo normal (pódio + lista) + import + edição de avatar.
// O modo TV vive em src/pages/bsc/bsc-tv.js e os helpers de marca/equipe em
// src/pages/bsc/bsc-shared.js. Este arquivo re-exporta os nomes públicos
// originais — main.js e auth.js não mudaram uma linha.
import { state }       from '../state.js';
import { icon }        from '../utils/icons.js';
import { toast }        from '../utils/ui.js';
import { fmtBRL }       from '../utils/currency.js';
import { parseBSC }     from '../core/parseBSC.js';
import { saveBSC, loadBSC } from '../services/bsc-svc.js';
import { sb }            from '../services/supabase.js';
import {
  normalizeName, teamColor, teamLabel, tempoInfo, quartilInfo,
  medalIcon, avatarHtml, avatarCacheBust,
} from './bsc/bsc-shared.js';
import { TV_DURATIONS } from './bsc/bsc-tv.js';

export { saveTVDurations, enterTVMode, exitTVMode } from './bsc/bsc-tv.js';

// ── Avatar edit (upload to Supabase Storage) ───────────────────────────────

let _editingAvatarNome = null;

export function startEditAvatar(rank) {
  const seller = state.bsc?.sellers?.find(s => s.rank === rank);
  if (!seller) return;
  _editingAvatarNome = seller.nome;
  document.getElementById('bsc-avatar-input').click();
}

export async function onAvatarFileChange(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !_editingAvatarNome) return;
  if (!file.type.startsWith('image/')) { toast('Selecione um arquivo de imagem', 'err'); return; }

  const slug = normalizeName(_editingAvatarNome);
  try {
    const { error } = await sb.storage.from('avatars').upload(`${slug}.jpg`, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    avatarCacheBust[slug] = Date.now();
    toast('Foto atualizada');
    renderBSC();
  } catch (err) {
    toast('Erro ao enviar foto: ' + err.message, 'err');
    console.error(err);
  }
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
      toast(`BSC importado: ${result.sellers.length} vendedores · ${result.monthYear}`);
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
  const d = TV_DURATIONS.map(ms => ms / 1000);
  return `
    <div class="bsc-import-bar">
      <div>
        <div class="bsc-import-period">${bsc?.monthYear ? icon('calendar', 12) + ' ' + bsc.monthYear : 'Ranking BSC'}</div>
        <div class="bsc-import-info">${updatedStr}</div>
      </div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray)">
          <span style="white-space:nowrap">⏱ Tela 1</span>
          <input type="number" id="tv-dur-0" value="${d[0]}" min="5" max="120"
            style="width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--white);font-size:12px;text-align:center">
          <span>s</span>
          <span style="white-space:nowrap;margin-left:4px">Tela 2</span>
          <input type="number" id="tv-dur-1" value="${d[1]}" min="5" max="120"
            style="width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--white);font-size:12px;text-align:center">
          <span>s</span>
          <span style="white-space:nowrap;margin-left:4px">Tela 3</span>
          <input type="number" id="tv-dur-2" value="${d[2]}" min="5" max="120"
            style="width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--white);font-size:12px;text-align:center">
          <span>s</span>
          <button class="btn-sm btn-ghost" onclick="saveTVDurations()" style="margin-left:4px">Salvar</button>
        </div>
        <button class="btn-sm btn-ghost" onclick="importBSCFile()">${icon('download', 12)} Importar BSC</button>
        <input type="file" id="bsc-file-input" accept=".xlsx,.xls" style="display:none" onchange="onBSCFileChange(event)">
        <input type="file" id="bsc-avatar-input" accept="image/*" style="display:none" onchange="onAvatarFileChange(event)">
        ${bsc ? `<button class="btn-sm btn-primary" onclick="enterTVMode()">${icon('tv', 12)} Modo TV</button>` : ''}
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
        ${avatarHtml(seller, is1 ? 88 : 72, true)}
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
      ${avatarHtml(seller, 48, true)}
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
        <div class="empty-icon">${icon('trophy')}</div>
        <div class="empty-title">Nenhum ranking importado</div>
        <div class="empty-desc">Importe a planilha BSC para visualizar o ranking.</div>
      </div>`;
    return;
  }

  const { sellers } = state.bsc;
  const top3  = sellers.filter(s => s.rank <= 3).sort((a, b) => a.rank - b.rank);
  const rest  = sellers.filter(s => s.rank >= 4).sort((a, b) => a.rank - b.rank);
  // Podium order: 2nd left, 1st center, 3rd right
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);

  let h = importBar();
  h += `<div class="section-title" style="margin-top:24px"><span class="bar"></span>Top 3 — Destaques</div>
        <div class="bsc-podium">${podium.map(s => podiumCard(s)).join('')}</div>`;
  if (rest.length) {
    h += `<div class="section-title" style="margin-top:28px"><span class="bar"></span>Classificação completa</div>
          <div class="bsc-list">${rest.map(s => listCard(s)).join('')}</div>`;
  }

  el.innerHTML = h;
}
