// Núcleo da Liberação de Margem: estado compartilhado (store S), helpers e
// carga de dados. Todos os outros módulos lib-* importam daqui — nunca o
// contrário (sem ciclos).
import { fetchTodasLiberacoes, fetchLiberacao } from '../../services/liberacao-svc.js';
import { state } from '../../state.js';
import { handleError } from '../../utils/ui.js';
import { perm } from '../../services/permissions.js';
import { statusDe, emAlerta } from './lib-status.js';

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
  statusFiltro: '',     // '' | chave de LIB_STATUS | 'alerta' (redesenho, Fase 3)
  abertos: new Set(),   // linhas expandidas
  sel: new Set(),       // selecionadas para ação em lote
  carregadoPor: null,   // id do usuário dono dos dados em memória (nunca mostrar dados de outro login)
};

/** Há dados em memória deste mesmo usuário (pode mostrar na hora e atualizar por trás). */
export const temCache = () => S.carregadoPor && S.carregadoPor === state.currentUser?.id;

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
  const fmt   = d => d.toISOString().slice(0,10);
  const atras = n => { const d = new Date(t); d.setDate(d.getDate() - n); return d; };
  switch (key) {
    case 'hoje':    return { from: fmt(t), to: fmt(t) };
    case 'ontem':   { const d = atras(1); return { from: fmt(d), to: fmt(d) }; }
    case '7d':      return { from: fmt(atras(6)),  to: fmt(t) };
    case '15d':     return { from: fmt(atras(14)), to: fmt(t) };
    case '30d':     return { from: fmt(atras(29)), to: fmt(t) };
    case '60d':     return { from: fmt(atras(59)), to: fmt(t) };
    case '90d':     return { from: fmt(atras(89)), to: fmt(t) };
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
  if (S.statusFiltro)  list = list.filter(_casaStatus);
  return list;
}

const _casaStatus = r => (S.statusFiltro === 'alerta' ? emAlerta(r) : statusDe(r) === S.statusFiltro);

// ── Data ──────────────────────────────────────────────────────────────────
export async function loadData() {
  const { data: all, error } = await fetchTodasLiberacoes();
  if (error) { handleError('Erro ao carregar dados.', error); S.registros = []; S.carregadoPor = null; return; }
  S.carregadoPor = state.currentUser?.id || null;
  // Desde a migration 015 o resíduo é um STATUS da linha (residuo_status) e
  // em_residuo fica sempre false. O filtro abaixo só esconde linhas do fluxo
  // antigo (012) caso o site novo suba antes de a 015 ser rodada.
  S.registros = all.filter(r => !r.em_residuo);
}

/**
 * Depois de uma ação (OK, resíduo, acerto…): busca no banco SÓ as linhas que
 * mudaram e troca na memória — em vez de baixar as ~4 mil linhas de novo.
 */
export async function recarregarLinhas(ids) {
  const resps = await Promise.all([...new Set(ids)].map(id => fetchLiberacao(id)));
  resps.forEach((r, i) => {
    const id = [...new Set(ids)][i];
    const pos = S.registros.findIndex(x => String(x.id) === String(id));
    const linha = r.data && !r.data.em_residuo ? r.data : null;
    if (pos >= 0 && linha) S.registros[pos] = linha;
    else if (pos >= 0 && !r.error) S.registros.splice(pos, 1);   // apagada (ou escondida) no banco
  });
}

export const spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;
