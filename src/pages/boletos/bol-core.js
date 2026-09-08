// Núcleo da Quitação de Boleto: estado compartilhado (store BO), helpers,
// presets de data, filtro e carga de dados. Todos os módulos bol-* importam
// daqui — nunca o contrário (sem ciclos).
import { state } from '../../state.js';
import { perm } from '../../services/permissions.js';
import { fetchBoletosPage } from '../../services/boletos-svc.js';
import { loadBoletoDocs } from '../../services/boleto-docs-svc.js';
import { handleError } from '../../utils/ui.js';

// Objeto único mutável: os módulos leem/escrevem BO.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const BO = {
  registros: [],
  docs: new Map(),      // boleto_id -> [boleto_docs]
  plano: null,          // resultado da análise do ZIP (conferência)
  importando: false,
  page: 1,
  search: '',
  dateFrom: null,
  dateTo: null,
  preset: null,
  empresaFiltro: '',
  statusFiltro: '',
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

export const fmtCpf = c => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (c || '—');
};

export const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

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
  let list = BO.registros;
  if (BO.search) {
    const digits = BO.search.replace(/\D/g,'');
    const lower  = BO.search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.includes(digits)) ||
      (digits && String(r.contrato || '').includes(digits))
    );
  }
  if (BO.dateFrom)      list = list.filter(r => (r.created_at || '').slice(0,10) >= BO.dateFrom);
  if (BO.dateTo)        list = list.filter(r => (r.created_at || '').slice(0,10) <= BO.dateTo);
  if (BO.empresaFiltro) list = list.filter(r => r.empresa_parceira === BO.empresaFiltro);
  if (BO.statusFiltro)  list = list.filter(r => r.status === BO.statusFiltro);
  return list;
}

// Clientes elegíveis para receber documentos de lote
export const elegiveis = () =>
  BO.registros.filter(r => r.status === 'boleto_solicitado' || r.status === 'boleto_enviado');

// ── Data ──────────────────────────────────────────────────────────────────
export async function loadData() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await fetchBoletosPage(from, from + PAGE - 1);
    if (error) { handleError('Erro ao carregar dados.', error); BO.registros = []; return; }
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  BO.registros = all;

  // Documentos anexados (boletos/faturas dos lotes) — não-fatal: se a tabela
  // ainda não existir (migration 012 pendente), a tela funciona sem os chips
  try {
    const docs = await loadBoletoDocs();
    BO.docs = new Map();
    for (const d of docs) {
      if (!BO.docs.has(d.boleto_id)) BO.docs.set(d.boleto_id, []);
      BO.docs.get(d.boleto_id).push(d);
    }
  } catch (e) {
    console.warn('boleto_docs indisponível:', e?.message);
    BO.docs = new Map();
  }
}

export const spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;
