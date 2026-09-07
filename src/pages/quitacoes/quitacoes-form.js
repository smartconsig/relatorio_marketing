// Formulário de cadastro/edição da Quitação: abrir/fechar modal, preencher
// campos na edição, máscaras (CPF/CNPJ/dinheiro) e leitura de valores.
// ⚠ Contrato de IDs com o shell (q-f-*): as listas de _resetForm e do
// preenchimento em q_openEditModal precisam acompanhar quitacoes-shell.js.
import { Q } from './q-store.js';

export function q_openModal() {
  Q.editingId = null;
  Q.docBase64 = null;
  Q.docNome   = null;
  Q.docFile   = null;
  _resetForm();
  const titleEl = document.getElementById('q-modal-title');
  if (titleEl) titleEl.textContent = 'Novo Cliente';
  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function q_openEditModal(id) {
  const c = Q.clientes.find(x => x.id === id);
  if (!c) return;
  Q.editingId = id;
  Q.docFile   = null;
  Q.docBase64 = null;
  Q.docNome   = c.doc_nome || null;
  _resetForm();

  const titleEl = document.getElementById('q-modal-title');
  if (titleEl) titleEl.textContent = 'Editar Cliente';

  const q = c.quitacao     || {};
  const p = c.profissional || {};

  // Dados pessoais
  _setVal('q-f-nome',   c.nome      || '');
  _setVal('q-f-cpf',    c.cpf       || '');
  _setVal('q-f-rg',     c.rg        || '');
  _setVal('q-f-tel',    c.telefone  || '');
  _setVal('q-f-cep',    c.cep       || '');
  _setVal('q-f-end',    c.endereco  || '');
  _setVal('q-f-bairro', c.bairro    || '');
  _setVal('q-f-cidade', c.cidade    || '');
  _setVal('q-f-uf',     c.uf        || '');

  // Quitação
  _setVal('q-f-banco',       q.banco           || '');
  _setVal('q-f-contrato',    q.contrato        || '');
  _setMoneyVal('q-f-boleto-val', q.val_boleto);
  _setVal('q-f-boleto-data', q.data_boleto     || '');
  _setMoneyVal('q-f-ted-val', q.val_ted);
  _setVal('q-f-ted-data',    q.data_ted        || '');

  const devEl = document.getElementById('q-f-devolvida');
  if (devEl) devEl.value = q.devolvida ? 'sim' : 'nao';
  q_toggleDev();
  _setVal('q-f-dev-data',    q.data_devolucao  || '');
  _setMoneyVal('q-f-dev-val', q.val_devolucao);

  _setVal('q-f-pag-nome',     q.pag_nome        || '');
  _setVal('q-f-pag-cnpj',     q.pag_cnpj        || '');
  _setVal('q-f-dest-nome',    q.destino_nome    || '');
  _setVal('q-f-dest-cnpj',    q.destino_cnpj    || '');
  _setVal('q-f-dest-banco',   q.destino_banco   || '');
  _setVal('q-f-dest-agencia', q.destino_agencia || '');
  _setVal('q-f-dest-conta',   q.destino_conta   || '');
  _setVal('q-f-txid',         q.txid            || '');
  _setVal('q-f-data-hora-tx', q.data_hora_tx    || '');

  // Profissional
  _setVal('q-f-cargo',     p.cargo     || '');
  _setVal('q-f-categoria', p.categoria || '');
  _setVal('q-f-unidade',   p.unidade   || '');
  _setVal('q-f-banco-sal', p.banco_sal || '');
  _setVal('q-f-agencia',   p.agencia   || '');
  _setVal('q-f-conta',     p.conta     || '');

  // Documento já existente (Storage ou legado)
  const hasExistingDoc = c.doc_path || c.doc_pdf;
  if (hasExistingDoc && Q.docNome) {
    const nameEl   = document.getElementById('q-file-done-name');
    const doneEl   = document.getElementById('q-file-done');
    const uploadEl = document.getElementById('q-upload-area');
    if (nameEl)   nameEl.textContent     = Q.docNome;
    if (doneEl)   doneEl.style.display   = '';
    if (uploadEl) uploadEl.style.display = 'none';
  }

  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function q_closeModal() {
  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  Q.docBase64 = null;
  Q.docNome   = null;
  Q.docFile   = null;
}

export function q_toggleDev() {
  const sim     = document.getElementById('q-f-devolvida')?.value === 'sim';
  const devData = document.getElementById('q-grp-dev-data');
  const devVal  = document.getElementById('q-grp-dev-val');
  if (devData) devData.style.display = sim ? '' : 'none';
  if (devVal)  devVal.style.display  = sim ? '' : 'none';
}

export function q_onDocSelect(input) {
  const file = input.files[0];
  if (!file) return;
  Q.docFile = file;
  Q.docNome = file.name;
  const nameEl   = document.getElementById('q-file-done-name');
  const doneEl   = document.getElementById('q-file-done');
  const uploadEl = document.getElementById('q-upload-area');
  if (nameEl)   nameEl.textContent     = file.name;
  if (doneEl)   doneEl.style.display   = '';
  if (uploadEl) uploadEl.style.display = 'none';
}

export function q_maskCPF(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
  el.value = v;
}

export function q_maskCNPJ(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 14);
  if (v.length > 12)     v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
  else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
  else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,3})/, '$1.$2');
  el.value = v;
}

export function q_maskMoney(el) {
  const raw = el.value.replace(/\D/g, '');
  if (!raw) { el.value = ''; return; }
  el.value = 'R$ ' + (parseInt(raw) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// ── Leitura/escrita de campos ──────────────────────────────────────────────
export function _v(id)   { return (document.getElementById(id)?.value || '').trim(); }
function _setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function _setMoneyVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!val) { el.value = ''; return; }
  el.value = 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function _pm(id) {
  const str = _v(id);
  return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function _resetForm() {
  [
    'q-f-nome','q-f-cpf','q-f-rg','q-f-tel','q-f-end','q-f-bairro','q-f-cidade','q-f-uf','q-f-cep',
    'q-f-banco','q-f-contrato','q-f-boleto-val','q-f-ted-val','q-f-pag-nome','q-f-pag-cnpj',
    'q-f-dest-nome','q-f-dest-cnpj','q-f-dest-banco','q-f-dest-agencia','q-f-dest-conta',
    'q-f-txid','q-f-data-hora-tx','q-f-dev-val',
    'q-f-cargo','q-f-categoria','q-f-unidade','q-f-banco-sal','q-f-agencia','q-f-conta',
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  ['q-f-boleto-data','q-f-ted-data','q-f-dev-data'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  const dev = document.getElementById('q-f-devolvida');
  if (dev) dev.value = 'nao';
  q_toggleDev();

  Q.docBase64 = null;
  Q.docNome   = null;
  Q.docFile   = null;

  const ua = document.getElementById('q-upload-area');
  const fd = document.getElementById('q-file-done');
  const fi = document.getElementById('q-f-doc');
  if (ua) ua.style.display = '';
  if (fd) fd.style.display = 'none';
  if (fi) fi.value = '';
}
