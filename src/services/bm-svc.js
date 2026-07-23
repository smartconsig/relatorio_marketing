import { sb } from './supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';

/**
 * Central de BMs — acesso ao Supabase.
 * Grava direto em bm_contas/bm_numeros/bm_eventos; NÃO passa pelo snapshot.
 * Cada ação persiste na hora e fica visível para os outros usuários.
 */

export const MOTIVOS_INATIVA = [
  { key: 'banida',      label: 'Banida pela Meta' },
  { key: 'desativada',  label: 'Desativada por nós' },
  { key: 'em_analise',  label: 'Em análise / restrita' },
];

export const STATUS_NUMERO = [
  { key: 'ativo',        label: 'Ativo' },
  { key: 'restrito',     label: 'Restrito' },
  { key: 'banido',       label: 'Banido' },
  { key: 'desconectado', label: 'Desconectado' },
];

export const QUALIDADES = [
  { key: 'alta',  label: 'Alta' },
  { key: 'media', label: 'Média' },
  { key: 'baixa', label: 'Baixa' },
  { key: 'na',    label: 'Sem dado' },
];

export const TIERS = [
  { key: 'na',        label: 'Sem dado' },
  { key: '250',       label: '250 / dia' },
  { key: '1000',      label: '1.000 / dia' },
  { key: '10000',     label: '10.000 / dia' },
  { key: '100000',    label: '100.000 / dia' },
  { key: 'ilimitado', label: 'Ilimitado' },
];

const BM_COLS  = 'id,nome,bm_id_meta,ativa,motivo_inativa,observacao,data_criacao_bm,arquivada,criado_por,created_at,updated_at';
const NUM_COLS = 'id,bm_id,numero,nome_exibicao,status,qualidade,tier,data_ativacao,observacao,created_at,updated_at';

function _autor() {
  return {
    autor_id:   state.currentUser?.id || null,
    autor_nome: state.currentUser?.nomeDisplay || state.currentUser?.email || null,
  };
}

// ── BMs ──────────────────────────────────────────────────────────────────────
export async function loadBMs() {
  const { data, error } = await sb
    .from('bm_contas')
    .select(BM_COLS)
    .eq('arquivada', false)
    .order('nome');
  if (error) {
    console.error('loadBMs:', error);
    toast('Erro ao carregar as BMs', 'err');
    return null;
  }
  return data || [];
}

export async function createBM(payload) {
  const { data, error } = await sb
    .from('bm_contas')
    .insert({ ...payload, criado_por: state.currentUser?.id || null })
    .select(BM_COLS)
    .single();
  if (error) throw error;
  await logEvento({ bm_id: data.id, tipo: 'bm_criada', texto: data.nome });
  return data;
}

export async function updateBM(id, patch) {
  const { data, error } = await sb
    .from('bm_contas')
    .update(patch)
    .eq('id', id)
    .select(BM_COLS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Liga/desliga a BM. Desligar exige motivo — é o que separa "a Meta baniu"
 * de "eu parei de usar" na hora de analisar o histórico.
 */
export async function setBMAtiva(bm, ativa, motivo = null) {
  const data = await updateBM(bm.id, {
    ativa,
    motivo_inativa: ativa ? null : motivo,
  });
  await logEvento({
    bm_id: bm.id,
    tipo:  ativa ? 'bm_reativada' : 'bm_desativada',
    de:    bm.ativa ? 'ativa' : (bm.motivo_inativa || 'inativa'),
    para:  ativa ? 'ativa' : motivo,
  });
  return data;
}

export async function deleteBM(id) {
  const { error } = await sb.from('bm_contas').delete().eq('id', id);
  if (error) throw error;
}

// ── Números oficiais ─────────────────────────────────────────────────────────
/** Todos os números de uma vez — o volume é pequeno e evita N requisições. */
export async function loadNumeros() {
  const { data, error } = await sb
    .from('bm_numeros')
    .select(NUM_COLS)
    .order('created_at');
  if (error) {
    console.error('loadNumeros:', error);
    toast('Erro ao carregar os números', 'err');
    return null;
  }
  return data || [];
}

export async function createNumero(payload) {
  const { data, error } = await sb
    .from('bm_numeros')
    .insert({ ...payload, criado_por: state.currentUser?.id || null })
    .select(NUM_COLS)
    .single();
  if (error) throw error;
  await logEvento({
    bm_id: data.bm_id, numero_id: data.id,
    tipo: 'numero_add', texto: data.numero,
  });
  return data;
}

/**
 * Atualiza o número e registra mudança de status e de qualidade como eventos
 * próprios — são as duas séries que interessam para entender o banimento.
 */
export async function updateNumero(numero, patch) {
  const { data, error } = await sb
    .from('bm_numeros')
    .update(patch)
    .eq('id', numero.id)
    .select(NUM_COLS)
    .single();
  if (error) throw error;

  if (patch.status !== undefined && patch.status !== numero.status) {
    await logEvento({
      bm_id: numero.bm_id, numero_id: numero.id, tipo: 'numero_status',
      de: numero.status, para: patch.status, texto: numero.numero,
    });
  }
  if (patch.qualidade !== undefined && patch.qualidade !== numero.qualidade) {
    await logEvento({
      bm_id: numero.bm_id, numero_id: numero.id, tipo: 'numero_qualidade',
      de: numero.qualidade, para: patch.qualidade, texto: numero.numero,
    });
  }
  return data;
}

export async function deleteNumero(numero) {
  const { error } = await sb.from('bm_numeros').delete().eq('id', numero.id);
  if (error) throw error;
  // numero_id vira NULL no ON DELETE SET NULL; o texto preserva qual era
  await logEvento({ bm_id: numero.bm_id, tipo: 'numero_removido', texto: numero.numero });
}

// ── Eventos ──────────────────────────────────────────────────────────────────
export async function logEvento({ bm_id, numero_id = null, tipo, de = null, para = null, texto = null }) {
  const { error } = await sb.from('bm_eventos').insert({
    bm_id, numero_id, tipo, de, para, texto, ..._autor(),
  });
  // Histórico é telemetria: falhar aqui não pode derrubar a ação do usuário
  if (error) console.error('logEvento(bm):', error);
}

export async function loadEventos(bmId) {
  const { data, error } = await sb
    .from('bm_eventos')
    .select('*')
    .eq('bm_id', bmId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('loadEventos(bm):', error);
    return [];
  }
  return data || [];
}
