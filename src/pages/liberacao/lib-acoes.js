// Ações da Liberação de Margem: marcar OK, salvar acerto, enviar para
// Resíduos, exportar, excluir e limpar base.
// ⚠ libToggleOk reescreve o próprio onclick via setAttribute com o nome
// global "libToggleOk" — NÃO RENOMEAR (vigiado por scripts/verifica-handlers).
import { updateLiberacao, deleteLiberacao, limparBaseLiberacao } from '../../services/liberacao-svc.js';
import { toast, handleError } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import * as XLSX from 'xlsx';
import { enviarParaResiduo } from '../../services/residuos-svc.js';
import { S, isAdmin, filtered, loadData } from './lib-core.js';
import { render, updateTable } from './lib-tabela.js';

// ── Enviar para Resíduos (transacional no banco: cria + esconde daqui) ────
export function libParaResiduo(id) {
  const r = S.registros.find(x => x.id === id);
  if (!r) return;
  showConfirm(
    'Enviar para Resíduos',
    `"${r.nome}" tem resíduo a pagar? O cliente sai desta tela e entra em Resíduos como "Resíduo Pendente". Ele volta para cá automaticamente quando o resíduo for pago.`,
    'Enviar para Resíduos',
    async () => {
      try {
        await enviarParaResiduo(id);
        toast(`${r.nome} enviado para a tela de Resíduos.`);
        await loadData();
        updateTable();
      } catch (e) {
        const m = e?.message || '';
        toast(
          m.includes('RESIDUO_JA_EXISTE')      ? 'Este cliente já está na tela de Resíduos.' :
          m.includes('RESIDUO_SEM_PERMISSAO')  ? 'Sem permissão para enviar clientes para Resíduos.' :
          m.includes('RESIDUO_CPF_INVALIDO')   ? 'CPF do cliente é inválido — corrija antes de enviar.' :
          m || 'Erro inesperado.', 'err');
      }
    }
  );
}

// ── Exportar Excel (admin) ────────────────────────────────────────────────
export function libExportar() {
  const data = filtered();
  if (!data.length) { toast('Nenhum dado para exportar.', 'err'); return; }

  const headers = ['CPF','NOME','CONVÊNIO','PRODUTO','EMPRESA','SALDO DEVEDOR','TROCO','SALDO TOTAL','COMISSÃO 6%','TROCO LÍQUIDO','ACERTO','DATA QUITADO','OBS','STATUS'];
  const rows = data.map(r => [
    r.cpf, r.nome, r.convenio || '', r.produto || '', r.empresa_parceira,
    r.saldo_devedor, r.troco, r.saldo_total, r.comissao_6pct, r.troco_liquido,
    r.acerto || '', r.data_quitado || '', r.obs || '',
    r.aprovado ? 'OK' : 'Pendente',
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
export async function libToggleOk(id, atual) {
  const novoValor = !atual;
  const { error } = await updateLiberacao(id, { aprovado: novoValor });

  if (error) { handleError('Erro ao atualizar status.', error); return; }

  const reg = S.registros.find(r => r.id === id);
  if (reg) reg.aprovado = novoValor;

  const tr = document.querySelector(`.lib-tr[data-id="${id}"]`);
  if (tr) {
    tr.className = `lib-tr${novoValor ? ' lib-row-ok' : ''}`;
    const btn = tr.querySelector('.lib-btn-ok');
    if (btn) {
      const lockOk = !isAdmin() && novoValor;   // parceiro: OK confirmado trava
      btn.className = `lib-btn-ok${novoValor ? ' ok' : ''}${lockOk ? ' locked' : ''}`;
      if (lockOk) {
        btn.disabled = true;
        btn.removeAttribute('onclick');
        btn.title = 'OK confirmado — somente admin pode remover';
      } else {
        btn.disabled = false;
        btn.setAttribute('onclick', `libToggleOk('${id}', ${novoValor})`);
        btn.title = novoValor ? 'Remover OK' : 'Marcar como OK';
      }
    }
    const badge = tr.querySelector('.lib-badge-ok, .lib-badge-pen');
    if (badge) {
      badge.className = novoValor ? 'lib-badge-ok' : 'lib-badge-pen';
      badge.textContent = novoValor ? '✓ OK' : 'Pendente';
    }
  }
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
