/**
 * Grupo de botões de filtro com estado ativo.
 *
 * Uso (páginas com innerHTML):
 *   filterButtonsHTML(options, active)
 *
 * Parâmetros:
 *   options — array de { value, label, onclick, style? }
 *   active  — o value do botão que deve ficar ativo
 *
 * Exemplo:
 *   filterButtonsHTML([
 *     { value: 'seller', label: 'Vendedor', onclick: "setRankView('seller')" },
 *     { value: 'team',   label: 'Time',     onclick: "setRankView('team')" },
 *   ], state.rankView)
 */
export function filterButtonsHTML(options, active) {
  return options.map(({ value, label, onclick, style }) => {
    const isActive = active === value;
    const styleAttr = style && !isActive ? ` style="${style}"` : '';
    return `<button class="filter-btn ${isActive ? 'active' : ''}"${styleAttr} onclick="${onclick}">${label}</button>`;
  }).join('');
}
