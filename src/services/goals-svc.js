import { sb } from './supabase.js';
import { state } from '../state.js';

export async function loadSupabaseGoals() {
  try {
    const { data, error } = await sb.from('goals').select('*').limit(1).maybeSingle();
    if (error || !data) return null;
    return {
      leads:    data.leads    || 0,
      invest:   data.invest   || 0,
      cpl:      data.cpl      || 0,
      approved: data.approved || 0,
      paid:     data.paid     || 0,
      value:    data.value    || 0,
      cac:      data.cac      || 0,
      roas:     data.roas     || 0,
    };
  } catch (e) { return null; }
}

export async function saveGoalsToSupabase(g) {
  if (!state.currentUser) return;
  try {
    const { data } = await sb.from('goals').select('id').limit(1).maybeSingle();
    if (data?.id) {
      await sb.from('goals').update({ ...g, updated_by: state.currentUser.id, updated_at: new Date().toISOString() }).eq('id', data.id);
    } else {
      await sb.from('goals').insert({ ...g, updated_by: state.currentUser.id });
    }
  } catch (e) { console.warn('saveGoals:', e); }
}
