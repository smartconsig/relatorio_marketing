// Tráfego (Ads) — visão de planilha dos dias digitados + formulário de lançamento.
// Fonte oficial de investimento/leads dos KPIs (ver calcKPIs.js).
import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { fmtBRL, fmtN, parseBRL } from '../utils/currency.js';
import { perm } from '../services/permissions.js';
import { loadTrafego, saveTrafegoDia, deleteTrafegoDia, trafegoInRange, TAXA_IMPOSTO } from '../services/trafego-svc.js';
import { renderAll } from '../navigation.js';
import { showConfirm } from '../utils/confirm.js';
import { icon } from '../utils/icons.js';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function _hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _fmtDia(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${DIAS_SEMANA[dt.getDay()]}`;
}

/** Período exibido: filtro global se definido; senão, o mês atual. */
function _periodo() {
  let { start, end } = state.filterDates || {};
  if (!start && !end) {
    const hoje = _hoje();
    start = hoje.slice(0, 8) + '01';
    end   = hoje;
  }
  return { start: start || null, end: end || null };
}

function _diasFaltantes(start, end, rows) {
  if (!start || !end) return [];
  const tem = new Set(rows.map(r => r.dia));
  const falta = [];
  const hoje = _hoje();
  const cur = new Date(start + 'T12:00:00');
  const fim = new Date(end + 'T12:00:00');
  while (cur <= fim) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    if (iso > hoje) break;
    if (!tem.has(iso)) falta.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return falta;
}

export async function renderTrafego() {
  const sec = document.getElementById('trafego-body');
  if (!sec) return;
  if (!perm.trafegoVisualizar()) {
    sec.innerHTML = `<div class="empty"><div class="empty-icon">${icon('lock')}</div><div class="empty-title">Sem acesso</div><div class="empty-desc">Peça a permissão de Tráfego ao administrador.</div></div>`;
    return;
  }

  if (state.trafego === null) {
    sec.innerHTML = `<div class="trafego-chips">${'<div class="cr-skeleton" style="height:66px;flex:1;min-width:120px"></div>'.repeat(6)}</div>
      <div class="cr-skeleton" style="height:280px"></div>`;
    await loadTrafego();
  }

  const { start, end } = _periodo();
  const t     = trafegoInRange(start, end);
  const rows  = t.rows.slice().sort((a, b) => (a.dia < b.dia ? -1 : 1));
  const falta = _diasFaltantes(start, end, rows);
  const podeEditar = perm.trafegoEditar();

  const cpl = t.leads ? t.invest / t.leads : 0;
  const ctr = t.impressoes ? (t.cliques / t.impressoes) * 100 : 0;

  let h = '';
  h += '<div class="trafego-top">';
  h += '<div class="section-title" style="margin:0"><span class="bar"></span>Tráfego Pago — dias digitados</div>';
  if (podeEditar) h += '<button class="btn-sm trafego-add-btn" onclick="openTrafegoForm()">+ Lançar dia</button>';
  h += '</div>';

  const brlChip = v => fmtBRL(v).replace(/^R\$\s?/, '<span class="cur-sm">R$</span>');
  h += `<div class="trafego-chips">
    <div class="trafego-chip"><span>Investimento + imposto</span><strong>${brlChip(t.invest * (1 + TAXA_IMPOSTO))}</strong></div>
    <div class="trafego-chip"><span>Investimento (painel Meta)</span><strong>${brlChip(t.invest)}</strong></div>
    <div class="trafego-chip"><span>Leads</span><strong>${fmtN(t.leads)}</strong></div>
    <div class="trafego-chip"><span>CPL (s/ imposto)</span><strong>${brlChip(cpl)}</strong></div>
    <div class="trafego-chip"><span>CTR médio</span><strong>${ctr.toFixed(2)}%</strong></div>
    <div class="trafego-chip"><span>Dias digitados</span><strong>${t.dias}</strong></div>
  </div>`;

  if (falta.length) {
    h += `<div class="trafego-falta">${icon('alert', 13)} ${falta.length} dia(s) do período sem lançamento: ${falta.map(_fmtDia).join(', ')}${podeEditar ? ' — clique em “Lançar dia” para preencher.' : ''}</div>`;
  }

  if (!rows.length) {
    h += `<div class="empty"><div class="empty-icon">${icon('trend')}</div><div class="empty-title">Nenhum dia digitado no período</div><div class="empty-desc">Use “Lançar dia” para registrar investimento, leads, cliques, impressões e alcance.</div></div>`;
  } else {
    h += `<div class="trafego-table-wrap"><table class="trafego-table">
      <thead><tr>
        <th>Data</th><th>Investimento</th><th>Leads</th><th>Cliques</th>
        <th>CPL</th><th>CTR</th><th>Impressões</th><th>Alcance</th>
        <th>Invest. + Imposto</th>${podeEditar ? '<th></th>' : ''}
      </tr></thead><tbody>`;
    for (const r of rows) {
      const inv  = Number(r.investimento) || 0;
      const rCpl = r.leads ? inv / r.leads : 0;
      const rCtr = r.impressoes ? (r.cliques / r.impressoes) * 100 : 0;
      h += `<tr>
        <td class="trafego-dia">${_fmtDia(r.dia)}</td>
        <td>${fmtBRL(inv)}</td>
        <td>${fmtN(r.leads)}</td>
        <td>${fmtN(r.cliques)}</td>
        <td>${fmtBRL(rCpl)}</td>
        <td>${rCtr.toFixed(2)}%</td>
        <td>${fmtN(r.impressoes)}</td>
        <td>${fmtN(r.alcance)}</td>
        <td class="trafego-imposto">${fmtBRL(inv * (1 + TAXA_IMPOSTO))}</td>
        ${podeEditar ? `<td class="trafego-acoes">
          <button class="btn-sm btn-ghost" onclick="openTrafegoForm('${r.dia}')" title="Editar">${icon('edit', 13)}</button>
          <button class="btn-sm btn-ghost" onclick="askDeleteTrafego('${r.dia}')" title="Excluir">${icon('trash', 13)}</button>
        </td>` : ''}
      </tr>`;
    }
    h += `</tbody><tfoot><tr>
      <td>TOTAL</td>
      <td>${fmtBRL(t.invest)}</td>
      <td>${fmtN(t.leads)}</td>
      <td>${fmtN(t.cliques)}</td>
      <td>${fmtBRL(cpl)}</td>
      <td>${ctr.toFixed(2)}%</td>
      <td>${fmtN(t.impressoes)}</td>
      <td>${fmtN(t.alcance)}</td>
      <td class="trafego-imposto">${fmtBRL(t.invest * (1 + TAXA_IMPOSTO))}</td>
      ${podeEditar ? '<td></td>' : ''}
    </tr></tfoot></table></div>`;
    h += `<div class="trafego-nota">CPL e CTR são calculados automaticamente. Investimento + Imposto = investimento × ${(1 + TAXA_IMPOSTO).toFixed(2).replace('.', ',')} — é o valor usado no CAC e ROAS da Visão Geral.</div>`;
  }

  sec.innerHTML = h;
}

// ── Modal de lançamento/edição ───────────────────────────────────────────────

function _ensureModal() {
  if (document.getElementById('trafego-modal')) return;
  const el = document.createElement('div');
  el.id = 'trafego-modal';
  el.className = 'trafego-modal-overlay';
  el.innerHTML = `
    <div class="trafego-modal">
      <div class="trafego-modal-title" id="trafego-modal-title">Lançar dia</div>
      <label>Data<input type="date" id="tf-dia"></label>
      <label>Investimento (R$, sem imposto)<input type="text" id="tf-invest" inputmode="decimal" placeholder="0,00"></label>
      <div class="trafego-modal-grid">
        <label>Leads<input type="number" id="tf-leads" min="0" placeholder="0"></label>
        <label>Cliques<input type="number" id="tf-cliques" min="0" placeholder="0"></label>
        <label>Impressões<input type="number" id="tf-impressoes" min="0" placeholder="0"></label>
        <label>Alcance<input type="number" id="tf-alcance" min="0" placeholder="0"></label>
      </div>
      <div class="trafego-modal-calc" id="tf-calc"></div>
      <div class="trafego-modal-actions">
        <button class="btn-sm btn-ghost" onclick="closeTrafegoForm()">Cancelar</button>
        <button class="btn-sm trafego-save-btn" id="tf-save" onclick="saveTrafegoForm()">Salvar</button>
      </div>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) closeTrafegoForm(); });
  document.body.appendChild(el);
  ['tf-invest', 'tf-leads', 'tf-cliques', 'tf-impressoes'].forEach(id =>
    document.getElementById(id).addEventListener('input', _updateCalc)
  );
}

function _updateCalc() {
  const inv    = parseBRL(document.getElementById('tf-invest').value) || 0;
  const leads  = Number(document.getElementById('tf-leads').value)      || 0;
  const cliq   = Number(document.getElementById('tf-cliques').value)    || 0;
  const impr   = Number(document.getElementById('tf-impressoes').value) || 0;
  const cpl = leads ? inv / leads : 0;
  const ctr = impr ? (cliq / impr) * 100 : 0;
  document.getElementById('tf-calc').textContent =
    `CPL ${fmtBRL(cpl)} · CTR ${ctr.toFixed(2)}% · com imposto ${fmtBRL(inv * (1 + TAXA_IMPOSTO))}`;
}

export function openTrafegoForm(dia) {
  if (!perm.trafegoEditar()) { toast('Sem permissão para lançar tráfego', 'err'); return; }
  _ensureModal();
  const reg = dia ? (state.trafego || []).find(r => r.dia === dia) : null;
  document.getElementById('trafego-modal-title').textContent = reg ? `Editar ${_fmtDia(reg.dia)}` : 'Lançar dia';
  document.getElementById('tf-dia').value        = reg ? reg.dia : _hoje();
  document.getElementById('tf-dia').disabled     = !!reg;
  document.getElementById('tf-invest').value     = reg ? String(reg.investimento).replace('.', ',') : '';
  document.getElementById('tf-leads').value      = reg ? reg.leads      : '';
  document.getElementById('tf-cliques').value    = reg ? reg.cliques    : '';
  document.getElementById('tf-impressoes').value = reg ? reg.impressoes : '';
  document.getElementById('tf-alcance').value    = reg ? reg.alcance    : '';
  _updateCalc();
  document.getElementById('trafego-modal').classList.add('open');
  document.getElementById('tf-invest').focus();
}

export function closeTrafegoForm() {
  document.getElementById('trafego-modal')?.classList.remove('open');
}

export async function saveTrafegoForm() {
  const dia = document.getElementById('tf-dia').value;
  if (!dia) { toast('Informe a data', 'err'); return; }
  const btn = document.getElementById('tf-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const ok = await saveTrafegoDia({
    dia,
    investimento: parseBRL(document.getElementById('tf-invest').value) || 0,
    leads:        Number(document.getElementById('tf-leads').value)      || 0,
    cliques:      Number(document.getElementById('tf-cliques').value)    || 0,
    impressoes:   Number(document.getElementById('tf-impressoes').value) || 0,
    alcance:      Number(document.getElementById('tf-alcance').value)    || 0,
  });
  btn.disabled = false; btn.textContent = 'Salvar';
  if (!ok) { toast('Erro ao salvar no Supabase', 'err'); return; }
  closeTrafegoForm();
  toast(`Tráfego de ${_fmtDia(dia)} salvo`);
  renderTrafego();
  if (state.result) renderAll(); // KPIs da Visão Geral recalculam na hora
}

export function askDeleteTrafego(dia) {
  showConfirm('Excluir lançamento', `Remover os dados de tráfego de ${_fmtDia(dia)}?`, 'Excluir', async () => {
    const ok = await deleteTrafegoDia(dia);
    if (!ok) { toast('Erro ao excluir', 'err'); return; }
    toast('Lançamento removido');
    renderTrafego();
    if (state.result) renderAll();
  });
}
