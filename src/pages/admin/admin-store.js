// Cache de grupos compartilhado entre as abas Usuários (selects dos modais)
// e Grupos (lista). Reatribuição fica DENTRO deste módulo — importadores
// usam getGrupos()/setGrupos()/ensureGrupos().
import { fetchGrupos } from '../../services/admin-svc.js';

let _grupos = [];

export function getGrupos() { return _grupos; }
export function setGrupos(grupos) { _grupos = grupos || []; }

/** Carrega os grupos se ainda não estiverem em cache (mesma semântica lazy
 *  que os modais de usuário sempre tiveram). */
export async function ensureGrupos() {
  if (!_grupos.length) {
    const { data } = await fetchGrupos();
    _grupos = data || [];
  }
  return _grupos;
}
