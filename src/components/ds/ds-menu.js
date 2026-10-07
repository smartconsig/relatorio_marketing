// Design system RYC — abre/fecha os menus suspensos gerados por dsMenu().
// Um único listener global (delegação): clicar no botão alterna o menu, clicar
// fora ou apertar Esc fecha todos. Escolher um item fecha o menu — quem trata a
// ação é a tela, ouvindo [data-ds-action] na própria seção.
let _ligado = false;

function _fecharTodos(exceto) {
  document.querySelectorAll('.ds-menu.is-open').forEach(m => { if (m !== exceto) m.classList.remove('is-open'); });
}

function _onClick(e) {
  const toggle = e.target.closest('[data-ds-menu-toggle]');
  if (toggle) {
    const menu = toggle.closest('.ds-menu');
    _fecharTodos(menu);
    menu.classList.toggle('is-open');
    return;
  }
  _fecharTodos(null);
}

export function initDsMenus() {
  if (_ligado) return;
  _ligado = true;
  document.addEventListener('click', _onClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _fecharTodos(null); });
}
