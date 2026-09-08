// Uploads do Criador de Cursos: vídeo via TUS → Bunny.net (autorização pela
// função serverless /api/bunny-create), PDF e imagens via Supabase Storage
// (bucket uni-assets).
import { sb } from './supabase.js';

function _loadTusClient() {
  return new Promise(resolve => {
    if (window.tus) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.1.0/dist/tus.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

/**
 * Envia um vídeo ao Bunny e devolve o videoId. `onProgress(pct)` é chamado
 * durante o envio. Lança em qualquer falha (init, TUS, rede).
 */
export async function uploadVideoBunny(file, titulo, onProgress) {
  const initRes = await fetch('/api/bunny-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: titulo || file.name }),
  });

  if (!initRes.ok) throw new Error(await initRes.text());
  const { videoId, authSignature, authExpire, libraryId } = await initRes.json();

  await _loadTusClient();

  await new Promise((resolve, reject) => {
    const upload = new window.tus.Upload(file, {
      endpoint: 'https://video.bunnycdn.com/tusupload',
      retryDelays: [0, 3000, 5000],
      chunkSize: 5 * 1024 * 1024,
      headers: {
        AuthorizationSignature: authSignature,
        AuthorizationExpire:    String(authExpire),
        VideoId:                videoId,
        LibraryId:              String(libraryId),
      },
      metadata: { filetype: file.type, title: titulo || file.name },
      onProgress: (sent, total) => {
        onProgress(Math.round((sent / total) * 100));
      },
      onSuccess: () => resolve(),
      onError:   (err) => reject(err),
    });
    upload.start();
  });

  return videoId;
}

/** Envia um PDF ao bucket uni-assets e devolve a URL pública. */
export async function uploadPdfAsset(file) {
  const path = `pdfs/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const { error } = await sb.storage.from('uni-assets').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from('uni-assets').getPublicUrl(path);
  return publicUrl;
}

/** Envia uma imagem (capa/hero) ao bucket uni-assets e devolve a URL pública. */
export async function uploadImagemAsset(file, tipo) {
  const ext  = file.name.split('.').pop();
  const path = `imagens/${tipo}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('uni-assets').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from('uni-assets').getPublicUrl(path);
  return publicUrl;
}
