// Ação em lote da Quitação de Boleto: caixinhas nas linhas + barra embaixo.
// Só oferece a mudança de status quando TODOS os selecionados estão no mesmo
// status e a pessoa pode agir em todos. Cada mudança vai pela mesma RPC da
// linha (o banco revalida um por um); falhas são listadas no fim.
import { toast } from '../../utils/ui.js';
import { dsBtn, dsConfirm } from '../../components/ds/index.js';
import { rpcMudarStatus, msgErroBanco } from '../../services/boletos-svc.js';
import { BO, loadData, filtered } from './bol-core.js';
import { BOL_ACOES, BOL_STATUS, podeAgir } from './bol-linha.js';

// Só os selecionados que continuam no filtro atual — trocar o filtro nunca deixa
// o lote agir em cliente escondido.
const selecionados = () => filtered().filter(r => BO.sel.has(r.id));

function _acaoComum(lista) {
  const status = [...new Set(lista.map(r => r.status))];
  if (status.length !== 1) return { nota: 'Selecione clientes no mesmo status para mudar em lote' };
  const acao = BOL_ACOES[status[0]];
  if (!acao) return { nota: 'Clientes já concluídos' };
  if (!lista.every(r => podeAgir(r, acao))) return { nota: acao.who === 's' ? 'Esta etapa é da Smart' : 'Há clientes de outra empresa na seleção' };
  return { acao };
}

export function renderBulk() {
  const bar = document.getElementById('bol-bulk');
  if (!bar) return;
  const lista = selecionados();
  bar.classList.toggle('is-show', lista.length > 0);
  if (!lista.length) { bar.innerHTML = ''; return; }
  const { acao, nota } = _acaoComum(lista);
  bar.innerHTML = `<b>${lista.length} ${lista.length === 1 ? 'selecionado' : 'selecionados'}</b><span style="opacity:.6">·</span>`
    + (acao ? dsBtn({ label: acao.label, variant: 'primary', size: 'sm', attrs: 'data-bol-bulk="status"' }) : `<span class="ds-bulk__note">${nota}</span>`)
    + dsBtn({ label: 'Exportar lote ZIP', variant: 'ghost', size: 'sm', attrs: 'data-bol-bulk="zip"' })
    + dsBtn({ label: 'Limpar seleção', variant: 'ghost', size: 'sm', attrs: 'data-bol-bulk="limpar" style="margin-left:auto"' });
}

async function _mudarTodos(lista, novo) {
  const falhas = [];
  for (const r of lista) {
    const { error } = await rpcMudarStatus(r.id, novo, null);
    if (error) falhas.push(`${r.nome}: ${msgErroBanco(error)}`);
  }
  return falhas;
}

async function _status() {
  const lista = selecionados();
  const { acao } = _acaoComum(lista);
  if (!acao) return;
  const ok = await dsConfirm({
    title: `${acao.label}: ${lista.length} cliente${lista.length > 1 ? 's' : ''}?`,
    desc: `Os clientes selecionados passam para "${BOL_STATUS[acao.novo].label}".`,
    okLabel: acao.label,
  });
  if (!ok) return;
  const falhas = await _mudarTodos(lista, acao.novo);
  BO.sel.clear();
  await loadData();
  window.bolRedesenhar?.();
  if (falhas.length) toast(`${lista.length - falhas.length} atualizados, ${falhas.length} falharam: ${falhas.slice(0, 2).join(' | ')}`, 'err');
  else toast(`${lista.length} clientes atualizados`);
}

export function executarBulk(tipo) {
  if (tipo === 'limpar') { BO.sel.clear(); window.bolRedesenhar?.(); return; }
  if (tipo === 'zip') { window.bolExportarLote({ selecionados: true }); return; }
  if (tipo === 'status') _status();
}
