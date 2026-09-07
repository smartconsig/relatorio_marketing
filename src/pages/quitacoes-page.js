// Quitações — orquestrador. Os blocos vivem em src/pages/quitacoes/:
//   q-store.js           estado compartilhado (Q)
//   quitacoes-shell.js   shell estático (vistas + modais), construído 1x
//   quitacoes-lista.js   KPIs + busca + tabela + troca lista/detalhe
//   quitacoes-detalhe.js comprovante "impresso" + visualizador de documento
//   quitacoes-form.js    modal de cadastro/edição + máscaras
// O acesso a dados é 100% via services/quitacoes-service.js.
// Este arquivo re-exporta os 15 nomes públicos q_* originais.
import { loadQuitacoes, upsertQuitacao, uploadDoc, deleteDoc, updateDocMeta } from '../services/quitacoes-service.js';
import { toast } from '../utils/ui.js';
import { Q } from './quitacoes/q-store.js';
import { buildShell } from './quitacoes/quitacoes-shell.js';
import { showList, showDetailView, renderList } from './quitacoes/quitacoes-lista.js';
import { renderDetail, buildComprovanteHTML } from './quitacoes/quitacoes-detalhe.js';
import { q_closeModal, _v, _pm } from './quitacoes/quitacoes-form.js';

export { q_openModal, q_openEditModal, q_closeModal, q_toggleDev, q_onDocSelect, q_maskCPF, q_maskCNPJ, q_maskMoney } from './quitacoes/quitacoes-form.js';

// ── Entry point (chamado pela navigation.js) ───────────────────────────────────
export async function renderQuitacoes() {
  const el = document.getElementById('sec-quitacoes');
  if (!el) return;

  if (!Q.built) {
    buildShell(el);
    Q.built = true;
  }

  showList();
  Q.clientes = await loadQuitacoes();
  renderList();
}

// ── Funções expostas no window ─────────────────────────────────────────────────

export function q_search(val) {
  Q.search = val;
  renderList();
}

export async function q_save() {
  const nome = _v('q-f-nome');
  const cpf  = _v('q-f-cpf');
  if (!nome || !cpf) { toast('Preencha pelo menos Nome e CPF', 'err'); return; }

  const devolvida = document.getElementById('q-f-devolvida')?.value === 'sim';

  const cliente = {
    nome:     nome.toUpperCase(),
    cpf,
    telefone: _v('q-f-tel'),
    endereco: _v('q-f-end'),
    bairro:   _v('q-f-bairro'),
    cidade:   _v('q-f-cidade'),
    uf:       _v('q-f-uf').toUpperCase(),
    cep:      _v('q-f-cep'),
    rg:       _v('q-f-rg'),
    // doc_pdf e doc_path são tratados separadamente via Storage
    quitacao: {
      banco:           _v('q-f-banco'),
      contrato:        _v('q-f-contrato'),
      val_boleto:      _pm('q-f-boleto-val'),
      data_boleto:     _v('q-f-boleto-data'),
      val_ted:         _pm('q-f-ted-val'),
      data_ted:        _v('q-f-ted-data'),
      devolvida,
      val_devolucao:   devolvida ? _pm('q-f-dev-val')  : 0,
      data_devolucao:  devolvida ? _v('q-f-dev-data')  : '',
      pag_nome:        _v('q-f-pag-nome'),
      pag_cnpj:        _v('q-f-pag-cnpj'),
      destino_nome:    _v('q-f-dest-nome'),
      destino_cnpj:    _v('q-f-dest-cnpj'),
      destino_banco:   _v('q-f-dest-banco'),
      destino_agencia: _v('q-f-dest-agencia'),
      destino_conta:   _v('q-f-dest-conta'),
      txid:            _v('q-f-txid'),
      data_hora_tx:    _v('q-f-data-hora-tx'),
    },
    profissional: {
      cargo:     _v('q-f-cargo'),
      categoria: _v('q-f-categoria'),
      unidade:   _v('q-f-unidade'),
      banco_sal: _v('q-f-banco-sal'),
      agencia:   _v('q-f-agencia'),
      conta:     _v('q-f-conta'),
    },
  };

  if (Q.editingId) cliente.id = Q.editingId;

  try {
    let saved = await upsertQuitacao(cliente);

    // Upload do documento para o Storage (se selecionado)
    if (Q.docFile) {
      try {
        if (saved.doc_path) await deleteDoc(saved.doc_path);
        const path = await uploadDoc(saved.id, Q.docFile);
        const withDoc = await updateDocMeta(saved.id, path, Q.docFile.name);
        if (withDoc) saved = withDoc;
      } catch (docErr) {
        toast('Cliente salvo, mas erro ao enviar documento', 'err');
        console.error(docErr);
      }
      Q.docFile = null;
    }

    if (Q.editingId) {
      const idx = Q.clientes.findIndex(x => x.id === Q.editingId);
      if (idx !== -1) Q.clientes[idx] = saved;
      Q.editingId = null;
      q_closeModal();
      showDetailView();
      renderDetail(saved);
    } else {
      Q.clientes.push(saved);
      Q.clientes.sort((a, b) => a.nome.localeCompare(b.nome));
      q_closeModal();
      renderList();
    }
    toast('Cliente salvo com sucesso');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'err');
    console.error(e);
  }
}

export function q_showDetail(id) {
  const c = Q.clientes.find(x => x.id === id);
  if (!c) return;
  showDetailView();
  renderDetail(c);
}

export function q_backToList() {
  showList();
}

export function q_showComprovante(id) {
  const c = Q.clientes.find(x => x.id === id);
  if (!c) return;
  const overlay = document.getElementById('q-comp-overlay');
  const content = document.getElementById('q-comp-content');
  if (!overlay || !content) return;
  content.innerHTML = buildComprovanteHTML(c);
  overlay.style.display = 'flex';
}

export function q_closeComprovante() {
  const overlay = document.getElementById('q-comp-overlay');
  if (overlay) overlay.style.display = 'none';
}

export async function q_attachDoc(id, input) {
  const file = input.files[0];
  if (!file) return;
  const c = Q.clientes.find(x => x.id === id);
  if (!c) return;
  try {
    if (c.doc_path) await deleteDoc(c.doc_path);
    const path = await uploadDoc(id, file);
    const updated = await upsertQuitacao({ ...c, doc_path: path, doc_nome: file.name, doc_pdf: null });
    const idx = Q.clientes.findIndex(x => x.id === id);
    if (idx !== -1) Q.clientes[idx] = updated;
    renderDetail(updated);
    toast('Documento anexado');
  } catch (err) {
    toast('Erro ao salvar documento', 'err');
    console.error(err);
  }
}
