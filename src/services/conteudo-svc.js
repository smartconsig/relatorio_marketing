import { sb } from './supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';

/**
 * Esteira de Conteúdo — acesso ao Supabase.
 * Tudo grava direto nas tabelas conteudo_cards/conteudo_eventos.
 * NÃO passa pelo snapshot: cada ação persiste na hora e é visível
 * para os outros usuários no próximo refresh.
 */

export const COLUNAS = [
  { key: 'ideias',    label: 'Ideias' },
  { key: 'planejado', label: 'Planejado' },
  { key: 'producao',  label: 'Em produção' },
  { key: 'revisao',   label: 'Revisão interna' },
  { key: 'aprovacao', label: 'Aprovação' },
  { key: 'agendado',  label: 'Agendado' },
  { key: 'publicado', label: 'Publicado' },
];

export const CANAIS = [
  { key: 'instagram_feed',    label: 'Instagram Feed' },
  { key: 'instagram_reels',   label: 'Instagram Reels' },
  { key: 'instagram_stories', label: 'Instagram Stories' },
  { key: 'tiktok',            label: 'TikTok' },
  { key: 'youtube',           label: 'YouTube' },
  { key: 'linkedin',          label: 'LinkedIn' },
];

const CARD_COLS = 'id,titulo,descricao,coluna,canal,responsavel_id,data_alvo,link_url,em_ajuste,ajuste_motivo,ordem,coluna_desde,arquivado,criado_por,created_at,updated_at';

function _autor() {
  return {
    autor_id:   state.currentUser?.id || null,
    autor_nome: state.currentUser?.nomeDisplay || state.currentUser?.email || null,
  };
}

/** Cards ativos do board (não arquivados), já ordenados por coluna/ordem. */
export async function loadCards() {
  const { data, error } = await sb
    .from('conteudo_cards')
    .select(CARD_COLS)
    .eq('arquivado', false)
    .order('ordem', { ascending: true });
  if (error) {
    console.error('loadCards:', error);
    toast('Erro ao carregar o board', 'err');
    return null;
  }
  return data || [];
}

/** Usuários ativos — alimenta o seletor de responsável. */
export async function loadMembros() {
  const { data, error } = await sb
    .from('profiles')
    .select('id,nome,email')
    .eq('ativo', true)
    .order('nome');
  if (error) {
    console.error('loadMembros:', error);
    return [];
  }
  return data || [];
}

export async function createCard(payload) {
  const { data, error } = await sb
    .from('conteudo_cards')
    .insert({ ...payload, criado_por: state.currentUser?.id || null })
    .select(CARD_COLS)
    .single();
  if (error) throw error;
  await logEvento(data.id, 'criado', { para_coluna: data.coluna });
  return data;
}

export async function updateCard(id, patch) {
  const { data, error } = await sb
    .from('conteudo_cards')
    .update(patch)
    .eq('id', id)
    .select(CARD_COLS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Move o card de coluna. Reseta coluna_desde — é o marco que alimenta
 * o "parado há X dias" e o cálculo de gargalo por etapa.
 */
export async function moveCard(card, paraColuna, ordem, extra = {}) {
  // _evento é só para o log — não pode vazar para o UPDATE como se fosse coluna
  const { _evento, ...campos } = extra;
  const patch = {
    coluna: paraColuna,
    ordem,
    ...campos,
  };
  if (paraColuna !== card.coluna) patch.coluna_desde = new Date().toISOString();

  const data = await updateCard(card.id, patch);
  if (paraColuna !== card.coluna) {
    await logEvento(card.id, _evento || 'movido', {
      de_coluna:   card.coluna,
      para_coluna: paraColuna,
      texto:       campos.ajuste_motivo || null,
    });
  }
  return data;
}

export async function deleteCard(id) {
  const { error } = await sb.from('conteudo_cards').delete().eq('id', id);
  if (error) throw error;
}

export async function logEvento(cardId, tipo, extra = {}) {
  const { _evento, ...rest } = extra;
  const { error } = await sb.from('conteudo_eventos').insert({
    card_id: cardId,
    tipo,
    ...rest,
    ..._autor(),
  });
  // Evento é histórico/telemetria: falhar aqui não pode derrubar a ação do usuário
  if (error) console.error('logEvento:', error);
}

/**
 * Comentário do usuário no card. Diferente de logEvento: aqui o erro sobe,
 * porque um comentário perdido em silêncio é pior que um erro na tela.
 */
export async function comentar(cardId, texto) {
  const { error } = await sb.from('conteudo_eventos').insert({
    card_id: cardId,
    tipo: 'comentario',
    texto,
    ..._autor(),
  });
  if (error) throw error;
}

// ── Anexos (imagens) ─────────────────────────────────────────────────────────
const BUCKET = 'conteudo-anexos';
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;   // 10 MB

export async function loadAnexos(cardId) {
  const { data, error } = await sb
    .from('conteudo_anexos')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at');
  if (error) {
    console.error('loadAnexos:', error);
    return [];
  }
  return data || [];
}

/** URLs assinadas (1h) para exibir as imagens — o bucket é privado. */
export async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    console.error('signedUrls:', error);
    return {};
  }
  return Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
}

export async function uploadAnexo(cardId, file) {
  const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${cardId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await sb.from('conteudo_anexos').insert({
    card_id: cardId,
    path,
    nome:    file.name,
    mime:    file.type || null,
    tamanho: file.size || null,
    ..._autor(),
  }).select('*').single();

  // Metadado falhou: remove o arquivo para não deixar lixo órfão no bucket
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }

  await logEvento(cardId, 'anexo', { texto: file.name });
  return data;
}

export async function deleteAnexo(anexo) {
  const { error } = await sb.from('conteudo_anexos').delete().eq('id', anexo.id);
  if (error) throw error;
  await sb.storage.from(BUCKET).remove([anexo.path]);
}

/** Remove os arquivos do bucket — o ON DELETE CASCADE só apaga as linhas. */
export async function removeArquivosDoCard(cardId) {
  const anexos = await loadAnexos(cardId);
  if (anexos.length) await sb.storage.from(BUCKET).remove(anexos.map(a => a.path));
}

export async function loadEventos(cardId) {
  const { data, error } = await sb
    .from('conteudo_eventos')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('loadEventos:', error);
    return [];
  }
  return data || [];
}
