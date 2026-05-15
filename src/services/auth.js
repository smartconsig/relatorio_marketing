import { sb } from './supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { loadSupabaseGoals } from './goals-svc.js';
import { syncClassificationsFromSupabase } from './classifications.js';
import { loadSnapshotFromSupabase, saveSnapshotToSupabase, checkSnapshotTimestamp } from './snapshot.js';
import { saveState, loadState, setCacheIndicator, saveSnapshotTimestamp, loadSnapshotTimestamp } from '../core/storage.js';
import { renderAll } from '../navigation.js';
import { renderDiag } from '../pages/overview.js';
import { populateGoalsForm } from '../pages/goals-page.js';
import { navigate } from '../navigation.js';
import { initBSC } from '../pages/bsc-page.js';
import { renderLastSystemEvent } from './action-log.js';
import { startSessionTimeout, stopSessionTimeout } from './session-timeout.js';
import { syncMetaAds } from './meta-ads.js';
import { syncSmartData } from './smart-sync.js';

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
  document.getElementById('user-email').textContent = data.user.user_metadata?.full_name || data.user.email;
  startSessionTimeout();
  document.getElementById('login-screen').style.display = 'none';
  await onAuthenticated();
}

export async function doSignOut() {
  stopSessionTimeout();
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
  // BSC — carrega em paralelo, não bloqueia o resto
  initBSC();

  // Logs de sistema — carrega em paralelo, não bloqueia
  renderLastSystemEvent('import-last-log', '__import__');
  renderLastSystemEvent('goals-last-log', '__goals__');

  // Metas e classificações (queries leves)
  const sbGoals = await loadSupabaseGoals();
  if (sbGoals) {
    state.goals = sbGoals;
    populateGoalsForm(state.goals);
    try { localStorage.setItem('sc_goals', JSON.stringify(state.goals)); } catch {}
  } else {
    loadGoalsFromStorage();
  }
  await syncClassificationsFromSupabase();

  // 1. Carrega cache local imediatamente — tela aparece na hora
  const hasLocal = loadState();
  const lastSection = localStorage.getItem('sc_last_section') || 'overview';
  if (hasLocal) {
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);
    navigate(lastSection);
  }

  // 2. Consulta leve ao Supabase: só o updated_at
  const serverTs = await checkSnapshotTimestamp();
  const localTs  = loadSnapshotTimestamp();

  if (!serverTs) {
    // Supabase não tem dados — usa só o local
    if (!hasLocal) { /* sem dados em lugar nenhum, fica na tela de importar */ }
    else {
      toast('Dados carregados ⚡');
      syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
      syncSmartData(); // pré-carrega para próxima importação
    }
    return;
  }

  if (serverTs === localTs) {
    // Cache local está em dia — não precisa baixar nada
    toast('Dados carregados ⚡');
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
    syncSmartData(); // pré-carrega para próxima importação
    return;
  }

  // 3. Servidor tem dados mais novos — baixa o snapshot completo
  if (hasLocal) toast('Sincronizando novos dados…');
  else toast('Carregando dados do servidor…');

  const result = await loadSnapshotFromSupabase();
  if (!result) return;

  const { snapshot, updatedAt } = result;
  state.result = snapshot;
  state.confirmedDivergences = snapshot.confirmedDivergences || {};

  try {
    const savedFilter = localStorage.getItem('sc_filter_v1');
    if (savedFilter) {
      state.filterDates = JSON.parse(savedFilter);
      if (state.filterDates.start) document.getElementById('date-start').value = state.filterDates.start;
      if (state.filterDates.end)   document.getElementById('date-end').value   = state.filterDates.end;
    }
  } catch {}

  const synced = await syncClassificationsFromSupabase();
  if (synced > 0) {
    const newTs = await saveSnapshotToSupabase();
    saveSnapshotTimestamp(newTs || updatedAt);
  } else {
    saveSnapshotTimestamp(updatedAt);
  }

  saveState();
  setCacheIndicator(true);
  renderAll();
  renderDiag(state.result.diag);
  if (!hasLocal) navigate(lastSection);
  toast(hasLocal ? 'Dados sincronizados ☁️' : 'Dados carregados do servidor ☁️');

  // Sincroniza Meta Ads em background — re-renderiza quando chegar
  syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
  // Pré-carrega Smart leads em background para próxima importação
  syncSmartData();
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
    // Refresh para garantir que o user_metadata (nome) está atualizado
    const { data: refreshed } = await sb.auth.refreshSession();
    const user = refreshed?.session?.user || session.user;
    state.currentUser = user;
    document.getElementById('user-email').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('login-screen').style.display = 'none';
    startSessionTimeout();
    await onAuthenticated();
  }
}
