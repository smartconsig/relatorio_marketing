// Importadores da Liberação de Margem: planilha de clientes (com detecção de
// linha verde e normalização de empresa) e planilha de acerto (por CPF).
import { insertLiberacoes, updateLiberacao } from '../../services/liberacao-svc.js';
import { toast, handleError } from '../../utils/ui.js';
import * as XLSX from 'xlsx';
import { S, isAdmin, empresaParceira, fmtDate } from './lib-core.js';
import { reloadAndRender } from './lib-tabela.js';
import { libFecharModal } from './lib-modais.js';
import { padCpf, lerCabecalhos, mapearColunas, coletarLinhas } from './lib-import-parse.js';

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

// Insere em fatias de 500; devolve o total inserido, ou -1 se deu erro.
async function _inserirLotes(valid) {
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const { error } = await insertLiberacoes(valid.slice(i, i + BATCH));
    if (error) { handleError('Erro ao importar planilha.', error); return -1; }
    inserted += valid.slice(i, i + BATCH).length;
  }
  return inserted;
}

function _msgImportacao(inserted, skipped) {
  return skipped > 0
    ? `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''}, ${skipped} ignorado${skipped !== 1 ? 's' : ''}.`
    : `${inserted} cliente${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''} com sucesso!`;
}

// Lê o Excel; null (com erro já mostrado) se o arquivo for ilegível.
async function _lerWorkbook(file, opts) {
  try {
    const buf = await file.arrayBuffer();
    return XLSX.read(buf, opts);
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return null;
  }
}

export async function libOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const wb = await _lerWorkbook(file, { type: 'array', cellDates: true, cellStyles: true });
  if (!wb) return;

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cols  = mapearColunas(lerCabecalhos(ws, range));

  // Bloqueia modelo antigo (sem as colunas obrigatórias Convênio/Produto)
  if (cols.iConvenio < 0 || cols.iProduto < 0) {
    _mostrarErroModelo();
    return;
  }

  const plan = {
    ws, range, cols,
    admin: isAdmin(),
    empresaParceiro: empresaParceira(),
    hoje: new Date().toISOString().slice(0, 10),
  };
  const { valid, skipped } = coletarLinhas(plan);

  if (valid.length === 0) {
    toast('Nenhum registro válido encontrado na planilha.', 'err');
    return;
  }

  const inserted = await _inserirLotes(valid);
  if (inserted < 0) return;

  toast(_msgImportacao(inserted, skipped));
  await reloadAndRender();
}

// ── Importar Acerto ────────────────────────────────────────────────────────
export function libImportarAcerto() {
  document.getElementById('lib-import-acerto-input')?.click();
}

// Coleta CPFs únicos da planilha (pula cabeçalho linha 0)
function _lerCpfsDaPlanilha(ws, range) {
  const seenPlan = new Set();
  const cpfsList = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: range.s.c })];
    if (!cell?.v) continue;
    const cpf = padCpf(cell.v);
    if (cpf === '00000000000') continue;
    if (seenPlan.has(cpf)) continue;
    seenPlan.add(cpf);
    cpfsList.push(cpf);
  }
  return cpfsList;
}

// Monta índice por CPF a partir dos registros já carregados em memória
function _indexarRegistrosPorCpf() {
  const byCpf = {};
  for (const r of S.registros) {
    const c = padCpf(r.cpf || '');
    (byCpf[c] = byCpf[c] || []).push(r);
  }
  return byCpf;
}

// Decide, CPF a CPF, quem recebe o acerto e quem é pulado (com o motivo).
function _classificarAcertos(cpfsList, byCpf) {
  const toUpdate = [];
  const pulados  = [];

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
  return { toUpdate, pulados };
}

// Atualiza no Supabase em lote (um por um para segurança); devolve os salvos.
async function _aplicarAcertos(toUpdate, pulados, hoje) {
  let ok = 0;
  for (const reg of toUpdate) {
    const { error } = await updateLiberacao(reg.id, { acerto: hoje });
    if (error) { pulados.push({ cpf: reg.cpf, nome: reg.nome, motivo: 'Erro ao salvar: ' + error.message }); }
    else { reg.acerto = hoje; ok++; }
  }
  return ok;
}

export async function libOnImportAcertoFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const wb = await _lerWorkbook(file, { type: 'array' });
  if (!wb) return;

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const hoje  = new Date().toISOString().slice(0, 10);

  const cpfsList = _lerCpfsDaPlanilha(ws, range);
  if (cpfsList.length === 0) {
    toast('Nenhum CPF encontrado na planilha.', 'err');
    return;
  }

  const { toUpdate, pulados } = _classificarAcertos(cpfsList, _indexarRegistrosPorCpf());

  if (toUpdate.length === 0) {
    toast('Nenhum cliente elegível para atualização de acerto.', 'err');
    _mostrarResultadoAcerto([], pulados, hoje);
    return;
  }

  const ok = await _aplicarAcertos(toUpdate, pulados, hoje);

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
