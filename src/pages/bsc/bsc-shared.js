// Config de marca/equipes e helpers compartilhados entre o modo normal e o
// modo TV do Ranking BSC.
import { icon } from '../../utils/icons.js';

export const STORAGE_BASE = 'https://gfxfuzmoywdsiyctkrux.supabase.co/storage/v1/object/public';
export const LOGO_URL     = `${STORAGE_BASE}/assets/logo.png`;

export const TEAM_COLORS = {
  FENIX:    '#940b10',
  ALFA:     '#6b7280',
  HYDRA:    '#7c3aed',
  GORILLAZ: '#6b3423',
  SCORPION: '#f97316',
};

export const TEAM_LABELS = {
  FENIX:    'Fênix',
  ALFA:     'Alfa',
  HYDRA:    'Hydra',
  GORILLAZ: 'Gorillaz',
  SCORPION: 'Scorpion',
};

export function normEquipe(eq) {
  return (eq || '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeName(nome) {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function teamColor(equipe)  { return TEAM_COLORS[normEquipe(equipe)]  || '#6b7280'; }
export function teamLabel(equipe)  { return TEAM_LABELS[normEquipe(equipe)]  || equipe;    }

export function tempoInfo(tempo) {
  const t = (tempo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('menos de 1'))  return { label: '< 1 mês',    color: '#6b7280' };
  if (t.includes('entre 1 e 3')) return { label: '1–3 meses',  color: '#94a3b8' };
  if (t.includes('entre 3 e 6')) return { label: '3–6 meses',  color: '#a78bfa' };
  if (t.includes('entre 6'))     return { label: '6–12 meses', color: '#22c55e' };
  if (t.includes('mais de 1'))   return { label: '+ 1 ano ⭐', color: '#f59e0b' };
  return { label: tempo, color: '#6b7280' };
}

export function quartilInfo(q) {
  if (q === 1) return { label: 'Excelente', color: '#f59e0b' };
  if (q === 2) return { label: 'Bom',       color: '#22c55e' };
  if (q === 3) return { label: 'Atenção',   color: '#f97316' };
  return         { label: 'Crítico',  color: '#ef4444' };
}

export function initials(nome) {
  const parts = nome.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function medalIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  return '🥉';
}

// Mutado por propriedade (nunca reatribuído) — a ligação ESM continua viva
// entre os módulos que o importam.
export const avatarCacheBust = {};

export function avatarHtml(seller, size, editable = false) {
  const slug = normalizeName(seller.nome);
  const bust = avatarCacheBust[slug];
  const url  = `${STORAGE_BASE}/avatars/${slug}.jpg${bust ? '?t=' + bust : ''}`;
  const tc   = teamColor(seller.equipe);
  return `
    <div class="bsc-avatar" style="width:${size}px;height:${size}px;border:3px solid ${tc}">
      <img src="${url}" alt="${seller.nome}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="bsc-avatar-fallback" style="display:none;background:${tc}">${initials(seller.nome)}</div>
      ${editable ? `<button type="button" class="bsc-avatar-edit" title="Editar foto"
        onclick="event.stopPropagation();startEditAvatar(${seller.rank})">${icon('edit', 11)}</button>` : ''}
    </div>`;
}
