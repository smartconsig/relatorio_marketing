// Design system RYC — calendário próprio (substitui o seletor de data do navegador).
//   dsCalendario(botao, { valor, onEscolher })                  → uma data (acerto)
//   dsCalendario(botao, { range: true, inicio, fim, onEscolher }) → período (de/até)
// Datas trafegam como 'AAAA-MM-DD' (o mesmo formato que o banco grava).
import { icon } from '../../utils/icons.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deIso = s => (s ? new Date(s + 'T00:00:00') : null);
export const fmtBr = s => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');

let _pop = null;
let _st = null;

function _fechar() {
  if (_pop) _pop.remove();
  _pop = null; _st = null;
  document.removeEventListener('mousedown', _fora, true);
  document.removeEventListener('keydown', _esc, true);
}
const _fora = e => { if (_pop && !_pop.contains(e.target) && !_st?.botao.contains(e.target)) _fechar(); };
const _esc = e => { if (e.key === 'Escape') _fechar(); };

function _classeDia(d, mes) {
  const s = iso(d);
  const c = ['ds-cal__d'];
  if (d.getMonth() !== mes) c.push('is-out');
  if (s === iso(new Date())) c.push('is-hoje');
  const { a, b } = _st;
  if (s === a || s === b) c.push('is-sel');
  else if (a && b && s > a && s < b) c.push('is-entre');
  return c.join(' ');
}

function _dias() {
  const { ano, mes } = _st;
  const ini = new Date(ano, mes, 1);
  ini.setDate(1 - ini.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d; });
}

function _rodape() {
  const { range, a, b } = _st;
  const info = range ? (a ? `${fmtBr(a)}${b ? ' até ' + fmtBr(b) : ' · escolha o fim'}` : 'Escolha o início') : '';
  return `<div class="ds-cal__foot"><button type="button" class="ds-btn ds-btn--ghost ds-btn--sm" data-cal="limpar">Limpar</button>`
    + (range ? `<span class="ds-hint">${info}</span><button type="button" class="ds-btn ds-btn--primary ds-btn--sm" data-cal="aplicar"${a ? '' : ' disabled'}>Aplicar</button>`
      : '<button type="button" class="ds-btn ds-btn--ghost ds-btn--sm" data-cal="hoje">Hoje</button>') + '</div>';
}

function _desenhar() {
  const { ano, mes } = _st;
  _pop.innerHTML = `<div class="ds-cal__head"><button type="button" class="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm" data-cal="ant" aria-label="Mês anterior"><span class="ds-cal__seta">${icon('chevron', 14)}</span></button>`
    + `<b>${MESES[mes][0].toUpperCase() + MESES[mes].slice(1)} de ${ano}</b>`
    + `<button type="button" class="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm" data-cal="prox" aria-label="Próximo mês"><span class="ds-cal__seta is-prox">${icon('chevron', 14)}</span></button></div>`
    + `<div class="ds-cal__grid">${SEMANA.map(s => `<span class="ds-cal__w">${s}</span>`).join('')}`
    + _dias().map(d => `<button type="button" class="${_classeDia(d, mes)}" data-dia="${iso(d)}">${d.getDate()}</button>`).join('')
    + `</div>${_rodape()}`;
}

function _posicionar() {
  const r = _st.botao.getBoundingClientRect();
  const w = 288;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  const cabeEmbaixo = r.bottom + 360 < window.innerHeight;
  _pop.style.left = left + 'px';
  _pop.style.top = (cabeEmbaixo ? r.bottom + 6 : Math.max(8, r.top - 366)) + 'px';
}

function _escolherDia(s) {
  const st = _st;
  if (!st.range) { st.onEscolher(s); _fechar(); return; }
  if (!st.a || st.b) { st.a = s; st.b = null; } else if (s < st.a) { st.b = st.a; st.a = s; } else st.b = s;
  _desenhar();
}

const ACOES = {
  ant:     () => { _st.mes--; if (_st.mes < 0) { _st.mes = 11; _st.ano--; } _desenhar(); },
  prox:    () => { _st.mes++; if (_st.mes > 11) { _st.mes = 0; _st.ano++; } _desenhar(); },
  hoje:    () => { _st.onEscolher(iso(new Date())); _fechar(); },
  limpar:  () => { const { onEscolher, range } = _st; _fechar(); onEscolher(range ? { inicio: null, fim: null } : null); },
  aplicar: () => { const { a, b, onEscolher } = _st; _fechar(); onEscolher({ inicio: a, fim: b || a }); },
};

function _onClick(e) {
  const dia = e.target.closest('[data-dia]');
  if (dia) { _escolherDia(dia.dataset.dia); return; }
  const ac = e.target.closest('[data-cal]');
  if (ac) ACOES[ac.dataset.cal]?.();
}

/** Abre o calendário embaixo do botão. range=true devolve { inicio, fim }; senão 'AAAA-MM-DD' (ou null em Limpar). */
export function dsCalendario(botao, { valor = null, range = false, inicio = null, fim = null, onEscolher }) {
  const reabrir = _st?.botao === botao;
  _fechar();
  if (reabrir) return;
  const base = deIso(range ? inicio : valor) || new Date();
  _st = { botao, range, onEscolher, a: range ? inicio : valor, b: range ? fim : null, ano: base.getFullYear(), mes: base.getMonth() };
  _pop = document.createElement('div');
  _pop.className = 'ds-cal';
  _pop.addEventListener('click', _onClick);
  document.body.appendChild(_pop);
  _desenhar();
  _posicionar();
  setTimeout(() => {
    document.addEventListener('mousedown', _fora, true);
    document.addEventListener('keydown', _esc, true);
  }, 0);
}
