import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { parseBRL } from '../utils/currency.js';
import { saveGoalsToSupabase } from '../services/goals-svc.js';
import { renderAll } from '../navigation.js';

const fmtMoney = v => v
  ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  : '';

/** Formata o input monetário ao sair do campo (onblur) */
export function fmtGoalInput(el) {
  const v = parseBRL(el.value);
  el.value = v ? fmtMoney(v) : '';
}

/** Mostra o número bruto ao entrar no campo (onfocus) */
export function rawGoalInput(el) {
  const v = parseBRL(el.value) || parseFloat(el.value) || 0;
  el.value = v ? String(v) : '';
}

/** Formata o ROAS com uma casa decimal ao sair do campo */
export function fmtRoasInput(el) {
  const v = parseFloat(String(el.value).replace(',', '.')) || 0;
  el.value = v ? v.toFixed(1) : '';
}

export function populateGoalsForm(g) {
  const setMoney = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ? fmtMoney(v) : ''; };
  const setNum   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ? v.toFixed(1) : ''; };
  setMoney('g-invest',   g.invest);
  setMoney('g-cpl',      g.cpl);
  setMoney('g-approved', g.approved);
  setMoney('g-paid',     g.paid);
  setMoney('g-cac',      g.cac);
  setNum  ('g-roas',     g.roas);
}

export function saveGoals() {
  state.goals = {
    invest:   parseBRL(document.getElementById('g-invest').value),
    cpl:      parseBRL(document.getElementById('g-cpl').value),
    approved: parseBRL(document.getElementById('g-approved').value),
    paid:     parseBRL(document.getElementById('g-paid').value),
    cac:      parseBRL(document.getElementById('g-cac').value),
    roas:     parseFloat(String(document.getElementById('g-roas').value).replace(',', '.')) || 0,
  };
  try { localStorage.setItem('sc_goals', JSON.stringify(state.goals)); } catch {}
  saveGoalsToSupabase(state.goals);
  toast('Metas salvas');
  if (state.result) renderAll();
}
