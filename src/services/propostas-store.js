// Fase 3 — tabelas normalizadas que substituem o snapshot.
// Etapa A: o import grava aqui além do snapshot (toda falha só gera
// console.warn — o import nunca quebra).
// Etapa B1: estas tabelas são a FONTE DE LEITURA do login; o snapshot continua
// sendo gravado, mas só é lido quando a leitura daqui falha (ver loadImportData).
import { sb } from './supabase.js';
import { state } from '../state.js';
import { logAction } from './action-log.js';

const BATCH = 500;
const PAGE  = 1000;

function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

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
      propostas_count:   rows.length,
      smart_leads_count: leads.length,
      updated_by:        state.currentUser?.email || null,
      updated_at:        new Date().toISOString(),
    });
    if (error) throw error;

    await sb.from('propostas').delete().neq('import_id', importId);
    await sb.from('smart_leads').delete().neq('import_id', importId);

    // Bootstrap dos dicionários de decisões (idempotente; mantém os das tabelas)
    await syncUserDicts();
    // Devolve a linha como o servidor a gravou — o carimbo do cache local
    // precisa ser byte a byte igual ao que o login vai ler de volta.
    return (await checkImportMeta()) || true;
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

// ── Leitura das fichas (B0: sombra · B1: fonte oficial) ──────────────────────

/** Lê das tabelas próprias as decisões que não vivem na ficha da proposta. */
export async function loadUserDicts() {
  const dicts = { confirmedDivergences: null, vendorMappings: null };
  try {
    const [divs, maps] = await Promise.all([
      sb.from('divergencias_confirmadas').select('cpf'),
      sb.from('vendor_mappings').select('ecorban_nome, smart_nome'),
    ]);
    if (!divs.error && divs.data) {
      dicts.confirmedDivergences = {};
      for (const r of divs.data) if (r.cpf) dicts.confirmedDivergences[r.cpf] = true;
    }
    if (!maps.error && maps.data) {
      dicts.vendorMappings = {};
      for (const r of maps.data) if (r.ecorban_nome) dicts.vendorMappings[r.ecorban_nome] = r.smart_nome;
    }
  } catch (e) { console.warn('loadUserDicts:', e); }
  return dicts;
}

/** Consulta leve: só o ponteiro do import atual, sem baixar as fichas. */
export async function checkImportMeta() {
  try {
    const { data, error } = await sb.from('import_meta')
      .select('import_id, updated_at').eq('id', 1).maybeSingle();
    if (error || !data?.import_id) return null;
    return data;
  } catch (e) { console.warn('checkImportMeta:', e); return null; }
}

/** Reaplica sobre as entradas as divergências confirmadas vindas da tabela. */
export function applyUserDicts(entries, dicts) {
  if (!dicts?.confirmedDivergences || !entries) return;
  for (const e of entries) {
    if (e.cpf) e.divergenceConfirmed = !!dicts.confirmedDivergences[e.cpf];
  }
}

/**
 * A ficha congela a entrada como ela estava no import. Uma confirmação manual
 * feita ANTES do import viajou junto na ficha; se o usuário desfez a
 * classificação DEPOIS, a ficha não sabe — quem sabe é a tabela
 * `classifications`. Por isso a marca 'manual' da ficha é desfeita aqui e o
 * isMarketing volta para a regra automática (Ecorban); logo em seguida
 * syncClassificationsFromSupabase() reaplica as classificações que ainda valem.
 */
export function resetManualMarks(entries) {
  if (!entries) return;
  for (const e of entries) {
    if (e.reviewReason !== 'manual') continue;
    e.isMarketing  = String(e.ecorbanOrigem || '').toUpperCase() === 'MARKETING';
    e.reviewReason = null;
  }
}

/**
 * Monta um objeto no formato de state.result a partir das tabelas normalizadas.
 * Filtra pelo import_id apontado por import_meta (nunca vê import pela metade).
 * Retorna null em qualquer falha — o chamador decide o fallback.
 */
export async function loadImportData() {
  try {
    const { data: meta, error } = await sb.from('import_meta').select('*').eq('id', 1).maybeSingle();
    if (error || !meta?.import_id) return null;

    const fetchAll = async (table) => {
      const { count, error: ce } = await sb.from(table)
        .select('id', { count: 'exact', head: true })
        .eq('import_id', meta.import_id);
      if (ce) throw ce;
      const pages = Math.ceil((count || 0) / PAGE);
      const results = await Promise.all(Array.from({ length: pages }, (_, p) =>
        sb.from(table).select('data').eq('import_id', meta.import_id)
          .order('id').range(p * PAGE, p * PAGE + PAGE - 1)
      ));
      const rows = [];
      for (const r of results) {
        if (r.error) throw r.error;
        rows.push(...r.data);
      }
      return rows.map(r => r.data);
    };

    const [entries, smartLeads, dicts] = await Promise.all([
      fetchAll('propostas'), fetchAll('smart_leads'), loadUserDicts(),
    ]);

    // Defesa contra import interrompido ou concorrente: se o que foi lido não
    // bate com o que o import disse ter gravado, estas fichas não servem.
    if (meta.propostas_count != null && meta.propostas_count !== entries.length) {
      console.warn(`loadImportData: contagem não bate — esperadas ${meta.propostas_count}, lidas ${entries.length}`);
      return null;
    }
    if (meta.smart_leads_count != null && meta.smart_leads_count !== smartLeads.length) {
      console.warn(`loadImportData: smart_leads não bate — esperados ${meta.smart_leads_count}, lidos ${smartLeads.length}`);
      return null;
    }

    entries.sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0));
    for (const e of entries) if (e.saleDate) e.saleDate = new Date(e.saleDate);
    for (const l of smartLeads) if (l.dataCriacao) l.dataCriacao = new Date(l.dataCriacao);

    // Decisões humanas mandam sobre a ficha congelada no import
    resetManualMarks(entries);
    applyUserDicts(entries, dicts);

    return {
      entries,
      _dicts: dicts,
      facebook:             meta.facebook || [],
      unknownStatuses:      meta.unknown_statuses || [],
      diag:                 meta.diag || null,
      smartLeadsByOperador: meta.smart_by_operador || {},
      smartLeadsByTime:     meta.smart_by_time || {},
      smartLeads,
      _meta: {
        importId:        meta.import_id,
        updatedAt:       meta.updated_at,
        propostasCount:  meta.propostas_count ?? null,
        smartLeadsCount: meta.smart_leads_count ?? null,
      },
    };
  } catch (e) {
    console.warn('loadImportData:', e);
    return null;
  }
}

/**
 * Comparação sombra fichas × snapshot: roda em segundo plano, nunca afeta o
 * usuário. Compara só campos imutáveis entre imports (classificações mudam
 * o snapshot sem mudar as fichas, então isMarketing fica de fora de propósito).
 */
export async function shadowCompareImportData(origem) {
  if (!state.result?.entries) return;
  try {
    const t0 = Date.now();
    const fichas = await loadImportData();
    if (!fichas) { console.warn(`[Fase3/sombra ${origem}] fichas indisponíveis — comparação pulada`); return; }

    const local = state.result;
    const diffs = [];
    if (fichas.entries.length !== local.entries.length)
      diffs.push(`qtde propostas ${fichas.entries.length} × ${local.entries.length}`);
    if (fichas._meta.propostasCount !== null && fichas._meta.propostasCount !== fichas.entries.length)
      diffs.push(`contagem esperada ${fichas._meta.propostasCount} × ${fichas.entries.length} lidas`);

    const soma = arr => Math.round(arr.reduce((s, e) => s + (Number(e.valor) || 0), 0));
    const somaF = soma(fichas.entries), somaL = soma(local.entries);
    if (somaF !== somaL) diffs.push(`soma de valores ${somaF} × ${somaL}`);

    const cpfHash = arr => hashStr(arr.map(e => e.cpf || '').sort().join(','));
    if (cpfHash(fichas.entries) !== cpfHash(local.entries)) diffs.push('conjunto de CPFs difere');

    const dist = arr => JSON.stringify(Object.fromEntries(Object.entries(
      arr.reduce((m, e) => { m[e.statusCat] = (m[e.statusCat] || 0) + 1; return m; }, {})
    ).sort()));
    if (dist(fichas.entries) !== dist(local.entries))
      diffs.push(`distribuição de status ${dist(fichas.entries)} × ${dist(local.entries)}`);

    if (fichas.smartLeads.length !== (local.smartLeads || []).length)
      diffs.push(`qtde smartLeads ${fichas.smartLeads.length} × ${(local.smartLeads || []).length}`);

    const ms = Date.now() - t0;
    if (diffs.length) {
      console.warn(`[Fase3/sombra ${origem}] ✗ DIVERGE: ${diffs.join(' | ')} (fichas de ${fichas._meta.updatedAt})`);
      logAction('__system__', `Sombra Fase3 (${origem}): DIVERGE — ${diffs.join('; ')}`, 'fase3_sombra');
    } else {
      console.info(`[Fase3/sombra ${origem}] ✓ fichas ≡ snapshot (${fichas.entries.length} propostas, ${fichas.smartLeads.length} leads, ${ms}ms)`);
      logAction('__system__', `Sombra Fase3 (${origem}): OK — ${fichas.entries.length} propostas em ${ms}ms`, 'fase3_sombra');
    }
  } catch (e) {
    console.warn('shadowCompareImportData:', e);
  }
}
