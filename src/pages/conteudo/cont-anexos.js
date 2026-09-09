// Anexos (artes) do card: galeria com lightbox, upload (botão, multi e
// Ctrl+V) e remoção. O arquivo vive no bucket conteudo-anexos (URL assinada).
import { toast } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import { perm } from '../../services/permissions.js';
import { loadAnexos, signedUrls, uploadAnexo, deleteAnexo, ANEXO_MAX_BYTES } from '../../services/conteudo-svc.js';
import { C, esc } from './cont-core.js';
import { carregarHistorico } from './cont-historico.js';

export async function carregarAnexos(cardId) {
  const box = document.getElementById('cont-anexos');
  box.innerHTML = '<div class="cont-hist-vazio">Carregando…</div>';

  const anexos = await loadAnexos(cardId);
  if (!anexos.length) {
    box.innerHTML = '<div class="cont-hist-vazio">Nenhuma arte anexada.</div>';
    return;
  }

  const urls = await signedUrls(anexos.map(a => a.path));
  const podeEditar = perm.conteudoEditar();

  box.innerHTML = anexos.map(a => `
    <div class="cont-anexo" data-url="${esc(urls[a.path] || '')}" title="${esc(a.nome)}">
      <img src="${esc(urls[a.path] || '')}" alt="${esc(a.nome)}" loading="lazy">
      ${podeEditar ? `<button class="cont-anexo-x" data-del="${a.id}" title="Remover">&times;</button>` : ''}
    </div>`).join('');

  box.querySelectorAll('.cont-anexo').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.cont-anexo-x')) return;
      const lb = document.getElementById('cont-lightbox');
      document.getElementById('cont-lightbox-img').src = el.dataset.url;
      lb.style.display = 'flex';
    });
  });

  box.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const anexo = anexos.find(a => a.id === btn.dataset.del);
      if (!anexo) return;
      showConfirm('Remover arte?', anexo.nome, 'Remover', async () => {
        try {
          await deleteAnexo(anexo);
          await carregarAnexos(cardId);
        } catch (err) {
          console.error('deleteAnexo:', err);
          toast('Erro ao remover a imagem', 'err');
        }
      });
    });
  });
}

// Só imagens até o limite entram; as demais avisam e ficam de fora.
function _filtrarImagensValidas(files) {
  const validos = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) { toast(`"${f.name}" não é imagem`, 'err'); continue; }
    if (f.size > ANEXO_MAX_BYTES)     { toast(`"${f.name}" passa de 10 MB`, 'err'); continue; }
    validos.push(f);
  }
  return validos;
}

export async function subirArquivos(files) {
  if (!C.editId || !files.length) return;
  if (!perm.conteudoEditar()) return;

  const validos = _filtrarImagensValidas(files);
  if (!validos.length) return;

  const btn = document.getElementById('cont-anexar');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    for (const f of validos) await uploadAnexo(C.editId, f);
    await carregarAnexos(C.editId);
    await carregarHistorico(C.editId);
    toast(validos.length === 1 ? 'Imagem anexada' : `${validos.length} imagens anexadas`);
  } catch (err) {
    console.error('uploadAnexo:', err);
    toast('Erro ao enviar a imagem', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Anexar imagem';
  }
}
