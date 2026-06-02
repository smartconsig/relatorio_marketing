import { sb } from './supabase.js';
import { state } from '../state.js';

let _snapDebounce = null;

export function scheduleSaveSnapshot() {
  clearTimeout(_snapDebounce);
  _snapDebounce = setTimeout(() => saveSnapshotToSupabase(), 2000);
}

export async function saveSnapshotToSupabase() {
  if (!state.currentUser || !state.result) return null;
  try {
    const now     = new Date().toISOString();
    const payload = JSON.stringify({
      entries:              state.result.entries.map(({ _justConfirmed, _confirmedInFilter, ...rest }) => rest),
      facebook:             state.result.facebook,
      unknownStatuses:      state.result.unknownStatuses,
      diag:                 state.result.diag,
      smartLeadsByOperador: state.result.smartLeadsByOperador || {},
      smartLeadsByTime:     state.result.smartLeadsByTime     || {},
      smartLeads:           state.result.smartLeads           || [],
      confirmedDivergences: state.confirmedDivergences,
      vendorMappings:       state.vendorMappings || {},
    });
    const { data } = await sb.from('snapshots').select('id').limit(1).maybeSingle();
    if (data?.id) {
      await sb.from('snapshots').update({
        data:       payload,
        updated_by: state.currentUser.email,
        updated_at: now,
      }).eq('id', data.id);
    } else {
      await sb.from('snapshots').insert({
        data:       payload,
        updated_by: state.currentUser.email,
        updated_at: now,
      });
    }
    return now;
  } catch (e) { console.warn('saveSnapshot:', e); return null; }
}

/** Consulta leve: retorna apenas o updated_at do snapshot mais recente. */
export async function checkSnapshotTimestamp() {
  try {
    const { data, error } = await sb
      .from('snapshots')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.updated_at;
  } catch (e) { console.warn('checkSnapshotTimestamp:', e); return null; }
}

/** Baixa o snapshot completo. Retorna { snapshot, updatedAt } ou null. */
export async function loadSnapshotFromSupabase() {
  try {
    const { data, error } = await sb
      .from('snapshots')
      .select('data, updated_by, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.data) return null;
    return { snapshot: JSON.parse(data.data), updatedAt: data.updated_at };
  } catch (e) { console.warn('loadSnapshot:', e); return null; }
}
