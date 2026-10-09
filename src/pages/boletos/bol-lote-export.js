// Exportar Lote ZIP (Fase 2): baixa num ZIP os boletos e faturas dos clientes
// do filtro atual (ou só dos selecionados), uma pasta por cliente
// ("NOME - CPF/boletos|faturas/arquivo.pdf") + resumo.xlsx. Parceiro e admin.
// Só LÊ: o banco/Storage já limitam o parceiro aos próprios clientes.
// fflate carrega sob demanda (import dinâmico), como na importação de lote.
import * as XLSX from 'xlsx';
import { toast } from '../../utils/ui.js';
import { dsImportReport } from '../../components/ds/index.js';
import { baixarBoletoDocBytes } from '../../services/boleto-docs-svc.js';
import { BO, filtered, fmtCpf, isAdmin } from './bol-core.js';
import { BOL_STATUS } from './bol-linha.js';
import { RESPALDO_HEADERS, respaldoCols } from './bol-respaldo-cols.js';

const _limpa = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const _dm = iso => (iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) : '');

function _nomeZip() {
  const quem = isAdmin() ? (BO.empresaFiltro || 'todas-empresas') : (BO.registros[0]?.empresa_parceira || 'parceiro');
  const periodo = BO.dateFrom || BO.dateTo ? `${_dm(BO.dateFrom) || 'inicio'}_a_${_dm(BO.dateTo) || 'hoje'}` : 'todo-periodo';
  return `lote_${_limpa(quem).replace(/ /g, '-')}_${periodo}.zip`;
}

// Monta a lista de arquivos (sem baixar): um item por documento, sem repetir o mesmo arquivo do Storage
function _plano(clientes) {
  const vistos = new Set();
  const itens = [];
  for (const r of clientes) {
    const pasta = `${_limpa(r.nome) || 'SEM NOME'} - ${String(r.cpf || '').replace(/\D/g, '')}`;
    const usados = new Set();
    for (const d of BO.docs.get(r.id) || []) {
      if (vistos.has(d.storage_path)) continue;
      vistos.add(d.storage_path);
      const original = _limpa(d.nome_arquivo) || 'documento.pdf';
      let nome = original;
      for (let i = 2; usados.has(nome); i++) nome = original.replace(/(\.pdf)?$/i, ` (${i})$1`);
      usados.add(nome);
      itens.push({ r, d, caminho: `${pasta}/${d.tipo === 'fatura' ? 'faturas' : 'boletos'}/${nome}` });
    }
  }
  return itens;
}

function _resumoXlsx(clientes) {
  const linhas = clientes.map(r => {
    const docs = BO.docs.get(r.id) || [];
    return [r.nome, fmtCpf(r.cpf), r.convenio || '', r.produto || '', r.empresa_parceira || '', BOL_STATUS[r.status]?.label || r.status,
      r.contrato || '', docs.filter(d => d.tipo === 'boleto').length, docs.filter(d => d.tipo === 'fatura').length,
      ...respaldoCols(r)];
  });
  const ws = XLSX.utils.aoa_to_sheet([['CLIENTE', 'CPF', 'CONVÊNIO', 'PRODUTO', 'EMPRESA', 'STATUS', 'CONTRATO', 'BOLETOS', 'FATURAS', ...RESPALDO_HEADERS], ...linhas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function _zipar(arquivos) {
  return import('fflate').then(({ zip }) => new Promise((res, rej) =>
    zip(arquivos, { level: 0 }, (err, data) => (err ? rej(err) : res(data)))));
}

function _baixar(bytes, nome) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function _gerar(itens, clientes, progresso) {
  const arquivos = {};
  const falhas = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    try { arquivos[it.caminho] = await baixarBoletoDocBytes(it.d.storage_path); } catch (e) {
      falhas.push({ titulo: it.r.nome, detalhe: `${it.d.nome_arquivo}: ${e?.message || 'não baixou'}` });
    }
    progresso(i + 1, itens.length, 'Baixando');
  }
  arquivos['resumo.xlsx'] = _resumoXlsx(clientes);
  _baixar(await _zipar(arquivos), _nomeZip());
  return { gravados: itens.length - falhas.length, falhas };
}

/** Abre a conferência e, confirmando, gera e baixa o ZIP. opts.selecionados = só as linhas marcadas. */
export async function bolExportarLote({ selecionados = false } = {}) {
  const base = selecionados ? filtered().filter(r => BO.sel.has(r.id)) : filtered();
  const clientes = base.filter(r => (BO.docs.get(r.id) || []).length);
  const semDocs = base.filter(r => !(BO.docs.get(r.id) || []).length);
  if (!clientes.length) { toast('Nenhum cliente com boleto ou fatura anexado neste filtro.', 'warn'); return; }
  const itens = _plano(clientes);
  await dsImportReport({
    eyebrow: 'Exportar lote ZIP', title: _nomeZip(),
    sub: selecionados ? 'Só os clientes selecionados' : 'Clientes do filtro atual (período, status e busca)',
    resumo: [{ n: clientes.length, label: 'clientes com documentos', tone: 'ok' }, { n: itens.length, label: 'documentos', tone: 'ok' },
      { n: semDocs.length, label: 'sem documento (fora do ZIP)', tone: semDocs.length ? 'warn' : 'ok' }],
    grupos: [{ label: 'Sem documento anexado', itens: semDocs.map(r => ({ titulo: r.nome, detalhe: BOL_STATUS[r.status]?.label })) }],
    okLabel: `Baixar ZIP com ${itens.length} documentos`, rotuloOk: 'documentos no ZIP',
    gravar: progresso => _gerar(itens, clientes, progresso),
  });
}
