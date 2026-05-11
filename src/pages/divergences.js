import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { saveState } from '../core/storage.js';
import { scheduleSaveSnapshot } from '../services/snapshot.js';
import { filteredData, calcKPIs } from '../core/calcKPIs.js';
import { renderOverview } from './overview.js';
import { renderAll } from '../navigation.js';
import { normCPF } from '../utils/cpf.js';
import { saveClassificationToSupabase } from '../services/classifications.js';

/** Confirma que a entrada é mesmo marketing — some da lista de divergências. */
export function confirmDivergence(idx) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;
  entry.divergenceConfirmed = true;
  if (entry.cpf) state.confirmedDivergences[normCPF(entry.cpf)] = true;
  saveState();
  scheduleSaveSnapshot();
  toast('✅ Confirmado como Marketing');
  const fd = filteredData();
  if (fd) {
    const k = calcKPIs(fd.entries, fd.facebook);
    renderOverview(k, fd);
  }
}

/** Remove a entrada do marketing — volta para o PROCV como pendente. */
export async function rejectDivergence(idx) {
  if (!state.result) return;
  const entry = state.result.entries[idx];
  if (!entry) return;
  entry.isMarketing         = false;
  entry.reviewReason        = 'manual';
  entry.divergenceConfirmed = false;
  if (entry.cpf) {
    const key = normCPF(entry.cpf);
    state.overrides[key] = false;
    delete state.confirmedDivergences[key];
    localStorage.setItem('sc_overrides_v1', JSON.stringify(state.overrides));
  }
  saveState();
  toast('❌ Removido do marketing');
  if (state.currentUser && entry.cpf) {
    await saveClassificationToSupabase(entry.cpf, false);
  }
  scheduleSaveSnapshot();
  const fd = filteredData();
  if (fd) renderAll();
}
