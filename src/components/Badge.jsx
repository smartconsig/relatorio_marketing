/**
 * Badge de status de venda/lead.
 *
 * Props:
 *   status — statusCat da entry: 'pago' | 'quase pago' | 'aprovado' | 'reprovado' | qualquer outro
 *   label  — texto exibido dentro do badge (normalmente entry.rawStatus)
 */

const CORES = {
  'pago':       'badge-green',
  'quase pago': 'badge-teal',
  'aprovado':   'badge-yellow',
  'reprovado':  'badge-red',
};

/** Componente Preact — usar em páginas JSX */
export function Badge({ status, label }) {
  const classe = CORES[status] || 'badge-gray';
  return <span class={`badge ${classe}`}>{label}</span>;
}

/** Função auxiliar — usar em páginas que ainda usam innerHTML */
export function badgeHTML(status, label) {
  const classe = CORES[status] || 'badge-gray';
  return `<span class="badge ${classe}">${label || '—'}</span>`;
}
