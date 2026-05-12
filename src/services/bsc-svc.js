/**
 * BSC data persistence via Supabase.
 *
 * Requires a table created once in Supabase SQL editor:
 *
 *   create table if not exists bsc_data (
 *     id         bigint generated always as identity primary key,
 *     data       text    not null,
 *     updated_by text,
 *     updated_at timestamptz default now()
 *   );
 */
import { sb } from './supabase.js';
import { state } from '../state.js';

export async function saveBSC(bscData) {
  if (!state.currentUser) return;
  try {
    const payload = JSON.stringify(bscData);
    const now     = new Date().toISOString();
    const { data } = await sb.from('bsc_data').select('id').limit(1).maybeSingle();
    if (data?.id) {
      await sb.from('bsc_data').update({ data: payload, updated_by: state.currentUser.email, updated_at: now }).eq('id', data.id);
    } else {
      await sb.from('bsc_data').insert({ data: payload, updated_by: state.currentUser.email, updated_at: now });
    }
  } catch (e) { console.warn('saveBSC:', e); }
}

export async function loadBSC() {
  try {
    const { data, error } = await sb
      .from('bsc_data')
      .select('data, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.data) return null;
    return JSON.parse(data.data);
  } catch (e) { console.warn('loadBSC:', e); return null; }
}
