// Linha da Liberação de Margem no visual novo (Fase 3): na linha ficam cliente,
// convênio·produto, empresa (Smart), data quitado, ACERTO (editável), status e a
// AÇÃO do dia a dia. Valores (saldo devedor, troco, troco líquido, saldo total,
// comissão) ficam no detalhe — decisão do responsável; o Excel continua com tudo.
// Só monta HTML; cliques por delegação em lib-tabela.js.
// window.* usados aqui: libSalvarAcerto, libEditarCliente, libDeletarCliente — NÃO RENOMEAR.
import { icon } from '../../utils/icons.js';
import { dsBadge, dsSteps, dsKv, dsWait, dsBtn, dsDateBtn } from '../../components/ds/index.js';
import { S, isAdmin, fmtBRL, fmtDate, esc } from './lib-core.js';
import { LIB_STATUS, LIB_ACOES, statusDe, ehDono, podeAgir, emAlerta, diasUteisDesde, LIMITE_ALERTA } from './lib-status.js';

export const colunas = () =>
  `22px minmax(0,2fr) minmax(0,1.3fr)${isAdmin() ? ' minmax(0,1fr)' : ''} minmax(0,.8fr) 140px minmax(0,1.25fr) 270px 36px`;

const _q = s => esc(s || '').replace(/'/g, "\\'");

function _statusCell(r) {
  if (emAlerta(r)) return dsBadge(`Em alerta · ${diasUteisDesde(r.residuo_data_pago)} dias úteis`, 'bad');
  const m = LIB_STATUS[statusDe(r)];
  const datas = { res_pendente: r.residuo_data_pendente, res_solicitado: r.residuo_data_solicitado,
    res_enviado: r.residuo_data_enviado, res_pago: r.residuo_data_pago };
  const d = datas[statusDe(r)];
  return dsBadge(m.label, m.tone) + (d ? `<div class="bol-sub">desde ${fmtDate(d)}</div>` : '');
}

function _acaoCell(r) {
  const st = statusDe(r);
  if (st === 'ok') return '<span class="ds-act__done">Concluído</span>';
  if (!ehDono(r)) return '';
  const acoes = LIB_ACOES[st];
  const permitidas = acoes.filter(a => podeAgir(r, a));
  if (!permitidas.length) return dsWait('Aguardando Smart');
  return permitidas.map(a => dsBtn({ label: a.label, variant: a.alt ? 'quiet' : 'primary', size: 'sm', attrs: `data-lib-acao="${a.k}" data-id="${r.id}"` })).join('')
    + dsBtn({ icon: 'dots', size: 'sm', ariaLabel: 'Mais ações', attrs: `data-lib-abrir="${r.id}"` });
}

function _acertoCell(r) {
  if (!ehDono(r)) return `<span class="ds-muted">${fmtDate(r.acerto)}</span>`;
  const travado = !isAdmin() && !!r.acerto;
  return dsDateBtn({ valor: r.acerto || '', placeholder: 'Definir', travado,
    attrs: travado ? 'title="Acerto preenchido — só a Smart altera"' : `data-lib-acerto="${r.id}" title="Escolher data de acerto"` });
}

export function linhaHTML(r) {
  const aberto = S.abertos.has(r.id);
  return `<div class="ds-tr ds-tr--item${aberto ? ' is-open' : ''}${emAlerta(r) ? ' ds-tr--alert' : ''}" data-lib-row="${r.id}" style="--ds-cols:${colunas()}">`
    + `<div><input type="checkbox" class="ds-cb" data-lib-sel="${r.id}"${S.sel.has(r.id) ? ' checked' : ''} aria-label="Selecionar"></div>`
    + `<div class="ds-who"><b>${esc(r.nome || '—')}</b><span>${esc(r.cpf || '—')}</span></div>`
    + `<div class="ds-muted bol-trunc">${esc(r.convenio || '—')} · ${esc(r.produto || '—')}</div>`
    + (isAdmin() ? `<div class="ds-muted bol-trunc">${esc(r.empresa_parceira || '—')}</div>` : '')
    + `<div class="ds-muted">${fmtDate(r.data_quitado)}</div>`
    + `<div>${_acertoCell(r)}</div>`
    + `<div>${_statusCell(r)}</div>`
    + `<div class="ds-act">${_acaoCell(r)}</div>`
    + `<div class="ds-chev">${icon('chevron', 16)}</div></div>`
    + `<div class="ds-det${aberto ? ' is-open' : ''}">${aberto ? detalheHTML(r) : ''}</div>`;
}

// ── Detalhe ──────────────────────────────────────────────────────────────
function _valores(r) {
  return '<div class="ds-det__grid">'
    + dsKv('Saldo devedor', fmtBRL(r.saldo_devedor)) + dsKv('Troco', fmtBRL(r.troco))
    + (isAdmin() ? dsKv('Troco líquido', fmtBRL(r.troco_liquido)) : '')
    + dsKv('Saldo total', fmtBRL(r.saldo_total)) + dsKv('Comissão 6%', fmtBRL(r.comissao_6pct))
    + dsKv('Data quitado', fmtDate(r.data_quitado)) + dsKv('Acerto', fmtDate(r.acerto)) + '</div>';
}

function _residuo(r) {
  if (!r.residuo_status) return '';
  const etapa = r.aprovado ? 5 : { pendente: 0, solicitado: 1, enviado: 2, pago: 3 }[r.residuo_status];
  const alerta = emAlerta(r)
    ? dsKv('Dias úteis sem OK', `<span style="color:var(--ds-bad)">${diasUteisDesde(r.residuo_data_pago)} de ${LIMITE_ALERTA}</span>`) : '';
  const enq = r.residuo_enquadrada == null ? '—' : (r.residuo_enquadrada ? 'Sim' : 'Não');
  return `<div class="ds-blk"><h3>${icon('coin', 16)}Resíduo</h3>`
    + dsSteps(['Pendente', 'Solicitado', 'Enviado', 'Pago', 'OK'], etapa)
    + '<div class="ds-det__grid">' + dsKv('Valor pendente', fmtBRL(r.residuo_valor)) + dsKv('Enquadrada', enq)
    + dsKv('Pendente em', fmtDate(r.residuo_data_pendente)) + dsKv('Solicitado em', fmtDate(r.residuo_data_solicitado))
    + dsKv('Enviado em', fmtDate(r.residuo_data_enviado))
    + dsKv('Pago em', fmtDate(r.residuo_data_pago) + (r.residuo_valor_pago != null ? ` · ${fmtBRL(r.residuo_valor_pago)}` : ''))
    + alerta + '</div></div>';
}

function _obs(r) {
  const linhas = String(r.obs || '').split(' · ').filter(Boolean).map(l => `<div>${esc(l)}</div>`).join('');
  return `<div class="ds-blk"><h3>${icon('note', 16)}Observação</h3><div class="bol-linhas">${linhas || '<span class="ds-hint">Sem observação</span>'}</div></div>`;
}

function _acoesRaras(r) {
  const admin = isAdmin();
  const btns = [];
  if (ehDono(r)) {
    const travado = !admin && r.acerto;
    btns.push(dsBtn({ label: 'Editar dados', size: 'sm', attrs: travado ? 'disabled title="Acerto preenchido — edição bloqueada"' : `onclick="libEditarCliente('${r.id}')"` }));
  }
  if (admin && r.aprovado) btns.push(dsBtn({ label: 'Remover OK', size: 'sm', attrs: `data-lib-acao="desfazer-ok" data-id="${r.id}"` }));
  if (admin) btns.push(dsBtn({ label: 'Excluir cliente', variant: 'danger', size: 'sm', attrs: `onclick="libDeletarCliente('${r.id}', '${_q(r.nome)}')"` }));
  return `<div class="ds-det__actions">${btns.join('')}<span class="ds-hint">Ações menos usadas ficam aqui dentro</span></div>`;
}

export const detalheHTML = r => _valores(r) + _residuo(r) + _obs(r) + _acoesRaras(r);
