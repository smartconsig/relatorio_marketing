// Ranking de Parceiros — página (import + pódio + lista + edição de logo).
// O overlay "Top Parceiros" vive em src/pages/parceiros/parc-top.js e os
// helpers em src/pages/parceiros/parc-shared.js. Este arquivo re-exporta os
// nomes públicos originais — main.js e auth.js não mudaram uma linha.
import { state }             from '../state.js';
import { icon }              from '../utils/icons.js';
import { toast }             from '../utils/ui.js';
import { fmtBRL }            from '../utils/currency.js';
import * as XLSX             from 'xlsx';
import { parseParceiros, parseParceirosRows } from '../core/parseParceiros.js';
import { saveParceiros, loadParceiros, uploadLogoParceiro } from '../services/parceiros-svc.js';
import { normalizeName, rankColor, medalIcon, logoHtml, logoCacheBust, annotateGaps } from './parceiros/parc-shared.js';

export { enterParceirosTop, exitParceirosTop, setParceirosTopN, toggleParceirosTopValues } from './parceiros/parc-top.js';

// Modo "mostrar valores" — desligado por padrão (tela limpa para print). Uso interno.
let _showValues = false;

// Número único em destaque: diferença de produção (Integrado) para o de cima.
function gapHtml(p, compact = false) {
  const cls = 'parc-gap' + (compact ? ' parc-gap-compact' : '');
  if (p._gapAbove == null) {
    return `<div class="${cls} parc-gap-leader">${icon('trophy', 11)} Líder</div>`;
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
    const { error } = await uploadLogoParceiro(slug, file);
    if (error) throw error;
    logoCacheBust[slug] = Date.now();
    toast('Logo atualizada');
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

// Detecta o formato pelo conteudo e devolve o ranking parseado.
function _parsearArquivoParceiros(buf) {
      const bytes = new Uint8Array(buf);
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        // Assinatura "PK" → arquivo .xlsx. O ranking fica na aba "Resumo";
        // valores brutos das células (raw) evitam problemas de formato de moeda.
        const wb    = XLSX.read(buf, { type: 'array' });
        const sheet = wb.SheetNames.find(n => n.trim().toLowerCase() === 'resumo') || wb.SheetNames[0];
        const rows  = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null });
        return parseParceirosRows(rows);
      }
        // CSV: tenta UTF-8; se vier caractere de substituição (acentos quebrados),
        // reinterpreta como windows-1252 (é como o Excel exporta esse CSV).
        let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
        text = text.replace(/^\uFEFF/, ''); // remove BOM
        return parseParceiros(text);
}

export async function onParceirosFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const result = _parsearArquivoParceiros(ev.target.result);
      if (!result.partners.length) { toast('Nenhum parceiro encontrado no arquivo', 'err'); return; }

      state.parceiros = { ...result, importedAt: new Date().toISOString(), importedBy: state.currentUser?.email || '' };
      try { localStorage.setItem('sc_parceiros_v1', JSON.stringify(state.parceiros)); } catch {}
      await saveParceiros(state.parceiros);
      renderParceiros();
      toast(`Ranking importado: ${result.partners.length} parceiros`);
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
        <div class="bsc-import-period">Ranking Parceiros</div>
        <div class="bsc-import-info">${updatedStr}</div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${hasData ? `<button class="btn-sm btn-ghost" onclick="enterParceirosTop()">${icon('trophy', 12)} Top Parceiros</button>` : ''}
        ${hasData ? `<button class="btn-sm btn-ghost" onclick="toggleParceirosValues()">${_showValues ? 'Esconder valores' : 'Mostrar valores'}</button>` : ''}
        <button class="btn-sm btn-ghost" onclick="importParceirosFile()">${icon('download', 12)} Importar planilha</button>
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
        <div class="empty-icon">${icon('users')}</div>
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
