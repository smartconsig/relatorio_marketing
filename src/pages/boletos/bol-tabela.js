// Tela da Quitação de Boleto no visual novo (Fase 2 do redesenho): cabeçalho,
// resumo, barra (busca, período, Importar ▾, Exportar ▾, ⋯), filtros de status,
// linhas que abrem ao clicar e barra de lote. Cliques por delegação na seção.
// A mudança de status continua só via RPC (o banco valida papel e transição).
// Funções window.* chamadas daqui (bolImportarPlanilha, bolAbrirLote,
// bolImportarRespaldo, bolExportar, bolExportarLote, bolLimparBase, bolAddCliente,
// bolMarcarQuitado, bolSetEmpresaFiltro, bolSetDateManual, bolOnImportFile) — NÃO RENOMEAR.
import { toast } from '../../utils/ui.js';
import { dsChips, dsMenu, dsBtn, dsEmpty, dsSelect, dsCalendario, fmtBr, initDsMenus } from '../../components/ds/index.js';
import { STATUS_ORDER, rpcMudarStatus, msgErroBanco } from '../../services/boletos-svc.js';
import { BO, PAGE_SIZE, isAdmin, esc, PRESETS, presetRange, filtered, loadData, recarregarLinhas } from './bol-core.js';
import { BOL_STATUS, linhaHTML, colunas } from './bol-linha.js';
import { renderBulk, executarBulk } from './bol-bulk.js';

// Padrão comum pós-escrita: recarrega do banco e redesenha o shell inteiro.
export async function reloadAndRender() {
  await loadData();
  const el = document.getElementById('sec-boletos');
  if (el) render(el);
}

// ── Menus da barra ─────────────────────────────────────────────────────────
function _menus() {
  const admin = isAdmin();
  const importar = [
    { action: 'imp-planilha', label: 'Planilha de clientes', sub: 'Cadastra clientes em lote', icon: 'table' },
    ...(admin ? [
      { action: 'imp-lote', label: 'Lote ZIP', sub: 'Boletos e faturas em PDF', icon: 'folder', tag: 'SMART' },
      { action: 'imp-respaldo', label: 'Respaldo', sub: 'Relatório de Faturas Smart', icon: 'shield', tag: 'SMART' },
    ] : []),
    { sep: true },
    { action: 'modelo', label: 'Baixar modelo da planilha', icon: 'download' },
  ];
  const exportar = [
    ...(admin ? [{ action: 'exp-excel', label: 'Excel', sub: 'Todas as colunas do filtro atual', icon: 'table' }] : []),
    { action: 'exp-lote', label: 'Lote ZIP', sub: 'Uma pasta por cliente + resumo.xlsx', icon: 'folder' },
  ];
  const mais = admin ? dsMenu({ icon: 'dots', right: true, ariaLabel: 'Mais opções',
    items: [{ action: 'limpar', label: 'Limpar base', sub: 'Apaga todos os clientes da tela', icon: 'trash', danger: true, tag: 'SMART' }] }) : '';
  return dsMenu({ label: 'Importar', icon: 'upload', items: importar })
    + dsMenu({ label: 'Exportar', icon: 'download', items: exportar })
    + dsBtn({ label: 'Adicionar cliente', icon: 'plus', variant: 'primary', attrs: 'data-ds-action="add"' }) + mais;
}

function _menuPeriodo() {
  const atual = PRESETS.find(p => p.key === BO.preset);
  const intervalo = BO.dateFrom || BO.dateTo ? `${fmtBr(BO.dateFrom) || '…'} – ${fmtBr(BO.dateTo) || 'hoje'}` : 'Todo o período';
  const rotulo = atual ? atual.label : intervalo;
  const itens = PRESETS.map(p => ({ action: 'periodo:' + p.key, label: p.label }));
  return dsMenu({ label: rotulo, icon: 'calendar', items: [...itens, { sep: true },
    { action: 'periodo:custom', label: 'Escolher datas…', icon: 'calendar' }, { action: 'periodo:limpar', label: 'Todo o período' }] });
}

// ── Shell ───────────────────────────────────────────────────────────────────
export function render(el) {
  initDsMenus();
  el.innerHTML = `
    <div class="ds-page">
      <div class="ds-page__head"><div><h1>Quitação de boleto</h1><div class="ds-page__count"><span id="bol-count"></span> <span class="ds-sync" id="bol-sync" hidden>Atualizando…</span></div></div></div>
      <div class="ds-kpis" id="bol-kpis"></div>
      <div class="ds-tbl">
        <div class="ds-tbl__toolbar">
          <label class="ds-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input class="ds-input" id="bol-search" type="text" placeholder="Buscar nome, CPF ou contrato" value="${esc(BO.search)}"></label>
          <span id="bol-periodo">${_menuPeriodo()}</span>
          ${_menus()}
          <input type="file" id="bol-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="bolOnImportFile(this)" />
          <input type="file" id="bol-respaldo-input" accept=".xlsx,.xls" style="display:none" />
        </div>
        <div class="ds-tbl__filters ds-filterbar">
          <div id="bol-status-chips"></div>
          <div class="ds-filterbar__right">
            ${isAdmin() ? '<span id="bol-empresa"></span>' : ''}
            <span id="bol-respaldo"></span>
            <span class="ds-hint">Período pela data de cadastro</span>
          </div>
        </div>
        <div id="bol-rows"></div>
        <div id="bol-ver-mais-wrap"></div>
      </div>
      <div class="ds-bulk" id="bol-bulk"></div>
    </div>`;
  _ligarEventos(el);
  updateTable();
}

// ── Atualização ─────────────────────────────────────────────────────────────
function _semStatus() {
  const salvo = BO.statusFiltro;
  BO.statusFiltro = '';
  const base = filtered();
  BO.statusFiltro = salvo;
  return base;
}

function _kpis(base) {
  const n = st => base.filter(r => r.status === st).length;
  const card = (lbl, val, sub, hl) => `<div class="ds-card ds-kpi${hl ? ' ds-kpi--hl' : ''}"><div class="ds-kpi__lbl">${lbl}</div><div class="ds-kpi__val">${val}</div><div class="ds-kpi__sub">${sub}</div></div>`;
  document.getElementById('bol-kpis').innerHTML =
    card('Clientes', base.length, 'no filtro atual', true)
    + card('Aguardando Smart', n('solicitar_boleto') + n('boleto_solicitado'), 'solicitar ou enviar boleto')
    + card('Boletos enviados', n('boleto_enviado'), 'aguardando quitação')
    + card('Quitados', n('boleto_quitado'), `${n('boleto_reprovado')} reprovados`);
}

function _chips(base) {
  const itens = [{ value: '', label: 'Todos', count: base.length },
    ...STATUS_ORDER.map(s => ({ value: s, label: BOL_STATUS[s].label, tone: BOL_STATUS[s].tone, count: base.filter(r => r.status === s).length }))];
  document.getElementById('bol-status-chips').innerHTML = dsChips(itens, BO.statusFiltro);
}

function _selects() {
  const emp = document.getElementById('bol-empresa');
  if (emp) {
    const empresas = [...new Set(BO.registros.map(r => r.empresa_parceira).filter(Boolean))].sort();
    emp.innerHTML = dsSelect({ id: 'empresa', value: BO.empresaFiltro, buscar: true, right: true,
      options: [{ value: '', label: 'Todas as empresas' }, ...empresas.map(e => ({ value: e, label: e }))] });
  }
  const sts = [...new Set(BO.registros.map(r => r.respaldo_status).filter(Boolean))].sort();
  document.getElementById('bol-respaldo').innerHTML = sts.length ? dsSelect({ id: 'respaldo', value: BO.respaldoFiltro, right: true,
    options: [{ value: '', label: 'Respaldo: todos' }, { value: '__sem', label: 'Sem respaldo' }, ...sts.map(x => ({ value: x, label: x }))] }) : '';
  document.getElementById('bol-periodo').innerHTML = _menuPeriodo();
}

function _linhas(list) {
  const visible = list.slice(0, BO.page * PAGE_SIZE);
  const todos = visible.length > 0 && visible.every(r => BO.sel.has(r.id));
  const head = `<div class="ds-tr ds-tr--head" style="--ds-cols:${colunas()}"><div><input type="checkbox" class="ds-cb" data-bol-all${todos ? ' checked' : ''} aria-label="Selecionar todos"></div>`
    + `<div>Cliente</div><div>Convênio · produto</div>${isAdmin() ? '<div>Empresa</div>' : ''}<div>Cadastro</div><div>Status</div><div style="text-align:right">Ação</div><div></div></div>`;
  document.getElementById('bol-rows').innerHTML = head + (visible.length ? visible.map(linhaHTML).join('')
    : dsEmpty({ titulo: 'Nenhum cliente neste filtro', texto: 'Troque o período ou limpe a busca.' }));
  const resto = list.length - visible.length;
  document.getElementById('bol-ver-mais-wrap').innerHTML = resto > 0
    ? `<div class="ds-more">${dsBtn({ label: `Mostrar mais ${Math.min(PAGE_SIZE, resto)} · ${resto} restantes`, attrs: 'data-ds-action="ver-mais"' })}</div>` : '';
}

export function updateTable() {
  if (!document.getElementById('bol-rows')) return;
  const list = filtered();
  const base = _semStatus();
  const total = BO.registros.length;
  document.getElementById('bol-count').textContent = list.length === total
    ? `${total} cliente${total !== 1 ? 's' : ''}` : `${list.length} de ${total} clientes no filtro`;
  _kpis(base);
  _chips(base);
  _selects();
  _linhas(list);
  renderBulk();
}

// ── Mudança de status (via RPC — o banco valida papel e transição) ─────────
export async function bolMudarStatus(id, novo, motivo = null) {
  const { error } = await rpcMudarStatus(id, novo, motivo);
  if (error) { toast(msgErroBanco(error), 'err'); return false; }
  await recarregarLinhas([id]);   // só a linha que mudou
  updateTable();
  toast(`Status atualizado: ${BOL_STATUS[novo]?.label || novo}`);
  return true;
}

// ── Eventos (delegação; ligados uma vez por render) ────────────────────────
const _resetPage = () => { BO.page = 1; };

const ACOES_MENU = {
  'imp-planilha': () => window.bolImportarPlanilha(),
  'imp-lote':     () => window.bolAbrirLote(),
  'imp-respaldo': () => window.bolImportarRespaldo(),
  'modelo':       () => { const a = document.createElement('a'); a.href = '/template_boletos.xlsx'; a.download = 'TEMPLATE_BOLETOS.xlsx'; a.click(); },
  'exp-excel':    () => window.bolExportar(),
  'exp-lote':     () => window.bolExportarLote(),
  'limpar':       () => window.bolLimparBase(),
  'add':          () => window.bolAddCliente(),
  'ver-mais':     () => { BO.page++; updateTable(); },
};

function _escolherPeriodo() {
  const botao = document.querySelector('#bol-periodo [data-ds-menu-toggle]');
  dsCalendario(botao, { range: true, inicio: BO.dateFrom, fim: BO.dateTo, onEscolher: ({ inicio, fim }) => {
    BO.preset = null; BO.dateFrom = inicio; BO.dateTo = fim; _resetPage(); updateTable();
  } });
}

function _acaoMenu(action) {
  if (action === 'periodo:custom') { setTimeout(_escolherPeriodo, 0); return; }
  if (action.startsWith('periodo:')) {
    const key = action.slice(8);
    const r = key === 'limpar' ? { from: null, to: null } : presetRange(key);
    BO.preset = key === 'limpar' ? null : key; BO.dateFrom = r.from; BO.dateTo = r.to; _resetPage(); updateTable();
    return;
  }
  ACOES_MENU[action]?.();
}

function _acaoLinha(id) {
  const r = BO.registros.find(x => x.id === id);
  if (!r) return;
  if (r.status === 'boleto_enviado') { window.bolMarcarQuitado(id); return; }
  const novo = { solicitar_boleto: 'boleto_solicitado', boleto_solicitado: 'boleto_enviado' }[r.status];
  if (novo) bolMudarStatus(id, novo);
}

function _alternarLinha(id) {
  if (BO.abertos.has(id)) BO.abertos.delete(id); else BO.abertos.add(id);
  updateTable();
}

// Ordem importa: o primeiro seletor que casar trata o clique.
const CLIQUES = [
  ['[data-ds-action]', el => _acaoMenu(el.dataset.dsAction)],
  ['[data-ds-chip]',   el => { BO.statusFiltro = el.dataset.dsChip; _resetPage(); updateTable(); }],
  ['[data-ds-select="empresa"]',  el => { BO.empresaFiltro = el.dataset.value; _resetPage(); updateTable(); }],
  ['[data-ds-select="respaldo"]', el => { BO.respaldoFiltro = el.dataset.value; _resetPage(); updateTable(); }],
  ['[data-bol-bulk]',  el => executarBulk(el.dataset.bolBulk)],
  ['[data-bol-acao]',  el => _acaoLinha(el.dataset.bolAcao)],
  ['[data-bol-abrir]', el => { BO.abertos.add(el.dataset.bolAbrir); updateTable(); }],
  ['input, select, button, a, .ds-menu, .ds-det', () => {}],
  ['[data-bol-row]',   el => _alternarLinha(el.dataset.bolRow)],
];

function _onClick(e) {
  for (const [sel, fn] of CLIQUES) {
    const el = e.target.closest(sel);
    if (el) { fn(el); return; }
  }
}

function _onChange(e) {
  const t = e.target;
  if (t.matches('[data-bol-all]')) {
    filtered().slice(0, BO.page * PAGE_SIZE).forEach(r => (t.checked ? BO.sel.add(r.id) : BO.sel.delete(r.id)));
    updateTable(); return;
  }
  if (t.dataset.bolSel) { if (t.checked) BO.sel.add(t.dataset.bolSel); else BO.sel.delete(t.dataset.bolSel); renderBulk(); return; }
  if (t.id === 'bol-respaldo-input') window.bolOnRespaldoFile(t);
}

function _ligarEventos(el) {
  if (el.dataset.dsLigado) return;
  el.dataset.dsLigado = '1';
  el.addEventListener('click', _onClick);
  el.addEventListener('change', _onChange);
  el.addEventListener('input', e => {
    if (e.target.id !== 'bol-search') return;
    BO.search = e.target.value || ''; _resetPage(); updateTable();
    const inp = document.getElementById('bol-search'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  });
}
