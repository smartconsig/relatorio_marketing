// Vercel Serverless Function — Universidade Smart
// Cria entrada de vídeo no Bunny.net e retorna credenciais TUS para upload direto do browser.
// A BUNNY_API_KEY fica segura aqui no servidor — nunca exposta no frontend.

const crypto = require('crypto');

const LIBRARY_ID = 670540;

module.exports = async function handler(req, res) {
  // CORS para o mesmo domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.BUNNY_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'BUNNY_API_KEY não configurada no servidor.' });
  }

  let titulo = 'Sem título';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body?.titulo) titulo = body.titulo;
  } catch (_) {}

  try {
    // 1. Cria entrada de vídeo no Bunny Stream
    const createRes = await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: titulo }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return res.status(502).json({ error: `Bunny API error: ${err}` });
    }

    const { guid: videoId } = await createRes.json();

    // 2. Gera assinatura TUS (válida por 1 hora)
    // Formato: SHA256(libraryId + apiKey + expirationTime + videoId)
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    const authSignature = crypto
      .createHash('sha256')
      .update(`${LIBRARY_ID}${API_KEY}${expirationTime}${videoId}`)
      .digest('hex');

    return res.status(200).json({
      videoId,
      authSignature,
      authExpire: expirationTime,
      libraryId: LIBRARY_ID,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
