// Aba Mapeamento de Vendedores (Ecorban ↔ Smart). O global
// window._removeMapeamento é registrado aqui, junto da função-alvo.
import { state } from '../../state.js';
import { icon } from '../../utils/icons.js';
import { toast } from '../../utils/ui.js';
import { normStr } from '../../utils/string.js';
import { saveState } from '../../core/storage.js';
import { saveSnapshotToSupabase } from '../../services/snapshot.js';
import { saveVendorMapping } from '../../services/propostas-store.js';

function _buildMapeamentoData() {
  const smartLeads = state.result?.smartLeadsByOperador || {};
  const entries    = state.result?.entries || [];
  const mappings   = state.vendorMappings || {};

  // Ecorban: normName → displayName (primeiro encontrado)
  const ecorbanMap = {};
  for (const e of entries.filter(e => e.isMarketing && e.vendedor)) {
    const norm = normStr(e.vendedor);
    if (!ecorbanMap[norm]) ecorbanMap[norm] = e.vendedor;
  }

  const mappedSmartNames  = new Set(Object.values(mappings));
  const mappedEcorbanNames = new Set(Object.keys(mappings));

  const unmatchedSmart   = Object.keys(smartLeads).filter(sn => !ecorbanMap[sn] && !mappedSmartNames.has(sn));
  const unmatchedEcorban = Object.keys(ecorbanMap).filter(en => !smartLeads[en] && !mappedEcorbanNames.has(en));

  return { smartLeads, ecorbanMap, mappings, unmatchedSmart, unmatchedEcorban };
}

export function renderMapeamento() {
  const wrap = document.getElementById('admin-tab-mapeamento');
  if (!wrap) return;

  const noData = !state.result;
  const { smartLeads, ecorbanMap, mappings, unmatchedSmart, unmatchedEcorban } = _buildMapeamentoData();

  // ── Tabela de mapeamentos existentes
  const currentMappings = Object.entries(mappings);
  const mappingsHtml = currentMappings.length === 0
    ? `<div style="padding:24px;text-align:center;color:var(--gray);font-size:13px">Nenhum mapeamento configurado ainda.</div>`
    : `<table class="admin-table">
        <thead><tr><th>Vendedor (Ecorban)</th><th>Operador (Smart)</th><th>Leads Smart</th><th></th></tr></thead>
        <tbody>
          ${currentMappings.map(([ecNorm, smNorm]) => `
            <tr>
              <td><strong>${ecorbanMap[ecNorm] || ecNorm}</strong></td>
              <td style="color:var(--gray)">${smNorm}</td>
              <td>${smartLeads[smNorm] || 0}</td>
              <td>
                <button class="btn-icon btn-danger" title="Remover" onclick="window._removeMapeamento('${ecNorm}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

  // ── Formulário de novo mapeamento
  const smartOptions   = unmatchedSmart.map(sn =>
    `<option value="${sn}">${sn} (${smartLeads[sn]} leads)</option>`).join('');
  const ecorbanOptions = unmatchedEcorban.map(en =>
    `<option value="${en}">${ecorbanMap[en] || en}</option>`).join('');

  const canAdd = unmatchedSmart.length > 0 && unmatchedEcorban.length > 0;
  const addHtml = !canAdd
    ? `<div style="padding:14px;color:var(--gray);font-size:13px">
        ${unmatchedSmart.length === 0   ? 'Todos os operadores do Smart já estão mapeados. ' : ''}
        ${unmatchedEcorban.length === 0 ? 'Todos os vendedores do Ecorban já têm correspondência.' : ''}
       </div>`
    : `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Operador Smart</div>
          <select id="map-smart-select" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--white);font-size:13px">
            <option value="">— Selecione —</option>${smartOptions}
          </select>
        </div>
        <div style="padding-bottom:10px;color:var(--gray);font-size:18px">→</div>
        <div style="flex:1;min-width:180px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Vendedor Ecorban</div>
          <select id="map-ecorban-select" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--white);font-size:13px">
            <option value="">— Selecione —</option>${ecorbanOptions}
          </select>
        </div>
        <div>
          <button class="btn-primary" id="btn-add-mapeamento">Adicionar</button>
        </div>
      </div>`;

  // ── Listas de sem correspondência
  const listSmartHtml = unmatchedSmart.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--gray);font-size:13px">Todos mapeados ✓</div>`
    : unmatchedSmart.map(sn =>
        `<div style="padding:8px 16px;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
          <span style="color:var(--gray-light)">${sn}</span>
          <span style="color:var(--gray);font-size:11px">${smartLeads[sn]} leads</span>
        </div>`).join('');

  const listEcorbanHtml = unmatchedEcorban.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--gray);font-size:13px">Todos com leads ✓</div>`
    : unmatchedEcorban.map(en =>
        `<div style="padding:8px 16px;font-size:13px;border-bottom:1px solid var(--border);color:var(--gray-light)">${ecorbanMap[en] || en}</div>`).join('');

  wrap.innerHTML = `
    <div style="padding:24px;max-width:900px">
      ${noData ? `<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#f59e0b">
        ${icon('alert', 13)} Processe os dados primeiro para ver os nomes disponíveis para mapeamento.
      </div>` : ''}

      <div class="card" style="margin-bottom:20px">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-family:var(--font-h);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.4px">Mapeamentos Configurados</span>
        </div>
        ${mappingsHtml}
      </div>

      ${!noData ? `
      <div class="card" style="margin-bottom:20px">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-family:var(--font-h);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.4px">Adicionar Mapeamento</span>
        </div>
        <div style="padding:16px 20px">${addHtml}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--gray)">
            Smart sem correspondência (${unmatchedSmart.length})
          </div>
          <div style="max-height:220px;overflow-y:auto">${listSmartHtml}</div>
        </div>
        <div class="card">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--gray)">
            Ecorban sem leads Smart (${unmatchedEcorban.length})
          </div>
          <div style="max-height:220px;overflow-y:auto">${listEcorbanHtml}</div>
        </div>
      </div>
      ` : ''}
    </div>`;

  document.getElementById('btn-add-mapeamento')?.addEventListener('click', () => {
    const smNorm = document.getElementById('map-smart-select')?.value;
    const ecNorm = document.getElementById('map-ecorban-select')?.value;
    if (!smNorm || !ecNorm) { toast('Selecione os dois nomes para criar o mapeamento', 'err'); return; }
    if (!state.vendorMappings) state.vendorMappings = {};
    state.vendorMappings[ecNorm] = smNorm;
    saveVendorMapping(ecNorm, smNorm);
    _persistMapeamento();
    renderMapeamento();
    toast('Mapeamento adicionado');
  });

  window._removeMapeamento = (ecNorm) => {
    if (state.vendorMappings) delete state.vendorMappings[ecNorm];
    saveVendorMapping(ecNorm, null);
    _persistMapeamento();
    renderMapeamento();
    toast('Mapeamento removido');
  };
}

async function _persistMapeamento() {
  saveState();
  await saveSnapshotToSupabase();
}
