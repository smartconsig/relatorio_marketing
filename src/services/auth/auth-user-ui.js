// Bloco do usuário no rodapé do menu lateral (Fase 1 do redesenho):
// iniciais no círculo, nome e perfil. #user-email continua sendo o nome
// (id mantido — outros pontos do código podem ler dele).
import { state } from '../../state.js';
import { perm } from '../permissions.js';

function _iniciais(nome) {
  const partes = String(nome || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!partes.length) return '··';
  const a = partes[0][0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0][1] || '');
  return (a + b).toUpperCase();
}

function _perfil() {
  if (perm.isAdmin()) return 'Administrador';
  return state.currentUser?.grupoNome || 'Usuário';
}

const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

/** Preenche o bloco com o usuário logado (fallback: e-mail). */
export function mostrarUsuario(emailFallback = '') {
  const nome = state.currentUser?.nomeDisplay || emailFallback || state.currentUser?.email || '';
  _set('user-email', nome);
  _set('user-av', _iniciais(nome));
  _set('user-role', _perfil());
}

export function limparUsuario() {
  _set('user-email', '');
  _set('user-av', '');
  _set('user-role', '');
}
