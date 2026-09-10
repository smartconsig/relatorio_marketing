// Painel "Diagnóstico do Processamento" (tela de importação).
import { fmtN } from '../../utils/currency.js';
import { sectionTitle } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';

const _chips = lista => lista.map(c => `<span style="background:var(--surface2);padding:1px 6px;border-radius:4px;margin:2px;display:inline-block">${c}</span>`).join('');

function _cardSmartHTML(diag) {
  return `
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Sistema Smart</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Registros lidos: <strong>${fmtN(diag.smart.total)}</strong></div>
          <div>CPFs indexados: <strong style="color:#22c55e">${fmtN(diag.smart.cpfIndexed)}</strong></div>
          <div>Telefones indexados: <strong style="color:#22c55e">${fmtN(diag.smart.phoneIndexed)}</strong></div>
          <div style="margin-top:8px;color:var(--gray);font-size:11px">Colunas detectadas:</div>
          <div style="color:var(--gray-light);font-size:11px">${_chips(diag.smart.cols)}</div>
        </div>
      </div>`;
}

function _statusDistHTML(diag) {
  return `
          <div style="margin-top:6px;color:var(--gray);font-size:11px">Distribuição de status:</div>
          <div style="font-size:11px;margin-bottom:4px">
            Pago: <strong style="color:#22c55e">${diag.statusDist?.pago || 0}</strong> &nbsp;
            Aprovado: <strong style="color:#f59e0b">${diag.statusDist?.aprovado || 0}</strong> &nbsp;
            Reprovado: <strong style="color:#ef4444">${diag.statusDist?.reprovado || 0}</strong> &nbsp;
            Desconhecido: <strong style="color:#9ca3af">${diag.statusDist?.desconhecido || 0}</strong> &nbsp;
            Sem Status: <strong style="color:#6b7280">${diag.statusDist?.['sem status'] || 0}</strong>
          </div>
          <div style="color:var(--gray);font-size:11px">Amostra de status brutos:</div>
          <div style="color:var(--gray-light);font-size:11px">${_chips(diag.statusSample || [])}</div>`;
}

function _cardEcorbanHTML(diag, matchPct, matchColor) {
  return `
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Ecorban</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Propostas lidas: <strong>${fmtN(diag.ecorban.total)}</strong></div>
          <div>Encontradas no Smart: <strong style="color:${matchColor}">${fmtN(diag.ecorban.matched)} (${matchPct}%)</strong></div>
          <div>Para revisão manual: <strong style="color:${diag.ecorban.toReview > 0 ? '#f59e0b' : '#22c55e'}">${fmtN(diag.ecorban.toReview)}</strong></div>
          <div>Com data lida: <strong style="color:${(diag.ecorban.withDate || 0) > 0 ? '#22c55e' : '#ef4444'}">${fmtN(diag.ecorban.withDate || 0)}</strong> de ${fmtN(diag.ecorban.total)} ${(diag.ecorban.withDate || 0) === 0 ? '<span style="color:#ef4444">⚠ coluna de data não encontrada</span>' : ''}</div>
          ${_statusDistHTML(diag)}
          <div style="margin-top:8px;color:var(--gray);font-size:11px">Colunas detectadas:</div>
          <div style="color:var(--gray-light);font-size:11px">${_chips(diag.ecorban.cols)}</div>
        </div>
      </div>`;
}

function _cardFacebookHTML(diag) {
  return `
      <div class="table-card" style="margin:0">
        <div class="table-header" style="padding:12px 16px"><div class="table-header-title">Facebook Ads</div></div>
        <div style="padding:14px 16px;font-size:12px;line-height:2">
          <div>Total de linhas: <strong>${fmtN(diag.facebook.total)}</strong></div>
          <div>BM-03: <strong>${fmtN(diag.facebook.bm03)} linhas</strong></div>
          <div>BM-06: <strong>${fmtN(diag.facebook.bm06)} linhas</strong></div>
          ${diag.facebook.total === 0 ? '<div style="color:var(--gray)">Nenhum arquivo de Facebook importado</div>' : ''}
        </div>
      </div>`;
}

// Avisos de CPF não indexado / taxa de match baixa (mesmos limiares)
function _alertasDiagHTML(diag, matchPct) {
  return `
    ${matchPct < 50 && diag.smart.cpfIndexed === 0 ? `
    <div style="margin-top:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#fca5a5">
      ${icon('alert', 13)} <strong>Atenção:</strong> Nenhum CPF foi indexado do Sistema Smart. Verifique se a coluna se chama exatamente <code>CPF</code> no arquivo exportado.
    </div>` : ''}
    ${matchPct < 30 && diag.smart.cpfIndexed > 0 ? `
    <div style="margin-top:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#fcd34d">
      ${icon('alert', 13)} <strong>Taxa de match baixa (${matchPct}%).</strong> Possível causa: CPFs com zeros à esquerda perdidos ao exportar.
    </div>` : ''}`;
}

export function renderDiag(diag) {
  const panel = document.getElementById('diag-panel');
  if (!panel) return;
  const matchPct   = diag.ecorban.total ? Math.round(diag.ecorban.matched / diag.ecorban.total * 100) : 0;
  const matchColor = matchPct >= 80 ? '#22c55e' : matchPct >= 50 ? '#f59e0b' : '#ef4444';
  panel.style.display = 'block';
  panel.innerHTML = `
    ${sectionTitle('Diagnóstico do Processamento', 'margin-bottom:12px')}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${_cardSmartHTML(diag)}
      ${_cardEcorbanHTML(diag, matchPct, matchColor)}
      ${_cardFacebookHTML(diag)}
    </div>
    ${_alertasDiagHTML(diag, matchPct)}
  `;
}
