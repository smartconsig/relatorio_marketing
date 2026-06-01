// ── Liberação de Margem Master ─────────────────────────────────────────────
import { sb } from '../services/supabase.js';
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { perm } from '../services/permissions.js';
import * as XLSX from 'xlsx';

// ── State ──────────────────────────────────────────────────────────────────
let _registros = [];
let _page      = 1;
let _search    = '';
let _dateFrom  = null;
let _dateTo    = null;
let _preset    = null;

const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────
const isAdmin = () => perm.isAdmin();

function _empresaParceira() {
  if (isAdmin()) return 'Smart Consig';
  return state.currentUser?.grupoNome || '';
}

const fmtBRL = v =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = v => {
  if (!v) return '—';
  const d = new Date(v + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Date presets ──────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'hoje',    label: 'Hoje' },
  { key: 'ontem',   label: 'Ontem' },
  { key: '7d',      label: '7 dias' },
  { key: '15d',     label: '15 dias' },
  { key: '30d',     label: '30 dias' },
  { key: '60d',     label: '60 dias' },
  { key: '90d',     label: '90 dias' },
  { key: 'mes',     label: 'Este mês' },
  { key: 'mes_ant', label: 'Mês passado' },
];

function _presetRange(key) {
  const t = new Date(); t.setHours(0,0,0,0);
  const fmt = d => d.toISOString().slice(0,10);
  switch (key) {
    case 'hoje':    return { from: fmt(t), to: fmt(t) };
    case 'ontem':   { const d=new Date(t); d.setDate(d.getDate()-1); return { from:fmt(d), to:fmt(d) }; }
    case '7d':      { const d=new Date(t); d.setDate(d.getDate()-6); return { from:fmt(d), to:fmt(t) }; }
    case '15d':     { const d=new Date(t); d.setDate(d.getDate()-14); return { from:fmt(d), to:fmt(t) }; }
    case '30d':     { const d=new Date(t); d.setDate(d.getDate()-29); return { from:fmt(d), to:fmt(t) }; }
    case '60d':     { const d=new Date(t); d.setDate(d.getDate()-59); return { from:fmt(d), to:fmt(t) }; }
    case '90d':     { const d=new Date(t); d.setDate(d.getDate()-89); return { from:fmt(d), to:fmt(t) }; }
    case 'mes':     return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmt(t) };
    case 'mes_ant': return {
      from: fmt(new Date(t.getFullYear(), t.getMonth()-1, 1)),
      to:   fmt(new Date(t.getFullYear(), t.getMonth(), 0)),
    };
    default: return { from: null, to: null };
  }
}

// ── Filter ────────────────────────────────────────────────────────────────
function _filtered() {
  let list = _registros;
  if (_search) {
    const digits = _search.replace(/\D/g,'');
    const lower  = _search.toLowerCase();
    list = list.filter(r =>
      r.nome?.toLowerCase().includes(lower) ||
      (digits && r.cpf?.replace(/\D/g,'').includes(digits))
    );
  }
  if (_dateFrom) list = list.filter(r => r.data_quitado && r.data_quitado >= _dateFrom);
  if (_dateTo)   list = list.filter(r => r.data_quitado && r.data_quitado <= _dateTo);
  return list;
}

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderLiberacao() {
  const el = document.getElementById('sec-liberacao');
  if (!el) return;
  _page = 1; _search = ''; _dateFrom = null; _dateTo = null; _preset = null;
  el.innerHTML = _spinner();
  await _loadData();
  _render(el);
}

// ── Data ──────────────────────────────────────────────────────────────────
async function _loadData() {
  const { data, error } = await sb
    .from('liberacao_margem_master')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.warn('[liberacao]', error); _registros = []; return; }
  _registros = data || [];
}

// ── Render shell (once) ───────────────────────────────────────────────────
function _render(el) {
  const admin = isAdmin();
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Liberação de Margem Master</h1>
          <p class="lib-count"></p>
        </div>
        <div class="lib-topbar-actions">
          <button class="lib-btn-import" onclick="libImportarPlanilha()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Planilha
          </button>
          <input type="file" id="lib-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="libOnImportFile(this)" />
          <button class="lib-btn-add" onclick="libAddCliente()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Cliente
          </button>
        </div>
      </div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="lib-search" type="text" placeholder="Buscar por nome ou CPF…" oninput="libSetSearch(this.value)" />
          <button class="lib-search-clear" id="lib-search-clear" onclick="libSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>

        <div class="lib-date-row">
          <div class="lib-presets">
            ${PRESETS.map(p => `<button class="lib-preset" data-key="${p.key}" onclick="libSetPreset('${p.key}')">${p.label}</button>`).join('')}
            <button class="lib-preset-clear" id="lib-preset-clear" onclick="libClearDate()" style="display:none">× Limpar</button>
          </div>
          <div class="lib-date-inputs">
            <input type="date" class="lib-date-input" id="lib-date-from" onchange="libSetDateManual()" />
            <span class="lib-date-sep">até</span>
            <input type="date" class="lib-date-input" id="lib-date-to" onchange="libSetDateManual()" />
          </div>
        </div>
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
              ${admin ? '<th>Troco Líquido</th>' : ''}
              <th>Saldo Total</th>
              <th>Comissão 6%</th>
              <th>Acerto</th>
              <th>Data Quitado</th>
              <th>Obs</th>
              <th>Status</th>
              ${admin ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody id="lib-tbody"></tbody>
        </table>
      </div>
      <div id="lib-ver-mais-wrap"></div>
    </div>
  `;
  _updateTable();
}

// ── Update dinâmico (sem re-renderizar tudo) ──────────────────────────────
function _updateTable() {
  const admin    = isAdmin();
  const filtered = _filtered();
  const visible  = filtered.slice(0, _page * PAGE_SIZE);
  const hasMore  = filtered.length > visible.length;
  const cols     = admin ? 13 : 11;

  // Contagem
  const countEl = document.querySelector('.lib-count');
  if (countEl) {
    countEl.textContent = _search || _dateFrom || _dateTo
      ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} de ${_registros.length} total`
      : `${_registros.length} cliente${_registros.length !== 1 ? 's' : ''} cadastrado${_registros.length !== 1 ? 's' : ''}`;
  }

  // Tbody
  const tbody = document.getElementById('lib-tbody');
  if (tbody) {
    tbody.innerHTML = visible.length === 0
      ? `<tr><td colspan="${cols}" class="lib-empty">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <div>Nenhum cliente encontrado.</div>
         </td></tr>`
      : visible.map(r => _renderRow(r, admin)).join('');
  }

  // Ver mais
  const vmWrap = document.getElementById('lib-ver-mais-wrap');
  if (vmWrap) {
    if (hasMore) {
      const rest = filtered.length - visible.length;
      const next = Math.min(PAGE_SIZE, rest);
      vmWrap.innerHTML = `
        <div class="lib-ver-mais-wrap">
          <button class="lib-ver-mais" onclick="libVerMais()">
            Mostrar mais ${next} cliente${next !== 1 ? 's' : ''}
            <span class="lib-ver-mais-sub">${rest} restante${rest !== 1 ? 's' : ''}</span>
          </button>
        </div>`;
    } else {
      vmWrap.innerHTML = '';
    }
  }

  // Botão limpar busca
  const clearSearch = document.getElementById('lib-search-clear');
  if (clearSearch) clearSearch.style.display = _search ? '' : 'none';

  // Botão limpar data
  const clearDate = document.getElementById('lib-preset-clear');
  if (clearDate) clearDate.style.display = (_preset || _dateFrom || _dateTo) ? '' : 'none';

  // Presets ativos
  document.querySelectorAll('.lib-preset[data-key]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === _preset);
  });

  // Sincroniza inputs de data
  const fromEl = document.getElementById('lib-date-from');
  const toEl   = document.getElementById('lib-date-to');
  if (fromEl) fromEl.value = _dateFrom || '';
  if (toEl)   toEl.value   = _dateTo   || '';
}

function _renderRow(r, admin) {
  const cls = r.aprovado ? ' lib-row-ok' : '';
  const acertoCell = admin
    ? `<input class="lib-acerto-input" type="date" value="${r.acerto || ''}" onchange="libSalvarAcerto('${r.id}', this.value)" />`
    : fmtDate(r.acerto);

  const okBtn = admin ? `
    <td class="lib-td-actions">
      <button class="lib-btn-ok${r.aprovado ? ' ok' : ''}" onclick="libToggleOk('${r.id}', ${r.aprovado})" title="${r.aprovado ? 'Remover OK' : 'Marcar como OK'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="lib-btn-del" onclick="libDeletarCliente('${r.id}', '${r.nome.replace(/'/g, "\\'")}')" title="Excluir cliente">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </td>` : '';

  return `
    <tr class="lib-tr${cls}" data-id="${r.id}">
      ${admin ? `<td><span class="lib-empresa-badge">${_esc(r.empresa_parceira)}</span></td>` : ''}
      <td>${r.cpf || '—'}</td>
      <td>${r.nome || '—'}</td>
      <td class="lib-val">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      ${admin ? `<td class="lib-val">${fmtBRL(r.troco_liquido)}</td>` : ''}
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_total)}</td>
      <td class="lib-val">${fmtBRL(r.comissao_6pct)}</td>
      <td>${acertoCell}</td>
      <td>${fmtDate(r.data_quitado)}</td>
      <td class="lib-obs">${r.obs || '—'}</td>
      <td>${r.aprovado
        ? '<span class="lib-badge-ok">✓ OK</span>'
        : '<span class="lib-badge-pen">Pendente</span>'}</td>
      ${okBtn}
    </tr>`;
}

const _spinner = () => `<div style="padding:48px;text-align:center;color:var(--muted)">Carregando…</div>`;

// ── Ações públicas de filtro ───────────────────────────────────────────────
export function libSetSearch(val) {
  _search = val || '';
  _page   = 1;
  const inp = document.getElementById('lib-search');
  if (inp && inp.value !== _search) inp.value = _search;
  _updateTable();
}

export function libSetPreset(key) {
  _preset = key;
  const range = _presetRange(key);
  _dateFrom = range.from;
  _dateTo   = range.to;
  _page     = 1;
  _updateTable();
}

export function libClearDate() {
  _preset = null; _dateFrom = null; _dateTo = null;
  _page   = 1;
  _updateTable();
}

export function libSetDateManual() {
  _dateFrom = document.getElementById('lib-date-from')?.value || null;
  _dateTo   = document.getElementById('lib-date-to')?.value   || null;
  _preset   = null;
  _page     = 1;
  _updateTable();
}

export function libVerMais() {
  _page++;
  _updateTable();
  // Scroll suave até o fim da tabela
  document.getElementById('lib-ver-mais-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Deletar Cliente (admin) ───────────────────────────────────────────────
export function libDeletarCliente(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir "${nome}"?\n\nEssa ação não pode ser desfeita.`)) return;
  _confirmarDelete(id);
}

async function _confirmarDelete(id) {
  const { error } = await sb
    .from('liberacao_margem_master')
    .delete()
    .eq('id', id);

  if (error) { toast('Erro ao excluir cliente.', 'err'); return; }

  _registros = _registros.filter(r => r.id !== id);
  _updateTable();
  toast('Cliente excluído.');
}

// ── Importar Planilha ─────────────────────────────────────────────────────
export function libImportarPlanilha() {
  document.getElementById('lib-import-input')?.click();
}

export async function libOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const empresa  = _empresaParceira();
  const hoje     = new Date().toISOString().slice(0, 10);

  let rows;
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch {
    toast('Erro ao ler o arquivo.', 'err');
    return;
  }

  // Normaliza nome das colunas (minúsculo, sem acentos, sem parênteses)
  const norm = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const findCol = (row, ...candidates) => {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const match = keys.find(k => norm(k) === norm(c));
      if (match !== undefined) return row[match];
    }
    return undefined;
  };

  const parseMoney = v => {
    if (v === '' || v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  };

  const padCpf = v => {
    const digits = String(v).replace(/\D/g, '');
    return digits.padStart(11, '0');
  };

  // Constrói registros válidos e detecta duplicatas (CPF + saldo_devedor)
  const seen   = new Set();
  const valid  = [];
  let skipped  = 0;

  for (const row of rows) {
    const cpfRaw  = findCol(row, 'CPF', 'cpf');
    const nome    = String(findCol(row, 'Nome Completo', 'Nome', 'nome') || '').trim();
    const sdRaw   = findCol(row, 'Saldo Devedor (R$)', 'Saldo Devedor', 'saldo_devedor', 'saldo devedor');
    const trocoRaw= findCol(row, 'Troco (R$)', 'Troco', 'troco');
    const obs     = String(findCol(row, 'Observações', 'Observacoes', 'OBS', 'obs') || '').trim() || null;

    if (!cpfRaw && !nome) continue; // linha vazia

    const cpf = padCpf(cpfRaw);
    const sd  = parseMoney(sdRaw);
    const troco = parseMoney(trocoRaw);

    if (!cpf || cpf === '00000000000' || !nome || sd <= 0) { skipped++; continue; }

    const dupKey = `${cpf}|${sd}`;
    if (seen.has(dupKey)) { skipped++; continue; }
    seen.add(dupKey);

    valid.push({ cpf, nome, empresa_parceira: empresa, saldo_devedor: sd, troco, data_quitado: hoje, obs, aprovado: false });
  }

  if (valid.length === 0) {
    toast('Nenhum registro válido encontrado na planilha.', 'err');
    return;
  }

  // INSERT em batches de 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    const { error } = await sb.from('liberacao_margem_master').insert(batch);
    if (error) { toast('Erro ao importar: ' + error.message, 'err'); return; }
    inserted += batch.length;
  }

  const msg = skipped > 0
    ? `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''}, ${skipped} ignorado${skipped !== 1 ? 's' : ''} (duplicata ou inválido).`
    : `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''} com sucesso!`;
  toast(msg);

  await _loadData();
  const el = document.getElementById('sec-liberacao');
  if (el) _render(el);
}

// ── Modal Adicionar Cliente ─────────────────────────────────────────────────
export function libAddCliente() {
  const empresa = _empresaParceira();
  const hoje = new Date().toLocaleDateString('pt-BR');

  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Novo Cliente</h2>

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

    <div class="lib-calc-preview">
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
      Empresa: <span>${_esc(empresa)}</span> &nbsp;·&nbsp;
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
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) libFecharModal(); };
  document.getElementById('lib-f-cpf')?.focus();
}

export function libFecharModal() {
  document.getElementById('lib-modal')?.classList.remove('open');
}

export function libCalcPreview() {
  const sd    = parseFloat(document.getElementById('lib-f-sd')?.value) || 0;
  const troco = parseFloat(document.getElementById('lib-f-troco')?.value) || 0;
  const total = sd + troco;
  const fmt   = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const t = document.getElementById('lib-prev-total');
  const c = document.getElementById('lib-prev-com');
  if (t) t.textContent = fmt(total);
  if (c) c.textContent = fmt(total * 0.06);
}

export async function libSalvarCliente() {
  const cpf   = document.getElementById('lib-f-cpf')?.value.trim();
  const nome  = document.getElementById('lib-f-nome')?.value.trim();
  const sd    = parseFloat(document.getElementById('lib-f-sd')?.value);
  const troco = parseFloat(document.getElementById('lib-f-troco')?.value) || 0;
  const obs   = document.getElementById('lib-f-obs')?.value.trim() || null;
  const err   = document.getElementById('lib-modal-err');
  const btn   = document.getElementById('lib-btn-save');

  if (!cpf)       { err.textContent = 'Informe o CPF.';           err.style.display = ''; return; }
  if (!nome)      { err.textContent = 'Informe o nome.';          err.style.display = ''; return; }
  if (!sd || sd <= 0) { err.textContent = 'Informe o saldo devedor.'; err.style.display = ''; return; }

  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const { error } = await sb.from('liberacao_margem_master').insert({
    cpf,
    nome,
    empresa_parceira: _empresaParceira(),
    saldo_devedor:    sd,
    troco,
    data_quitado:     new Date().toISOString().slice(0,10),
    obs,
    aprovado:         false,
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

// ── Marcar OK (admin) ──────────────────────────────────────────────────────
export async function libToggleOk(id, atual) {
  const novoValor = !atual;
  const { error } = await sb
    .from('liberacao_margem_master')
    .update({ aprovado: novoValor })
    .eq('id', id);

  if (error) { toast('Erro ao atualizar.'); return; }

  const reg = _registros.find(r => r.id === id);
  if (reg) reg.aprovado = novoValor;

  const tr = document.querySelector(`.lib-tr[data-id="${id}"]`);
  if (tr) {
    tr.className = `lib-tr${novoValor ? ' lib-row-ok' : ''}`;
    const btn = tr.querySelector('.lib-btn-ok');
    if (btn) {
      btn.className = `lib-btn-ok${novoValor ? ' ok' : ''}`;
      btn.setAttribute('onclick', `libToggleOk('${id}', ${novoValor})`);
      btn.title = novoValor ? 'Remover OK' : 'Marcar como OK';
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
  const { error } = await sb
    .from('liberacao_margem_master')
    .update({ acerto: valor || null })
    .eq('id', id);

  if (error) { toast('Erro ao salvar data de acerto.'); return; }

  const reg = _registros.find(r => r.id === id);
  if (reg) reg.acerto = valor || null;

  toast('Acerto salvo!');
}
