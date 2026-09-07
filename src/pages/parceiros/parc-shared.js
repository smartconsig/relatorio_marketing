// Helpers compartilhados do Ranking de Parceiros (página + overlay Top).
import { icon } from '../../utils/icons.js';

export const STORAGE_BASE = 'https://gfxfuzmoywdsiyctkrux.supabase.co/storage/v1/object/public';
export const LOGO_URL     = `${STORAGE_BASE}/assets/logo.png`;

export function normalizeName(nome) {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function initials(nome) {
  const parts = nome.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function rankColor(rank) {
  if (rank === 1) return '#f59e0b'; // ouro
  if (rank === 2) return '#9ca3af'; // prata
  if (rank === 3) return '#b45309'; // bronze
  return '#6b7280';
}

export function medalIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  return '🥉';
}

// Mutado por propriedade (nunca reatribuído) — ligação ESM viva.
export const logoCacheBust = {};

export function logoHtml(p, size, editable = false) {
  const slug = normalizeName(p.nome);
  const bust = logoCacheBust[slug];
  const url  = `${STORAGE_BASE}/avatars/parceiros/${slug}.jpg${bust ? '?t=' + bust : ''}`;
  const rc   = rankColor(p.rank);
  return `
    <div class="parc-logo" style="width:${size}px;height:${size}px;border-color:${rc}">
      <img src="${url}" alt="${p.nome}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="parc-logo-fallback" style="display:none;background:${rc}">${initials(p.nome)}</div>
      ${editable ? `<button type="button" class="parc-logo-edit" title="Editar logo"
        onclick="event.stopPropagation();startEditParceiroLogo(${p._i})">${icon('edit', 11)}</button>` : ''}
    </div>`;
}

// Anota em cada parceiro a diferença de INTEGRADO para o parceiro imediatamente
// acima no ranking (`_gapAbove`) e o rank desse parceiro de cima (`_aboveRank`).
// O líder fica com `_gapAbove = null`. Deve receber a lista completa.
export function annotateGaps(partners) {
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
