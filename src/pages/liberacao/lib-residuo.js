// Ações do dia a dia da Liberação (Fase 3): Marcar como OK, Resíduo (modal
// OBRIGATÓRIO com valor pendente + enquadrada), solicitado, anexado, enviado
// (só Smart), pago (valor pago opcional) e Remover OK (Smart). Servem para uma
// linha ou para o lote. Desde 08/10/2026 (migration 018) também "Mudar status"
// para qualquer etapa — tudo pela RPC liberacao_mudar_status.
// O redesenho da tela é injetado (opts.redesenhar) — sem import de lib-tabela.
import { toast } from '../../utils/ui.js';
import { dsForm, dsConfirm } from '../../components/ds/index.js';
import { updateLiberacao, rpcMudarStatus, msgErroResiduo } from '../../services/liberacao-svc.js';
import { S, fmtBRL, recarregarLinhas } from './lib-core.js';
import { LIB_STATUS, statusDe, ehSmart } from './lib-status.js';

const nomes = lista => (lista.length === 1 ? lista[0].nome : `${lista.length} clientes`);
const _rotulo = st => LIB_STATUS[st].label.toLowerCase();

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

// OK: mesma gravação de sempre (coluna aprovado); só a Smart tira o OK depois
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
  if (!ehSmart()) return;
  if (!(await dsConfirm({ title: 'Remover o OK?', desc: `${nomes(lista)} volta para o status anterior.`, okLabel: 'Remover OK' }))) return;
  const falhas = await _aplicar(lista, r => updateLiberacao(r.id, { aprovado: false }));
  await _finalizar(lista, falhas, 'OK removido', redesenhar);
}

// Valor + enquadrada (obrigatórios) — pedidos quando o cliente ainda não tem resíduo informado
const CAMPOS_RESIDUO = r => [
  { id: 'valor', label: 'Valor que ficou pendente', type: 'money', required: true, min: 0.01, minMsg: 'O valor precisa ser maior que zero.',
    value: r.residuo_valor != null ? fmtBRL(r.residuo_valor) : '' },
  { id: 'enq', label: 'A conta está enquadrada?', type: 'yesno', required: true, value: r.residuo_enquadrada ?? null },
];
const CAMPO_PAGO = r => ({ id: 'pago', label: 'Valor pago', type: 'money',
  placeholder: r?.residuo_valor ? fmtBRL(r.residuo_valor) : 'R$ 0,00', hint: 'Em branco: usa o valor pendente.' });
const _semDadosResiduo = r => r.residuo_valor == null || r.residuo_enquadrada == null;
const _pedeResiduo = (r, novo) => novo.startsWith('res_') && (novo === 'res_pendente' || _semDadosResiduo(r));
const _precisaForm = (r, novo) => _pedeResiduo(r, novo) || novo === 'res_pago';

// Um cliente: abre o formulário certo para o destino e grava pela RPC
async function _mudarUm(r, novo, redesenhar) {
  const fields = [...(_pedeResiduo(r, novo) ? CAMPOS_RESIDUO(r) : []), ...(novo === 'res_pago' ? [CAMPO_PAGO(r)] : [])];
  const de = LIB_STATUS[statusDe(r)].label;
  const v = await dsForm({
    eyebrow: `${de} → ${LIB_STATUS[novo].label}`, title: r.nome, sub: `${r.cpf || ''} · ${r.convenio || ''} · ${r.produto || ''}`,
    okLabel: 'Confirmar', fields,
    nota: novo === 'res_pago' ? 'A observação ganha "RESÍDUO PAGO em" + a data de hoje. Depois do pago, o cliente precisa virar OK em até 7 dias úteis.' : undefined,
    onSubmit: async val => {
      const { error } = await rpcMudarStatus(r.id, novo, { valor: val.valor ?? null, enquadrada: val.enq ?? null, valorPago: val.pago ?? null });
      if (error) throw new Error(msgErroResiduo(error));
    },
  });
  if (!v) return;
  await recarregarLinhas([r.id]);
  redesenhar();
  toast(`${r.nome} · ${_rotulo(novo)}`);
}

// Lote (só os passos simples; o resíduo novo é sempre um cliente por vez)
async function _mudarLote(lista, novo, redesenhar, valorPago = null) {
  if (lista.length === 1 && _precisaForm(lista[0], novo)) { await _mudarUm(lista[0], novo, redesenhar); return; }
  if (lista.length > 1 && novo !== 'res_pago' && !(await dsConfirm({ title: `${lista.length} clientes: marcar como ${_rotulo(novo)}?`, okLabel: 'Confirmar' }))) return;
  const falhas = await _aplicar(lista, r => rpcMudarStatus(r.id, novo, { valorPago }));
  await _finalizar(lista, falhas, `${nomes(lista)} · ${_rotulo(novo)}`, redesenhar);
}

async function _pagoLote(lista, redesenhar) {
  if (lista.length === 1) { await _mudarUm(lista[0], 'res_pago', redesenhar); return; }
  const v = await dsForm({
    eyebrow: 'Resíduo pago', title: nomes(lista), okLabel: 'Confirmar pagamento',
    sub: 'A observação ganha "RESÍDUO PAGO em" + a data de hoje.',
    fields: [{ ...CAMPO_PAGO(null), hint: 'Em branco: cada cliente fica com o próprio valor pendente.' }],
  });
  if (!v) return;
  await _mudarLote(lista, 'res_pago', redesenhar, v.pago);
}

const ACOES = {
  ok:            _ok,
  'desfazer-ok': _desfazerOk,
  residuo:       (l, re) => _mudarUm(l[0], 'res_pendente', re),
  solicitado:    (l, re) => _mudarLote(l, 'res_solicitado', re),
  anexado:       (l, re) => _mudarLote(l, 'res_anexado', re),
  enviado:       (l, re) => _mudarLote(l, 'res_enviado', re),
  pago:          _pagoLote,
};

/** k: ok | desfazer-ok | residuo | solicitado | anexado | enviado | pago. lista: linhas de S.registros. */
export function executarAcao(k, lista, { redesenhar }) {
  if (!lista.length || !ACOES[k]) return;
  ACOES[k](lista, redesenhar);
}

/** "Mudar status" da linha aberta: leva UM cliente para qualquer status permitido. */
export function mudarStatus(r, novo, { redesenhar }) {
  if (!r || !LIB_STATUS[novo]) return;
  if (novo === 'ok') { _ok([r], redesenhar); return; }
  if (statusDe(r) === 'ok' && novo !== 'ok' && !ehSmart()) return;
  if (_precisaForm(r, novo)) { _mudarUm(r, novo, redesenhar); return; }
  _confirmarSimples(r, novo, redesenhar);
}

async function _confirmarSimples(r, novo, redesenhar) {
  const desc = novo === 'pendente' && r.residuo_status ? 'O resíduo sai de andamento (valor e enquadrada ficam guardados).' : undefined;
  if (!(await dsConfirm({ title: `${r.nome}: mudar para ${_rotulo(novo)}?`, desc, okLabel: 'Mudar status' }))) return;
  const { error } = await rpcMudarStatus(r.id, novo);
  if (error) { toast(msgErroResiduo(error), 'err'); return; }
  await recarregarLinhas([r.id]);
  redesenhar();
  toast(`${r.nome} · ${_rotulo(novo)}`);
}
