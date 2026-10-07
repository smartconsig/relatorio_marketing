// Ações da Liberação de Margem: marcar OK (legado), salvar acerto, exportar,
// excluir e limpar base. O resíduo agora vive na própria linha (lib-residuo.js).
// ⚠ libToggleOk reescreve o próprio onclick via setAttribute com o nome
// global "libToggleOk" — NÃO RENOMEAR (vigiado por scripts/verifica-handlers).
import { updateLiberacao, deleteLiberacao, limparBaseLiberacao } from '../../services/liberacao-svc.js';
import { toast, handleError } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import * as XLSX from 'xlsx';
import { S, isAdmin, filtered } from './lib-core.js';
import { LIB_STATUS, statusDe, emAlerta } from './lib-status.js';
import { render, updateTable } from './lib-tabela.js';

// ── Exportar Excel (admin) ────────────────────────────────────────────────
const _enq = v => (v == null ? '' : (v ? 'Sim' : 'Não'));
const _colunasResiduo = r => [
  r.residuo_valor ?? '', _enq(r.residuo_enquadrada), r.residuo_data_pendente || '', r.residuo_data_solicitado || '',
  r.residuo_data_enviado || '', r.residuo_data_pago || '', r.residuo_valor_pago ?? '', emAlerta(r) ? 'SIM' : '',
];

export function libExportar() {
  const data = filtered();
  if (!data.length) { toast('Nenhum dado para exportar.', 'err'); return; }

  const headers = ['CPF','NOME','CONVÊNIO','PRODUTO','EMPRESA','SALDO DEVEDOR','TROCO','SALDO TOTAL','COMISSÃO 6%','TROCO LÍQUIDO','ACERTO','DATA QUITADO','OBS','STATUS',
    'RESÍDUO VALOR PENDENTE','RESÍDUO ENQUADRADA','RESÍDUO PENDENTE EM','RESÍDUO SOLICITADO EM','RESÍDUO ENVIADO EM','RESÍDUO PAGO EM','RESÍDUO VALOR PAGO','EM ALERTA'];
  const rows = data.map(r => [
    r.cpf, r.nome, r.convenio || '', r.produto || '', r.empresa_parceira,
    r.saldo_devedor, r.troco, r.saldo_total, r.comissao_6pct, r.troco_liquido,
    r.acerto || '', r.data_quitado || '', r.obs || '',
    LIB_STATUS[statusDe(r)].label,
    ..._colunasResiduo(r),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Aplica verde nas linhas aprovadas
  const greenFill = { patternType: 'solid', fgColor: { rgb: '00B050' } };
  data.forEach((r, i) => {
    if (!r.aprovado) return;
    headers.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = { fill: greenFill, font: { color: { rgb: 'FFFFFF' } } };
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Liberação de Margem');
  XLSX.writeFile(wb, `liberacao_margem_${new Date().toISOString().slice(0,10)}.xlsx`, { cellStyles: true });
  toast(`${data.length} clientes exportados.`);
}

// ── Limpar Base (admin) ───────────────────────────────────────────────────
export function libLimparBase() {
  const total = S.registros.length;
  showConfirm(
    'Limpar toda a base',
    `Isso vai excluir TODOS os ${total} clientes permanentemente. Essa ação não pode ser desfeita.`,
    'Excluir tudo',
    async () => {
      const { error } = await limparBaseLiberacao();

      if (error) { handleError('Erro ao limpar a base.', error); return; }

      S.registros = [];
      S.page = 1;
      toast('Base limpa com sucesso.');
      const el = document.getElementById('sec-liberacao');
      if (el) render(el);
    }
  );
}

// ── Deletar Cliente (admin) ───────────────────────────────────────────────
export function libDeletarCliente(id, nome) {
  showConfirm(
    'Excluir cliente',
    `Tem certeza que deseja excluir "${nome}"? Essa ação não pode ser desfeita.`,
    'Excluir',
    () => _confirmarDelete(id)
  );
}

async function _confirmarDelete(id) {
  const { error } = await deleteLiberacao(id);

  if (error) { handleError('Erro ao excluir cliente.', error); return; }

  S.registros = S.registros.filter(r => r.id !== id);
  updateTable();
  toast('Cliente excluído.');
}

// ── Marcar OK (admin) ──────────────────────────────────────────────────────
// ⚠ reescreve o onclick via setAttribute com o nome global "libToggleOk" —
// NÃO RENOMEAR (vigiado por scripts/verifica-handlers).
function _atualizarBotaoOk(tr, id, novoValor) {
  const btn = tr.querySelector('.lib-btn-ok');
  if (!btn) return;
  const lockOk = !isAdmin() && novoValor;   // parceiro: OK confirmado trava
  btn.className = `lib-btn-ok${novoValor ? ' ok' : ''}${lockOk ? ' locked' : ''}`;
  if (lockOk) {
    btn.disabled = true;
    btn.removeAttribute('onclick');
    btn.title = 'OK confirmado — somente admin pode remover';
    return;
  }
  btn.disabled = false;
  btn.setAttribute('onclick', `libToggleOk('${id}', ${novoValor})`);
  btn.title = novoValor ? 'Remover OK' : 'Marcar como OK';
}

// Reflete o novo estado na própria linha, sem redesenhar a tabela.
function _refletirOkNaLinha(id, novoValor) {
  const tr = document.querySelector(`.lib-tr[data-id="${id}"]`);
  if (!tr) return;
  tr.className = `lib-tr${novoValor ? ' lib-row-ok' : ''}`;
  _atualizarBotaoOk(tr, id, novoValor);
  const badge = tr.querySelector('.lib-badge-ok, .lib-badge-pen');
  if (badge) {
    badge.className = novoValor ? 'lib-badge-ok' : 'lib-badge-pen';
    badge.textContent = novoValor ? '✓ OK' : 'Pendente';
  }
}

export async function libToggleOk(id, atual) {
  const novoValor = !atual;
  const { error } = await updateLiberacao(id, { aprovado: novoValor });

  if (error) { handleError('Erro ao atualizar status.', error); return; }

  const reg = S.registros.find(r => r.id === id);
  if (reg) reg.aprovado = novoValor;

  _refletirOkNaLinha(id, novoValor);
}

// ── Salvar Acerto (admin) ──────────────────────────────────────────────────
export async function libSalvarAcerto(id, valor) {
  const { error } = await updateLiberacao(id, { acerto: valor || null });

  if (error) { handleError('Erro ao salvar data de acerto.', error); return; }

  const reg = S.registros.find(r => r.id === id);
  if (reg) reg.acerto = valor || null;

  toast('Acerto salvo!');
  updateTable();
}
