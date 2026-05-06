export const STATUS_PAID = new Set([
  'anuência', 'anuencia', 'integrado', 'pago', 'reapresentar conta',
]);

export const STATUS_ALMOST_PAID = new Set([
  'desaverbação', 'desaverbação master',
]);

export const STATUS_APPROVED = new Set([
  'anuência', 'anuencia',
  'aguardando averbação', 'aguardando averba',
  'em digitação', 'digitação',
  'digitado', 'aprovado', 'aprovada',
  'aguardando aceite', 'aceite pendente',
  'aguardando liberação', 'liberação pendente',
  'em análise', 'análise de crédito',
  'pré aprovado', 'pré-aprovado',
  'aguardando formalização', 'formalização',
  'aguardando assinatura', 'assinatura pendente',
  'contrato gerado', 'contrato enviado',
  'reapresentar conta',
  'solicitado', 'em processamento',
  'aguardando pagamento', 'aguardando averbação banco',
  'pendente',
  'assinado', 'boleto', 'virada de fatura',
  'boleto master', 'boleto reduzido', 'fatura master',
  'desautorização', 'desautorizacao',
  'analise banco', 'análise banco', 'auditoria banco',
  'consulta', 'anexar link', 'assinar link',
  'aguardando banco',
]);

export const STATUS_REJECTED = new Set([
  'reprovado', 'reprovada',
  'cancelado', 'cancelada',
  'negado', 'negada',
  'recusado', 'recusada',
  'desistência', 'desistencia',
  'devolvido', 'devolvida',
  'não aprovado', 'nao aprovado',
  'reprovado banco', 'reprovado crédito',
  'inelegível', 'inelegivel',
  'bloqueado', 'bloqueada',
  'vencido', 'expirado',
  'inativo', 'inativa',
  'tratativa interna', 'perda', 'black list',
  'politica interna', 'política interna',
  'venda errada', 'cliente desistiu',
  'troco abaixo', 'margem negativa',
  'boleto agencia', 'boleto agência',
  'não resolvido', 'nao resolvido',
  'acordo', 'não compra', 'nao compra',
  'cliente retido', 'sem margem',
  'contrato temporario', 'contrato temporário',
  'bloqueio tbm',
]);

export const HIERARCHY = {
  'Boa Vista':      { supervisor: 'Cleiton', gerente: 'Marcos' },
  'Caruaru':        { supervisor: 'Ana',     gerente: 'Marcos' },
  'Caruaru 2':      { supervisor: 'Ana',     gerente: 'Marcos' },
  'Carpina':        { supervisor: 'Ricardo', gerente: 'Marcos' },
  'Gravatá':        { supervisor: 'Ricardo', gerente: 'Marcos' },
  'Limoeiro':       { supervisor: 'Ricardo', gerente: 'Marcos' },
  'Serra Talhada':  { supervisor: 'Cleiton', gerente: 'Marcos' },
  'Salgueiro':      { supervisor: 'Cleiton', gerente: 'Marcos' },
  'Ouricuri':       { supervisor: 'Cleiton', gerente: 'Marcos' },
  'Arcoverde':      { supervisor: 'Cleiton', gerente: 'Marcos' },
  'Petrolina':      { supervisor: 'Cleiton', gerente: 'Marcos' },
};
