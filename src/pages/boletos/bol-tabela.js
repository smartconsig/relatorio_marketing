// Tabela da Quitação de Boleto: shell, atualização dinâmica (com chips de
// status), linha e a mudança de status via RPC (o banco valida papel e
// transição).
import { state } from '../../state.js';
import { icon } from '../../utils/icons.js';
import { toast } from '../../utils/ui.js';
import { STATUS_META, STATUS_ORDER, rpcMudarStatus, msgErroBanco } from '../../services/boletos-svc.js';
import { BO, PAGE_SIZE, isAdmin, fmtBRL, fmtDate, fmtCpf, esc, PRESETS, filtered, loadData } from './bol-core.js';

// Padrão comum pós-escrita: recarrega do banco e redesenha o shell inteiro.
export async function reloadAndRender() {
  await loadData();
  const el = document.getElementById('sec-boletos');
  if (el) render(el);
}

// ── Render shell ──────────────────────────────────────────────────────────
export function render(el) {
  const admin = isAdmin();
  el.innerHTML = `
    <div class="lib-page">
      <div class="lib-topbar">
        <div>
          <h1>Quitação de Boleto</h1>
          <p class="lib-count bol-count"></p>
        </div>
        <div class="lib-topbar-actions">
          ${admin ? `<button class="lib-btn-limpar" onclick="bolLimparBase()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Limpar Base
          </button>` : ''}
          ${admin ? `<button class="lib-btn-export" onclick="bolExportar()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>` : ''}
          <a class="lib-btn-modelo" href="/template_boletos.xlsx" download="TEMPLATE_BOLETOS.xlsx" title="Baixar modelo de planilha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Modelo
          </a>
          <button class="lib-btn-import" onclick="bolImportarPlanilha()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar Planilha
          </button>
          <input type="file" id="bol-import-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="bolOnImportFile(this)" />
          ${admin ? `<button class="lib-btn-import" onclick="bolAbrirLote()" title="Importar ZIP de boletos ou faturas — os PDFs são anexados aos clientes em Boleto Solicitado/Enviado">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Importar Lote (.zip)
          </button>` : ''}
          <button class="lib-btn-add" onclick="bolAddCliente()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Cliente
          </button>
        </div>
      </div>

      <div class="bol-status-chips" id="bol-status-chips"></div>

      <div class="lib-filters">
        <div class="lib-search-wrap">
          <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="lib-search" id="bol-search" type="text" placeholder="Buscar por nome, CPF ou contrato…" oninput="bolSetSearch(this.value)" />
          <button class="lib-search-clear" id="bol-search-clear" onclick="bolSetSearch('')" title="Limpar busca" style="display:none">×</button>
        </div>

        ${admin ? `<div class="lib-empresa-filter-wrap">
          <select class="lib-empresa-select" id="bol-empresa-select" onchange="bolSetEmpresaFiltro(this.value)">
            <option value="">Todas as empresas</option>
          </select>
        </div>` : ''}

        <div class="lib-date-row">
          <div class="lib-presets">
            ${PRESETS.map(p => `<button class="lib-preset" data-key="${p.key}" onclick="bolSetPreset('${p.key}')">${p.label}</button>`).join('')}
            <button class="lib-preset-clear" id="bol-preset-clear" onclick="bolClearDate()" style="display:none">× Limpar</button>
          </div>
          <div class="lib-date-inputs">
            <input type="date" class="lib-date-input" id="bol-date-from" onchange="bolSetDateManual()" />
            <span class="lib-date-sep">até</span>
            <input type="date" class="lib-date-input" id="bol-date-to" onchange="bolSetDateManual()" />
          </div>
        </div>
      </div>

      <div class="lib-table-wrap">
        <table class="lib-table">
          <thead>
            <tr>
              ${admin ? '<th>Empresa</th>' : ''}
              <th>Contrato</th>
              <th>CPF</th>
              <th>Nome</th>
              <th>Convênio</th>
              <th>Produto</th>
              <th>Parcela</th>
              <th>Saldo Devedor</th>
              <th>Troco</th>
              <th>Cadastro</th>
              <th>Status</th>
              <th>Docs</th>
              <th>Obs</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="bol-tbody"></tbody>
        </table>
      </div>
      <div id="bol-ver-mais-wrap"></div>
    </div>
  `;
  updateTable();
}

// ── Update dinâmico ───────────────────────────────────────────────────────
export function updateTable() {
  const admin    = isAdmin();
  const list     = filtered();
  const visible  = list.slice(0, BO.page * PAGE_SIZE);
  const hasMore  = list.length > visible.length;
  const cols     = admin ? 14 : 13;

  // Contagem
  const countEl = document.querySelector('.bol-count');
  if (countEl) {
    countEl.textContent = BO.search || BO.dateFrom || BO.dateTo || BO.statusFiltro || BO.empresaFiltro
      ? `${list.length} resultado${list.length !== 1 ? 's' : ''} de ${BO.registros.length} total`
      : `${BO.registros.length} cliente${BO.registros.length !== 1 ? 's' : ''} cadastrado${BO.registros.length !== 1 ? 's' : ''}`;
  }

  // Chips de status (contadores respeitam os demais filtros, exceto o próprio status)
  const chipsEl = document.getElementById('bol-status-chips');
  if (chipsEl) {
    const savedStatus = BO.statusFiltro;
    BO.statusFiltro = '';
    const base = filtered();
    BO.statusFiltro = savedStatus;
    const countBy = s => base.filter(r => r.status === s).length;
    chipsEl.innerHTML = `
      <button class="bol-chip${!BO.statusFiltro ? ' active' : ''}" onclick="bolSetStatusFiltro('')">Todos <span>${base.length}</span></button>
      ${STATUS_ORDER.map(s => `
        <button class="bol-chip ${STATUS_META[s].cls}${BO.statusFiltro === s ? ' active' : ''}" onclick="bolSetStatusFiltro('${s}')">
          ${STATUS_META[s].label} <span>${countBy(s)}</span>
        </button>`).join('')}
    `;
  }

  // Tbody
  const tbody = document.getElementById('bol-tbody');
  if (tbody) {
    tbody.innerHTML = visible.length === 0
      ? `<tr><td colspan="${cols}" class="lib-empty">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           <div>Nenhum cliente encontrado.</div>
         </td></tr>`
      : visible.map(r => _renderRow(r, admin)).join('');
  }

  // Ver mais
  const vmWrap = document.getElementById('bol-ver-mais-wrap');
  if (vmWrap) {
    if (hasMore) {
      const rest = list.length - visible.length;
      const next = Math.min(PAGE_SIZE, rest);
      vmWrap.innerHTML = `
        <div class="lib-ver-mais-wrap">
          <button class="lib-ver-mais" onclick="bolVerMais()">
            Mostrar mais ${next} cliente${next !== 1 ? 's' : ''}
            <span class="lib-ver-mais-sub">${rest} restante${rest !== 1 ? 's' : ''}</span>
          </button>
        </div>`;
    } else {
      vmWrap.innerHTML = '';
    }
  }

  const clearSearch = document.getElementById('bol-search-clear');
  if (clearSearch) clearSearch.style.display = BO.search ? '' : 'none';

  const clearDate = document.getElementById('bol-preset-clear');
  if (clearDate) clearDate.style.display = (BO.preset || BO.dateFrom || BO.dateTo) ? '' : 'none';

  document.querySelectorAll('#sec-boletos .lib-preset[data-key]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === BO.preset);
  });

  const fromEl = document.getElementById('bol-date-from');
  const toEl   = document.getElementById('bol-date-to');
  if (fromEl) fromEl.value = BO.dateFrom || '';
  if (toEl)   toEl.value   = BO.dateTo   || '';

  const empSelect = document.getElementById('bol-empresa-select');
  if (empSelect) {
    const empresas = [...new Set(BO.registros.map(r => r.empresa_parceira).filter(Boolean))].sort();
    empSelect.innerHTML = `<option value="">Todas as empresas</option>` +
      empresas.map(e => `<option value="${esc(e)}"${e === BO.empresaFiltro ? ' selected' : ''}>${esc(e)}</option>`).join('');
  }
}

function _renderRow(r, admin) {
  const meta      = STATUS_META[r.status] || STATUS_META.solicitar_boleto;
  const grupoNome = state.currentUser?.grupoNome || '';
  const dono      = admin || r.empresa_parceira === grupoNome;
  const final     = r.status === 'boleto_quitado' || r.status === 'boleto_reprovado';

  // Botões de status conforme fase e papel (o banco revalida tudo)
  let statusBtns = '';
  if (admin && r.status === 'solicitar_boleto') {
    statusBtns = `<button class="bol-btn-step" onclick="bolMudarStatus('${r.id}', 'boleto_solicitado')" title="Marcar como Boleto Solicitado">Solicitado →</button>`;
  } else if (admin && r.status === 'boleto_solicitado') {
    statusBtns = `<button class="bol-btn-step" onclick="bolMudarStatus('${r.id}', 'boleto_enviado')" title="Marcar como Boleto Enviado">Enviado →</button>`;
  } else if (dono && r.status === 'boleto_enviado') {
    statusBtns = `
      <button class="bol-btn-quit" onclick="bolMarcarQuitado('${r.id}')" title="Marcar como Boleto Quitado">${icon('check', 11)} Quitado</button>
      <button class="bol-btn-rep" onclick="bolAbrirReprovar('${r.id}')" title="Reprovar boleto">${icon('x', 11)} Reprovar</button>`;
  }

  // Documentos anexados pelos lotes (parceiro só recebe os dos próprios
  // clientes — o RLS filtra no banco)
  const docs = BO.docs.get(r.id) || [];
  const nBol = docs.filter(d => d.tipo === 'boleto').length;
  const nFat = docs.filter(d => d.tipo === 'fatura').length;
  const docsCell = docs.length
    ? `<span class="res-doc-chips" onmouseenter="bolPopShow(event,'${r.id}')" onmouseleave="bolPopLeave()" onclick="bolPopShow(event,'${r.id}',true)">
         ${nBol ? `<span class="res-chip res-chip-ok">${icon('file', 11)} ${nBol}</span>` : ''}
         ${nFat ? `<span class="res-chip res-chip-ok">${icon('receipt', 11)} ${nFat}</span>` : ''}
       </span>`
    : `<span class="res-chip res-chip-none">—</span>`;

  const canEdit = admin || (dono && !final);
  const editBtn = canEdit
    ? `<button class="lib-btn-edit" onclick="bolEditarCliente('${r.id}')" title="Editar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>` : '';
  const delBtn = admin
    ? `<button class="lib-btn-del" onclick="bolDeletarCliente('${r.id}', '${esc(r.nome).replace(/'/g, "\\'")}')" title="Excluir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : '';

  const statusDate =
    r.status === 'boleto_quitado'    ? fmtDate(r.data_quitado)    :
    r.status === 'boleto_reprovado'  ? fmtDate(r.data_reprovado)  :
    r.status === 'boleto_enviado'    ? fmtDate(r.data_enviado)    :
    r.status === 'boleto_solicitado' ? fmtDate(r.data_solicitado) : '';

  const motivoBtn = r.status === 'boleto_reprovado' && r.motivo_reprovacao
    ? `<button class="bol-motivo-link" onclick="bolVerMotivo('${r.id}')" title="Ver motivo da reprovação">motivo</button>`
    : '';

  return `
    <tr class="lib-tr bol-tr-${meta.cls}" data-id="${r.id}">
      ${admin ? `<td><span class="lib-empresa-badge">${esc(r.empresa_parceira)}</span></td>` : ''}
      <td>${esc(r.contrato || '—')}</td>
      <td>${fmtCpf(r.cpf)}</td>
      <td class="lib-nome" title="${esc(r.nome || '')}">${esc(r.nome || '—')}</td>
      <td class="lib-trunc" title="${esc(r.convenio || '')}">${esc(r.convenio || '—')}</td>
      <td class="lib-trunc" title="${esc(r.produto || '')}">${esc(r.produto || '—')}</td>
      <td class="lib-val">${fmtBRL(r.valor_parcela)}</td>
      <td class="lib-val lib-val-destaque">${fmtBRL(r.saldo_devedor)}</td>
      <td class="lib-val">${fmtBRL(r.troco)}</td>
      <td>${fmtDate((r.created_at || '').slice(0,10))}</td>
      <td>
        <span class="bol-badge ${meta.cls}">${meta.label}</span>
        ${statusDate ? `<span class="bol-badge-date">${statusDate}</span>` : ''}
        ${motivoBtn}
      </td>
      <td>${docsCell}</td>
      <td class="lib-obs" title="${esc(r.obs || '')}">${esc(r.obs || '—')}</td>
      <td class="lib-td-actions bol-td-actions">${statusBtns}${editBtn}${delBtn}</td>
    </tr>`;
}

// ── Mudança de status (via RPC — o banco valida papel e transição) ────────
export async function bolMudarStatus(id, novo, motivo = null) {
  const { error } = await rpcMudarStatus(id, novo, motivo);
  if (error) { toast(msgErroBanco(error), 'err'); return false; }

  await loadData();
  updateTable();
  toast(`Status atualizado: ${STATUS_META[novo]?.label || novo}.`);
  return true;
}
