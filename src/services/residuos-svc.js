// ── Resíduos — serviço (v2) ─────────────────────────────────────────────────
// Clientes da Liberação de Margem Master que têm resíduo a pagar. Lista de
// controle pura — SEM documentos (os PDFs de boletos/faturas vivem na
// Quitação de Boleto, ver boleto-docs-svc.js).
//
// Fluxo: liberacao_para_residuo esconde a linha da Liberação e cria o resíduo
// como residuo_pendente; residuo_mudar_status leva a residuo_solicitado e a
// residuo_pago — ao pagar, a linha volta à Liberação com a observação
// "RESÍDUO PAGO em dd/mm/aaaa" (tudo transacional na migration 012).
import { sb } from './supabase.js';

export async function loadResiduos() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('residuos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function enviarParaResiduo(liberacaoId) {
  const { data, error } = await sb.rpc('liberacao_para_residuo', { p_liberacao_id: String(liberacaoId) });
  if (error) throw error;
  return data;
}

export async function mudarStatusResiduo(id, novo, valor = null) {
  const { data, error } = await sb.rpc('residuo_mudar_status', { p_id: id, p_novo: novo, p_valor: valor });
  if (error) throw error;
  return data;
}

export async function salvarObsResiduo(id, obs) {
  const { error } = await sb.from('residuos').update({ obs }).eq('id', id);
  if (error) throw error;
}

// Excluir (admin): a linha volta a aparecer na Liberação (trigger no banco)
export async function excluirResiduo(id) {
  const { error } = await sb.from('residuos').delete().eq('id', id);
  if (error) throw error;
}
