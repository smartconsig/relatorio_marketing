// Autenticação: login, logout, sessão e o boot (initAuth, incluindo o fluxo
// de convite/redefinição de senha). Os blocos extraídos vivem em
// src/services/auth/:
//   auth-state.js  flag freshLogin compartilhada (store A)
//   auth-theme.js  tema claro/escuro (applySavedTheme + toggleTheme)
//   boot-data.js   onAuthenticated — a carga da Fase 3, movida EM BLOCO
// ⚠ doSignOut PRECISA continuar como declaração de função NESTE arquivo:
// session-timeout.js importa daqui (ciclo pré-existente que funciona por
// hoisting) — convertê-la em arrow/const quebra o boot por TDZ.
import { sb } from './supabase.js';
import { state } from '../state.js';
import { applyPermissionsToUI } from '../navigation.js';
import { startSessionTimeout, stopSessionTimeout } from './session-timeout.js';
import { DEFAULT_PERMISSIONS } from './permissions.js';
import { resetUniversidade } from '../pages/universidade.js';
import { A } from './auth/auth-state.js';
import { applySavedTheme } from './auth/auth-theme.js';
import { onAuthenticated } from './auth/boot-data.js';

export { toggleTheme } from './auth/auth-theme.js';
export { onAuthenticated } from './auth/boot-data.js';

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
  A.freshLogin = true;
  await onAuthenticated();
}

export async function doSignOut() {
  stopSessionTimeout();
  resetUniversidade();
  await sb.auth.signOut();
  state.currentUser = null;
  document.body.classList.remove('uni-mode');
  document.getElementById('user-email').textContent = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
  document.getElementById('login-screen').style.display = 'flex';
}

export async function initAuth() {
  applySavedTheme();

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
