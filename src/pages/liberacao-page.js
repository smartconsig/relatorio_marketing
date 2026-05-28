// ── Liberação de Margem Master ─────────────────────────────────────────────
import { sb } from '../services/supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { perm } from '../services/permissions.js';

// ── State ──────────────────────────────────────────────────────────────────
let _registros = [];
let _loading   = false;

// ── Helpers ────────────────────────────────────────────────────────────────
const isAdmin = () => perm.isAdmin();

function _empresaParceira() {
  // Admin → sempre "Smart Consig"; parceiro → nome do grupo
  if (isAdmin()) return 'Smart Consig';
  return state.currentUser?.grupoNome || '';
}

const fmtBRL = v =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = v => {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

// ── Entry point ─────────────────────────────────────────────────────────────
export async function renderLiberacao() {
  const el = document.getElementById('sec-liberacao');
  if (!el) return;
  el.innerHTML = _spinner();
  await _loadData();
  _render(el);
}

// ── Data ────────────────────────────────────────────────────────────────────
async function _loadData() {
  const { data, error } = await sb
    .from('liberacao_margem_master')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.warn('[liberacao]', error); _registros = []; return; }
  _registros = data || [];
}

// ── Render principal ─────────────────────────────────────────────────────────
function _render(el) {
  const admin = isAdmin();
  const empresa = _empresaParceira();

  const rows = _registros.length === 0
    ? `<tr><td colspan="${admin ? 12 : 11}" class="lib-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div>Nenhum cliente cadastrado ainda.</div>
      </td></tr>`
    : _registros.map(r => _renderRow(r, admin)).join('');

  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Liberação de Margem Master</h1>
          <p>${_registros.length} cliente${_registros.length !== 1 ? 's' : ''} cadastrado${_registros.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="lib-btn-add" onclick="libAddCliente()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar Cliente
        </button>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              ${admin ? '<th>Empresa</th>' : ''}
              <th>CPF</th>
              <th>Nome</th>
              <th>Saldo Devedor</th>
              <th>Troco</th>
              <th>Saldo Total</th>
              <th>Comissão 6%</th>
              <th>Acerto</th>
              <th>Data Quitado</th>
              <th>Obs</th>
              <th>Status</th>
              ${admin ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody id="lib-tbody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderRow(r, admin) {
  const cls = r.aprovado ? ' lib-row-ok' : '';
  const acertoCell = admin
    ? `<input class="lib-acerto-input" type="date" value="${r.acerto || ''}" data-id="${r.id}" onchange="libSalvarAcerto('${r.id}', this.value)" />`
    : `<span>${fmtDate(r.acerto)}</span>`;

  const okBtn = admin ? `
    <td>
      <button class="lib-btn-ok${r.aprovado ? ' ok' : ''}" data-id="${r.id}" onclick="libToggleOk('${r.id}', ${r.aprovado})" title="${r.aprovado ? 'Remover OK' : 'Marcar como OK'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </td>` : '';

  return `
    <tr class="lib-tr${cls}" data-id="${r.id}">
      ${admin ? `<td><span class="lib-empresa-badge">${r.empresa_parceira}</span></td>` : ''}
      <td>${r.cpf || '—'}</td>
      <td>${r.nome || '—'}</td>
      <td class="lib-val">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_total)}</td>
      <td class="lib-val">${fmtBRL(r.comissao_6pct)}</td>
      <td>${acertoCell}</td>
      <td>${fmtDate(r.data_quitado)}</td>
      <td>${r.obs || '—'}</td>
      <td>${r.aprovado
        ? '<span class="lib-badge-ok">✓ OK</span>'
        : '<span class="lib-badge-pen">Pendente</span>'}</td>
      ${okBtn}
    </tr>
  `;
}

const _spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;

// ── Modal Adicionar Cliente ─────────────────────────────────────────────────
export function libAddCliente() {
  const empresa = _empresaParceira();
  const hoje = new Date().toLocaleDateString('pt-BR');

  const overlay = document.createElement('div');
  overlay.className = 'lib-modal-overlay';
  overlay.id = 'lib-modal-overlay';
  overlay.innerHTML = `
    <div class="lib-modal">
      <h2>Novo Cliente</h2>

      <div class="lib-form-row">
        <label>CPF</label>
        <input type="text" id="lib-f-cpf" placeholder="000.000.000-00" maxlength="14" />
      </div>

      <div class="lib-form-row">
        <label>Nome Completo</label>
        <input type="text" id="lib-f-nome" placeholder="Nome do cliente" />
      </div>

      <div class="lib-form-row-2">
        <div>
          <label>Saldo Devedor (R$)</label>
          <input type="number" id="lib-f-sd" placeholder="0,00" min="0" step="0.01" oninput="libCalcPreview()" />
        </div>
        <div>
          <label>Troco (R$)</label>
          <input type="number" id="lib-f-troco" placeholder="0,00" min="0" step="0.01" value="0" oninput="libCalcPreview()" />
        </div>
      </div>

      <div class="lib-calc-preview" id="lib-calc-preview">
        <div class="lib-calc-preview-item">
          <span class="lbl">Saldo Total</span>
          <span class="val" id="lib-prev-total">R$ —</span>
        </div>
        <div class="lib-calc-preview-item">
          <span class="lbl">Comissão 6%</span>
          <span class="val" id="lib-prev-com">R$ —</span>
        </div>
      </div>

      <div class="lib-modal-auto">
        Empresa: <span>${empresa}</span> &nbsp;·&nbsp;
        Data Quitado: <span>${hoje}</span>
      </div>

      <div class="lib-form-row">
        <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
        <textarea id="lib-f-obs" placeholder="Deixe em branco se não houver observações"></textarea>
      </div>

      <div id="lib-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>

      <div class="lib-modal-actions">
        <button class="lib-btn-cancel" onclick="libFecharModal()">Cancelar</button>
        <button class="lib-btn-save" id="lib-btn-save" onclick="libSalvarCliente()">Salvar Cliente</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) libFecharModal(); });
  document.getElementById('lib-f-cpf')?.focus();
}

export function libFecharModal() {
  document.getElementById('lib-modal-overlay')?.remove();
}

export function libCalcPreview() {
  const sd    = parseFloat(document.getElementById('lib-f-sd')?.value) || 0;
  const troco = parseFloat(document.getElementById('lib-f-troco')?.value) || 0;
  const total = sd + troco;
  const com   = total * 0.06;
  const fmt   = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const t = document.getElementById('lib-prev-total');
  const c = document.getElementById('lib-prev-com');
  if (t) t.textContent = fmt(total);
  if (c) c.textContent = fmt(com);
}

export async function libSalvarCliente() {
  const cpf  = document.getElementById('lib-f-cpf')?.value.trim();
  const nome = document.getElementById('lib-f-nome')?.value.trim();
  const sd   = parseFloat(document.getElementById('lib-f-sd')?.value);
  const troco= parseFloat(document.getElementById('lib-f-troco')?.value) || 0;
  const obs  = document.getElementById('lib-f-obs')?.value.trim() || null;
  const err  = document.getElementById('lib-modal-err');
  const btn  = document.getElementById('lib-btn-save');

  if (!cpf) { err.textContent = 'Informe o CPF.'; err.style.display = ''; return; }
  if (!nome) { err.textContent = 'Informe o nome.'; err.style.display = ''; return; }
  if (!sd || sd <= 0) { err.textContent = 'Informe o saldo devedor.'; err.style.display = ''; return; }

  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const empresa = _empresaParceira();
  const hoje = new Date().toISOString().slice(0, 10);

  const { error } = await sb.from('liberacao_margem_master').insert({
    cpf,
    nome,
    empresa_parceira: empresa,
    saldo_devedor: sd,
    troco,
    data_quitado: hoje,
    obs,
    aprovado: false,
  });

  if (error) {
    err.textContent = 'Erro ao salvar: ' + error.message;
    err.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Salvar Cliente';
    return;
  }

  libFecharModal();
  toast('Cliente salvo com sucesso!');
  await _loadData();
  const el = document.getElementById('sec-liberacao');
  if (el) _render(el);
}

// ── Marcar OK (admin) ───────────────────────────────────────────────────────
export async function libToggleOk(id, atual) {
  const novoValor = !atual;
  const { error } = await sb
    .from('liberacao_margem_master')
    .update({ aprovado: novoValor })
    .eq('id', id);

  if (error) { toast('Erro ao atualizar.'); return; }

  const reg = _registros.find(r => r.id === id);
  if (reg) reg.aprovado = novoValor;

  // Atualiza a linha na UI sem re-renderizar tudo
  const tr = document.querySelector(`.lib-tr[data-id="${id}"]`);
  if (tr) {
    tr.className = `lib-tr${novoValor ? ' lib-row-ok' : ''}`;
    const btn = tr.querySelector('.lib-btn-ok');
    if (btn) {
      btn.className = `lib-btn-ok${novoValor ? ' ok' : ''}`;
      btn.setAttribute('onclick', `libToggleOk('${id}', ${novoValor})`);
      btn.title = novoValor ? 'Remover OK' : 'Marcar como OK';
    }
    const statusCell = tr.querySelector('.lib-badge-ok, .lib-badge-pen');
    if (statusCell) {
      statusCell.className = novoValor ? 'lib-badge-ok' : 'lib-badge-pen';
      statusCell.textContent = novoValor ? '✓ OK' : 'Pendente';
    }
  }
}

// ── Salvar Acerto (admin) ───────────────────────────────────────────────────
export async function libSalvarAcerto(id, valor) {
  const { error } = await sb
    .from('liberacao_margem_master')
    .update({ acerto: valor || null })
    .eq('id', id);

  if (error) { toast('Erro ao salvar data de acerto.'); return; }

  const reg = _registros.find(r => r.id === id);
  if (reg) reg.acerto = valor || null;

  toast('Acerto salvo!');
}
