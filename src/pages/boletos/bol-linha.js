// Linha da Quitação de Boleto no visual novo (Fase 2 do redesenho):
// resumo compacto (cliente, convênio, cadastro, status, AÇÃO do dia a dia) e
// detalhe que abre ao clicar (etapas, valores, respaldo, documentos, ações raras).
// Só monta HTML — os cliques são tratados por delegação em bol-tabela.js.
// Nomes window.* usados aqui (bolMarcarQuitado, bolAbrirReprovar, bolEditarCliente,
// bolDeletarCliente, bolVerDoc, bolBaixarDoc, bolExcluirDoc) — NÃO RENOMEAR.
import { icon } from '../../utils/icons.js';
import { dsBadge, dsSteps, dsKv, dsWait, dsBtn } from '../../components/ds/index.js';
import { BO, isAdmin, ehDono, fmtBRL, fmtDate, fmtCpf, esc } from './bol-core.js';

// Status → rótulo e tom do design system
export const BOL_STATUS = {
  solicitar_boleto:  { label: 'Solicitar boleto',  tone: 'neutral', etapa: 0 },
  boleto_solicitado: { label: 'Boleto solicitado', tone: 'warn',    etapa: 1 },
  boleto_enviado:    { label: 'Boleto enviado',    tone: 'info',    etapa: 2 },
  boleto_quitado:    { label: 'Quitado',           tone: 'ok',      etapa: 4 },
  boleto_reprovado:  { label: 'Reprovado',         tone: 'bad',     etapa: 3 },
};
const meta = r => BOL_STATUS[r.status] || BOL_STATUS.solicitar_boleto;

// Ação do dia a dia de cada status. who: 's' = só Smart (admin); 'p' = dono da linha.
export const BOL_ACOES = {
  solicitar_boleto:  { novo: 'boleto_solicitado', label: 'Marcar como solicitado', who: 's' },
  boleto_solicitado: { novo: 'boleto_enviado',    label: 'Marcar como enviado',    who: 's' },
  boleto_enviado:    { novo: 'boleto_quitado',    label: 'Marcar como quitado',    who: 'p' },
};
export const podeAgir = (r, acao) => (acao.who === 's' ? isAdmin() : ehDono(r));

export const colunas = () =>
  `22px minmax(0,2fr) minmax(0,1.4fr)${isAdmin() ? ' minmax(0,1fr)' : ''} minmax(0,.8fr) minmax(0,1.3fr) 230px 36px`;

const _q = s => esc(s).replace(/'/g, "\\'");

function _dataDoStatus(r) {
  const d = { boleto_solicitado: r.data_solicitado, boleto_enviado: r.data_enviado,
    boleto_quitado: r.data_quitado, boleto_reprovado: r.data_reprovado }[r.status];
  return d ? fmtDate(d) : '';
}

function _subStatus(r) {
  const partes = [];
  const data = _dataDoStatus(r);
  if (data) partes.push('desde ' + data);
  const nDocs = (BO.docs.get(r.id) || []).length;
  if (nDocs) partes.push(`${nDocs} doc${nDocs > 1 ? 's' : ''}`);
  if (r.respaldo_status) partes.push('respaldo');
  return partes.length ? `<div class="bol-sub">${partes.join(' · ')}</div>` : '';
}

function _acaoCell(r) {
  if (r.status === 'boleto_quitado') return '<span class="ds-act__done">Concluído</span>';
  if (r.status === 'boleto_reprovado') return '<span class="ds-act__done">Reprovado</span>';
  const acao = BOL_ACOES[r.status];
  if (!podeAgir(r, acao)) return acao.who === 's' ? dsWait('Aguardando Smart') : '';
  return dsBtn({ label: acao.label, variant: 'primary', size: 'sm', attrs: `data-bol-acao="${r.id}"` })
    + dsBtn({ icon: 'dots', size: 'sm', ariaLabel: 'Mais ações', attrs: `data-bol-abrir="${r.id}"` });
}

export function linhaHTML(r) {
  const aberto = BO.abertos.has(r.id);
  const m = meta(r);
  return `<div class="ds-tr ds-tr--item${aberto ? ' is-open' : ''}" data-bol-row="${r.id}" style="--ds-cols:${colunas()}">`
    + `<div><input type="checkbox" class="ds-cb" data-bol-sel="${r.id}"${BO.sel.has(r.id) ? ' checked' : ''} aria-label="Selecionar"></div>`
    + `<div class="ds-who"><b>${esc(r.nome || '—')}</b><span>${fmtCpf(r.cpf)}</span></div>`
    + `<div class="ds-muted bol-trunc">${esc(r.convenio || '—')} · ${esc(r.produto || '—')}</div>`
    + (isAdmin() ? `<div class="ds-muted bol-trunc">${esc(r.empresa_parceira || '—')}</div>` : '')
    + `<div class="ds-muted">${fmtDate((r.created_at || '').slice(0, 10))}</div>`
    + `<div>${dsBadge(m.label, m.tone)}${_subStatus(r)}</div>`
    + `<div class="ds-act">${_acaoCell(r)}</div>`
    + `<div class="ds-chev">${icon('chevron', 16)}</div></div>`
    + `<div class="ds-det${aberto ? ' is-open' : ''}">${aberto ? detalheHTML(r) : ''}</div>`;
}

// ── Detalhe (linha aberta) ──────────────────────────────────────────────
function _etapas(r) {
  const fim = r.status === 'boleto_reprovado' ? 'Reprovado' : 'Quitado';
  return dsSteps(['Solicitar', 'Solicitado', 'Enviado', fim], meta(r).etapa);
}

function _valores(r) {
  return '<div class="ds-det__grid">'
    + dsKv('Contrato', `<span class="bol-mono">${esc(r.contrato || '—')}</span>`)
    + dsKv('Valor da parcela', fmtBRL(r.valor_parcela)) + dsKv('Saldo devedor', fmtBRL(r.saldo_devedor))
    + dsKv('Troco', fmtBRL(r.troco)) + dsKv('Solicitado em', fmtDate(r.data_solicitado))
    + dsKv('Enviado em', fmtDate(r.data_enviado))
    + (r.data_quitado ? dsKv('Quitado em', fmtDate(r.data_quitado)) : '')
    + (r.data_reprovado ? dsKv('Reprovado em', fmtDate(r.data_reprovado)) : '')
    + (r.email ? dsKv('E-mail', esc(r.email)) : '')
    + '</div>';
}

function _respaldo(r) {
  if (!r.respaldo_status && !r.respaldo_protocolo) {
    return `<div class="ds-blk"><h3>${icon('shield', 16)}Respaldo</h3><div class="ds-hint">Ainda não importado.</div></div>`;
  }
  const quando = r.respaldo_em ? new Date(r.respaldo_em).toLocaleDateString('pt-BR') : '';
  const linhas = String(r.respaldo_detalhes || '').split('\n').filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');
  return `<div class="ds-blk"><h3>${icon('shield', 16)}Respaldo ${r.respaldo_status ? dsBadge(r.respaldo_status, 'pur') : ''}`
    + `<span class="ds-hint bol-respaldo-meta">${r.respaldo_protocolo ? 'protocolo <span class="bol-mono">' + esc(r.respaldo_protocolo) + '</span>' : ''}${quando ? ' · importado em ' + quando : ''}</span></h3>`
    + `<div class="bol-linhas">${linhas || '<span class="ds-hint">Sem detalhes por cartão.</span>'}</div>`
    + (r.respaldo_obs ? `<div class="ds-hint" style="margin-top:6px">${esc(r.respaldo_obs)}</div>` : '') + '</div>';
}

function _docItem(d) {
  const excluir = isAdmin()
    ? dsBtn({ label: 'Excluir', variant: 'ghost', size: 'sm', attrs: `onclick="bolExcluirDoc('${d.id}')"` }) : '';
  return `<div class="bol-doc">${icon(d.tipo === 'fatura' ? 'receipt' : 'file', 16)}`
    + `<span class="bol-doc__nome" title="${esc(d.nome_arquivo)}">${esc(d.nome_arquivo)}</span>`
    + `<span class="ds-hint">${d.tipo === 'fatura' ? 'Fatura' : 'Boleto'}${d.contrato ? ' · ' + esc(d.contrato) : ''}</span>`
    + dsBtn({ label: 'Ver', variant: 'ghost', size: 'sm', attrs: `onclick="bolVerDoc('${d.id}')"` })
    + dsBtn({ label: 'Baixar', variant: 'ghost', size: 'sm', attrs: `onclick="bolBaixarDoc('${d.id}')"` })
    + excluir + '</div>';
}

function _documentos(r) {
  const docs = BO.docs.get(r.id) || [];
  return `<div class="ds-blk"><h3>${icon('folder', 16)}Documentos</h3>`
    + (docs.length ? `<div class="bol-docs">${docs.map(_docItem).join('')}</div>` : '<div class="ds-hint">Nenhum boleto ou fatura anexado.</div>')
    + '</div>';
}

function _acoesRaras(r) {
  const admin = isAdmin();
  const final = r.status === 'boleto_quitado' || r.status === 'boleto_reprovado';
  const btns = [];
  if (admin || (ehDono(r) && !final)) btns.push(dsBtn({ label: 'Editar dados', size: 'sm', attrs: `onclick="bolEditarCliente('${r.id}')"` }));
  if (ehDono(r) && r.status === 'boleto_enviado') btns.push(dsBtn({ label: 'Reprovar', variant: 'danger', size: 'sm', attrs: `onclick="bolAbrirReprovar('${r.id}')"` }));
  if (admin) btns.push(dsBtn({ label: 'Excluir cliente', variant: 'danger', size: 'sm', attrs: `onclick="bolDeletarCliente('${r.id}', '${_q(r.nome)}')"` }));
  return `<div class="ds-det__actions">${btns.join('')}<span class="ds-hint">Ações menos usadas ficam aqui dentro</span></div>`;
}

export function detalheHTML(r) {
  const motivo = r.status === 'boleto_reprovado' && r.motivo_reprovacao
    ? `<div class="ds-blk"><h3 style="color:var(--ds-bad)">Motivo da reprovação</h3><div class="ds-muted">${esc(r.motivo_reprovacao)}</div></div>` : '';
  const obs = r.obs ? `<div class="ds-blk"><h3>${icon('note', 16)}Observação</h3><div class="ds-muted bol-obs">${esc(r.obs)}</div></div>` : '';
  return _etapas(r) + _valores(r) + motivo + _respaldo(r) + _documentos(r) + obs + _acoesRaras(r);
}
