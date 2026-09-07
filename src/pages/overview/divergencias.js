// Banner de divergências Ecorban da Visão Geral (confirmado como marketing
// manualmente, mas origem diferente no Ecorban). Os botões chamam os globais
// confirmDivergence/rejectDivergence (src/pages/divergences.js via main.js).
import { fmtBRL, fmtN } from '../../utils/currency.js';
import { toTitle } from '../../utils/string.js';
import { badgeHTML } from '../../components/Badge.jsx';
import { icon } from '../../utils/icons.js';

export function renderDivergencias(entries) {
  const divs = entries.filter(e =>
    e.reviewReason === 'manual' &&
    e.isMarketing === true &&
    (e.ecorbanOrigem || '').toUpperCase() !== 'MARKETING' &&
    !e.divergenceConfirmed
  );
  if (!divs.length) return '';

  const rows = divs.map((e, i) => `
    <tr>
      <td class="muted" style="font-size:11px">${i + 1}</td>
      <td><strong>${e.cliente || '—'}</strong></td>
      <td class="muted" style="font-family:monospace;font-size:12px">${e.cpf || '—'}</td>
      <td class="muted" style="font-family:monospace;font-size:12px">${e.smartPhone || '—'}</td>
      <td>${badgeHTML(e.statusCat, e.rawStatus)}</td>
      <td class="muted">${fmtBRL(e.valor)}</td>
      <td><span style="color:#f59e0b;font-weight:600">${e.ecorbanOrigem || '—'}</span></td>
      <td class="muted">${e.loja || '—'}</td>
      <td class="muted">${toTitle(e.vendedor || '—')}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn-mkt"   onclick="confirmDivergence(${e._idx})" style="font-size:11px;padding:4px 8px">${icon('check', 11)} É Marketing</button>
          <button class="btn-nomkt" onclick="rejectDivergence(${e._idx})"  style="font-size:11px;padding:4px 8px">${icon('x', 11)} Não é Marketing</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="color:var(--yellow);line-height:1">${icon('alert', 18)}</span>
        <div>
          <div style="font-family:var(--font-h);font-size:12px;font-weight:700;color:#f59e0b">
            ${fmtN(divs.length)} ENTRADAS CONFIRMADAS COMO MARKETING MAS COM ORIGEM DIFERENTE NO ECORBAN
          </div>
          <div style="font-size:12px;color:var(--gray-light);margin-top:2px">
            Revise cada uma — confirme se é realmente marketing ou remova para corrigir os números.
          </div>
        </div>
      </div>
      <div class="table-card" style="margin:0">
        <div class="table-wrap"><table>
          <thead><tr>
            <th>#</th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Status</th>
            <th>Valor</th><th>Origem Ecorban</th><th>Loja</th><th>Vendedor</th><th>Ação</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </div>`;
}
