import { sb } from './supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { loadSupabaseGoals } from './goals-svc.js';
import { syncClassificationsFromSupabase } from './classifications.js';
import { loadSnapshotFromSupabase, saveSnapshotToSupabase } from './snapshot.js';
import { saveState, loadState, setCacheIndicator } from '../core/storage.js';
import { renderAll } from '../navigation.js';
import { renderDiag } from '../pages/overview.js';
import { populateGoalsForm } from '../pages/goals-page.js';
import { navigate } from '../navigation.js';

export async function doSignIn() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-err');
  if (!email || !pass) { err.textContent = 'Preencha e-mail e senha.'; return; }
  btn.textContent = 'Entrando…'; btn.disabled = true; err.textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    err.textContent = 'E-mail ou senha incorretos.';
    btn.textContent = 'Entrar'; btn.disabled = false;
    return;
  }
  state.currentUser = data.user;
  document.getElementById('user-email').textContent = data.user.email;
  document.getElementById('login-screen').style.display = 'none';
  await onAuthenticated();
}

export async function doSignOut() {
  await sb.auth.signOut();
  state.currentUser = null;
  document.getElementById('user-email').textContent = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
  document.getElementById('login-screen').style.display = 'flex';
}

export function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sc_theme', next);
  document.getElementById('theme-toggle').textContent = next === 'light' ? '🌙 Tema Escuro' : '☀ Tema Claro';
}

export async function onAuthenticated() {
  const sbGoals = await loadSupabaseGoals();
  if (sbGoals) {
    state.goals = sbGoals;
    populateGoalsForm(state.goals);
    try { localStorage.setItem('sc_goals', JSON.stringify(state.goals)); } catch {}
  } else {
    loadGoalsFromStorage();
  }
  await syncClassificationsFromSupabase();
  toast('Carregando dados do servidor…');
  const snap = await loadSnapshotFromSupabase();
  if (snap) {
    state.result = snap;
    const synced = await syncClassificationsFromSupabase();
    try {
      const savedFilter = localStorage.getItem('sc_filter_v1');
      if (savedFilter) {
        state.filterDates = JSON.parse(savedFilter);
        if (state.filterDates.start) document.getElementById('date-start').value = state.filterDates.start;
        if (state.filterDates.end)   document.getElementById('date-end').value   = state.filterDates.end;
      }
    } catch {}
    if (synced > 0) await saveSnapshotToSupabase();
    saveState();
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);
    navigate('overview');
    toast('Dados carregados do servidor ☁️');
  } else if (loadState()) {
    await syncClassificationsFromSupabase();
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);
    navigate('overview');
    toast('Dados restaurados do cache local ⚡');
  }
}

function loadGoalsFromStorage() {
  try {
    const s = localStorage.getItem('sc_goals');
    if (!s) return;
    state.goals = JSON.parse(s);
    populateGoalsForm(state.goals);
  } catch {}
}

export async function initAuth() {
  const saved = localStorage.getItem('sc_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '🌙 Tema Escuro';
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.currentUser = session.user;
    document.getElementById('user-email').textContent = session.user.email;
    document.getElementById('login-screen').style.display = 'none';
    await onAuthenticated();
  }
}
