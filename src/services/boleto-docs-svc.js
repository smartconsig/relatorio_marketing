// ── Documentos da Quitação de Boleto ────────────────────────────────────────
// Boletos e faturas chegam em lotes ZIP e são anexados ao cliente da tela de
// Quitação de Boleto. Arquivos vivem no bucket privado boletos-docs (Storage);
// o banco guarda apenas metadados (boleto_docs, migration 012).
//
// Regras: documento só casa com cliente em boleto_solicitado/boleto_enviado
// (o chamador passa a lista já filtrada); quem estava SOLICITADO e recebe o
// 1º doc vira BOLETO_ENVIADO automaticamente (trigger no banco). Parceiro vê
// e baixa os docs dos próprios clientes; importar/excluir é só admin.
//
// Formatos reais dos lotes (verificados no "lote 07"):
//   • Boletos: pasta raiz = CPF (11 dígitos) / subpasta = contrato / Boleto_*.pdf
//   • Faturas: arquivo solto "NOME DO CLIENTE - 9999.pdf" (9999 = final do
//     CARTÃO, não do CPF). O CPF verdadeiro está no TEXTO do PDF — é dele que
//     o casamento primário é feito; nome normalizado é o fallback.
import { sb } from './supabase.js';
import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';

const BUCKET = 'boletos-docs';

// ── Metadados ───────────────────────────────────────────────────────────────

export async function loadBoletoDocs() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('boleto_docs')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Upload / URL / exclusão ─────────────────────────────────────────────────

function _safeName(nome) {
  return String(nome || 'arquivo.pdf')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120);
}

export async function uploadBoletoDoc(boleto, tipo, file, { contrato = null, nomeArquivo = null } = {}) {
  const nome = nomeArquivo || file.name;
  const path = `${boleto.cpf}/${tipo}s/${_safeName(nome)}`;

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data, error } = await sb
    .from('boleto_docs')
    .upsert({
      boleto_id:        boleto.id,
      cpf:              boleto.cpf,
      empresa_parceira: boleto.empresa_parceira,
      tipo,
      contrato,
      storage_path:     path,
      nome_arquivo:     nome,
      tamanho:          file.size ?? null,
      uploaded_by:      state.currentUser?.id || null,
    }, { onConflict: 'boleto_id,tipo,nome_arquivo', ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBoletoDocUrl(path, downloadName = null) {
  const opts = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, opts);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteBoletoDoc(doc) {
  await sb.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await sb.from('boleto_docs').delete().eq('id', doc.id);
  if (error) throw error;
}

// ── Análise do ZIP (roda inteira no navegador, nada é gravado aqui) ─────────

const _normNome = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Nome da fatura pode vir abreviado ("MARCIA A G SOUTO") ou truncado.
// Compatível = mesmo 1º nome, tokens seguintes batem por igualdade, inicial
// ou prefixo (truncagem), consumindo os tokens do nome completo em ordem.
function _nomeCompativel(abrevTokens, fullTokens) {
  if (!abrevTokens.length || !fullTokens.length) return false;
  if (abrevTokens[0] !== fullTokens[0]) return false;
  let j = 1;
  for (let i = 1; i < abrevTokens.length; i++) {
    const t = abrevTokens[i];
    let ok = false;
    while (j < fullTokens.length) {
      const f = fullTokens[j];
      j++;
      if (t === f || (t.length === 1 && f[0] === t) || (t.length >= 4 && f.startsWith(t))) { ok = true; break; }
    }
    if (!ok) return false;
  }
  return true;
}

async function _extrairCpfsDoPdf(pdfjs, bytes) {
  const cpfs = new Set();
  let doc = null;
  try {
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const maxPages = Math.min(doc.numPages, 2);
    for (let p = 1; p <= maxPages; p++) {
      const page    = await doc.getPage(p);
      const content = await page.getTextContent();
      const texto   = content.items.map(it => it.str).join(' ');
      const re = /CPF[:\s]*([0-9][0-9.\s-]{9,17}[0-9])/gi;
      let m;
      while ((m = re.exec(texto)) !== null) {
        const d = m[1].replace(/\D/g, '');
        if (d.length === 11) cpfs.add(d);
      }
    }
  } catch (_) {
    // PDF ilegível (ex.: escaneado) → cai no fallback por nome
  } finally {
    try { doc?.destroy(); } catch (_) {}
  }
  return [...cpfs];
}

/**
 * Lê o ZIP e propõe o casamento de cada PDF com um cliente ELEGÍVEL
 * (o chamador passa apenas clientes em boleto_solicitado/boleto_enviado).
 * @param {File} file - o .zip
 * @param {Array} alvos - registros elegíveis de quitacao_boletos
 * @param {Array} docsExistentes - linhas atuais de boleto_docs (para dedupe)
 * @param {Function} onProgress - (feitos, total, etapa) para a barra do modal
 * @returns {{ itens, orfaos, jaAnexados, clientesSemArquivo }}
 */
export async function analisarZipBoletos(file, alvos, docsExistentes, onProgress = () => {}) {
  const { unzip } = await import('fflate');

  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise((resolve, reject) => {
    unzip(buf, (err, data) => err ? reject(err) : resolve(data));
  });

  const porCpf = new Map();
  for (const r of alvos) {
    const cpf = normCPF(r.cpf);
    if (!porCpf.has(cpf)) porCpf.set(cpf, []);
    porCpf.get(cpf).push(r);
  }
  const nomes = alvos.map(r => ({ r, tokens: _normNome(r.nome).split(' ') }));

  const jaTem = new Set((docsExistentes || []).map(d => `${d.boleto_id}|${d.tipo}|${d.nome_arquivo}`));

  const pdfEntries = Object.entries(entries).filter(([path, bytes]) =>
    !path.endsWith('/') && bytes?.length > 0 && /\.pdf$/i.test(path));

  const itens = [], orfaos = [], jaAnexados = [];
  let pdfjs = null;
  let feitos = 0;

  for (const [path, bytes] of pdfEntries) {
    feitos++;
    const parts = path.split('/').filter(Boolean);
    const nomeArquivo = parts[parts.length - 1];

    let tipo, cpf = null, contrato = null, metodo = null, motivo = null;

    if (/^\d{11}$/.test(parts[0])) {
      // ── Boleto: pasta raiz é o CPF ──
      tipo     = 'boleto';
      contrato = parts.length >= 3 ? parts[1] : null;
      metodo   = 'cpf';
      if (porCpf.has(parts[0])) cpf = parts[0];
      else motivo = 'CPF não está em Boleto Solicitado/Enviado';
    } else {
      // ── Fatura: CPF só existe DENTRO do PDF ──
      tipo = 'fatura';
      onProgress(feitos, pdfEntries.length, `Lendo fatura ${nomeArquivo}…`);
      if (!pdfjs) {
        pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      const achados = await _extrairCpfsDoPdf(pdfjs, bytes.slice());
      const validos = [...new Set(achados)].filter(c => porCpf.has(c));
      if (validos.length === 1) {
        cpf    = validos[0];
        metodo = 'cpf-pdf';
      } else if (validos.length > 1) {
        motivo = 'PDF cita mais de um cliente elegível';
      } else {
        // Fallback: nome do arquivo ("NOME DO CLIENTE - 9999.pdf")
        const nomeFatura = _normNome(nomeArquivo.replace(/\.pdf$/i, '').replace(/\s*-\s*\d{3,4}\s*$/, ''));
        const abrev = nomeFatura.split(' ');
        const cands = nomes.filter(n => _nomeCompativel(abrev, n.tokens));
        const cpfsCand = [...new Set(cands.map(c => normCPF(c.r.cpf)))];
        if (cpfsCand.length === 1) {
          cpf    = cpfsCand[0];
          metodo = 'nome';
        } else {
          motivo = achados.length
            ? 'CPF do PDF não está em Boleto Solicitado/Enviado'
            : (cpfsCand.length > 1 ? 'Nome bate com mais de um cliente' : 'Sem CPF legível e nome não encontrado');
        }
      }
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });

    if (!cpf) {
      orfaos.push({ path, nomeArquivo, tipo, contrato, blob, tamanho: bytes.length, motivo });
    } else {
      // Mesmo CPF pode ter mais de um registro elegível (produtos diferentes);
      // anexa em todos — o documento é do cliente, não da linha.
      for (const r of porCpf.get(cpf)) {
        const item = { alvo: r, nomeArquivo, tipo, contrato, blob, tamanho: bytes.length, metodo };
        if (jaTem.has(`${r.id}|${tipo}|${nomeArquivo}`)) jaAnexados.push(item);
        else itens.push(item);
      }
    }
    onProgress(feitos, pdfEntries.length, `Analisando ${feitos}/${pdfEntries.length}…`);
  }

  const cpfsComArquivo = new Set([...itens, ...jaAnexados].map(i => normCPF(i.alvo.cpf)));
  const clientesSemArquivo = alvos.filter(r =>
    r.status === 'boleto_solicitado' && !cpfsComArquivo.has(normCPF(r.cpf)));

  return { itens, orfaos, jaAnexados, clientesSemArquivo };
}

/**
 * Executa o plano confirmado na conferência: sobe um PDF por vez e grava o
 * metadado. Item que falha não derruba o lote — volta na lista de falhas.
 */
export async function executarImportBoletos(itens, onProgress = () => {}) {
  const ok = [], falhas = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    onProgress(i, itens.length, it);
    try {
      await uploadBoletoDoc(it.alvo, it.tipo, it.blob, {
        contrato: it.contrato, nomeArquivo: it.nomeArquivo,
      });
      ok.push(it);
    } catch (e) {
      console.error('executarImportBoletos:', it.nomeArquivo, e);
      falhas.push({ ...it, erro: e?.message || 'erro desconhecido' });
    }
  }
  onProgress(itens.length, itens.length, null);
  return { ok, falhas };
}
