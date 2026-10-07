// Tela da Liberação de Margem no visual novo (Fase 3 do redesenho): resumo,
// barra (busca, período, Importar ▾, Exportar ▾, ⋯), filtros de status com
// Em alerta, linhas que abrem ao clicar, coluna Ação e barra de lote.
// window.* chamados daqui (libImportarPlanilha, libImportarAcerto,
// libImportarPendencias, libOnPendenciasFile, libExportar, libLimparBase,
// libAddCliente, libSetEmpresaFiltro, libSetDateManual, libOnImportFile,
// libOnImportAcertoFile) — NÃO RENOMEAR.
import { dsChips, dsMenu, dsBtn, dsEmpty, dsSelect, dsCalendario, fmtBr, initDsMenus } from '../../components/ds/index.js';
import { S, PAGE_SIZE, isAdmin, fmtBRL, esc, PRESETS, presetRange, filtered, loadData } from './lib-core.js';
import { LIB_STATUS, LIB_ORDEM, LIB_ACOES, statusDe, emAlerta, podeAgir } from './lib-status.js';
import { linhaHTML, colunas } from './lib-linha.js';
import { executarAcao } from './lib-residuo.js';

export async function reloadAndRender() {
  await loadData();
  const el = document.getElementById('sec-liberacao');
  if (el) render(el);
}

// ── Barra ─────────────────────────────────────────────────────────────────
function _menus() {
  const admin = isAdmin();
  const importar = [
    { action: 'imp-planilha', label: 'Planilha de clientes', sub: 'Cadastra clientes em lote', icon: 'table' },
    ...(admin ? [
      { action: 'imp-acerto', label: 'Planilha de acerto', sub: 'Preenche as datas de acerto', icon: 'calendar', tag: 'SMART' },
      { action: 'imp-pendencias', label: 'Pendências', sub: 'Motivo de a margem não liberar', icon: 'note', tag: 'SMART' },
    ] : []),
    { sep: true },
    { action: 'modelo', label: 'Baixar modelo da planilha', icon: 'download' },
  ];
  const exportar = admin ? dsMenu({ label: 'Exportar', icon: 'download',
    items: [{ action: 'exp-excel', label: 'Excel', sub: 'Todas as colunas, inclusive valores e resíduo', icon: 'table' }] }) : '';
  const mais = admin ? dsMenu({ icon: 'dots', right: true, ariaLabel: 'Mais opções',
    items: [{ action: 'limpar', label: 'Limpar base', sub: 'Apaga todos os clientes da tela', icon: 'trash', danger: true, tag: 'SMART' }] }) : '';
  return dsMenu({ label: 'Importar', icon: 'upload', items: importar }) + exportar
    + dsBtn({ label: 'Adicionar cliente', icon: 'plus', variant: 'primary', attrs: 'data-ds-action="add"' }) + mais;
}

function _menuPeriodo() {
  const atual = PRESETS.find(p => p.key === S.preset);
  const intervalo = S.dateFrom || S.dateTo ? `${fmtBr(S.dateFrom) || '…'} – ${fmtBr(S.dateTo) || 'hoje'}` : 'Todo o período';
  const rotulo = atual ? atual.label : intervalo;
  return dsMenu({ label: rotulo, icon: 'calendar',
    items: [...PRESETS.map(p => ({ action: 'periodo:' + p.key, label: p.label })), { sep: true },
      { action: 'periodo:custom', label: 'Escolher datas…', icon: 'calendar' }, { action: 'periodo:limpar', label: 'Todo o período' }] });
}

export function render(el) {
  initDsMenus();
  el.innerHTML = `
    <div class="ds-page">
      <div class="ds-page__head"><div><h1>Liberação de margem</h1><div class="ds-page__count"><span id="lib-count"></span> <span class="ds-sync" id="lib-sync" hidden>Atualizando…</span></div></div></div>
      <div class="ds-kpis" id="lib-kpis"></div>
      <div class="ds-tbl">
        <div class="ds-tbl__toolbar">
          <label class="ds-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input class="ds-input" id="lib-search" type="text" placeholder="Buscar nome ou CPF" value="${esc(S.search)}"></label>
          <span id="lib-periodo">${_menuPeriodo()}</span>
          ${_menus()}
          <input type="file" id="lib-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="libOnImportFile(this)" />
          ${isAdmin() ? `<input type="file" id="lib-import-acerto-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="libOnImportAcertoFile(this)" />
          <input type="file" id="lib-pendencias-input" accept=".xlsx,.xls" style="display:none" />` : ''}
        </div>
        <div class="ds-tbl__filters ds-filterbar">
          <div id="lib-status-chips"></div>
          <div class="ds-filterbar__right">
            ${isAdmin() ? '<span id="lib-empresa"></span>' : ''}
            <span class="ds-hint">Período pela data quitado</span>
          </div>
        </div>
        <div id="lib-rows"></div>
        <div id="lib-ver-mais-wrap"></div>
      </div>
      <div class="ds-bulk" id="lib-bulk"></div>
    </div>`;
  _ligarEventos(el);
  updateTable();
}

// ── Atualização ───────────────────────────────────────────────────────────
function _semStatus() {
  const salvo = S.statusFiltro;
  S.statusFiltro = '';
  const base = filtered();
  S.statusFiltro = salvo;
  return base;
}

function _kpis(base) {
  const emRes = base.filter(r => !r.aprovado && ['pendente', 'solicitado', 'enviado'].includes(r.residuo_status));
  const alerta = base.filter(emAlerta).length;
  const card = (lbl, val, sub, hl) => `<div class="ds-card ds-kpi${hl ? ' ds-kpi--hl' : ''}"><div class="ds-kpi__lbl">${lbl}</div><div class="ds-kpi__val">${val}</div><div class="ds-kpi__sub">${sub}</div></div>`;
  document.getElementById('lib-kpis').innerHTML =
    card('Clientes', base.length, 'no filtro atual', true)
    + card('Aguardando OK', base.filter(r => !r.aprovado).length, 'pendentes ou em resíduo')
    + card('Em resíduo', emRes.length, fmtBRL(emRes.reduce((s, r) => s + (Number(r.residuo_valor) || 0), 0)) + ' pendentes')
    + card('Em alerta', `<span style="color:${alerta ? 'var(--ds-bad)' : 'inherit'}">${alerta}</span>`, 'pagos há mais de 7 dias úteis sem OK');
}

function _chips(base) {
  const itens = [{ value: '', label: 'Todos', count: base.length },
    ...LIB_ORDEM.map(s => ({ value: s, label: LIB_STATUS[s].label, tone: LIB_STATUS[s].tone, count: base.filter(r => statusDe(r) === s).length })),
    { value: 'alerta', label: 'Em alerta', alert: true, count: base.filter(emAlerta).length }];
  document.getElementById('lib-status-chips').innerHTML = dsChips(itens, S.statusFiltro);
}

function _selects() {
  const emp = document.getElementById('lib-empresa');
  if (emp) {
    const empresas = [...new Set(S.registros.map(r => r.empresa_parceira).filter(Boolean))].sort();
    emp.innerHTML = dsSelect({ id: 'empresa', value: S.empresaFiltro, buscar: true, right: true,
      options: [{ value: '', label: 'Todas as empresas' }, ...empresas.map(e => ({ value: e, label: e }))] });
  }
  document.getElementById('lib-periodo').innerHTML = _menuPeriodo();
}

function _linhas(list) {
  const visible = list.slice(0, S.page * PAGE_SIZE);
  const todos = visible.length > 0 && visible.every(r => S.sel.has(r.id));
  const head = `<div class="ds-tr ds-tr--head" style="--ds-cols:${colunas()}"><div><input type="checkbox" class="ds-cb" data-lib-all${todos ? ' checked' : ''} aria-label="Selecionar todos"></div>`
    + `<div>Cliente</div><div>Convênio · produto</div>${isAdmin() ? '<div>Empresa</div>' : ''}<div>Quitado</div><div>Acerto</div><div>Status</div><div style="text-align:right">Ação</div><div></div></div>`;
  document.getElementById('lib-rows').innerHTML = head + (visible.length ? visible.map(linhaHTML).join('')
    : dsEmpty({ titulo: 'Nenhum cliente neste filtro', texto: 'Troque o período ou limpe a busca.' }));
  const resto = list.length - visible.length;
  document.getElementById('lib-ver-mais-wrap').innerHTML = resto > 0
    ? `<div class="ds-more">${dsBtn({ label: `Mostrar mais ${Math.min(PAGE_SIZE, resto)} · ${resto} restantes`, attrs: 'data-ds-action="ver-mais"' })}</div>` : '';
}

// ── Lote ──────────────────────────────────────────────────────────────────
// Só os selecionados que continuam no filtro atual — trocar o filtro nunca deixa
// o lote agir em cliente escondido.
const _selecionados = () => filtered().filter(r => S.sel.has(r.id));

function _acaoComum(lista) {
  const sts = [...new Set(lista.map(statusDe))];
  if (sts.length !== 1) return { nota: 'Selecione clientes no mesmo status para mudar em lote' };
  const acoes = LIB_ACOES[sts[0]].filter(a => a.k !== 'residuo');
  if (!acoes.length) return { nota: sts[0] === 'ok' ? 'Clientes já estão OK' : 'O resíduo é aberto um cliente por vez' };
  const acao = acoes[0];
  if (!lista.every(r => podeAgir(r, acao))) return { nota: acao.who === 's' ? 'Esta etapa é da Smart' : 'Há clientes de outra empresa na seleção' };
  return { acao };
}

function _renderBulk() {
  const bar = document.getElementById('lib-bulk');
  const lista = _selecionados();
  bar.classList.toggle('is-show', lista.length > 0);
  if (!lista.length) { bar.innerHTML = ''; return; }
  const { acao, nota } = _acaoComum(lista);
  bar.innerHTML = `<b>${lista.length} ${lista.length === 1 ? 'selecionado' : 'selecionados'}</b><span style="opacity:.6">·</span>`
    + (acao ? dsBtn({ label: acao.label, variant: 'primary', size: 'sm', attrs: `data-lib-bulk="${acao.k}"` }) : `<span class="ds-bulk__note">${nota}</span>`)
    + (lista.every(r => statusDe(r) === 'pendente') ? '<span class="ds-bulk__note">Resíduo: um cliente por vez (pede valor e enquadrada)</span>' : '')
    + dsBtn({ label: 'Limpar seleção', variant: 'ghost', size: 'sm', attrs: 'data-lib-bulk="limpar" style="margin-left:auto"' });
}

export function updateTable() {
  if (!document.getElementById('lib-rows')) return;
  const list = filtered();
  const base = _semStatus();
  const total = S.registros.length;
  document.getElementById('lib-count').textContent = list.length === total
    ? `${total} cliente${total !== 1 ? 's' : ''}` : `${list.length} de ${total} clientes no filtro`;
  _kpis(base);
  _chips(base);
  _selects();
  _linhas(list);
  _renderBulk();
}

// ── Eventos ───────────────────────────────────────────────────────────────
const _resetPage = () => { S.page = 1; };
const _acao = (k, lista) => executarAcao(k, lista, { redesenhar: updateTable });

const ACOES_MENU = {
  'imp-planilha':   () => window.libImportarPlanilha(),
  'imp-acerto':     () => window.libImportarAcerto(),
  'imp-pendencias': () => window.libImportarPendencias(),
  'modelo':         () => { const a = document.createElement('a'); a.href = '/template_liberacao.xlsx'; a.download = 'TEMPLATE_LIBERACAO.xlsx'; a.click(); },
  'exp-excel':      () => window.libExportar(),
  'limpar':         () => window.libLimparBase(),
  'add':            () => window.libAddCliente(),
  'ver-mais':       () => { S.page++; updateTable(); },
};

function _escolherPeriodo() {
  const botao = document.querySelector('#lib-periodo [data-ds-menu-toggle]');
  dsCalendario(botao, { range: true, inicio: S.dateFrom, fim: S.dateTo, onEscolher: ({ inicio, fim }) => {
    S.preset = null; S.dateFrom = inicio; S.dateTo = fim; _resetPage(); updateTable();
  } });
}

function _escolherAcerto(btn) {
  const r = _linhaDe(btn.dataset.libAcerto)[0];
  if (!r) return;
  dsCalendario(btn, { valor: r.acerto, onEscolher: v => window.libSalvarAcerto(r.id, v || '') });
}

function _acaoMenu(action) {
  if (!action.startsWith('periodo:')) { ACOES_MENU[action]?.(); return; }
  if (action === 'periodo:custom') { setTimeout(_escolherPeriodo, 0); return; }
  const key = action.slice(8);
  const r = key === 'limpar' ? { from: null, to: null } : presetRange(key);
  S.preset = key === 'limpar' ? null : key; S.dateFrom = r.from; S.dateTo = r.to; _resetPage(); updateTable();
}

function _bulk(k) {
  if (k === 'limpar') { S.sel.clear(); updateTable(); return; }
  _acao(k, _selecionados());
}

function _alternarLinha(id) {
  if (S.abertos.has(id)) S.abertos.delete(id); else S.abertos.add(id);
  updateTable();
}

const _linhaDe = id => S.registros.filter(r => String(r.id) === String(id));

const CLIQUES = [
  ['[data-ds-action]', el => _acaoMenu(el.dataset.dsAction)],
  ['[data-ds-chip]',   el => { S.statusFiltro = el.dataset.dsChip; _resetPage(); updateTable(); }],
  ['[data-ds-select="empresa"]', el => { S.empresaFiltro = el.dataset.value; _resetPage(); updateTable(); }],
  ['[data-lib-acerto]', el => _escolherAcerto(el)],
  ['[data-lib-bulk]',  el => _bulk(el.dataset.libBulk)],
  ['[data-lib-acao]',  el => _acao(el.dataset.libAcao, _linhaDe(el.dataset.id))],
  ['[data-lib-abrir]', el => { S.abertos.add(_linhaDe(el.dataset.libAbrir)[0]?.id); updateTable(); }],
  ['input, select, button, a, .ds-menu, .ds-det', () => {}],
  ['[data-lib-row]',   el => _alternarLinha(_linhaDe(el.dataset.libRow)[0]?.id)],
];

function _onClick(e) {
  for (const [sel, fn] of CLIQUES) {
    const el = e.target.closest(sel);
    if (el) { fn(el); return; }
  }
}

function _onChange(e) {
  const t = e.target;
  if (t.matches('[data-lib-all]')) {
    filtered().slice(0, S.page * PAGE_SIZE).forEach(r => (t.checked ? S.sel.add(r.id) : S.sel.delete(r.id)));
    updateTable(); return;
  }
  if (t.dataset.libSel) {
    const id = _linhaDe(t.dataset.libSel)[0]?.id;
    if (t.checked) S.sel.add(id); else S.sel.delete(id);
    _renderBulk(); return;
  }
  if (t.id === 'lib-pendencias-input') window.libOnPendenciasFile(t);
}

function _ligarEventos(el) {
  if (el.dataset.dsLigado) return;
  el.dataset.dsLigado = '1';
  el.addEventListener('click', _onClick);
  el.addEventListener('change', _onChange);
  el.addEventListener('input', e => {
    if (e.target.id !== 'lib-search') return;
    S.search = e.target.value || ''; _resetPage(); updateTable();
  });
}

