import { sb } from './supabase.js';
import { state } from '../state.js';

export async function loadAllGoals() {
  try {
    const { data, error } = await sb
      .from('goals')
      .select('*')
      .order('periodo', { ascending: false });
    if (error || !data) return {};
    const map = {};
    for (const row of data) {
      const key = row.periodo;
      if (!key) continue;
      map[key] = {
        invest:   row.invest   || 0,
        cpl:      row.cpl      || 0,
        approved: row.approved || 0,
        paid:     row.paid     || 0,
        cac:      row.cac      || 0,
        roas:     row.roas     || 0,
      };
    }
    return map;
  } catch (e) { return {}; }
}

export async function saveGoalsToSupabase(g, periodo) {
  if (!state.currentUser) return;
  try {
    await sb.from('goals').upsert(
      { ...g, periodo, updated_by: state.currentUser.id, updated_at: new Date().toISOString() },
      { onConflict: 'periodo' }
    );
  } catch (e) { console.warn('saveGoals:', e); }
}
