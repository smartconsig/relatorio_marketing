import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { parseBRL } from '../utils/currency.js';
import { saveGoalsToSupabase } from '../services/goals-svc.js';
import { renderAll } from '../navigation.js';
import { logAction, renderLastSystemEvent } from '../services/action-log.js';

// ── Estado do módulo ──────────────────────────────────────────────────────────
let _periodo = _currentMonth();   // mês sendo editado na página de metas

// ── Helpers de período ────────────────────────────────────────────────────────
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function _currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function _monthLabel(periodo) {
  if (!periodo) return '—';
  const [y, m] = periodo.split('-');
  return `${MONTHS_PT[parseInt(m, 10) - 1]} ${y}`;
}

function _navMonth(periodo, delta) {
  const [y, m] = periodo.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtMoney = v => v
  ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  : '';

const fmtBRL = v => v
  ? 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  : '—';

// ── Formatação dos inputs ─────────────────────────────────────────────────────
export function fmtGoalInput(el) {
  const v = parseBRL(el.value);
  el.value = v ? fmtMoney(v) : '';
}

export function rawGoalInput(el) {
  const v = parseBRL(el.value) || parseFloat(el.value) || 0;
  el.value = v ? String(v) : '';
}

export function fmtRoasInput(el) {
  const v = parseFloat(String(el.value).replace(',', '.')) || 0;
  el.value = v ? v.toFixed(1) : '';
}

export function populateGoalsForm(g) {
  const setMoney = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ? fmtMoney(v) : ''; };
  const setNum   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ? v.toFixed(1) : ''; };
  setMoney('g-invest',   g?.invest);
  setMoney('g-cpl',      g?.cpl);
  setMoney('g-approved', g?.approved);
  setMoney('g-paid',     g?.paid);
  setMoney('g-cac',      g?.cac);
  setNum  ('g-roas',     g?.roas);
}

// ── Inicializa a página de metas ──────────────────────────────────────────────
export function initGoalsPage() {
  // Sincroniza _periodo com o filtro ativo se houver
  const ref = state.filterDates?.start || null;
  if (ref) _periodo = ref.slice(0, 7);

  _renderPeriodBar();
  populateGoalsForm(state.allGoals?.[_periodo] || {});
  _renderHistory();
}

// ── Navegar entre meses ───────────────────────────────────────────────────────
export function goalsNavMonth(delta) {
  _periodo = _navMonth(_periodo, delta);
  _renderPeriodBar();
  populateGoalsForm(state.allGoals?.[_periodo] || {});
  _renderHistory();
}

// ── Copiar mês anterior ───────────────────────────────────────────────────────
export function goalsCopyPrev() {
  const prev = _navMonth(_periodo, -1);
  const g = state.allGoals?.[prev];
  if (!g || (!g.invest && !g.paid && !g.cpl)) {
    toast(`Nenhuma meta encontrada em ${_monthLabel(prev)}`, 'err');
    return;
  }
  populateGoalsForm(g);
  toast(`Valores de ${_monthLabel(prev)} copiados — clique em Salvar para confirmar`);
}

// ── Salvar metas ──────────────────────────────────────────────────────────────
export function saveGoals() {
  const g = {
    invest:   parseBRL(document.getElementById('g-invest').value),
    cpl:      parseBRL(document.getElementById('g-cpl').value),
    approved: parseBRL(document.getElementById('g-approved').value),
    paid:     parseBRL(document.getElementById('g-paid').value),
    cac:      parseBRL(document.getElementById('g-cac').value),
    roas:     parseFloat(String(document.getElementById('g-roas').value).replace(',', '.')) || 0,
  };

  // Atualiza o mapa de todas as metas
  if (!state.allGoals) state.allGoals = {};
  state.allGoals[_periodo] = g;

  // Sincroniza state.goals se o período editado for o período ativo do filtro
  const activePeriodo = (state.filterDates?.start || new Date().toISOString().slice(0, 10)).slice(0, 7);
  if (_periodo === activePeriodo) {
    state.goals = g;
  }

  saveGoalsToSupabase(g, _periodo);
  toast(`Metas de ${_monthLabel(_periodo)} salvas`);
  if (state.result) renderAll();

  _renderHistory();
  logAction('__goals__', 'Metas configuradas', 'saved_goals').then(() =>
    renderLastSystemEvent('goals-last-log', '__goals__')
  );
}

// ── Render: barra de período ──────────────────────────────────────────────────
function _renderPeriodBar() {
  const bar = document.getElementById('goals-period-bar');
  if (!bar) return;

  const hasPrev = !!(state.allGoals?.[ _navMonth(_periodo, -1) ]);

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button onclick="goalsNavMonth(-1)" class="btn-sm btn-ghost" title="Mês anterior">◄</button>
      <span style="font-family:var(--font-h);font-weight:800;font-size:15px;color:var(--white);min-width:140px;text-align:center">
        ${_monthLabel(_periodo)}
      </span>
      <button onclick="goalsNavMonth(1)" class="btn-sm btn-ghost" title="Próximo mês">►</button>
      <button onclick="goalsCopyPrev()" class="btn-sm btn-ghost"
        style="margin-left:8px;font-size:11px;${hasPrev ? '' : 'opacity:.45'}"
        title="${hasPrev ? 'Copia os valores de ' + _monthLabel(_navMonth(_periodo, -1)) : 'Nenhuma meta no mês anterior'}">
        ↙ Copiar ${_monthLabel(_navMonth(_periodo, -1))}
      </button>
    </div>`;

  // Atualiza label do botão salvar
  const lbl = document.getElementById('goals-save-label');
  if (lbl) lbl.textContent = _monthLabel(_periodo);
}

// ── Render: histórico ─────────────────────────────────────────────────────────
function _renderHistory() {
  const wrap = document.getElementById('goals-history-wrap');
  if (!wrap) return;

  const all = state.allGoals || {};
  const entries = Object.entries(all)
    .filter(([k]) => k && k.match(/^\d{4}-\d{2}$/))
    .sort(([a], [b]) => b.localeCompare(a));

  if (!entries.length) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <div class="section-title" style="margin-bottom:14px"><span class="bar"></span>Histórico de Metas</div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th style="text-align:right">Investimento</th>
              <th style="text-align:right">CPL Máx.</th>
              <th style="text-align:right">Vend. Aprovadas</th>
              <th style="text-align:right">Vend. Pagas</th>
              <th style="text-align:right">CAC Máx.</th>
              <th style="text-align:right">ROAS Mín.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(([periodo, g]) => `
              <tr style="${periodo === _periodo ? 'background:rgba(148,11,16,0.08)' : ''}">
                <td>
                  <span style="font-family:var(--font-h);font-weight:700;font-size:12px;color:${periodo === _periodo ? 'var(--red)' : 'var(--white)'}">
                    ${_monthLabel(periodo)}
                  </span>
                  ${periodo === _currentMonth() ? '<span style="font-size:10px;color:var(--gray);margin-left:6px">atual</span>' : ''}
                </td>
                <td style="text-align:right;font-size:12px">${fmtBRL(g.invest)}</td>
                <td style="text-align:right;font-size:12px">${fmtBRL(g.cpl)}</td>
                <td style="text-align:right;font-size:12px">${fmtBRL(g.approved)}</td>
                <td style="text-align:right;font-size:12px">${fmtBRL(g.paid)}</td>
                <td style="text-align:right;font-size:12px">${fmtBRL(g.cac)}</td>
                <td style="text-align:right;font-size:12px">${g.roas ? g.roas.toFixed(1) + 'x' : '—'}</td>
                <td>
                  <button onclick="goalsLoadPeriodo('${periodo}')"
                    class="btn-sm btn-ghost" style="font-size:10px;padding:3px 8px">
                    Editar
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Carregar período específico pelo histórico ────────────────────────────────
export function goalsLoadPeriodo(periodo) {
  _periodo = periodo;
  _renderPeriodBar();
  populateGoalsForm(state.allGoals?.[_periodo] || {});
  _renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
