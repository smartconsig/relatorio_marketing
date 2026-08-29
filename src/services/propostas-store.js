// Fase 3 / Etapa A — dual-write do import em tabelas normalizadas.
// Nesta etapa NADA lê estas tabelas: o snapshot continua sendo a fonte da
// verdade. Toda falha aqui só gera console.warn — o import nunca quebra.
import { sb } from './supabase.js';
import { state } from '../state.js';

const BATCH = 500;

async function insertBatches(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + BATCH));
    if (error) throw error;
  }
}

/**
 * Substitui o conteúdo de propostas/smart_leads/import_meta pelo import atual.
 * Ordem pensada para leitores futuros (Etapa B) nunca verem dados pela metade:
 * 1) insere as linhas novas com um import_id novo
 * 2) só então aponta import_meta para esse import_id
 * 3) por último remove as linhas do import anterior
 */
export async function replaceImportData() {
  if (!state.result?.entries) return false;
  try {
    const importId = crypto.randomUUID();

    const rows = state.result.entries.map(({ _justConfirmed, _confirmedInFilter, ...rest }) => ({
      import_id: importId,
      cpf:       rest.cpf || null,
      sale_date: rest.saleDate ? new Date(rest.saleDate).toISOString().slice(0, 10) : null,
      data:      rest,
    }));
    await insertBatches('propostas', rows);

    const leads = (state.result.smartLeads || []).map(l => ({ import_id: importId, data: l }));
    await insertBatches('smart_leads', leads);

    const { error } = await sb.from('import_meta').upsert({
      id:                1,
      import_id:         importId,
      diag:              state.result.diag || null,
      unknown_statuses:  state.result.unknownStatuses || [],
      facebook:          state.result.facebook || [],
      smart_by_operador: state.result.smartLeadsByOperador || {},
      smart_by_time:     state.result.smartLeadsByTime || {},
      updated_by:        state.currentUser?.email || null,
      updated_at:        new Date().toISOString(),
    });
    if (error) throw error;

    await sb.from('propostas').delete().neq('import_id', importId);
    await sb.from('smart_leads').delete().neq('import_id', importId);

    // Bootstrap dos dicionários de decisões (idempotente; mantém os das tabelas)
    await syncUserDicts();
    return true;
  } catch (e) {
    console.warn('replaceImportData (Etapa A, não-fatal):', e);
    return false;
  }
}

/** Envia para as tabelas as divergências e mapeamentos que só existem no estado local. */
async function syncUserDicts() {
  const divs = Object.keys(state.confirmedDivergences || {}).filter(Boolean);
  if (divs.length) {
    const { error } = await sb.from('divergencias_confirmadas')
      .upsert(divs.map(cpf => ({ cpf })), { onConflict: 'cpf', ignoreDuplicates: true });
    if (error) throw error;
  }
  const maps = Object.entries(state.vendorMappings || {}).filter(([k, v]) => k && v);
  if (maps.length) {
    const { error } = await sb.from('vendor_mappings')
      .upsert(maps.map(([ec, sm]) => ({ ecorban_nome: ec, smart_nome: sm })), { onConflict: 'ecorban_nome' });
    if (error) throw error;
  }
}

/** Grava/remove uma divergência confirmada na hora do clique. */
export function saveDivergencia(cpf, confirmada) {
  if (!cpf) return;
  const op = confirmada
    ? sb.from('divergencias_confirmadas').upsert({ cpf, confirmado_por: state.currentUser?.email || null })
    : sb.from('divergencias_confirmadas').delete().eq('cpf', cpf);
  op.then(({ error }) => { if (error) console.warn('saveDivergencia:', error); });
}

/** Grava/remove um mapeamento de vendedor na hora da edição. */
export function saveVendorMapping(ecorbanNome, smartNome) {
  if (!ecorbanNome) return;
  const op = smartNome
    ? sb.from('vendor_mappings').upsert({ ecorban_nome: ecorbanNome, smart_nome: smartNome })
    : sb.from('vendor_mappings').delete().eq('ecorban_nome', ecorbanNome);
  op.then(({ error }) => { if (error) console.warn('saveVendorMapping:', error); });
}
