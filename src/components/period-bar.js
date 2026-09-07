// Barra de período por tela (Etapa 2 do redesenho do filtro).
// Reutiliza as classes visuais do filtro do header (date-filter/qf-*) para herdar
// tema claro/escuro e mobile. Nenhuma barra guarda estado próprio: os valores vêm
// sempre de state.filterDates e toda mudança passa pela porta única setPeriodo()
// (navigation.js). Eventos por delegação — tela nova que imprimir a barra já funciona.
import { state } from '../state.js';
import { setPeriodo, quickFilter, clearFilter } from '../navigation.js';

/** Seções que usam o período global e ganham a barra (Metas tem seletor de mês próprio). */
export const PERIOD_SECS = ['overview', 'ranking', 'perfil', 'gestao', 'propostas', 'trafego'];

const QF_PRESETS = [
  ['today', 'Hoje'],
  ['yesterday', 'Ontem'],
  ['this-month', 'Esse Mês'],
  ['last-month', 'Último Mês'],
  ['7d', 'Últimos 7 dias'],
  ['15d', 'Últimos 15 dias'],
  ['30d', 'Últimos 30 dias'],
];

function periodBarHTML() {
  const { start, end } = state.filterDates || {};
  return `
    <div class="period-bar date-filter">
      <div class="qf-wrap">
        <button class="btn-sm btn-ghost pb-qf-btn" type="button">Período ▾</button>
        <div class="qf-menu">
          ${QF_PRESETS.map(([k, l]) => `<div class="qf-item" data-preset="${k}">${l}</div>`).join('')}
        </div>
      </div>
      <label>De</label>
      <input type="date" class="pb-start" value="${start || ''}">
      <label>Até</label>
      <input type="date" class="pb-end" value="${end || ''}">
      <button class="btn-sm btn-primary pb-apply" type="button">Filtrar</button>
      <button class="btn-sm btn-ghost pb-clear" type="button">Limpar</button>
    </div>`;
}

/** Injeta a barra no topo das seções de período e instala o listener único. Chamar 1x no boot. */
export function initPeriodBars() {
  for (const sec of PERIOD_SECS) {
    const el = document.getElementById(`sec-${sec}`);
    if (!el || el.querySelector(':scope > .pb-host')) continue;
    const host = document.createElement('div');
    host.className = 'pb-host';
    host.innerHTML = periodBarHTML();
    el.prepend(host);
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.period-bar .qf-wrap')) {
      document.querySelectorAll('.period-bar .qf-menu.open').forEach(m => m.classList.remove('open'));
    }
    const bar = e.target.closest('.period-bar');
    if (!bar) return;
    if (e.target.closest('.pb-qf-btn')) {
      bar.querySelector('.qf-menu').classList.toggle('open');
    } else if (e.target.closest('.qf-item')) {
      bar.querySelector('.qf-menu').classList.remove('open');
      quickFilter(e.target.closest('.qf-item').dataset.preset);
    } else if (e.target.closest('.pb-apply')) {
      setPeriodo(bar.querySelector('.pb-start').value, bar.querySelector('.pb-end').value);
    } else if (e.target.closest('.pb-clear')) {
      clearFilter();
    }
  });
}

/** Reflete state.filterDates em todas as barras visíveis. */
export function syncPeriodBars() {
  const { start, end } = state.filterDates || {};
  document.querySelectorAll('.period-bar').forEach(bar => {
    bar.querySelector('.pb-start').value = start || '';
    bar.querySelector('.pb-end').value   = end   || '';
  });
}
