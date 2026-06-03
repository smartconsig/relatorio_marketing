/**
 * Badge de status de venda/lead.
 *
 * Props:
 *   status — statusCat da entry: 'pago' | 'quase pago' | 'aprovado' | 'reprovado' | qualquer outro
 *   label  — texto exibido dentro do badge (normalmente entry.rawStatus)
 */
export function Badge({ status, label }) {
  const cores = {
    'pago':       'badge-green',
    'quase pago': 'badge-teal',
    'aprovado':   'badge-yellow',
    'reprovado':  'badge-red',
  };

  const classe = cores[status] || 'badge-gray';

  return <span class={`badge ${classe}`}>{label}</span>;
}
