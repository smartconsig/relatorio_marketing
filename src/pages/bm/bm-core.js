// Núcleo da Central de BMs: estado compartilhado (store B), mapas de rótulo
// e helpers. Todos os módulos bm-* importam daqui — nunca o contrário.
import {
  MOTIVOS_INATIVA, MOTIVOS_PERFIL, STATUS_NUMERO, QUALIDADES, TIERS,
} from '../../services/bm-svc.js';

// Objeto único mutável: os módulos leem/escrevem B.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const B = {
  perfis: [],
  bms: [],
  numeros: [],
  busca: '',
  filtro: 'todos',          // todos | ativos | inativos (nível do perfil)
  abertosP: new Set(),      // ids dos perfis expandidos
  abertas: new Set(),       // ids das BMs expandidas
  editPerfilId: null,       // perfil aberto no modal (null = novo)
  editBmId: null,           // BM aberta no modal (null = nova)
  bmPerfilPre: null,        // perfil pré-selecionado ao criar BM
  editNumId: null,          // número aberto no modal (null = novo)
  numBmId: null,            // BM dona do número em edição
  motivoAlvo: null,         // { tipo: 'bm'|'perfil', obj } aguardando motivo
  built: false,
  pollTimer: null,
};

export const MOTIVO_LABEL   = Object.fromEntries(MOTIVOS_INATIVA.map(m => [m.key, m.label]));
export const MOTIVO_P_LABEL = Object.fromEntries(MOTIVOS_PERFIL.map(m => [m.key, m.label]));
export const STATUS_LABEL = Object.fromEntries(STATUS_NUMERO.map(s => [s.key, s.label]));
export const QUAL_LABEL   = Object.fromEntries(QUALIDADES.map(q => [q.key, q.label]));
export const TIER_LABEL   = Object.fromEntries(TIERS.map(t => [t.key, t.label]));

// ── helpers ──────────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function opts(lista, sel) {
  return lista.map(o => `<option value="${o.key}"${o.key === sel ? ' selected' : ''}>${o.label}</option>`).join('');
}

export function fmtData(ymd) {
  if (!ymd) return '—';
  const [a, m, d] = ymd.split('-');
  return `${d}/${m}/${a}`;
}

export function fmtDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Dias inteiros decorridos desde uma data ISO/YMD. */
export function diasDesde(iso) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function numerosDa(bmId) {
  return B.numeros.filter(n => n.bm_id === bmId);
}

export function bmsDo(perfilId) {
  return B.bms.filter(b => b.perfil_id === perfilId);
}

export function bmMatch(bm) {
  const alvo = [bm.nome, bm.bm_id_meta, ...numerosDa(bm.id).flatMap(n => [n.numero, n.nome_exibicao])]
    .filter(Boolean).join(' ').toLowerCase();
  return alvo.includes(B.busca);
}

export function labelEvento(ev) {
  switch (ev.tipo) {
    case 'perfil_criado':      return `Perfil criado`;
    case 'perfil_desativado':  return `Perfil desativado — ${MOTIVO_P_LABEL[ev.para] || ev.para || '—'}`;
    case 'perfil_reativado':   return `Perfil reativado`;
    case 'perfil_editado':     return `Dados alterados${ev.texto ? `: ${ev.texto}` : ''}`;
    case 'bm_criada':          return `BM criada`;
    case 'bm_desativada':      return `Desativada — ${MOTIVO_LABEL[ev.para] || ev.para || '—'}`;
    case 'bm_reativada':       return `Reativada`;
    case 'bm_editada':         return `Dados alterados${ev.texto ? `: ${ev.texto}` : ''}`;
    case 'bm_movida':          return `BM movida de perfil${ev.texto ? ` — ${ev.texto}` : ''}`;
    case 'numero_add':         return `Número adicionado — ${ev.texto || ''}`;
    case 'numero_status':      return `${ev.texto || 'Número'}: status ${STATUS_LABEL[ev.de] || ev.de} → ${STATUS_LABEL[ev.para] || ev.para}`;
    case 'numero_qualidade':   return `${ev.texto || 'Número'}: qualidade ${QUAL_LABEL[ev.de] || ev.de} → ${QUAL_LABEL[ev.para] || ev.para}`;
    case 'numero_editado':     return `${ev.texto || 'Número'} editado`;
    case 'numero_removido':    return `Número removido — ${ev.texto || ''}`;
    default:                   return ev.texto || ev.tipo;
  }
}
