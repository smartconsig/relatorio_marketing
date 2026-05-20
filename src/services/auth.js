import { sb } from './supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { loadSupabaseGoals } from './goals-svc.js';
import { syncClassificationsFromSupabase } from './classifications.js';
import { loadSnapshotFromSupabase, saveSnapshotToSupabase, checkSnapshotTimestamp } from './snapshot.js';
import { saveState, loadState, setCacheIndicator, saveSnapshotTimestamp, loadSnapshotTimestamp } from '../core/storage.js';
import { renderAll, applyPermissionsToUI } from '../navigation.js';
import { renderDiag } from '../pages/overview.js';
import { populateGoalsForm } from '../pages/goals-page.js';
import { navigate } from '../navigation.js';
import { initBSC } from '../pages/bsc-page.js';
import { renderLastSystemEvent } from './action-log.js';
import { startSessionTimeout, stopSessionTimeout } from './session-timeout.js';
import { syncMetaAds } from './meta-ads.js';
import { DEFAULT_PERMISSIONS } from './permissions.js';

/**
 * Carrega o perfil e permissões do usuário logado a partir do Supabase.
 * Armazena em state.currentUser.permissoes e state.currentUser.profile.
 */
async function loadUserProfile() {
  try {
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*, grupos_acesso(id, nome, permissoes)')
      .eq('id', state.currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (profile) {
      state.currentUser.profile    = profile;
      state.currentUser.grupoId    = profile.grupo_id;
      state.currentUser.grupoNome  = profile.grupos_acesso?.nome  || '';
      state.currentUser.permissoes = profile.grupos_acesso?.permissoes || DEFAULT_PERMISSIONS;
      state.currentUser.nomeDisplay = profile.nome || state.currentUser.email;
      state.currentUser.ativo      = profile.ativo !== false;
    } else {
      // Usuário sem perfil — acesso mínimo
      state.currentUser.permissoes = DEFAULT_PERMISSIONS;
      state.currentUser.grupoNome  = '';
      state.currentUser.nomeDisplay = state.currentUser.email;
    }
  } catch (e) {
    console.warn('[auth] loadUserProfile:', e);
    state.currentUser.permissoes = DEFAULT_PERMISSIONS;
  }
}

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
  await loadUserProfile();
  applyPermissionsToUI();
  document.getElementById('user-email').textContent = state.currentUser.nomeDisplay || data.user.email;
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

  // 1. Navega imediatamente pelo hash da URL (antes de qualquer load de dados)
  //    Garante que o F5 mantém a seção correta independente do estado do cache
  const VALID_SECS = new Set(['import','overview','ranking','perfil','gestao','propostas','goals','bsc','admin']);
  const hashSec = window.location.hash.replace('#', '');
  const lastSection = (VALID_SECS.has(hashSec) ? hashSec : null)
    || localStorage.getItem('sc_last_section')
    || 'overview';
  navigate(lastSection);

  // 2. Carrega cache local e preenche os dados
  const hasLocal = loadState();
  if (hasLocal) {
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);
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
    }
    return;
  }

  if (serverTs === localTs) {
    // Cache local está em dia — não precisa baixar nada
    toast('Dados carregados ⚡');
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
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
  state.vendorMappings       = snapshot.vendorMappings       || {};

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
  navigate(lastSection);
  toast(hasLocal ? 'Dados sincronizados ☁️' : 'Dados carregados do servidor ☁️');

  // Sincroniza Meta Ads em background — re-renderiza quando chegar
  syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
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

  // Detecta link de convite ou redefinição de senha (hash na URL)
  const hash = window.location.hash;
  const isInvite   = hash.includes('type=invite');
  const isRecovery = hash.includes('type=recovery');

  if (isInvite || isRecovery) {
    // Supabase processa o hash automaticamente — aguarda a sessão
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      // Mostra tela de definir senha
      document.getElementById('set-password-screen').style.display = 'flex';
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('set-pass-1').focus();

      window._confirmSetPassword = async () => {
        const p1  = document.getElementById('set-pass-1').value;
        const p2  = document.getElementById('set-pass-2').value;
        const err = document.getElementById('set-pass-err');
        const btn = document.getElementById('set-pass-btn');

        if (!p1 || p1.length < 8) { err.textContent = 'A senha deve ter pelo menos 8 caracteres.'; return; }
        if (p1 !== p2)             { err.textContent = 'As senhas não conferem.'; return; }

        btn.textContent = 'Salvando…'; btn.disabled = true; err.textContent = '';

        const { error } = await sb.auth.updateUser({ password: p1 });
        if (error) {
          err.textContent = 'Erro ao definir senha: ' + error.message;
          btn.textContent = 'Criar Senha e Entrar'; btn.disabled = false;
          return;
        }

        // Senha definida — continua para o app normalmente
        document.getElementById('set-password-screen').style.display = 'none';
        // Limpa o hash da URL sem recarregar
        history.replaceState(null, '', window.location.pathname + window.location.search);

        state.currentUser = session.user;
        await loadUserProfile();
        applyPermissionsToUI();
        document.getElementById('user-email').textContent = state.currentUser.nomeDisplay || session.user.email;
        startSessionTimeout();
        await onAuthenticated();
      };
    }
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    // Refresh para garantir que o user_metadata (nome) está atualizado
    const { data: refreshed } = await sb.auth.refreshSession();
    const user = refreshed?.session?.user || session.user;
    state.currentUser = user;
    await loadUserProfile();
    applyPermissionsToUI();
    document.getElementById('user-email').textContent = state.currentUser.nomeDisplay || user.email;
    document.getElementById('login-screen').style.display = 'none';
    startSessionTimeout();
    await onAuthenticated();
  }
}
