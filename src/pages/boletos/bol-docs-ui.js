// Popover de documentos da Quitação de Boleto (hover/clique nos chips 📄/🧾)
// + ver/baixar/excluir. O contêiner #bol-pop vive no index.html (com
// onmouseenter="bolPopEnter()" / onmouseleave="bolPopLeave()" inline).
import { icon } from '../../utils/icons.js';
import { showConfirm } from '../../utils/confirm.js';
import { toast, handleError } from '../../utils/ui.js';
import { getBoletoDocUrl, deleteBoletoDoc } from '../../services/boleto-docs-svc.js';
import { BO, isAdmin, esc, loadData } from './bol-core.js';
import { updateTable } from './bol-tabela.js';

let _popTimer     = null;
let _popFixo      = false;
let _popListeners = false;

export function bolPopShow(ev, boletoId, fixo = false) {
  clearTimeout(_popTimer);
  const pop = document.getElementById('bol-pop');
  const r   = BO.registros.find(x => x.id === boletoId);
  if (!pop || !r) return;
  _popFixo = fixo;

  if (!_popListeners) {
    _popListeners = true;
    document.addEventListener('click', e => {
      if (e.target.closest('.res-pop') || e.target.closest('.res-doc-chips')) return;
      _popFixo = false;
      pop.style.display = 'none';
    });
  }

  const docs  = BO.docs.get(boletoId) || [];
  const admin = isAdmin();
  const linha = d => `
    <div class="res-pop-file">
      <span class="res-pop-nm" title="${esc(d.nome_arquivo)}">${d.tipo === 'boleto' ? icon('file', 11) : icon('receipt', 11)} ${esc(d.nome_arquivo)}${d.contrato ? ` <em>· ${esc(d.contrato)}</em>` : ''}</span>
      <span class="res-pop-ops">
        <a onclick="bolVerDoc('${d.id}')">ver</a>
        <a onclick="bolBaixarDoc('${d.id}')">baixar</a>
        ${admin ? `<a class="res-pop-del" onclick="bolExcluirDoc('${d.id}')">excluir</a>` : ''}
      </span>
    </div>`;

  const bols = docs.filter(d => d.tipo === 'boleto');
  const fats = docs.filter(d => d.tipo === 'fatura');
  pop.innerHTML = `
    <div class="res-pop-title">${esc(r.nome)}</div>
    ${bols.length ? `<div class="res-pop-grp">Boletos</div>${bols.map(linha).join('')}` : ''}
    ${fats.length ? `<div class="res-pop-grp">Faturas</div>${fats.map(linha).join('')}` : ''}
    ${!docs.length ? `<div class="res-pop-grp">Nenhum documento</div>` : ''}
  `;

  const rect = ev.currentTarget.getBoundingClientRect();
  pop.style.display = 'block';
  const popW = Math.min(380, window.innerWidth - 24);
  pop.style.width = popW + 'px';
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - popW - 12));
  let top  = rect.bottom + 6;
  const popH = pop.offsetHeight || 200;
  if (top + popH > window.innerHeight - 12) top = Math.max(12, rect.top - popH - 6);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}

export function bolPopEnter() { clearTimeout(_popTimer); }

export function bolPopLeave() {
  clearTimeout(_popTimer);
  _popTimer = setTimeout(() => {
    if (_popFixo) return; // fixado por clique: fecha só clicando fora
    const pop = document.getElementById('bol-pop');
    if (pop) pop.style.display = 'none';
  }, 300);
}

function _findDoc(docId) {
  for (const docs of BO.docs.values()) {
    const d = docs.find(x => x.id === docId);
    if (d) return d;
  }
  return null;
}

export async function bolVerDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  const win = window.open('', '_blank');
  try {
    const url = await getBoletoDocUrl(doc.storage_path);
    if (win) win.location = url; else window.open(url, '_blank');
  } catch (e) {
    if (win) win.close();
    handleError('Erro ao abrir o documento.', e);
  }
}

export async function bolBaixarDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  try {
    const url = await getBoletoDocUrl(doc.storage_path, doc.nome_arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nome_arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    handleError('Erro ao baixar o documento.', e);
  }
}

export function bolExcluirDoc(docId) {
  const doc = _findDoc(docId);
  if (!doc) return;
  showConfirm(
    'Excluir documento',
    `Excluir "${doc.nome_arquivo}" deste cliente? O arquivo é removido do Storage.`,
    'Excluir',
    async () => {
      try {
        await deleteBoletoDoc(doc);
        toast('Documento excluído.');
        await loadData();
        updateTable();
      } catch (e) { handleError('Erro ao excluir o documento.', e); }
    }
  );
}
