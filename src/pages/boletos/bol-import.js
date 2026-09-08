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

export async function bolOnImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const admin           = isAdmin();
  const empresaParceiro = empresaParceira();

  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch {
    handleError('Erro ao ler o arquivo.', null);
    return;
  }

  const ws    = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  const normStr = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s/]/g, '').trim();

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

  // Aceita os cabeçalhos do template novo E os da planilha original de boletos
  const iContrato = colIdx('contrato');
  const iNome     = colIdx('nome', 'nome completo');
  const iCpf      = colIdx('cpf', 'cpf/cnpj');
  const iEmail    = colIdx('email', 'e-mail', 'proposta');
  const iParcela  = colIdx('valor parcela', 'valor da parcela');
  const iSaldo    = colIdx('saldo devedor', 'saldo');
  const iTroco    = colIdx('troco');
  const iConvenio = colIdx('convenio', 'convênio', 'promotora');
  const iProduto  = colIdx('produto');
  const iObs      = colIdx('obs', 'observacoes', 'observações', 'observacoes ultimo status', 'observações ultimo status');
  const iEmp      = colIdx('empresa', 'empresa parceira');

  if (iCpf < 0 || iNome < 0) {
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
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const padCpf   = v => String(v).replace(/\D/g, '').padStart(11, '0');
  const cleanTxt = v => String(v ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  const seen  = new Set();
  const valid = [];
  const invalidos = [];

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cpfRaw = getVal(r, iCpf);
    const nome   = cleanTxt(getVal(r, iNome));
    if (!cpfRaw && !nome) continue;

    const cpf      = padCpf(cpfRaw);
    const contrato = cleanTxt(getVal(r, iContrato)) || null;
    const email    = cleanTxt(getVal(r, iEmail)) || null;
    const parcela  = parseMoney(getVal(r, iParcela));
    const saldo    = parseMoney(getVal(r, iSaldo));
    const troco    = parseMoney(getVal(r, iTroco));
    const convenio    = cleanTxt(getVal(r, iConvenio));
    const produtoRaw  = cleanTxt(getVal(r, iProduto));
    const produto     = canonProduto(produtoRaw);
    const obs      = cleanTxt(getVal(r, iObs)) || null;
    const empresa  = admin ? (cleanTxt(getVal(r, iEmp)) || 'Smart Consig') : empresaParceiro;

    let motivo = null;
    if (!cpf || cpf === '00000000000') motivo = 'CPF ausente ou inválido';
    else if (!nome)                    motivo = 'Sem nome';
    else if (saldo <= 0)               motivo = 'Sem saldo devedor';
    else if (!convenio)                motivo = 'Sem convênio';
    else if (!produtoRaw)              motivo = 'Sem produto';
    else if (!produto)                 motivo = `Produto não reconhecido: "${produtoRaw}"`;

    if (motivo) { invalidos.push({ cpf: cpfRaw || '—', nome: nome || '—', motivo }); continue; }

    // Mesma regra do banco: CPF repetido no mesmo produto não entra
    const dupKey = `${cpf}|${produto}`;
    if (seen.has(dupKey)) { invalidos.push({ cpf, nome, motivo: 'CPF duplicado no mesmo produto na planilha' }); continue; }
    seen.add(dupKey);

    valid.push({
      cpf, nome, email, contrato,
      valor_parcela: parcela, saldo_devedor: saldo, troco,
      convenio, produto, obs, empresa_parceira: empresa,
    });
  }

  if (valid.length === 0 && invalidos.length === 0) {
    toast('Nenhum registro encontrado na planilha.', 'err');
    return;
  }

  // Insere UM POR UM: o trigger de CPF pode recusar linhas específicas e
  // as demais precisam entrar mesmo assim, com relatório do que foi pulado
  let inserted = 0;
  const rejeitados = [];
  toast(`Importando ${valid.length} cliente${valid.length !== 1 ? 's' : ''}…`);

  for (const reg of valid) {
    const { error } = await insertBoleto(reg);
    if (error) rejeitados.push({ cpf: reg.cpf, nome: reg.nome, motivo: msgErroBanco(error) });
    else inserted++;
  }

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
