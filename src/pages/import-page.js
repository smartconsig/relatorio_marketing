import { state } from '../state.js';
import { toast } from '../utils/ui.js';
import { saveState, setCacheIndicator } from '../core/storage.js';
import { buildResult } from '../core/buildResult.js';
import { saveSnapshotToSupabase } from '../services/snapshot.js';
import { syncClassificationsFromSupabase } from '../services/classifications.js';
import { normCPF } from '../utils/cpf.js';
import { renderAll } from '../navigation.js';
import { renderDiag } from './overview.js';
import { navigate } from '../navigation.js';
import { logAction, renderLastSystemEvent } from '../services/action-log.js';

export function loadFile(e, key) {
  const file = e.target.files[0];
  if (!file) return;

  if (key === 'overrides') {
    const r = new FileReader();
    r.onload = ev => {
      try {
        state.overrides = JSON.parse(ev.target.result);
        state.raw.overrides = true;
        setCardLoaded('overrides', file.name);
        toast('Classificações manuais carregadas');
      } catch { toast('Erro ao ler arquivo de classificações', 'err'); }
    };
    r.readAsText(file);
    return;
  }

  const r = new FileReader();
  r.onload = ev => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: false, raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      state.raw[key] = data;
      setCardLoaded(key, `${file.name} (${data.length} linhas)`);
      checkProcessBtn();
      toast(`${file.name} carregado`);
    } catch (err) {
      toast(`Erro ao ler ${file.name}`, 'err');
      console.error(err);
    }
  };
  r.readAsArrayBuffer(file);
}

export function setCardLoaded(key, label) {
  document.getElementById(`card-${key}`).classList.add('loaded');
  document.getElementById(`fn-${key}`).textContent = label;
}

export function checkProcessBtn() {
  document.getElementById('btn-process').disabled = !state.raw.ecorban;
}

export async function processAll() {
  const btn = document.getElementById('btn-process');
  btn.textContent = 'Processando…';
  btn.disabled = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 60));

    // Captura classificações manuais do estado atual antes de reconstruir
    const prevClassifications = {};
    if (state.result?.entries) {
      for (const e of state.result.entries) {
        if (e.reviewReason === 'manual' && e.cpf) {
          prevClassifications[normCPF(e.cpf)] = e.isMarketing;
        }
      }
    }

    state.result = buildResult();

    // Reaplica classificações anteriores nas novas entradas (cobre falha de DB e state.overrides stale)
    for (const e of state.result.entries) {
      if (e.reviewReason === 'manual') continue;
      const norm = normCPF(e.cpf);
      if (norm && prevClassifications[norm] !== undefined) {
        e.isMarketing  = prevClassifications[norm];
        e.reviewReason = 'manual';
      }
    }

    await syncClassificationsFromSupabase();
    saveState();
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);

    const matchPct = state.result.diag.ecorban.total
      ? Math.round(state.result.diag.ecorban.matched / state.result.diag.ecorban.total * 100) : 0;
    const src = state.result.diag.smart.source === 'api' ? 'API Smart' : 'Excel Smart';
    toast(`Processado: ${state.result.entries.length} propostas · ${matchPct}% encontradas no ${src}`);

    navigate('overview');
    saveSnapshotToSupabase();
    logAction('__import__', 'Dados processados', 'imported_data').then(() =>
      renderLastSystemEvent('import-last-log', '__import__')
    );
  } catch (err) {
    toast('Erro ao processar: ' + err.message, 'err');
    console.error(err);
  }

  btn.textContent = 'Processar Dados';
  btn.disabled = false;
}
