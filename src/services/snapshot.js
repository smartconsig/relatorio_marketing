import { sb } from './supabase.js';
import { state } from '../state.js';
import { supportsGzip, gzipToBase64, gunzipFromBase64 } from '../utils/gzip.js';

let _snapDebounce  = null;
let _lastSavedHash = null;
let _lastSavedAt   = null;

// Snapshots antigos são JSON puro; os novos levam este prefixo (gzip + base64).
// A leitura precisa aceitar os dois formatos para sempre.
const GZ_PREFIX = 'gz1:';

function hashPayload(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ':' + str.length;
}

export function scheduleSaveSnapshot() {
  clearTimeout(_snapDebounce);
  _snapDebounce = setTimeout(() => saveSnapshotToSupabase(), 2000);
}

export async function saveSnapshotToSupabase() {
  if (!state.currentUser || !state.result) return null;
  try {
    const now     = new Date().toISOString();
    const payload = JSON.stringify({
      entries:              state.result.entries.map(({ _justConfirmed, _confirmedInFilter, ...rest }) => rest),
      facebook:             state.result.facebook,
      unknownStatuses:      state.result.unknownStatuses,
      diag:                 state.result.diag,
      smartLeadsByOperador: state.result.smartLeadsByOperador || {},
      smartLeadsByTime:     state.result.smartLeadsByTime     || {},
      smartLeads:           state.result.smartLeads           || [],
      confirmedDivergences: state.confirmedDivergences,
      vendorMappings:       state.vendorMappings || {},
    });

    // Nada mudou desde o último save bem-sucedido desta sessão — não re-envia.
    const hash = hashPayload(payload);
    if (hash === _lastSavedHash) return _lastSavedAt;

    let body = payload;
    if (supportsGzip()) {
      try { body = GZ_PREFIX + await gzipToBase64(payload); } catch (e) { console.warn('gzip falhou, salvando sem compressão:', e); }
    }

    const { data } = await sb.from('snapshots').select('id').limit(1).maybeSingle();
    if (data?.id) {
      const { error } = await sb.from('snapshots').update({
        data:       body,
        updated_by: state.currentUser.email,
        updated_at: now,
      }).eq('id', data.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('snapshots').insert({
        data:       body,
        updated_by: state.currentUser.email,
        updated_at: now,
      });
      if (error) throw error;
    }
    _lastSavedHash = hash;
    _lastSavedAt   = now;
    return now;
  } catch (e) { console.warn('saveSnapshot:', e); return null; }
}

/** Consulta leve: retorna apenas o updated_at do snapshot mais recente. */
export async function checkSnapshotTimestamp() {
  try {
    const { data, error } = await sb
      .from('snapshots')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.updated_at;
  } catch (e) { console.warn('checkSnapshotTimestamp:', e); return null; }
}

/** Baixa o snapshot completo. Retorna { snapshot, updatedAt } ou null. */
export async function loadSnapshotFromSupabase() {
  try {
    const { data, error } = await sb
      .from('snapshots')
      .select('data, updated_by, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.data) return null;
    let raw = data.data;
    if (typeof raw === 'string' && raw.startsWith(GZ_PREFIX)) {
      raw = await gunzipFromBase64(raw.slice(GZ_PREFIX.length));
    }
    return { snapshot: JSON.parse(raw), updatedAt: data.updated_at };
  } catch (e) { console.warn('loadSnapshot:', e); return null; }
}
