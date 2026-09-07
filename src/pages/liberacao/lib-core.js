// Núcleo da Liberação de Margem: estado compartilhado (store S), helpers e
// carga de dados. Todos os outros módulos lib-* importam daqui — nunca o
// contrário (sem ciclos).
import { sb } from '../../services/supabase.js';
import { state } from '../../state.js';
import { handleError } from '../../utils/ui.js';
import { perm } from '../../services/permissions.js';

// ── State ──────────────────────────────────────────────────────────────────
// Objeto único mutável: os módulos leem/escrevem S.campo — reatribuir uma
// variável importada quebraria (bindings ESM são somente-leitura no importador).
export const S = {
  registros: [],
  page: 1,
  search: '',
  dateFrom: null,
  dateTo: null,
  preset: null,
  empresaFiltro: '',
};

export const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────
export const isAdmin = () => perm.isAdmin();

export function empresaParceira() {
  if (isAdmin()) return 'Smart Consig';
  return state.currentUser?.grupoNome || '';
}

export const fmtBRL = v =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDate = v => {
  if (!v) return '—';
  const d = new Date(v + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

export const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Date presets ──────────────────────────────────────────────────────────
export const PRESETS = [
  { key: 'hoje',    label: 'Hoje' },
  { key: 'ontem',   label: 'Ontem' },
  { key: '7d',      label: '7 dias' },
  { key: '15d',     label: '15 dias' },
  { key: '30d',     label: '30 dias' },
  { key: '60d',     label: '60 dias' },
  { key: '90d',     label: '90 dias' },
  { key: 'mes',     label: 'Este mês' },
  { key: 'mes_ant', label: 'Mês passado' },
];

export function presetRange(key) {
  const t = new Date(); t.setHours(0,0,0,0);
  const fmt = d => d.toISOString().slice(0,10);
  switch (key) {
    case 'hoje':    return { from: fmt(t), to: fmt(t) };
    case 'ontem':   { const d=new Date(t); d.setDate(d.getDate()-1); return { from:fmt(d), to:fmt(d) }; }
    case '7d':      { const d=new Date(t); d.setDate(d.getDate()-6); return { from:fmt(d), to:fmt(t) }; }
    case '15d':     { const d=new Date(t); d.setDate(d.getDate()-14); return { from:fmt(d), to:fmt(t) }; }
    case '30d':     { const d=new Date(t); d.setDate(d.getDate()-29); return { from:fmt(d), to:fmt(t) }; }
    case '60d':     { const d=new Date(t); d.setDate(d.getDate()-59); return { from:fmt(d), to:fmt(t) }; }
    case '90d':     { const d=new Date(t); d.setDate(d.getDate()-89); return { from:fmt(d), to:fmt(t) }; }
    case 'mes':     return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmt(t) };
    case 'mes_ant': return {
      from: fmt(new Date(t.getFullYear(), t.getMonth()-1, 1)),
      to:   fmt(new Date(t.getFullYear(), t.getMonth(), 0)),
    };
    default: return { from: null, to: null };
  }
}

// ── Filter ────────────────────────────────────────────────────────────────
export function filtered() {
  let list = S.registros;
  if (S.search) {
    const digits = S.search.replace(/\D/g,'');
    const lower  = S.search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.replace(/\D/g,'').includes(digits))
    );
  }
  if (S.dateFrom)      list = list.filter(r => r.data_quitado && r.data_quitado >= S.dateFrom);
  if (S.dateTo)        list = list.filter(r => r.data_quitado && r.data_quitado <= S.dateTo);
  if (S.empresaFiltro) list = list.filter(r => r.empresa_parceira === S.empresaFiltro);
  return list;
}

// ── Data ──────────────────────────────────────────────────────────────────
export async function loadData() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('liberacao_margem_master')
      .select('*')
      .order('data_quitado', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { handleError('Erro ao carregar dados.', error); S.registros = []; return; }
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  // Cliente em resíduo some desta tela e volta automaticamente quando o
  // resíduo for pago (com a observação) — ver residuos-page.js / migration 012
  S.registros = all.filter(r => !r.em_residuo);
}

export const spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;
