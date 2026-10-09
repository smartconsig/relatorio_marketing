// Colunas de respaldo nas exportações da Quitação de Boleto (Excel e resumo.xlsx
// do Lote ZIP). Decisão do responsável (08/10/2026): os respaldos NÃO aparecem
// na tela, só aqui — boleto e fatura lado a lado na mesma planilha.
// Vários contratos no mesmo CPF: um por linha dentro da célula, na mesma ordem
// em todas as colunas (a 2ª linha de "Contrato" casa com a 2ª de "Modalidade").

export const RESPALDO_HEADERS = [
  'RESPALDO BOLETO · STATUS', 'RESPALDO BOLETO · MENSAGEM', 'RESPALDO BOLETO · Nº CONTRATO', 'RESPALDO BOLETO · MODALIDADE',
  'RESPALDO BOLETO · EMPREGADOR', 'RESPALDO BOLETO · MATRÍCULA', 'RESPALDO BOLETO · ALERTA',
  'RESPALDO FATURA · STATUS', 'RESPALDO FATURA · DETALHES POR CARTÃO',
];

const _lista = (contratos, campo) => (Array.isArray(contratos) ? contratos.map(c => c?.[campo] || '—').join('\n') : '');

export function respaldoCols(r) {
  const k = r.respaldo_boleto_contratos;
  return [
    r.respaldo_boleto_status || '', r.respaldo_boleto_mensagem || '',
    _lista(k, 'contrato'), _lista(k, 'modalidade'), _lista(k, 'empregador'), _lista(k, 'matricula'),
    r.respaldo_boleto_alerta || '',
    r.respaldo_status || '', r.respaldo_detalhes || '',
  ];
}
