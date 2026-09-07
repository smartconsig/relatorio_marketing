// Lista de Quitações: KPIs, busca com destaque e tabela de clientes, mais a
// troca entre as vistas lista/detalhe.
import { Q } from './q-store.js';

export function showList() {
  const vl = document.getElementById('q-view-list');
  const vd = document.getElementById('q-view-detail');
  if (vl) vl.style.display = '';
  if (vd) vd.style.display = 'none';
}

export function showDetailView() {
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

export function renderList() {
  const statsEl = document.getElementById('q-stats');
  const tableEl = document.getElementById('q-table');
  if (!statsEl || !tableEl) return;

  const comQuit = Q.clientes.filter(c => c.quitacao && (c.quitacao.val_boleto || c.quitacao.val_ted)).length;
  const comDoc  = Q.clientes.filter(c => c.doc_pdf).length;

  statsEl.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total de Clientes</div>
      <div class="kpi-value">${Q.clientes.length}</div>
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

  const q    = Q.search.toLowerCase().trim();
  const list = q
    ? Q.clientes.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    : Q.clientes;

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
