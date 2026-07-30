/**
 * Persistência do Ranking de Parceiros via Supabase.
 *
 * Requer uma tabela criada uma vez no SQL editor do Supabase:
 *
 *   create table if not exists parceiros_data (
 *     id         bigint generated always as identity primary key,
 *     data       text    not null,
 *     updated_by text,
 *     updated_at timestamptz default now()
 *   );
 *
 * Mesmo padrão de bsc_data: uma única linha guarda o ranking inteiro em JSON.
 */
import { sb }    from './supabase.js';
import { state } from '../state.js';

export async function saveParceiros(parceirosData) {
  if (!state.currentUser) return;
  try {
    const payload = JSON.stringify(parceirosData);
    const now     = new Date().toISOString();
    const { data } = await sb.from('parceiros_data').select('id').limit(1).maybeSingle();
    if (data?.id) {
      await sb.from('parceiros_data').update({ data: payload, updated_by: state.currentUser.email, updated_at: now }).eq('id', data.id);
    } else {
      await sb.from('parceiros_data').insert({ data: payload, updated_by: state.currentUser.email, updated_at: now });
    }
  } catch (e) { console.warn('saveParceiros:', e); }
}

export async function loadParceiros() {
  try {
    const { data, error } = await sb
      .from('parceiros_data')
      .select('data, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.data) return null;
    return JSON.parse(data.data);
  } catch (e) { console.warn('loadParceiros:', e); return null; }
}
