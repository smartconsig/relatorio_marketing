/**
 * Utilitários de HTML reutilizáveis para páginas com innerHTML.
 *
 * Funções auxiliares que centralizam padrões visuais repetidos no sistema.
 * Uso: importar a função necessária e chamar dentro de template strings.
 */

/**
 * Cabeçalho de seção padrão do sistema.
 *
 * @param {string} titulo  — texto do cabeçalho
 * @param {string} style   — estilos inline opcionais (ex: 'margin-bottom:14px')
 *
 * Exemplo:
 *   sectionTitle('Ranking de Vendas')
 *   sectionTitle('Histórico de Metas', 'margin-bottom:14px')
 */
export function sectionTitle(titulo, style = '') {
  const styleAttr = style ? ` style="${style}"` : '';
  return `<div class="section-title"${styleAttr}><span class="bar"></span>${titulo}</div>`;
}
