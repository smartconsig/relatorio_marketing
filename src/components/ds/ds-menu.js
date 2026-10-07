// Design system RYC — abre/fecha os menus suspensos gerados por dsMenu()/dsSelect().
// Um único listener global (delegação): clicar no botão alterna o menu, clicar
// fora ou apertar Esc fecha todos. Escolher um item fecha o menu — quem trata a
// ação é a tela, ouvindo [data-ds-action] / [data-ds-select] na própria seção.
// O campo de busca das listas longas ([data-ds-filtro]) filtra as opções aqui.
let _ligado = false;

function _fecharTodos(exceto) {
  document.querySelectorAll('.ds-menu.is-open').forEach(m => { if (m !== exceto) m.classList.remove('is-open'); });
}

function _abrir(menu) {
  menu.classList.add('is-open');
  const busca = menu.querySelector('[data-ds-filtro]');
  if (busca) { busca.value = ''; _filtrar(busca); setTimeout(() => busca.focus(), 20); }
}

function _onClick(e) {
  if (e.target.closest('[data-ds-filtro]')) return;   // digitar na busca não fecha a lista
  const toggle = e.target.closest('[data-ds-menu-toggle]');
  if (toggle) {
    const menu = toggle.closest('.ds-menu');
    const aberto = menu.classList.contains('is-open');
    _fecharTodos(null);
    if (!aberto) _abrir(menu);
    return;
  }
  _fecharTodos(null);
}

function _filtrar(input) {
  const termo = input.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  input.closest('.ds-pop').querySelectorAll('[data-ds-select]').forEach(it => {
    const txt = it.textContent.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    it.style.display = !termo || txt.includes(termo) ? '' : 'none';
  });
}

export function initDsMenus() {
  if (_ligado) return;
  _ligado = true;
  document.addEventListener('click', _onClick);
  document.addEventListener('input', e => { if (e.target.matches('[data-ds-filtro]')) _filtrar(e.target); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _fecharTodos(null); });
}
