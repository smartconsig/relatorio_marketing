// ── Resíduos — serviço ──────────────────────────────────────────────────────
// Clientes vindos da Quitação de Boleto que têm resíduo a pagar.
// Arquivos (boletos/faturas) vivem no bucket privado residuos-docs (Storage);
// o banco guarda apenas metadados (residuo_docs). Status muda só por RPC
// (migration 011_residuos.sql).
import { sb } from './supabase.js';
import { state } from '../state.js';
import { normCPF } from '../utils/cpf.js';

const BUCKET = 'residuos-docs';

// ── Dados ───────────────────────────────────────────────────────────────────

export async function loadResiduos() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('residuos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (data?.length) all.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function loadResiduoDocs() {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('residuo_docs')
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

export async function enviarParaResiduo(boletoId) {
  const { data, error } = await sb.rpc('boleto_para_residuo', { p_boleto_id: boletoId });
  if (error) throw error;
  return data;
}

export async function marcarResiduoPago(id, valor = null) {
  const { data, error } = await sb.rpc('residuo_marcar_pago', { p_id: id, p_valor: valor });
  if (error) throw error;
  return data;
}

export async function salvarObsResiduo(id, obs) {
  const { error } = await sb.from('residuos').update({ obs }).eq('id', id);
  if (error) throw error;
}

// Excluir (admin): remove os arquivos do Storage e a linha; o trigger no banco
// tira a marca em_residuo do boleto de origem.
export async function excluirResiduo(residuo, docs) {
  const paths = (docs || []).map(d => d.storage_path).filter(Boolean);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const { error } = await sb.from('residuos').delete().eq('id', residuo.id);
  if (error) throw error;
}

// ── Documentos ──────────────────────────────────────────────────────────────

function _safeName(nome) {
  return String(nome || 'arquivo.pdf')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120);
}

export async function uploadResiduoDoc(residuo, tipo, file, { contrato = null, nomeArquivo = null } = {}) {
  const nome = nomeArquivo || file.name;
  const path = `${residuo.cpf}/${tipo}s/${_safeName(nome)}`;

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data, error } = await sb
    .from('residuo_docs')
    .upsert({
      residuo_id:   residuo.id,
      cpf:          residuo.cpf,
      tipo,
      contrato,
      storage_path: path,
      nome_arquivo: nome,
      tamanho:      file.size ?? null,
      uploaded_by:  state.currentUser?.id || null,
    }, { onConflict: 'residuo_id,tipo,nome_arquivo', ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getResiduoDocUrl(path, downloadName = null) {
  const opts = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, opts);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteResiduoDoc(doc) {
  await sb.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await sb.from('residuo_docs').delete().eq('id', doc.id);
  if (error) throw error;
}

// ── Análise do ZIP (roda inteira no navegador, nada é gravado aqui) ─────────
//
// Formatos reais dos lotes (verificados no "lote 07"):
//   • Boletos: pasta raiz = CPF (11 dígitos) / subpasta = contrato / Boleto_*.pdf
//   • Faturas: arquivo solto "NOME DO CLIENTE - 9999.pdf" (9999 = final do
//     CARTÃO, não do CPF). O CPF verdadeiro está no TEXTO do PDF — é dele que
//     o casamento primário é feito; nome normalizado é o fallback.

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
 * Lê o ZIP e propõe o casamento de cada PDF com um cliente da tela.
 * @param {File} file - o .zip
 * @param {Array} residuos - linhas atuais da tabela residuos
 * @param {Array} docsExistentes - linhas atuais de residuo_docs (para dedupe)
 * @param {Function} onProgress - (feitos, total, etapa) para a barra do modal
 * @returns {{ itens, orfaos, jaAnexados, ignorados, clientesSemArquivo }}
 */
export async function analisarZip(file, residuos, docsExistentes, onProgress = () => {}) {
  const { unzip } = await import('fflate');

  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise((resolve, reject) => {
    unzip(buf, (err, data) => err ? reject(err) : resolve(data));
  });

  const porCpf = new Map();
  for (const r of residuos) {
    const cpf = normCPF(r.cpf);
    if (!porCpf.has(cpf)) porCpf.set(cpf, []);
    porCpf.get(cpf).push(r);
  }
  const nomes = residuos.map(r => ({ r, tokens: _normNome(r.nome).split(' ') }));

  const jaTem = new Set((docsExistentes || []).map(d => `${d.residuo_id}|${d.tipo}|${d.nome_arquivo}`));

  const pdfEntries = Object.entries(entries).filter(([path, bytes]) =>
    !path.endsWith('/') && bytes?.length > 0 && /\.pdf$/i.test(path));

  const itens = [], orfaos = [], jaAnexados = [], ignorados = [];
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
      else motivo = 'CPF não está na tela de Resíduos';
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
        motivo = 'PDF cita mais de um cliente da tela';
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
            ? 'CPF do PDF não está na tela de Resíduos'
            : (cpfsCand.length > 1 ? 'Nome bate com mais de um cliente' : 'Sem CPF legível e nome não encontrado');
        }
      }
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });

    if (!cpf) {
      orfaos.push({ path, nomeArquivo, tipo, contrato, blob, tamanho: bytes.length, motivo });
    } else {
      // Mesmo CPF pode ter mais de um registro em resíduo (boletos diferentes);
      // anexa em todos — o documento é do cliente, não da linha.
      for (const r of porCpf.get(cpf)) {
        const item = { residuo: r, nomeArquivo, tipo, contrato, blob, tamanho: bytes.length, metodo };
        if (jaTem.has(`${r.id}|${tipo}|${nomeArquivo}`)) jaAnexados.push(item);
        else itens.push(item);
      }
    }
    onProgress(feitos, pdfEntries.length, `Analisando ${feitos}/${pdfEntries.length}…`);
  }

  const cpfsComArquivo = new Set([...itens, ...jaAnexados].map(i => normCPF(i.residuo.cpf)));
  const clientesSemArquivo = residuos.filter(r =>
    r.status === 'residuo_solicitado' && !cpfsComArquivo.has(normCPF(r.cpf)));

  return { itens, orfaos, jaAnexados, ignorados, clientesSemArquivo };
}

/**
 * Executa o plano confirmado na conferência: sobe um PDF por vez e grava o
 * metadado. Item que falha não derruba o lote — volta na lista de falhas.
 */
export async function executarImport(itens, onProgress = () => {}) {
  const ok = [], falhas = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    onProgress(i, itens.length, it);
    try {
      await uploadResiduoDoc(it.residuo, it.tipo, it.blob, {
        contrato: it.contrato, nomeArquivo: it.nomeArquivo,
      });
      ok.push(it);
    } catch (e) {
      console.error('executarImport:', it.nomeArquivo, e);
      falhas.push({ ...it, erro: e?.message || 'erro desconhecido' });
    }
  }
  onProgress(itens.length, itens.length, null);
  return { ok, falhas };
}
