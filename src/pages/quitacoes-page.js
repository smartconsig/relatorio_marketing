import { loadQuitacoes, upsertQuitacao } from '../services/quitacoes-service.js';
import { toast } from '../utils/ui.js';

// ── Estado do módulo ───────────────────────────────────────────────────────────
let _clientes  = [];
let _search    = '';
let _docBase64 = null;
let _docNome   = null;
let _built     = false;
let _editingId = null;   // id do cliente sendo editado (null = novo)

// ── Entry point (chamado pela navigation.js) ───────────────────────────────────
export async function renderQuitacoes() {
  const el = document.getElementById('sec-quitacoes');
  if (!el) return;

  if (!_built) {
    _buildShell(el);
    _built = true;
  }

  _showList();
  _clientes = await loadQuitacoes();
  _renderList();
}

// ── Funções expostas no window ─────────────────────────────────────────────────

export function q_search(val) {
  _search = val;
  _renderList();
}

export function q_openModal() {
  _editingId = null;
  _docBase64 = null;
  _docNome   = null;
  _resetForm();
  const titleEl = document.getElementById('q-modal-title');
  if (titleEl) titleEl.textContent = 'Novo Cliente';
  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function q_openEditModal(id) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  _editingId = id;
  _docBase64 = c.doc_pdf  || null;
  _docNome   = c.doc_nome || null;
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

  // Documento já existente
  if (_docBase64 && _docNome) {
    const nameEl   = document.getElementById('q-file-done-name');
    const doneEl   = document.getElementById('q-file-done');
    const uploadEl = document.getElementById('q-upload-area');
    if (nameEl)   nameEl.textContent     = _docNome;
    if (doneEl)   doneEl.style.display   = '';
    if (uploadEl) uploadEl.style.display = 'none';
  }

  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function q_closeModal() {
  const overlay = document.getElementById('q-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  _docBase64 = null;
  _docNome   = null;
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
    doc_pdf:  _docBase64 || null,
    doc_nome: _docNome   || null,
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

  if (_editingId) cliente.id = _editingId;

  try {
    const saved = await upsertQuitacao(cliente);
    if (_editingId) {
      const idx = _clientes.findIndex(x => x.id === _editingId);
      if (idx !== -1) _clientes[idx] = saved;
      _editingId = null;
      q_closeModal();
      _showDetailView();
      _renderDetail(saved);
    } else {
      _clientes.push(saved);
      _clientes.sort((a, b) => a.nome.localeCompare(b.nome));
      q_closeModal();
      _renderList();
    }
    toast('Cliente salvo com sucesso');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'err');
    console.error(e);
  }
}

export function q_showDetail(id) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  _showDetailView();
  _renderDetail(c);
}

export function q_backToList() {
  _showList();
}

export function q_showComprovante(id) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  const overlay = document.getElementById('q-comp-overlay');
  const content = document.getElementById('q-comp-content');
  if (!overlay || !content) return;
  content.innerHTML = _buildComprovanteHTML(c);
  overlay.style.display = 'flex';
}

export function q_closeComprovante() {
  const overlay = document.getElementById('q-comp-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function q_attachDoc(id, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    c.doc_pdf  = e.target.result;
    c.doc_nome = file.name;
    try {
      await upsertQuitacao(c);
      _renderDetail(c);
      toast('Documento anexado');
    } catch (err) {
      toast('Erro ao salvar documento', 'err');
      console.error(err);
    }
  };
  reader.readAsDataURL(file);
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
  const reader = new FileReader();
  reader.onload = e => {
    _docBase64 = e.target.result;
    _docNome   = file.name;
    const nameEl   = document.getElementById('q-file-done-name');
    const doneEl   = document.getElementById('q-file-done');
    const uploadEl = document.getElementById('q-upload-area');
    if (nameEl)   nameEl.textContent    = file.name;
    if (doneEl)   doneEl.style.display  = '';
    if (uploadEl) uploadEl.style.display = 'none';
  };
  reader.readAsDataURL(file);
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

// ── Privados ───────────────────────────────────────────────────────────────────

function _v(id)   { return (document.getElementById(id)?.value || '').trim(); }
function _setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function _setMoneyVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!val) { el.value = ''; return; }
  el.value = 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _pm(id) {
  const str = _v(id);
  return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function _showList() {
  const vl = document.getElementById('q-view-list');
  const vd = document.getElementById('q-view-detail');
  if (vl) vl.style.display = '';
  if (vd) vd.style.display = 'none';
}

function _showDetailView() {
  const vl = document.getElementById('q-view-list');
  const vd = document.getElementById('q-view-detail');
  if (vl) vl.style.display = 'none';
  if (vd) vd.style.display = '';
}

function _initials(nome) {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return ((p[0] || '?')[0]).toUpperCase();
}

function _hi(text, q) {
  if (!q) return text;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return text.replace(re, '<mark style="background:rgba(148,11,16,0.25);color:var(--red);border-radius:2px;padding:0 1px">$1</mark>');
}

function _money(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _fmtDate(str) {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

  const ua = document.getElementById('q-upload-area');
  const fd = document.getElementById('q-file-done');
  const fi = document.getElementById('q-f-doc');
  if (ua) ua.style.display = '';
  if (fd) fd.style.display = 'none';
  if (fi) fi.value = '';
}

function _renderList() {
  const statsEl = document.getElementById('q-stats');
  const tableEl = document.getElementById('q-table');
  if (!statsEl || !tableEl) return;

  const comQuit = _clientes.filter(c => c.quitacao && (c.quitacao.val_boleto || c.quitacao.val_ted)).length;
  const comDoc  = _clientes.filter(c => c.doc_pdf).length;

  statsEl.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total de Clientes</div>
      <div class="kpi-value">${_clientes.length}</div>
      <div class="kpi-meta">cadastrados no sistema</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Com Quitação</div>
      <div class="kpi-value">${comQuit}</div>
      <div class="kpi-meta">pagamento registrado</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Com Documento</div>
      <div class="kpi-value">${comDoc}</div>
      <div class="kpi-meta">CNH / RG anexado</div>
    </div>`;

  const q    = _search.toLowerCase().trim();
  const list = q
    ? _clientes.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    : _clientes;

  if (!list.length) {
    tableEl.innerHTML = `
      <div class="table-card">
        <div class="q-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <h3>${q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</h3>
          <p>${q ? 'Tente outro nome ou CPF.' : 'Clique em "Novo Cliente" para começar.'}</p>
        </div>
      </div>`;
    return;
  }

  const hasQuit = c => c.quitacao && (c.quitacao.val_boleto || c.quitacao.val_ted);

  tableEl.innerHTML = `
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CPF</th>
              <th>Cidade / UF</th>
              <th>Quitação</th>
              <th>Documento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(c => `
              <tr class="q-client-row clickable" onclick="q_showDetail('${c.id}')">
                <td>
                  <div style="display:flex;align-items:center;gap:11px">
                    <div class="q-avatar">${_initials(c.nome)}</div>
                    <span style="font-weight:700;color:var(--white)">${_hi(c.nome, q)}</span>
                  </div>
                </td>
                <td style="color:var(--gray);font-size:12px">${c.cpf || '—'}</td>
                <td style="color:var(--gray);font-size:12px">${c.cidade || '—'}${c.uf ? ' / ' + c.uf : ''}</td>
                <td>${hasQuit(c)
                  ? '<span class="q-badge q-badge-green">✓ Quitado</span>'
                  : '<span class="q-badge q-badge-orange">Pendente</span>'}</td>
                <td>${c.doc_pdf
                  ? '<span class="q-badge q-badge-green">✓ Documento</span>'
                  : '<span class="q-badge q-badge-red">Sem doc.</span>'}</td>
                <td>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--gray)" stroke-width="2" width="15" height="15">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _renderDetail(c) {
  const vd = document.getElementById('q-view-detail');
  if (!vd) return;

  const p      = c.profissional || {};
  const q      = c.quitacao    || {};
  const hasDoc = !!c.doc_pdf;
  const hasQuit = q.val_boleto || q.val_ted;

  vd.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <button class="q-back-btn" style="margin-bottom:0" onclick="q_backToList()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Voltar à lista
      </button>
      <button onclick="q_openEditModal('${c.id}')"
        style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:var(--surface3);border:1px solid var(--border);color:var(--white);border-radius:8px;font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;transition:border-color .15s"
        onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>
    </div>

    <div class="q-split">

      <!-- ESQUERDA: comprovante (branco) -->
      <div class="q-split-left">
        <div class="q-comprovante">

          <div class="q-comp-header">
            <div class="q-comp-brand">Smart<em>Consig</em></div>
            <span class="q-comp-status" style="${hasQuit ? '' : 'background:#bf360c'}">
              ${hasQuit ? '✓ QUITADO' : 'PENDENTE'}
            </span>
          </div>

          <div class="q-comp-body">

            <!-- Dados Pessoais -->
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados Pessoais</div>
              <div class="q-comp-row"><span class="lbl">Nome</span><span class="val">${c.nome}</span></div>
              <div class="q-comp-row"><span class="lbl">CPF</span><span class="val">${c.cpf || '—'}</span></div>
              ${c.rg ? `<div class="q-comp-row"><span class="lbl">RG</span><span class="val">${c.rg}</span></div>` : ''}
              ${c.endereco ? `<div class="q-comp-row">
                <span class="lbl">Endereço</span>
                <span class="val" style="font-size:11px;max-width:58%;text-align:right">
                  ${c.endereco}${c.bairro ? ', ' + c.bairro : ''}${c.cidade ? ', ' + c.cidade : ''}${c.uf ? ' / ' + c.uf : ''}
                </span>
              </div>` : ''}
              ${c.cep ? `<div class="q-comp-row"><span class="lbl">CEP</span><span class="val">${c.cep}</span></div>` : ''}
            </div>

            <!-- Dados Profissionais -->
            ${p.cargo || p.unidade ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados Profissionais</div>
              ${p.cargo     ? `<div class="q-comp-row"><span class="lbl">Cargo</span><span class="val">${p.cargo}</span></div>` : ''}
              ${p.categoria ? `<div class="q-comp-row"><span class="lbl">Categoria</span><span class="val">${p.categoria}</span></div>` : ''}
              ${p.unidade   ? `<div class="q-comp-row">
                <span class="lbl">Unidade</span>
                <span class="val" style="font-size:11px;max-width:58%;text-align:right">${p.unidade}</span>
              </div>` : ''}
              ${p.banco_sal ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row"><span class="lbl">Banco (Salário)</span><span class="val">${p.banco_sal}</span></div>
              ` : ''}
              ${p.agencia ? `<div class="q-comp-row"><span class="lbl">Agência</span><span class="val">${p.agencia}</span></div>` : ''}
              ${p.conta   ? `<div class="q-comp-row"><span class="lbl">Conta Corrente</span><span class="val">${p.conta}</span></div>` : ''}
            </div>` : ''}

            <!-- Dados do Contrato -->
            ${q.banco || q.contrato ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados do Contrato</div>
              ${q.banco    ? `<div class="q-comp-row"><span class="lbl">Banco</span><span class="val">${q.banco}</span></div>` : ''}
              ${q.contrato ? `<div class="q-comp-row"><span class="lbl">Nº Contrato</span><span class="val">${q.contrato}</span></div>` : ''}
            </div>` : ''}

            <!-- Pagamentos -->
            ${hasQuit ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Pagamentos Realizados</div>

              ${q.val_boleto ? `
              <div class="q-comp-row q-boleto-click" onclick="q_showComprovante('${c.id}')" title="Ver comprovante">
                <span class="lbl">Boleto quitado <span style="font-size:10px;color:#940b10;margin-left:6px;font-weight:700">↗ comprovante</span></span>
                <span class="val green">${_money(q.val_boleto)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data do pagamento</span>
                <span class="val muted">${_fmtDate(q.data_boleto)}</span>
              </div>` : ''}

              ${q.val_ted ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row q-boleto-click" onclick="q_showComprovante('${c.id}')" title="Ver comprovante">
                <span class="lbl">Carta TED quitada ${!q.val_boleto ? '<span style="font-size:10px;color:#940b10;margin-left:6px;font-weight:700">↗ comprovante</span>' : ''}</span>
                <span class="val green">${_money(q.val_ted)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data do pagamento</span>
                <span class="val muted">${_fmtDate(q.data_ted)}</span>
              </div>` : ''}

              ${q.devolvida ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row">
                <span class="lbl">TED devolvida</span>
                <span class="val red">− ${_money(q.val_devolucao)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data da devolução</span>
                <span class="val muted">${_fmtDate(q.data_devolucao)}</span>
              </div>` : ''}
            </div>` : ''}

            <!-- Pagador -->
            ${q.pag_nome ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Pagador</div>
              <div class="q-comp-row">
                <span class="lbl">Empresa</span>
                <span class="val" style="font-size:11px;max-width:60%;text-align:right">${q.pag_nome}</span>
              </div>
              ${q.pag_cnpj ? `<div class="q-comp-row"><span class="lbl">CNPJ</span><span class="val">${q.pag_cnpj}</span></div>` : ''}
            </div>` : ''}

          </div><!-- /comp-body -->

          <!-- Anexar documento (se não tiver) -->
          ${!hasDoc ? `
          <div style="padding:0 22px 18px">
            <div class="q-attach-bar">
              <span>Nenhum documento anexado.</span>
              <label class="btn-sm btn-ghost" style="cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Anexar Documento
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style="display:none" onchange="q_attachDoc('${c.id}', this)">
              </label>
            </div>
          </div>` : ''}

        </div><!-- /q-comprovante -->
      </div><!-- /q-split-left -->

      <!-- DIREITA: visualizador de documento -->
      <div class="q-split-right" id="q-doc-panel">
        ${hasDoc
          ? `<div class="q-no-doc" id="q-doc-loading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:.3">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div style="font-size:13px;font-weight:700;color:var(--gray-light)">Carregando documento...</div>
            </div>`
          : `<div class="q-no-doc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style="font-size:13px;font-weight:700;color:var(--gray-light)">Documento não anexado</div>
              <div style="font-size:12px">Clique em "Anexar Documento" ao lado.</div>
            </div>`}
      </div>

    </div><!-- /q-split -->`;

  if (hasDoc) _renderDoc(c.doc_pdf);
}

async function _renderDoc(dataUrl) {
  const panel = document.getElementById('q-doc-panel');
  if (!panel) return;

  if (dataUrl.startsWith('data:image/')) {
    panel.innerHTML = `<img src="${dataUrl}" style="width:100%;height:auto;border-radius:6px;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.4)">`;
    return;
  }

  // PDF: converte base64 em blob e exibe em iframe
  try {
    const base64 = dataUrl.split(',')[1];
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    panel.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="width:100%;height:100%;min-height:400px;border:none;border-radius:6px"></iframe>`;
  } catch (e) {
    panel.innerHTML = `<div class="q-no-doc"><div>Erro ao carregar o documento.</div></div>`;
    console.error(e);
  }
}

function _buildComprovanteHTML(c) {
  const q      = c.quitacao    || {};
  const p      = c.profissional || {};
  const dataStr = q.data_hora_tx || '—';
  const txId    = q.txid || '—';
  const valorTx = (q.val_boleto && q.val_boleto > 0) ? q.val_boleto : q.val_ted;

  return `
    <div style="padding:22px 26px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0">
      <div style="font-size:14px;font-weight:800;color:#1a1a1a;font-family:var(--font-h)">Comprovante de transferência</div>
      <button onclick="q_closeComprovante()" style="width:30px;height:30px;border-radius:8px;border:none;background:#f0f0f0;cursor:pointer;font-size:17px;color:#5e5e5e;display:flex;align-items:center;justify-content:center">×</button>
    </div>
    <div style="padding:0 26px 26px">

      <div class="q-nu-date">${dataStr}</div>

      <div class="q-nu-section">
        <div class="q-nu-row">
          <span class="q-nu-lbl">Valor</span>
          <span class="q-nu-val">${_money(valorTx)}</span>
        </div>
        <div class="q-nu-row">
          <span class="q-nu-lbl">Tipo de transferência</span>
          <span class="q-nu-val">TED</span>
        </div>
        <div class="q-nu-row">
          <span class="q-nu-lbl">ID da transação</span>
          <span class="q-nu-val q-nu-txid">${txId}</span>
        </div>
      </div>

      <div class="q-nu-group-label">Destino</div>
      <div class="q-nu-section">
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${q.destino_nome || q.banco || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CNPJ</span><span class="q-nu-val">${q.destino_cnpj || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Banco</span><span class="q-nu-val">${q.destino_banco || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${q.destino_agencia || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${q.destino_conta || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Tipo de conta</span><span class="q-nu-val">Conta Corrente</span></div>
      </div>

      <div class="q-nu-group-label">Origem</div>
      <div class="q-nu-section">
        ${q.origem_nome ? `
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${q.origem_nome}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CNPJ</span><span class="q-nu-val">${q.origem_cnpj || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${q.origem_agencia || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${q.origem_conta || '—'}</span></div>
        ` : `
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${c.nome}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CPF</span><span class="q-nu-val">${c.cpf || '—'}</span></div>
        ${p.banco_sal ? `<div class="q-nu-row"><span class="q-nu-lbl">Banco</span><span class="q-nu-val">${p.banco_sal}</span></div>` : ''}
        ${p.agencia   ? `<div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${p.agencia}</span></div>` : ''}
        ${p.conta     ? `<div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${p.conta}</span></div>` : ''}
        `}
      </div>

    </div>`;
}

function _inp(id, placeholder, extra = '') {
  return `<input type="text" id="${id}" placeholder="${placeholder}" class="q-form-input" ${extra}>`;
}
function _dat(id) {
  return `<input type="date" id="${id}" class="q-form-input">`;
}

function _buildShell(el) {
  el.innerHTML = `
    <div style="padding:28px 30px;max-width:1200px">

      <!-- Vista: Lista -->
      <div id="q-view-list">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px">
          <div>
            <div style="font-size:20px;font-family:var(--font-h);font-weight:800;color:var(--white)">Quitações</div>
            <div style="font-size:12px;color:var(--gray);margin-top:4px">Comprovantes de pagamento e quitação de contratos</div>
          </div>
          <button onclick="q_openModal()" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Cliente
          </button>
        </div>

        <!-- Busca -->
        <div style="position:relative;margin-bottom:16px">
          <svg style="position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--gray);pointer-events:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="q-search" type="text" placeholder="Pesquisar por nome ou CPF..."
            oninput="q_search(this.value)"
            style="width:100%;padding:11px 16px 11px 42px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--white);font-family:var(--font-b);font-size:13px;outline:none;transition:border-color .15s"
            onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- Stats -->
        <div id="q-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px"></div>

        <!-- Tabela -->
        <div id="q-table"></div>
      </div>

      <!-- Vista: Detalhe -->
      <div id="q-view-detail" style="display:none"></div>

    </div>

    <!-- ── Modal: Novo Cliente ─────────────────────────── -->
    <div id="q-modal-overlay" onclick="if(event.target===this)q_closeModal()"
      style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;padding:20px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto">
        <div style="padding:22px 26px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface2);z-index:10">
          <div id="q-modal-title" style="font-family:var(--font-h);font-size:16px;font-weight:800;color:var(--white)">Novo Cliente</div>
          <button onclick="q_closeModal()" style="width:30px;height:30px;border-radius:8px;border:none;background:var(--surface3);cursor:pointer;font-size:17px;color:var(--gray);display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="padding:22px 26px">
          <div class="q-form-grid">

            <div class="q-form-group full">
              <label class="q-form-label">Nome Completo</label>
              ${_inp('q-f-nome', 'Ex: WILTON BORGES VIANA')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CPF</label>
              ${_inp('q-f-cpf', '000.000.000-00', 'oninput="q_maskCPF(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">RG</label>
              ${_inp('q-f-rg', 'Ex: 21.973.887-7')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Telefone</label>
              ${_inp('q-f-tel', '(11) 99999-9999')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CEP</label>
              ${_inp('q-f-cep', '00000-000')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Endereço</label>
              ${_inp('q-f-end', 'Rua, número')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Bairro</label>
              ${_inp('q-f-bairro', 'Bairro')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Cidade</label>
              ${_inp('q-f-cidade', 'Cidade')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">UF</label>
              ${_inp('q-f-uf', 'SP')}
            </div>

            <div class="q-form-divider"><span>Dados de Quitação</span></div>

            <div class="q-form-group">
              <label class="q-form-label">Banco</label>
              ${_inp('q-f-banco', 'Ex: Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Nº Contrato</label>
              ${_inp('q-f-contrato', 'Ex: 857102')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Valor Boleto Quitado</label>
              ${_inp('q-f-boleto-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Data Quitação Boleto</label>
              ${_dat('q-f-boleto-data')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Valor Carta TED</label>
              ${_inp('q-f-ted-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Data Quitação TED</label>
              ${_dat('q-f-ted-data')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">TED Devolvida?</label>
              <select id="q-f-devolvida" class="q-form-input" onchange="q_toggleDev()">
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div class="q-form-group" id="q-grp-dev-data" style="display:none">
              <label class="q-form-label">Data Devolução</label>
              ${_dat('q-f-dev-data')}
            </div>
            <div class="q-form-group full" id="q-grp-dev-val" style="display:none">
              <label class="q-form-label">Valor Devolvido</label>
              ${_inp('q-f-dev-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Pagador — Empresa</label>
              ${_inp('q-f-pag-nome', 'Razão Social da empresa pagadora')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">CNPJ do Pagador</label>
              ${_inp('q-f-pag-cnpj', '00.000.000/0000-00', 'oninput="q_maskCNPJ(this)"')}
            </div>

            <div class="q-form-divider"><span>Dados do Destino (TED)</span></div>

            <div class="q-form-group full">
              <label class="q-form-label">Nome do Destino</label>
              ${_inp('q-f-dest-nome', 'Ex: Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CNPJ do Destino</label>
              ${_inp('q-f-dest-cnpj', '00.000.000/0000-00', 'oninput="q_maskCNPJ(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Banco Destino</label>
              ${_inp('q-f-dest-banco', 'Ex: 643 - Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Agência Destino</label>
              ${_inp('q-f-dest-agencia', 'Ex: 0001-9')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Conta Destino</label>
              ${_inp('q-f-dest-conta', 'Ex: 900.026-9')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">ID da Transação (TXID)</label>
              ${_inp('q-f-txid', 'Ex: E1A2B3C4D...')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Data e Hora da Transação</label>
              ${_inp('q-f-data-hora-tx', 'Ex: 09 ABR 2026 - 14:32:17')}
            </div>

            <div class="q-form-divider"><span>Dados Profissionais</span></div>

            <div class="q-form-group full">
              <label class="q-form-label">Cargo / Função</label>
              ${_inp('q-f-cargo', 'Ex: Policial Penal IV')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Categoria</label>
              ${_inp('q-f-categoria', 'Ex: Titular de Cargo Efetivo')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Órgão / Unidade</label>
              ${_inp('q-f-unidade', 'Ex: Centro de Detenção Provisória de Suzano')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Banco (Salário)</label>
              ${_inp('q-f-banco-sal', 'Ex: Banco do Brasil')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Agência</label>
              ${_inp('q-f-agencia', 'Ex: 0097')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Conta Corrente</label>
              ${_inp('q-f-conta', 'Ex: 71921-8')}
            </div>

            <div class="q-form-divider"><span>Documento do Cliente (PDF ou Imagem)</span></div>

            <div class="q-file-upload" id="q-upload-area" onclick="document.getElementById('q-f-doc').click()">
              <input type="file" id="q-f-doc" accept=".pdf,.png,.jpg,.jpeg" onchange="q_onDocSelect(this)" style="display:none">
              <div style="font-size:13px;font-weight:600;color:var(--gray-light)">Clique para selecionar o documento</div>
              <div style="font-size:11px;color:var(--gray);margin-top:4px">PDF, PNG ou JPEG — CNH, RG ou outro documento</div>
            </div>
            <div class="q-file-done" id="q-file-done" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span id="q-file-done-name"></span>
            </div>

          </div>
        </div>
        <div style="padding:0 26px 22px;display:flex;justify-content:flex-end;gap:10px">
          <button onclick="q_closeModal()" class="btn-sm btn-ghost">Cancelar</button>
          <button onclick="q_save()" class="btn-sm btn-primary">Salvar Cliente</button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Comprovante ──────────────────────────── -->
    <div id="q-comp-overlay" onclick="if(event.target===this)q_closeComprovante()"
      style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;padding:20px">
      <div id="q-comp-content"
        style="background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:92vh;overflow-y:auto;color:#1a1a1a"></div>
    </div>`;
}
