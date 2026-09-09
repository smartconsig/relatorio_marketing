// Importação de planilha da Quitação de Boleto. Aceita os cabeçalhos do
// template novo E os da planilha original; insere UM POR UM porque o trigger
// de CPF pode recusar linhas específicas (relatório do que foi pulado).
import * as XLSX from 'xlsx';
import { toast, handleError } from '../../utils/ui.js';
import { canonProduto, msgErroBanco, insertBoleto } from '../../services/boletos-svc.js';
import { isAdmin, empresaParceira, esc } from './bol-core.js';
import { reloadAndRender } from './bol-tabela.js';
import { bolFecharModal } from './bol-modais.js';

export function bolImportarPlanilha() {
  document.getElementById('bol-import-input')?.click();
}

// ── Helpers puros do parser (mesma lógica que vivia dentro da função) ──────
const _normStrBol = s => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s/]/g, '').trim();

const _padCpf   = v => String(v).replace(/\D/g, '').padStart(11, '0');
const _cleanTxt = v => String(v ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const _parseMoney = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

const _getVal = (ws, r, colI) => {
  if (colI < 0) return undefined;
  return ws[XLSX.utils.encode_cell({ r, c: colI })]?.v;
};

function _lerCabecalhosBol(ws, range) {
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v ? _normStrBol(cell.v) : '');
  }
  return headers;
}

// Aceita os cabeçalhos do template novo E os da planilha original de boletos
function _mapearColunasBol(headers) {
  const colIdx = (...names) => {
    for (const n of names) {
      const idx = headers.indexOf(_normStrBol(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return {
    iContrato: colIdx('contrato'),
    iNome:     colIdx('nome', 'nome completo'),
    iCpf:      colIdx('cpf', 'cpf/cnpj'),
    iEmail:    colIdx('email', 'e-mail', 'proposta'),
    iParcela:  colIdx('valor parcela', 'valor da parcela'),
    iSaldo:    colIdx('saldo devedor', 'saldo'),
    iTroco:    colIdx('troco'),
    iConvenio: colIdx('convenio', 'convênio', 'promotora'),
    iProduto:  colIdx('produto'),
    iObs:      colIdx('obs', 'observacoes', 'observações', 'observacoes ultimo status', 'observações ultimo status'),
    iEmp:      colIdx('empresa', 'empresa parceira'),
  };
}

// Converte a linha r num candidato; null para linha vazia. cpfRaw/produtoRaw
// ficam junto só para as mensagens de motivo — saem antes do insert.
function _linhaParaCandidatoBol(plan, r) {
  const { ws, cols } = plan;
  const cpfRaw = _getVal(ws, r, cols.iCpf);
  const nome   = _cleanTxt(_getVal(ws, r, cols.iNome));
  if (!cpfRaw && !nome) return null;

  const produtoRaw = _cleanTxt(_getVal(ws, r, cols.iProduto));
  return {
    cpfRaw, produtoRaw,
    cpf:  _padCpf(cpfRaw),
    nome,
    email:    _cleanTxt(_getVal(ws, r, cols.iEmail)) || null,
    contrato: _cleanTxt(_getVal(ws, r, cols.iContrato)) || null,
    valor_parcela: _parseMoney(_getVal(ws, r, cols.iParcela)),
    saldo_devedor: _parseMoney(_getVal(ws, r, cols.iSaldo)),
    troco:         _parseMoney(_getVal(ws, r, cols.iTroco)),
    convenio: _cleanTxt(_getVal(ws, r, cols.iConvenio)),
    produto:  canonProduto(produtoRaw),
    obs: _cleanTxt(_getVal(ws, r, cols.iObs)) || null,
    empresa_parceira: plan.admin ? (_cleanTxt(_getVal(ws, r, cols.iEmp)) || 'Smart Consig') : plan.empresaParceiro,
  };
}

// Mesmas regras e mensagens de descarte, na mesma ordem
function _motivoInvalido(c) {
  if (!c.cpf || c.cpf === '00000000000') return 'CPF ausente ou inválido';
  if (!c.nome)              return 'Sem nome';
  if (c.saldo_devedor <= 0) return 'Sem saldo devedor';
  if (!c.convenio)          return 'Sem convênio';
  if (!c.produtoRaw)        return 'Sem produto';
  if (!c.produto)           return `Produto não reconhecido: "${c.produtoRaw}"`;
  return null;
}

function _coletarLinhasBol(plan) {
  const seen  = new Set();
  const valid = [];
  const invalidos = [];

  for (let r = plan.range.s.r + 1; r <= plan.range.e.r; r++) {
    const c = _linhaParaCandidatoBol(plan, r);
    if (!c) continue;

    const motivo = _motivoInvalido(c);
    if (motivo) { invalidos.push({ cpf: c.cpfRaw || '—', nome: c.nome || '—', motivo }); continue; }

    // Mesma regra do banco: CPF repetido no mesmo produto não entra
    const dupKey = `${c.cpf}|${c.produto}`;
    if (seen.has(dupKey)) { invalidos.push({ cpf: c.cpf, nome: c.nome, motivo: 'CPF duplicado no mesmo produto na planilha' }); continue; }
    seen.add(dupKey);

    const { cpfRaw: _1, produtoRaw: _2, ...reg } = c;
    valid.push(reg);
  }
  return { valid, invalidos };
}

// Insere UM POR UM: o trigger de CPF pode recusar linhas específicas e
// as demais precisam entrar mesmo assim, com relatório do que foi pulado
async function _inserirUmAUm(valid) {
  let inserted = 0;
  const rejeitados = [];
  for (const reg of valid) {
    const { error } = await insertBoleto(reg);
    if (error) rejeitados.push({ cpf: reg.cpf, nome: reg.nome, motivo: msgErroBanco(error) });
    else inserted++;
  }
  return { inserted, rejeitados };
}

// Lê o Excel; null (com erro já mostrado) se o arquivo for ilegível.
async function _lerWorkbookBol(file) {
  try {
    const buf = await file.arrayBuffer();
    return XLSX.read(buf, { type: 'array', cellDates: true });
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return null;
  }
}

export async function bolOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const wb = await _lerWorkbookBol(file);
  if (!wb) return;

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cols  = _mapearColunasBol(_lerCabecalhosBol(ws, range));

  if (cols.iCpf < 0 || cols.iNome < 0) {
    _mostrarErroModelo();
    return;
  }

  const plan = { ws, range, cols, admin: isAdmin(), empresaParceiro: empresaParceira() };
  const { valid, invalidos } = _coletarLinhasBol(plan);

  if (valid.length === 0 && invalidos.length === 0) {
    toast('Nenhum registro encontrado na planilha.', 'err');
    return;
  }

  toast(`Importando ${valid.length} cliente${valid.length !== 1 ? 's' : ''}…`);
  const { inserted, rejeitados } = await _inserirUmAUm(valid);

  await reloadAndRender();

  _mostrarResultadoImport(inserted, [...rejeitados, ...invalidos]);
}

function _mostrarErroModelo() {
  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Planilha fora do modelo</h2>
    <p style="font-size:.9rem;line-height:1.5;color:var(--text)">
      Esta planilha não contém as colunas mínimas <strong>CPF</strong> e <strong>NOME</strong>.
      A importação foi cancelada.
    </p>
    <p style="font-size:.9rem;line-height:1.5;color:var(--muted);margin-top:8px">
      Baixe o <strong>modelo</strong>, preencha os dados dos clientes e importe novamente.
    </p>
    <div class="lib-modal-actions" style="margin-top:20px">
      <a class="lib-btn-save" href="/template_boletos.xlsx" download="TEMPLATE_BOLETOS.xlsx" style="text-decoration:none">Baixar modelo</a>
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}

function _mostrarResultadoImport(inserted, pulados) {
  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) {
    toast(`${inserted} importado${inserted !== 1 ? 's' : ''}, ${pulados.length} pulado${pulados.length !== 1 ? 's' : ''}.`);
    return;
  }

  content.innerHTML = `
    <h2 class="lib-modal-title">Resultado da Importação</h2>
    <div style="margin-bottom:16px">
      <span class="lib-badge-ok" style="font-size:.9rem">✓ ${inserted} importado${inserted !== 1 ? 's' : ''}</span>
      ${pulados.length ? `&nbsp;<span class="lib-badge-pen" style="font-size:.9rem">${pulados.length} pulado${pulados.length !== 1 ? 's' : ''}</span>` : ''}
    </div>
    ${pulados.length ? `
      <div style="margin-bottom:8px;font-size:.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Pulados</div>
      <div style="max-height:260px;overflow-y:auto;font-size:.82rem;border:1px solid var(--border);border-radius:6px">
        <table style="width:100%;border-collapse:collapse">
          ${pulados.map(p => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px 10px;font-family:monospace">${esc(p.cpf)}</td>
              <td style="padding:6px 10px;color:var(--muted)">${esc(p.nome || '—')}</td>
              <td style="padding:6px 10px;color:var(--muted)">${esc(p.motivo)}</td>
            </tr>`).join('')}
        </table>
      </div>` : ''}
    <div class="lib-modal-actions" style="margin-top:20px">
      <button class="lib-btn-save" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}
