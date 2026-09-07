// Importadores da Liberação de Margem: planilha de clientes (com detecção de
// linha verde e normalização de empresa) e planilha de acerto (por CPF).
import { sb } from '../../services/supabase.js';
import { toast, handleError } from '../../utils/ui.js';
import * as XLSX from 'xlsx';
import { S, isAdmin, empresaParceira, fmtDate } from './lib-core.js';
import { reloadAndRender } from './lib-tabela.js';
import { libFecharModal } from './lib-modais.js';

// ── Erro: planilha no modelo antigo (sem Convênio/Produto) ─────────────────
function _mostrarErroModelo() {
  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Modelo antigo detectado</h2>
    <p style="font-size:.9rem;line-height:1.5;color:var(--text)">
      Esta planilha não contém as colunas <strong>CONVÊNIO</strong> e <strong>PRODUTO</strong>,
      que agora são obrigatórias. A importação foi cancelada.
    </p>
    <p style="font-size:.9rem;line-height:1.5;color:var(--muted);margin-top:8px">
      Baixe o <strong>novo modelo</strong>, preencha o convênio e o produto de todos os clientes
      e importe novamente.
    </p>
    <div class="lib-modal-actions" style="margin-top:20px">
      <a class="lib-btn-save" href="/template_liberacao.xlsx" download="TEMPLATE_LIBERACAO.xlsx" style="text-decoration:none">Baixar novo modelo</a>
      <button class="lib-btn-cancel" onclick="libFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) libFecharModal(); };
}

// ── Importar Planilha ─────────────────────────────────────────────────────
export function libImportarPlanilha() {
  document.getElementById('lib-import-input')?.click();
}

export async function libOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const admin          = isAdmin();
  const empresaParceiro = empresaParceira();
  const hoje           = new Date().toISOString().slice(0, 10);

  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true, cellStyles: true });
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return;
  }

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Lê cabeçalhos da linha 1
  const normStr = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();

  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v ? normStr(cell.v) : '');
  }

  const colIdx = (...names) => {
    for (const n of names) {
      const idx = headers.indexOf(normStr(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iCpf    = colIdx('cpf');
  const iNome   = colIdx('nome', 'nome completo');
  const iEmp    = colIdx('empresa', 'empresa parceira');
  const iSd     = colIdx('saldo devedor', 'saldo devedor r');
  const iTroco  = colIdx('troco', 'troco r');
  const iAcerto = colIdx('acerto');
  const iDq     = colIdx('data quitado');
  const iObs    = colIdx('obs', 'observacoes', 'observações');
  const iConvenio = colIdx('convenio', 'convênio');
  const iProduto  = colIdx('produto');

  // Bloqueia modelo antigo (sem as colunas obrigatórias Convênio/Produto)
  if (iConvenio < 0 || iProduto < 0) {
    _mostrarErroModelo();
    return;
  }

  const getVal = (r, colI) => {
    if (colI < 0) return undefined;
    return ws[XLSX.utils.encode_cell({ r, c: colI })]?.v;
  };

  const parseMoney = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    // Remove R$, espaços (incl. NBSP), letras e qualquer símbolo — mantém só dígitos, vírgula, ponto e sinal
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const padCpf = v => String(v).replace(/\D/g, '').padStart(11, '0');

  const parseDate = v => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  };

  // Detecta linha verde pela cor FF00B050 (verde padrão do template)
  const isGreenRow = r => {
    for (let c = range.s.c; c <= Math.min(range.e.c, 4); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const rgb  = (cell?.s?.fgColor?.rgb || cell?.s?.bgColor?.rgb || '').toUpperCase();
      if (rgb.includes('00B050')) return true;
    }
    return false;
  };

  // Normaliza nome da empresa para bater com os grupos do sistema
  const normalizeEmpresa = v => {
    if (!v) return 'Smart Consig';
    const s = String(v).toLowerCase();
    if (s.includes('smart'))                          return 'Smart Consig';
    if (s.includes('vital'))                          return 'Vital Cred';
    if (s.includes('rz') || s.includes('r z'))        return 'RZ Cred';
    if (s.includes('cred vale') || s.includes('credvale')) return 'Cred Vale';
    if (s.includes('tem cred') || s.includes('temcred'))   return 'Tem Credito';
    if (s.includes('alg'))                            return 'ALG Promotora';
    if (s.includes('neg'))                            return 'Negócio Certo';
    if (s.includes('pnl'))                            return 'PNL Credito';
    if (s.includes('ita'))                            return 'ITA Promotora';
    return String(v).trim();
  };

  const seen   = new Set();
  const valid  = [];
  let skipped  = 0;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cpfRaw = getVal(r, iCpf);
    const nome   = String(getVal(r, iNome) || '').trim();
    if (!cpfRaw && !nome) continue;

    const cpf    = padCpf(cpfRaw);
    const sd     = parseMoney(getVal(r, iSd));
    const troco  = parseMoney(getVal(r, iTroco));
    const obs      = String(getVal(r, iObs) || '').trim() || null;
    const convenio = String(getVal(r, iConvenio) || '').trim();
    const produto  = String(getVal(r, iProduto)  || '').trim();
    const acerto = parseDate(getVal(r, iAcerto));
    const dq     = parseDate(getVal(r, iDq)) || hoje;
    const aprovado = isGreenRow(r);
    const empresa  = admin ? normalizeEmpresa(getVal(r, iEmp)) : empresaParceiro;

    if (!cpf || cpf === '00000000000' || !nome || sd <= 0 || !convenio || !produto) { skipped++; continue; }

    const dupKey = `${cpf}|${sd}`;
    if (seen.has(dupKey)) { skipped++; continue; }
    seen.add(dupKey);

    valid.push({ cpf, nome, convenio, produto, empresa_parceira: empresa, saldo_devedor: sd, troco, data_quitado: dq, acerto, obs, aprovado });
  }

  if (valid.length === 0) {
    toast('Nenhum registro válido encontrado na planilha.', 'err');
    return;
  }

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const { error } = await sb.from('liberacao_margem_master').insert(valid.slice(i, i + BATCH));
    if (error) { handleError('Erro ao importar planilha.', error); return; }
    inserted += valid.slice(i, i + BATCH).length;
  }

  const msg = skipped > 0
    ? `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''}, ${skipped} ignorado${skipped !== 1 ? 's' : ''}.`
    : `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''} com sucesso!`;
  toast(msg);

  await reloadAndRender();
}

// ── Importar Acerto ────────────────────────────────────────────────────────
export function libImportarAcerto() {
  document.getElementById('lib-import-acerto-input')?.click();
}

export async function libOnImportAcertoFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return;
  }

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const hoje  = new Date().toISOString().slice(0, 10);

  const padCpf = v => String(v).replace(/\D/g, '').padStart(11, '0');

  // Coleta CPFs únicos da planilha (pula cabeçalho linha 0)
  const seenPlan  = new Set();
  const cpfsList  = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: range.s.c })];
    if (!cell?.v) continue;
    const cpf = padCpf(cell.v);
    if (cpf === '00000000000') continue;
    if (seenPlan.has(cpf)) continue;
    seenPlan.add(cpf);
    cpfsList.push(cpf);
  }

  if (cpfsList.length === 0) {
    toast('Nenhum CPF encontrado na planilha.', 'err');
    return;
  }

  // Monta índice por CPF a partir dos registros já carregados em memória
  const byCpf = {};
  for (const r of S.registros) {
    const c = padCpf(r.cpf || '');
    (byCpf[c] = byCpf[c] || []).push(r);
  }

  const toUpdate   = [];
  const pulados    = [];

  for (const cpf of cpfsList) {
    const matches = byCpf[cpf] || [];
    const ok      = matches.filter(m => m.aprovado);

    if (ok.length === 0) {
      pulados.push({ cpf, motivo: matches.length === 0 ? 'Não encontrado no sistema' : 'Não está OK' });
      continue;
    }
    if (ok.length > 1) {
      pulados.push({ cpf, motivo: 'Ambíguo (' + ok.length + ' registros OK com mesmo CPF)' });
      continue;
    }
    if (ok[0].acerto) {
      pulados.push({ cpf, nome: ok[0].nome, motivo: 'Já tinha acerto (' + fmtDate(ok[0].acerto) + ')' });
      continue;
    }
    toUpdate.push(ok[0]);
  }

  if (toUpdate.length === 0) {
    toast('Nenhum cliente elegível para atualização de acerto.', 'err');
    _mostrarResultadoAcerto([], pulados, hoje);
    return;
  }

  // Atualiza no Supabase em lote (um por um para segurança)
  let ok = 0;
  for (const reg of toUpdate) {
    const { error } = await sb
      .from('liberacao_margem_master')
      .update({ acerto: hoje })
      .eq('id', reg.id);
    if (error) { pulados.push({ cpf: reg.cpf, nome: reg.nome, motivo: 'Erro ao salvar: ' + error.message }); }
    else { reg.acerto = hoje; ok++; }
  }

  await reloadAndRender();

  _mostrarResultadoAcerto(toUpdate.slice(0, ok), pulados, hoje);
}

function _mostrarResultadoAcerto(atualizados, pulados, hoje) {
  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  const fmtCpf = c => String(c).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const dataFmt = hoje.split('-').reverse().join('/');

  content.innerHTML = `
    <h2 class="lib-modal-title">Resultado — Importar Acerto</h2>
    <div style="margin-bottom:16px">
      <span class="lib-badge-ok" style="font-size:.9rem">✓ ${atualizados.length} atualizado${atualizados.length !== 1 ? 's' : ''} com ${dataFmt}</span>
      ${pulados.length ? `&nbsp;<span class="lib-badge-pen" style="font-size:.9rem">${pulados.length} pulado${pulados.length !== 1 ? 's' : ''}</span>` : ''}
    </div>
    ${pulados.length ? `
      <div style="margin-bottom:8px;font-size:.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Pulados</div>
      <div style="max-height:260px;overflow-y:auto;font-size:.82rem;border:1px solid var(--border);border-radius:6px">
        <table style="width:100%;border-collapse:collapse">
          ${pulados.map(p => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px 10px;font-family:monospace">${fmtCpf(p.cpf)}</td>
              <td style="padding:6px 10px;color:var(--muted)">${p.nome || '—'}</td>
              <td style="padding:6px 10px;color:var(--muted)">${p.motivo}</td>
            </tr>`).join('')}
        </table>
      </div>` : ''}
    <div class="lib-modal-actions" style="margin-top:20px">
      <button class="lib-btn-save" onclick="libFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) libFecharModal(); };
}
