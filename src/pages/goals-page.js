import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { saveGoalsToSupabase } from '../services/goals-svc.js';
import { renderAll } from '../navigation.js';

export function populateGoalsForm(g) {
  document.getElementById('g-invest').value   = g.invest   || '';
  document.getElementById('g-cpl').value      = g.cpl      || '';
  document.getElementById('g-approved').value = g.approved || '';
  document.getElementById('g-paid').value     = g.paid     || '';
  document.getElementById('g-cac').value      = g.cac      || '';
  document.getElementById('g-roas').value     = g.roas     || '';
}

export function saveGoals() {
  state.goals = {
    invest:   parseFloat(document.getElementById('g-invest').value)   || 0,
    cpl:      parseFloat(document.getElementById('g-cpl').value)      || 0,
    approved: parseFloat(document.getElementById('g-approved').value) || 0,
    paid:     parseFloat(document.getElementById('g-paid').value)     || 0,
    cac:      parseFloat(document.getElementById('g-cac').value)      || 0,
    roas:     parseFloat(document.getElementById('g-roas').value)     || 0,
  };
  try { localStorage.setItem('sc_goals', JSON.stringify(state.goals)); } catch {}
  saveGoalsToSupabase(state.goals);
  toast('Metas salvas');
  if (state.result) renderAll();
}
