// Modais da Central de BMs: perfil, BM e número oficial (criar/editar/
// excluir), com histórico carregado do bm_eventos.
import { perm } from '../../services/permissions.js';
import { toast } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import {
  createPerfil, updatePerfil, deletePerfil,
  createBM, updateBM, deleteBM,
  createNumero, updateNumero, deleteNumero,
  logEvento, loadEventos, loadEventosPerfil,
} from '../../services/bm-svc.js';
import { B, esc, fmtDataHora, labelEvento, numerosDa, bmsDo } from './bm-core.js';
import { renderLista } from './bm-lista.js';

// ── modal: perfil ────────────────────────────────────────────────────────────
export async function abrirModalPerfil(id) {
  if (!perm.bmEditar()) return;
  B.editPerfilId = id;
  const p = id ? B.perfis.find(x => x.id === id) : null;

  document.getElementById('bm-p-title').textContent = p ? 'Editar Perfil' : 'Novo Perfil';
  document.getElementById('bm-p-nome').value = p?.nome || '';
  document.getElementById('bm-p-obs').value  = p?.observacao || '';
  document.getElementById('bm-p-excluir').style.display = p && perm.isAdmin() ? '' : 'none';

  const histWrap = document.getElementById('bm-p-hist-wrap');
  histWrap.style.display = p ? '' : 'none';
  document.getElementById('bm-perfil-modal').style.display = 'flex';
  document.getElementById('bm-p-nome').focus();

  if (p) {
    document.getElementById('bm-p-hist').innerHTML = '<div class="bm-hint">Carregando…</div>';
    const eventos = await loadEventosPerfil(p.id);
    if (B.editPerfilId !== p.id) return;                 // usuário já trocou de modal
    document.getElementById('bm-p-hist').innerHTML = eventos.length
      ? eventos.map(ev => `
          <div class="bm-hist-item">
            <span class="bm-hist-txt">${esc(labelEvento(ev))}</span>
            <span class="bm-hist-meta">${esc(ev.autor_nome || '')} · ${fmtDataHora(ev.created_at)}</span>
          </div>`).join('')
      : '<div class="bm-hint">Sem histórico ainda.</div>';
  }
}

export function fecharModalPerfil() {
  B.editPerfilId = null;
  document.getElementById('bm-perfil-modal').style.display = 'none';
}

export async function salvarPerfil() {
  const nome = document.getElementById('bm-p-nome').value.trim();
  if (!nome) { toast('Dê um nome para o perfil', 'err'); return; }

  const payload = {
    nome,
    observacao: document.getElementById('bm-p-obs').value.trim() || null,
  };

  try {
    if (B.editPerfilId) {
      const p = B.perfis.find(x => x.id === B.editPerfilId);
      const novo = await updatePerfil(B.editPerfilId, payload);
      const mudou = Object.keys(payload).filter(k => (p[k] || '') !== (payload[k] || ''));
      if (mudou.length) await logEvento({ perfil_id: B.editPerfilId, tipo: 'perfil_editado', texto: mudou.join(', ') });
      Object.assign(p, novo);
      toast('Perfil atualizado');
    } else {
      const novo = await createPerfil(payload);
      B.perfis.push(novo);
      B.perfis.sort((a, b) => a.nome.localeCompare(b.nome));
      B.abertosP.add(novo.id);           // já abre para cadastrar as BMs
      toast('Perfil criado');
    }
    fecharModalPerfil();
    renderLista();
  } catch (err) {
    console.error('salvarPerfil:', err);
    toast('Erro ao salvar o perfil', 'err');
  }
}

export function excluirPerfil() {
  if (!B.editPerfilId) return;
  const id   = B.editPerfilId;
  const p    = B.perfis.find(x => x.id === id);
  const bms  = bmsDo(id);
  const nums = bms.reduce((tot, bm) => tot + numerosDa(bm.id).length, 0);
  showConfirm(
    'Excluir perfil?',
    `As ${bms.length} BM(s), os ${nums} número(s) e todo o histórico dele também serão apagados. Esta ação não pode ser desfeita.`,
    'Excluir',
    async () => {
      try {
        await deletePerfil(id);
        const bmIds = new Set(bms.map(b => b.id));
        B.perfis  = B.perfis.filter(x => x.id !== id);
        B.bms     = B.bms.filter(b => b.perfil_id !== id);
        B.numeros = B.numeros.filter(n => !bmIds.has(n.bm_id));
        B.abertosP.delete(id);
        bmIds.forEach(bmId => B.abertas.delete(bmId));
        fecharModalPerfil();
        renderLista();
        toast(`Perfil "${p?.nome || ''}" excluído`);
      } catch (err) {
        console.error('excluirPerfil:', err);
        toast('Erro ao excluir o perfil', 'err');
      }
    },
  );
}

// ── modal: BM ────────────────────────────────────────────────────────────────
export async function abrirModalBM(id, perfilPre) {
  if (!perm.bmEditar()) return;
  B.editBmId    = id;
  B.bmPerfilPre = perfilPre || null;
  const bm = id ? B.bms.find(b => b.id === id) : null;

  const perfilSel = bm?.perfil_id || B.bmPerfilPre || B.perfis[0]?.id || '';
  document.getElementById('bm-f-perfil').innerHTML = B.perfis
    .map(p => `<option value="${p.id}"${p.id === perfilSel ? ' selected' : ''}>${esc(p.nome)}${p.ativa ? '' : ' (fora do ar)'}</option>`)
    .join('');

  document.getElementById('bm-modal-title').textContent = bm ? 'Editar BM' : 'Nova BM';
  document.getElementById('bm-f-nome').value   = bm?.nome || '';
  document.getElementById('bm-f-idmeta').value = bm?.bm_id_meta || '';
  document.getElementById('bm-f-data').value   = bm?.data_criacao_bm || '';
  document.getElementById('bm-f-obs').value    = bm?.observacao || '';
  document.getElementById('bm-excluir').style.display = bm && perm.isAdmin() ? '' : 'none';

  const histWrap = document.getElementById('bm-hist-wrap');
  histWrap.style.display = bm ? '' : 'none';
  document.getElementById('bm-modal').style.display = 'flex';
  document.getElementById('bm-f-nome').focus();

  if (bm) {
    document.getElementById('bm-hist').innerHTML = '<div class="bm-hint">Carregando…</div>';
    const eventos = await loadEventos(bm.id);
    if (B.editBmId !== bm.id) return;                    // usuário já trocou de modal
    document.getElementById('bm-hist').innerHTML = eventos.length
      ? eventos.map(ev => `
          <div class="bm-hist-item">
            <span class="bm-hist-txt">${esc(labelEvento(ev))}</span>
            <span class="bm-hist-meta">${esc(ev.autor_nome || '')} · ${fmtDataHora(ev.created_at)}</span>
          </div>`).join('')
      : '<div class="bm-hint">Sem histórico ainda.</div>';
  }
}

export function fecharModalBM() {
  B.editBmId    = null;
  B.bmPerfilPre = null;
  document.getElementById('bm-modal').style.display = 'none';
}

export async function salvarBM() {
  const nome = document.getElementById('bm-f-nome').value.trim();
  if (!nome) { toast('Dê um nome para a BM', 'err'); return; }

  const perfilId = document.getElementById('bm-f-perfil').value;
  if (!perfilId) { toast('Cadastre um perfil antes de criar a BM', 'err'); return; }

  const payload = {
    nome,
    perfil_id:       perfilId,
    bm_id_meta:      document.getElementById('bm-f-idmeta').value.trim() || null,
    data_criacao_bm: document.getElementById('bm-f-data').value || null,
    observacao:      document.getElementById('bm-f-obs').value.trim() || null,
  };

  try {
    if (B.editBmId) {
      const bm = B.bms.find(b => b.id === B.editBmId);
      const mudouPerfil = payload.perfil_id !== bm.perfil_id;
      const perfilAntigo = bm.perfil_id;
      const novo = await updateBM(B.editBmId, payload);
      const mudou = Object.keys(payload)
        .filter(k => k !== 'perfil_id')
        .filter(k => (bm[k] || '') !== (payload[k] || ''));
      if (mudou.length) await logEvento({ bm_id: B.editBmId, tipo: 'bm_editada', texto: mudou.join(', ') });
      if (mudouPerfil) {
        const de   = B.perfis.find(p => p.id === perfilAntigo)?.nome || '—';
        const para = B.perfis.find(p => p.id === payload.perfil_id)?.nome || '—';
        await logEvento({ bm_id: B.editBmId, perfil_id: payload.perfil_id, tipo: 'bm_movida', texto: `${de} → ${para}` });
        B.abertosP.add(payload.perfil_id);   // mostra para onde a BM foi
      }
      Object.assign(bm, novo);
      toast('BM atualizada');
    } else {
      const novo = await createBM(payload);
      B.bms.push(novo);
      B.bms.sort((a, b) => a.nome.localeCompare(b.nome));
      B.abertosP.add(novo.perfil_id);
      B.abertas.add(novo.id);            // já abre para cadastrar os números
      toast('BM criada');
    }
    fecharModalBM();
    renderLista();
  } catch (err) {
    console.error('salvarBM:', err);
    toast('Erro ao salvar a BM', 'err');
  }
}

export function excluirBM() {
  if (!B.editBmId) return;
  const id  = B.editBmId;
  const bm  = B.bms.find(b => b.id === id);
  const qtd = numerosDa(id).length;
  showConfirm(
    'Excluir BM?',
    `Os ${qtd} número(s) e todo o histórico dela também serão apagados. Esta ação não pode ser desfeita.`,
    'Excluir',
    async () => {
      try {
        await deleteBM(id);
        B.bms     = B.bms.filter(b => b.id !== id);
        B.numeros = B.numeros.filter(n => n.bm_id !== id);
        B.abertas.delete(id);
        fecharModalBM();
        renderLista();
        toast(`BM "${bm?.nome || ''}" excluída`);
      } catch (err) {
        console.error('excluirBM:', err);
        toast('Erro ao excluir a BM', 'err');
      }
    },
  );
}

// ── modal: número oficial ────────────────────────────────────────────────────
export function abrirModalNum(bmId, numId) {
  if (!perm.bmEditar()) return;
  B.numBmId   = bmId;
  B.editNumId = numId;
  const n  = numId ? B.numeros.find(x => x.id === numId) : null;
  const bm = B.bms.find(b => b.id === bmId);

  document.getElementById('bm-num-title').textContent =
    (n ? 'Editar número — ' : 'Novo número — ') + (bm?.nome || '');
  document.getElementById('bm-n-numero').value = n?.numero || '';
  document.getElementById('bm-n-nome').value   = n?.nome_exibicao || '';
  document.getElementById('bm-n-status').value = n?.status    || 'ativo';
  document.getElementById('bm-n-qual').value   = n?.qualidade || 'na';
  document.getElementById('bm-n-tier').value   = n?.tier      || 'na';
  document.getElementById('bm-n-data').value   = n?.data_ativacao || '';
  document.getElementById('bm-n-obs').value    = n?.observacao || '';
  document.getElementById('bm-n-excluir').style.display = n ? '' : 'none';

  document.getElementById('bm-num-modal').style.display = 'flex';
  document.getElementById('bm-n-numero').focus();
}

export function fecharModalNum() {
  B.editNumId = null;
  B.numBmId   = null;
  document.getElementById('bm-num-modal').style.display = 'none';
}

export async function salvarNumero() {
  const numero = document.getElementById('bm-n-numero').value.trim();
  if (!numero) { toast('Informe o número', 'err'); return; }

  const payload = {
    numero,
    nome_exibicao: document.getElementById('bm-n-nome').value.trim() || null,
    status:        document.getElementById('bm-n-status').value,
    qualidade:     document.getElementById('bm-n-qual').value,
    tier:          document.getElementById('bm-n-tier').value,
    data_ativacao: document.getElementById('bm-n-data').value || null,
    observacao:    document.getElementById('bm-n-obs').value.trim() || null,
  };

  try {
    if (B.editNumId) {
      const n = B.numeros.find(x => x.id === B.editNumId);
      const novo = await updateNumero(n, payload);
      Object.assign(n, novo);
      toast('Número atualizado');
    } else {
      const novo = await createNumero({ ...payload, bm_id: B.numBmId });
      B.numeros.push(novo);
      toast('Número adicionado');
    }
    fecharModalNum();
    renderLista();
  } catch (err) {
    console.error('salvarNumero:', err);
    toast('Erro ao salvar o número', 'err');
  }
}

export function excluirNumero() {
  if (!B.editNumId) return;
  const n = B.numeros.find(x => x.id === B.editNumId);
  if (!n) return;
  showConfirm(
    'Excluir número?',
    'Prefira marcar como "Banido" para manter o histórico. Excluir apaga o registro de vez.',
    'Excluir',
    async () => {
      try {
        await deleteNumero(n);
        B.numeros = B.numeros.filter(x => x.id !== n.id);
        fecharModalNum();
        renderLista();
        toast('Número excluído');
      } catch (err) {
        console.error('excluirNumero:', err);
        toast('Erro ao excluir o número', 'err');
      }
    },
  );
}
