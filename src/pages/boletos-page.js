// ── Quitação de Boleto — orquestrador ──────────────────────────────────────
// Acompanhamento das fases do boleto por parceiro. Regras críticas (visibilidade
// por empresa, bloqueio de CPF, transições de status) são garantidas no banco
// (migration 006_quitacao_boletos.sql) — esta tela é a conveniência por cima.
// Os blocos vivem em src/pages/boletos/:
//   bol-core.js    estado compartilhado (store BO), helpers, filtro, loadData
//   bol-tabela.js  shell + atualização dinâmica + linha + bolMudarStatus (RPC)
//   bol-docs-ui.js popover de documentos + ver/baixar/excluir
//   bol-lote.js    importação de lote ZIP (análise, conferência, upload)
//   bol-import.js  importação de planilha Excel
//   bol-modais.js  adicionar/editar/quitação/reprovação/motivo
// Domínio e acesso a dados em services/boletos-svc.js. Este arquivo re-exporta
// os 34 nomes públicos originais — main.js e o index.html não mudaram.
import * as XLSX from 'xlsx';
import { toast, handleError } from '../utils/ui.js';
import { showConfirm } from '../utils/confirm.js';
import { STATUS_META, limparBaseBoletos, deleteBoleto } from '../services/boletos-svc.js';
import { BO, fmtCpf, presetRange, filtered, loadData, spinner } from './boletos/bol-core.js';
import { render, updateTable } from './boletos/bol-tabela.js';

export { bolMudarStatus } from './boletos/bol-tabela.js';
export { bolPopShow, bolPopEnter, bolPopLeave, bolVerDoc, bolBaixarDoc, bolExcluirDoc } from './boletos/bol-docs-ui.js';
export { bolAbrirLote, bolOnZipFile, bolAtribuirOrfaoLote, bolConfirmarLote, bolFecharLote } from './boletos/bol-lote.js';
export { bolImportarPlanilha, bolOnImportFile } from './boletos/bol-import.js';
export {
  bolAddCliente, bolSalvarCliente, bolEditarCliente, bolSalvarEdicao, bolFecharModal,
  bolMarcarQuitado, bolAbrirReprovar, bolConfirmarReprovar, bolVerMotivo,
} from './boletos/bol-modais.js';

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderBoletos() {
  const el = document.getElementById('sec-boletos');
  if (!el) return;
  BO.page = 1; BO.search = ''; BO.dateFrom = null; BO.dateTo = null; BO.preset = null;
  BO.empresaFiltro = ''; BO.statusFiltro = '';
  el.innerHTML = spinner();
  await loadData();
  render(el);
}

// ── Filtros ───────────────────────────────────────────────────────────────
export function bolSetSearch(val) {
  BO.search = val || '';
  BO.page   = 1;
  const inp = document.getElementById('bol-search');
  if (inp && inp.value !== BO.search) inp.value = BO.search;
  updateTable();
}

export function bolSetPreset(key) {
  BO.preset = key;
  const range = presetRange(key);
  BO.dateFrom = range.from;
  BO.dateTo   = range.to;
  BO.page     = 1;
  updateTable();
}

export function bolSetEmpresaFiltro(val) {
  BO.empresaFiltro = val;
  BO.page = 1;
  updateTable();
}

export function bolSetStatusFiltro(val) {
  BO.statusFiltro = val;
  BO.page = 1;
  updateTable();
}

export function bolClearDate() {
  BO.preset = null; BO.dateFrom = null; BO.dateTo = null;
  BO.page   = 1;
  updateTable();
}

export function bolSetDateManual() {
  BO.dateFrom = document.getElementById('bol-date-from')?.value || null;
  BO.dateTo   = document.getElementById('bol-date-to')?.value   || null;
  BO.preset   = null;
  BO.page     = 1;
  updateTable();
}

export function bolVerMais() {
  BO.page++;
  updateTable();
  document.getElementById('bol-ver-mais-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Exportar Excel (admin) ────────────────────────────────────────────────
export function bolExportar() {
  const data = filtered();
  if (!data.length) { toast('Nenhum dado para exportar.', 'err'); return; }

  const headers = ['CONTRATO','NOME','CPF','EMAIL','VALOR PARCELA','SALDO DEVEDOR','TROCO','CONVÊNIO','PRODUTO','EMPRESA','STATUS','DATA SOLICITADO','DATA ENVIADO','DATA QUITADO','DATA REPROVADO','MOTIVO REPROVAÇÃO','OBS','CADASTRO'];
  const rows = data.map(r => [
    r.contrato || '', r.nome, fmtCpf(r.cpf), r.email || '',
    r.valor_parcela, r.saldo_devedor, r.troco,
    r.convenio || '', r.produto || '', r.empresa_parceira,
    STATUS_META[r.status]?.label || r.status,
    r.data_solicitado || '', r.data_enviado || '', r.data_quitado || '', r.data_reprovado || '',
    r.motivo_reprovacao || '', r.obs || '', (r.created_at || '').slice(0,10),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quitação de Boleto');
  XLSX.writeFile(wb, `quitacao_boleto_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`${data.length} clientes exportados.`);
}

// ── Limpar Base (admin) ───────────────────────────────────────────────────
export function bolLimparBase() {
  const total = BO.registros.length;
  showConfirm(
    'Limpar toda a base',
    `Isso vai excluir TODOS os ${total} clientes da Quitação de Boleto permanentemente. Essa ação não pode ser desfeita.`,
    'Excluir tudo',
    async () => {
      const { error } = await limparBaseBoletos();

      if (error) { handleError('Erro ao limpar a base.', error); return; }

      BO.registros = [];
      BO.page = 1;
      toast('Base limpa com sucesso.');
      const el = document.getElementById('sec-boletos');
      if (el) render(el);
    }
  );
}

// ── Deletar Cliente (admin) ───────────────────────────────────────────────
export function bolDeletarCliente(id, nome) {
  showConfirm(
    'Excluir cliente',
    `Tem certeza que deseja excluir "${nome}"? Essa ação não pode ser desfeita.`,
    'Excluir',
    async () => {
      const { error } = await deleteBoleto(id);

      if (error) { handleError('Erro ao excluir cliente.', error); return; }

      BO.registros = BO.registros.filter(r => r.id !== id);
      updateTable();
      toast('Cliente excluído.');
    }
  );
}
