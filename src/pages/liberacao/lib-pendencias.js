// Importar Pendências (Fase 3, só Smart/admin): planilha "LIBERAÇÃO MARGEM GERAL
// … TRATADA", aba PENDENCIA — CPF, Empresa, Nome, Convenio, Pendencia Credcesta,
// Pendencia Mfacil (qualquer coluna "Pendencia X" vira "X: texto").
// Regras do responsável: a pendência explica por que a margem não liberou e é
// ACRESCENTADA ao fim da observação ("obs antiga · Credcesta: … · Mfacil: …").
// CPF perde o zero à esquerda no Excel → completa até 11 dígitos.
// Grava nas linhas do CPF que ainda não estão OK. Nada é gravado antes da conferência.
import * as XLSX from 'xlsx';
import { toast } from '../../utils/ui.js';
import { dsImportReport } from '../../components/ds/index.js';
import { updateLiberacao } from '../../services/liberacao-svc.js';
import { S, isAdmin } from './lib-core.js';

const _norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const _cpf = v => String(v ?? '').replace(/\D/g, '').padStart(11, '0');
const _cpfOk = c => /^\d{11}$/.test(c) && c !== '00000000000';
const _titulo = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

export function libImportarPendencias() {
  if (!isAdmin()) { toast('Só a Smart importa as pendências.', 'err'); return; }
  const inp = document.getElementById('lib-pendencias-input');
  if (inp) { inp.value = ''; inp.click(); }
}

// Aba com CPF + ao menos uma coluna "PENDENCIA …" (de preferência a "PENDENCIA")
function _lerLinhas(wb) {
  const abas = [...wb.SheetNames].sort((a, b) => (_norm(b) === 'PENDENCIA') - (_norm(a) === 'PENDENCIA'));
  for (const nome of abas) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' });
    const idx = rows.findIndex(r => r.map(_norm).includes('CPF') && r.some(h => _norm(h).startsWith('PENDENCIA')));
    if (idx < 0) continue;
    const cab = rows[idx].map(_norm);
    const iCpf = cab.indexOf('CPF');
    const iNome = cab.indexOf('NOME');
    const pend = cab.map((h, i) => (h.startsWith('PENDENCIA') ? { i, rotulo: _titulo(h.replace(/^PENDENCIA\s*/, '')) || 'Pendência' } : null)).filter(Boolean);
    return rows.slice(idx + 1).map(r => ({
      cpf: _cpf(r[iCpf]), nome: iNome >= 0 ? String(r[iNome] || '').trim() : '',
      texto: pend.map(p => [p.rotulo, String(r[p.i] || '').trim()]).filter(([, t]) => t).map(([rot, t]) => `${rot}: ${t}`).join(' · '),
    })).filter(l => l.cpf !== '00000000000' || l.texto);
  }
  return null;
}

const _novaObs = (obs, texto) => (String(obs || '').trim() ? `${String(obs).trim()} · ${texto}` : texto);

// Destino de UMA linha da planilha: [grupo, item(s)]
function _destino(l) {
  if (!_cpfOk(l.cpf)) return ['naoAchados', { ...l, motivo: 'CPF inválido' }];
  if (!l.texto) return ['semTexto', l];
  const regs = S.registros.filter(r => _cpf(r.cpf) === l.cpf);
  if (!regs.length) return ['naoAchados', { ...l, motivo: 'não está na Liberação' }];
  const abertos = regs.filter(r => !r.aprovado);
  if (!abertos.length) return ['soOk', { ...l, nome: regs[0].nome }];
  const novos = abertos.filter(r => !String(r.obs || '').includes(l.texto));
  if (!novos.length) return ['jaTinha', { ...l, nome: abertos[0].nome }];
  return ['prontos', novos.map(r => ({ r, texto: l.texto }))];
}

function _classificar(linhas) {
  const c = { prontos: [], jaTinha: [], soOk: [], naoAchados: [], semTexto: [] };
  for (const l of linhas) {
    const [grupo, item] = _destino(l);
    c[grupo].push(...(Array.isArray(item) ? item : [item]));
  }
  return c;
}

async function _gravar(prontos, progresso) {
  const falhas = [];
  for (let i = 0; i < prontos.length; i++) {
    const { r, texto } = prontos[i];
    const { error } = await updateLiberacao(r.id, { obs: _novaObs(r.obs, texto) });
    if (error) falhas.push({ titulo: r.nome, detalhe: error.message || 'não foi possível gravar' });
    progresso(i + 1, prontos.length, 'Gravando');
  }
  return { gravados: prontos.length - falhas.length, falhas };
}

async function _lerArquivo(file) {
  try {
    const linhas = _lerLinhas(XLSX.read(await file.arrayBuffer(), { type: 'array' }));
    if (!linhas) toast('Planilha fora do modelo: não achei a coluna CPF e as colunas "Pendencia …".', 'err');
    return linhas;
  } catch (e) {
    toast('Não foi possível ler a planilha: ' + (e?.message || e), 'err');
    return null;
  }
}

function _conferir(arquivo, c) {
  const it = (l, d) => ({ titulo: l.nome || l.cpf, detalhe: d });
  return dsImportReport({
    eyebrow: 'Importar pendências', title: arquivo,
    sub: 'A pendência é acrescentada ao fim da observação dos clientes que ainda não estão OK.',
    resumo: [{ n: c.prontos.length, label: 'observações a gravar', tone: 'ok' },
      { n: c.jaTinha.length + c.soOk.length, label: 'ignorados (já tinham / já OK)', tone: 'warn' },
      { n: c.naoAchados.length, label: 'não encontrados', tone: c.naoAchados.length ? 'bad' : 'ok' }],
    grupos: [
      { label: 'Vão receber a pendência', itens: c.prontos.map(p => ({ titulo: p.r.nome, detalhe: p.texto })) },
      { label: 'Já tinham esta pendência na observação', itens: c.jaTinha.map(l => it(l, 'nada a fazer')) },
      { label: 'Cliente já está OK (não gravado)', itens: c.soOk.map(l => it(l, 'OK')) },
      { label: 'Não encontrados na Liberação', itens: c.naoAchados.map(l => it(l, l.motivo)) },
      { label: 'Linha sem pendência preenchida', itens: c.semTexto.map(l => it(l, 'vazia')) },
    ],
    okLabel: c.prontos.length ? `Gravar ${c.prontos.length} observaç${c.prontos.length > 1 ? 'ões' : 'ão'}` : null,
    rotuloOk: 'observações gravadas',
    gravar: progresso => _gravar(c.prontos, progresso),
  });
}

export async function libOnPendenciasFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const linhas = await _lerArquivo(file);
  if (!linhas) return;
  const r = await _conferir(file.name, _classificar(linhas));
  if (r.gravou) await window.libRecarregar?.();
}
