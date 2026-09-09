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

// Blocos de preenchimento (tabelas id → valor; mesmos fallbacks '')
function _preencherPessoais(c) {
  [
    ['q-f-nome', c.nome], ['q-f-cpf', c.cpf], ['q-f-rg', c.rg],
    ['q-f-tel', c.telefone], ['q-f-cep', c.cep], ['q-f-end', c.endereco],
    ['q-f-bairro', c.bairro], ['q-f-cidade', c.cidade], ['q-f-uf', c.uf],
  ].forEach(([id, v]) => _setVal(id, v || ''));
}

function _preencherQuitacao(q) {
  [
    ['q-f-banco', q.banco], ['q-f-contrato', q.contrato],
    ['q-f-boleto-data', q.data_boleto], ['q-f-ted-data', q.data_ted],
    ['q-f-dev-data', q.data_devolucao],
    ['q-f-pag-nome', q.pag_nome], ['q-f-pag-cnpj', q.pag_cnpj],
    ['q-f-dest-nome', q.destino_nome], ['q-f-dest-cnpj', q.destino_cnpj],
    ['q-f-dest-banco', q.destino_banco], ['q-f-dest-agencia', q.destino_agencia],
    ['q-f-dest-conta', q.destino_conta], ['q-f-txid', q.txid],
    ['q-f-data-hora-tx', q.data_hora_tx],
  ].forEach(([id, v]) => _setVal(id, v || ''));

  _setMoneyVal('q-f-boleto-val', q.val_boleto);
  _setMoneyVal('q-f-ted-val',    q.val_ted);
  _setMoneyVal('q-f-dev-val',    q.val_devolucao);

  const devEl = document.getElementById('q-f-devolvida');
  if (devEl) devEl.value = q.devolvida ? 'sim' : 'nao';
  q_toggleDev();
}

function _preencherProfissional(p) {
  [
    ['q-f-cargo', p.cargo], ['q-f-categoria', p.categoria],
    ['q-f-unidade', p.unidade], ['q-f-banco-sal', p.banco_sal],
    ['q-f-agencia', p.agencia], ['q-f-conta', p.conta],
  ].forEach(([id, v]) => _setVal(id, v || ''));
}

// Documento já existente (Storage ou legado)
function _mostrarDocExistente(c) {
  const hasExistingDoc = c.doc_path || c.doc_pdf;
  if (!hasExistingDoc || !Q.docNome) return;
  const nameEl   = document.getElementById('q-file-done-name');
  const doneEl   = document.getElementById('q-file-done');
  const uploadEl = document.getElementById('q-upload-area');
  if (nameEl)   nameEl.textContent     = Q.docNome;
  if (doneEl)   doneEl.style.display   = '';
  if (uploadEl) uploadEl.style.display = 'none';
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

  _preencherPessoais(c);
  _preencherQuitacao(c.quitacao || {});
  _preencherProfissional(c.profissional || {});
  _mostrarDocExistente(c);

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
