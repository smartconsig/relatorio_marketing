// Núcleo da Esteira de Conteúdo: estado compartilhado (store C), helpers e
// mapas de rótulo. Todos os módulos cont-* importam daqui — nunca o contrário.
import { COLUNAS, CANAIS, STATUS_PROD } from '../../services/conteudo-svc.js';

// Objeto único mutável: os módulos leem/escrevem C.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const C = {
  cards: [],
  membros: [],
  filtroResp: '',       // '' = todos | 'meus' | 'sem' | id do responsável
  filtroCanal: '',
  editId: null,         // id do card aberto no modal (null = novo)
  motivoCard: null,     // card aguardando o motivo do ajuste
  dragId: null,
  built: false,
  pollTimer: null,
};

export const CANAL_LABEL  = Object.fromEntries(CANAIS.map(c => [c.key, c.label]));
export const STATUS_LABEL = Object.fromEntries(STATUS_PROD.map(s => [s.key, s.label]));
export const COL_LABEL    = Object.fromEntries(COLUNAS.map(c => [c.key, c.label]));

// ── helpers ──────────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function iniciais(nome) {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function nomeMembro(id) {
  const m = C.membros.find(x => x.id === id);
  return m?.nome || m?.email || '';
}

/** Dias inteiros decorridos desde uma data ISO. */
export function diasDesde(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function fmtDataCurta(ymd) {
  if (!ymd) return '';
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

/** Ordem que coloca o card no fim da coluna de destino. */
export function ordemFinal(coluna, ignoraId) {
  const maior = C.cards
    .filter(c => c.coluna === coluna && c.id !== ignoraId)
    .reduce((m, c) => Math.max(m, Number(c.ordem)), 0);
  return maior + 1000;
}

export function hojeYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lista legível dos campos alterados — alimenta a linha "alterou …". */
export const CAMPO_LABEL = {
  titulo: 'título', descricao: 'descrição', canal: 'canal',
  tipo: 'tipo', producao_status: 'status de produção',
  responsavel_id: 'responsável', data_alvo: 'data alvo', link_url: 'link',
};

export function camposAlterados(antes, depois) {
  return Object.keys(CAMPO_LABEL)
    .filter(k => (antes?.[k] ?? null) !== (depois[k] ?? null))
    .map(k => CAMPO_LABEL[k]);
}
