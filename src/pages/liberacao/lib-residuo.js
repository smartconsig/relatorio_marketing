// Ações do dia a dia da Liberação (Fase 3): Marcar como OK, Resíduo (modal
// OBRIGATÓRIO com valor pendente + enquadrada), solicitado, enviado (só Smart),
// pago (valor pago opcional) e Remover OK (Smart). Servem para uma linha ou
// para o lote. Status do resíduo só muda pelas RPCs da migration 015.
// O redesenho da tela é injetado (opts.redesenhar) — sem import de lib-tabela.
import { toast } from '../../utils/ui.js';
import { dsForm, dsConfirm } from '../../components/ds/index.js';
import { updateLiberacao, rpcResiduoIniciar, rpcResiduoAvancar, msgErroResiduo } from '../../services/liberacao-svc.js';
import { S, isAdmin, fmtBRL, recarregarLinhas } from './lib-core.js';
import { LIB_STATUS } from './lib-status.js';

const nomes = lista => (lista.length === 1 ? lista[0].nome : `${lista.length} clientes`);

async function _aplicar(lista, fn) {
  const falhas = [];
  for (const r of lista) {
    const { error } = await fn(r);
    if (error) falhas.push(`${r.nome}: ${error.__msg || msgErroResiduo(error)}`);
  }
  return falhas;
}

function _avisarResultado(lista, falhas, ok) {
  if (!falhas.length) { toast(ok); return; }
  toast(`${lista.length - falhas.length} de ${lista.length} atualizados. ${falhas.slice(0, 2).join(' | ')}`, 'err');
}

async function _finalizar(lista, falhas, ok, redesenhar) {
  S.sel.clear();
  await recarregarLinhas(lista.map(r => r.id));   // só as linhas que mudaram
  redesenhar();
  _avisarResultado(lista, falhas, ok);
}

// OK: mesma gravação de sempre (coluna aprovado); parceiro não desfaz depois
async function _ok(lista, redesenhar) {
  if (lista.length > 1 && !(await dsConfirm({ title: `Marcar ${lista.length} clientes como OK?`, okLabel: 'Marcar como OK' }))) return;
  const falhas = await _aplicar(lista, async r => {
    const res = await updateLiberacao(r.id, { aprovado: true });
    if (res.error) res.error.__msg = 'não foi possível marcar OK';
    return res;
  });
  await _finalizar(lista, falhas, `${nomes(lista)} marcado${lista.length > 1 ? 's' : ''} como OK`, redesenhar);
}

async function _desfazerOk(lista, redesenhar) {
  if (!isAdmin()) return;
  if (!(await dsConfirm({ title: 'Remover o OK?', desc: `${nomes(lista)} volta para o status anterior.`, okLabel: 'Remover OK' }))) return;
  const falhas = await _aplicar(lista, r => updateLiberacao(r.id, { aprovado: false }));
  await _finalizar(lista, falhas, 'OK removido', redesenhar);
}

// Resíduo pendente: um cliente por vez (o valor é de cada um)
async function _residuo(lista, redesenhar) {
  const r = lista[0];
  const v = await dsForm({
    eyebrow: 'Resíduo pendente', title: r.nome, sub: `${r.cpf || ''} · ${r.convenio || ''} · ${r.produto || ''}`,
    okLabel: 'Confirmar resíduo',
    fields: [
      { id: 'valor', label: 'Valor que ficou pendente', type: 'money', required: true, min: 0.01, minMsg: 'O valor precisa ser maior que zero.' },
      { id: 'enq', label: 'A conta está enquadrada?', type: 'yesno', required: true },
    ],
    nota: 'O cliente continua aqui na Liberação, com o status Resíduo pendente.',
    onSubmit: async val => {
      const { error } = await rpcResiduoIniciar(r.id, val.valor, val.enq);
      if (error) throw new Error(msgErroResiduo(error));
    },
  });
  if (!v) return;
  await recarregarLinhas([r.id]);
  redesenhar();
  toast(`${r.nome} em resíduo pendente`);
}

async function _avancar(lista, novo, redesenhar, valorPago = null) {
  const falhas = await _aplicar(lista, r => rpcResiduoAvancar(r.id, novo, valorPago));
  await _finalizar(lista, falhas, `${nomes(lista)} · ${LIB_STATUS['res_' + novo].label.toLowerCase()}`, redesenhar);
}

async function _pago(lista, redesenhar) {
  const um = lista.length === 1 ? lista[0] : null;
  const v = await dsForm({
    eyebrow: 'Resíduo pago', title: nomes(lista), okLabel: 'Confirmar pagamento',
    sub: 'A observação ganha "RESÍDUO PAGO em" + a data de hoje.',
    fields: [{ id: 'valor', label: 'Valor pago', type: 'money', placeholder: um?.residuo_valor ? fmtBRL(um.residuo_valor) : 'R$ 0,00',
      hint: lista.length > 1 ? 'Em branco: cada cliente fica com o próprio valor pendente.' : 'Em branco: usa o valor pendente.' }],
    nota: 'Depois do pago, o cliente precisa virar OK em até 7 dias úteis. Se passar disso, fica vermelho e entra em "Em alerta".',
  });
  if (!v) return;
  await _avancar(lista, 'pago', redesenhar, v.valor);
}

async function _confirmarEAvancar(lista, novo, redesenhar) {
  if (lista.length > 1) {
    const ok = await dsConfirm({ title: `${lista.length} clientes: marcar como ${novo}?`, okLabel: `Marcar como ${novo}` });
    if (!ok) return;
  }
  await _avancar(lista, novo, redesenhar);
}

const ACOES = {
  ok:            _ok,
  'desfazer-ok': _desfazerOk,
  residuo:       _residuo,
  solicitado:    (l, re) => _confirmarEAvancar(l, 'solicitado', re),
  enviado:       (l, re) => _confirmarEAvancar(l, 'enviado', re),
  pago:          _pago,
};

/** k: ok | desfazer-ok | residuo | solicitado | enviado | pago. lista: linhas de S.registros. */
export function executarAcao(k, lista, { redesenhar }) {
  if (!lista.length || !ACOES[k]) return;
  ACOES[k](lista, redesenhar);
}
