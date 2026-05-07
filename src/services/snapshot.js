import { sb } from './supabase.js';
import { state } from '../state.js';

let _snapDebounce = null;

export function scheduleSaveSnapshot() {
  clearTimeout(_snapDebounce);
  _snapDebounce = setTimeout(() => saveSnapshotToSupabase(), 2000);
}

export async function saveSnapshotToSupabase() {
  if (!state.currentUser || !state.result) return;
  try {
    const payload = JSON.stringify({
      entries:         state.result.entries.map(({ _justConfirmed, _confirmedInFilter, ...rest }) => rest),
      facebook:        state.result.facebook,
      unknownStatuses: state.result.unknownStatuses,
      diag:            state.result.diag,
    });
    const { data } = await sb.from('snapshots').select('id').limit(1).maybeSingle();
    if (data?.id) {
      await sb.from('snapshots').update({
        data: payload,
        updated_by: state.currentUser.email,
        updated_at: new Date().toISOString(),
      }).eq('id', data.id);
    } else {
      await sb.from('snapshots').insert({
        data: payload,
        updated_by: state.currentUser.email,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) { console.warn('saveSnapshot:', e); }
}

export async function loadSnapshotFromSupabase() {
  try {
    const { data, error } = await sb
      .from('snapshots')
      .select('data, updated_by, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.data) return null;
    return JSON.parse(data.data);
  } catch (e) { console.warn('loadSnapshot:', e); return null; }
}
