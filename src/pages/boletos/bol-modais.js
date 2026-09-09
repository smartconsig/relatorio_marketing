// Modais da Quitação de Boleto: adicionar/editar cliente, quitação,
// reprovação (motivo obrigatório) e visualização de motivo.
// ⚠ Os botões Salvar passam o nome da função como STRING (onSaveFn:
// 'bolSalvarCliente()' / `bolSalvarEdicao('${id}')`) — NÃO RENOMEAR sem
// atualizar main.js e scripts/verifica-handlers.mjs.
import { toast } from '../../utils/ui.js';
import { showConfirm } from '../../utils/confirm.js';
import { parseBRL } from '../../utils/currency.js';
import { PRODUTOS, canonProduto, msgErroBanco, insertBoleto, updateBoleto } from '../../services/boletos-svc.js';
import { BO, empresaParceira, fmtCpf, fmtDate, esc } from './bol-core.js';
import { reloadAndRender, bolMudarStatus } from './bol-tabela.js';

export function bolMarcarQuitado(id) {
  const r = BO.registros.find(x => x.id === id);
  if (!r) return;
  showConfirm(
    'Marcar como Boleto Quitado',
    `Confirma que o boleto de "${r.nome}" foi quitado? Essa é a fase final do processo.`,
    'Confirmar quitação',
    () => bolMudarStatus(id, 'boleto_quitado')
  );
}

// ── Reprovação (motivo obrigatório) ───────────────────────────────────────
export function bolAbrirReprovar(id) {
  const r = BO.registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Reprovar Boleto</h2>
    <p style="font-size:.88rem;color:var(--muted);margin:0 0 16px">
      Cliente: <strong style="color:var(--text)">${esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
    </p>
    <div class="lib-form-row">
      <label>Motivo da reprovação <span style="color:var(--red)">*</span></label>
      <textarea id="bol-f-motivo" placeholder="Explique por que o boleto foi reprovado (obrigatório)"></textarea>
    </div>
    <div id="bol-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>
    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="bol-btn-reprovar" onclick="bolConfirmarReprovar('${id}')">Reprovar Boleto</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
  document.getElementById('bol-f-motivo')?.focus();
}

export async function bolConfirmarReprovar(id) {
  const motivo = document.getElementById('bol-f-motivo')?.value.trim();
  const err    = document.getElementById('bol-modal-err');
  const btn    = document.getElementById('bol-btn-reprovar');

  if (!motivo) {
    if (err) { err.textContent = 'O motivo da reprovação é obrigatório.'; err.style.display = ''; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  const ok = await bolMudarStatus(id, 'boleto_reprovado', motivo);
  if (ok) {
    bolFecharModal();
  } else if (btn) {
    btn.disabled = false; btn.textContent = 'Reprovar Boleto';
  }
}

export function bolVerMotivo(id) {
  const r = BO.registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Motivo da Reprovação</h2>
    <p style="font-size:.88rem;color:var(--muted);margin:0 0 12px">
      Cliente: <strong style="color:var(--text)">${esc(r.nome)}</strong> · CPF ${fmtCpf(r.cpf)}
      · Reprovado em ${fmtDate(r.data_reprovado)}
    </p>
    <div class="bol-motivo-box">${esc(r.motivo_reprovacao || '—')}</div>
    <div class="lib-modal-actions" style="margin-top:20px">
      <button class="lib-btn-save" onclick="bolFecharModal()">Fechar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
}

// ── Modal Adicionar / Editar Cliente ──────────────────────────────────────
// Valores iniciais do formulário (novo cliente = campos vazios).
function _valoresTextoForm(r) {
  return {
    cpf:      esc(r ? fmtCpf(r.cpf) : ''),
    contrato: esc(r?.contrato || ''),
    nome:     esc(r?.nome || ''),
    email:    esc(r?.email || ''),
    convenio: esc(r?.convenio || ''),
    obs:      esc(r?.obs || ''),
  };
}

function _valoresNumeroForm(r) {
  return {
    produtoCanon: canonProduto(r?.produto),
    saldo:   r ? (r.saldo_devedor || 0) : '',
    troco:   r ? (r.troco || 0) : '0',
    parcela: r ? (r.valor_parcela || 0) : '',
    statusInicial: r ? '' : ' &nbsp;·&nbsp; Status inicial: <span>Solicitar Boleto</span>',
  };
}

function _modalForm({ titulo, r, onSaveFn }) {
  const empresa = r ? r.empresa_parceira : empresaParceira();
  const v = { ..._valoresTextoForm(r), ..._valoresNumeroForm(r) };

  const content = document.getElementById('bol-modal-content');
  const modal   = document.getElementById('bol-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">${titulo}</h2>

    <div class="lib-form-row-2">
      <div>
        <label>CPF</label>
        <input type="text" id="bol-f-cpf" value="${v.cpf}" placeholder="000.000.000-00" maxlength="14" />
      </div>
      <div>
        <label>Contrato</label>
        <input type="text" id="bol-f-contrato" value="${v.contrato}" placeholder="Nº do contrato" />
      </div>
    </div>

    <div class="lib-form-row">
      <label>Nome Completo</label>
      <input type="text" id="bol-f-nome" value="${v.nome}" placeholder="Nome do cliente" />
    </div>

    <div class="lib-form-row">
      <label>E-mail <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <input type="text" id="bol-f-email" value="${v.email}" placeholder="email@cliente.com" />
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Convênio</label>
        <input type="text" id="bol-f-convenio" value="${v.convenio}" placeholder="Ex.: GOV-SÃO PAULO" />
      </div>
      <div>
        <label>Produto</label>
        <select id="bol-f-produto">
          <option value="">Selecione…</option>
          ${PRODUTOS.map(p => `<option value="${p}"${v.produtoCanon === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Saldo Devedor (R$)</label>
        <input type="text" id="bol-f-saldo" value="${v.saldo}" placeholder="0,00" />
      </div>
      <div>
        <label>Troco (R$)</label>
        <input type="text" id="bol-f-troco" value="${v.troco}" placeholder="0,00" />
      </div>
    </div>

    <div class="lib-form-row">
      <label>Valor da Parcela (R$) <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <input type="text" id="bol-f-parcela" value="${v.parcela}" placeholder="0,00" />
    </div>

    <div class="lib-modal-auto">
      Empresa: <span>${esc(empresa)}</span>
      ${v.statusInicial}
    </div>

    <div class="lib-form-row">
      <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <textarea id="bol-f-obs" placeholder="Deixe em branco se não houver observações">${v.obs}</textarea>
    </div>

    <div id="bol-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="bolFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="bol-btn-save" onclick="${onSaveFn}">Salvar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) bolFecharModal(); };
  document.getElementById('bol-f-cpf')?.focus();
}

function _camposTextoBol() {
  return {
    cpf:      (document.getElementById('bol-f-cpf')?.value || '').replace(/\D/g, ''),
    nome:     document.getElementById('bol-f-nome')?.value.trim(),
    contrato: document.getElementById('bol-f-contrato')?.value.trim() || null,
    email:    document.getElementById('bol-f-email')?.value.trim() || null,
    convenio: document.getElementById('bol-f-convenio')?.value.trim(),
    produto:  document.getElementById('bol-f-produto')?.value || '',
  };
}

function _camposValoresBol() {
  return {
    saldo_devedor: parseBRL(document.getElementById('bol-f-saldo')?.value),
    troco:         parseBRL(document.getElementById('bol-f-troco')?.value) || 0,
    valor_parcela: parseBRL(document.getElementById('bol-f-parcela')?.value) || 0,
    obs:           document.getElementById('bol-f-obs')?.value.trim() || null,
  };
}

function _lerFormulario() {
  const err = document.getElementById('bol-modal-err');
  const show = msg => { if (err) { err.textContent = msg; err.style.display = ''; } };
  const d = { ..._camposTextoBol(), ..._camposValoresBol() };

  if (!d.cpf || d.cpf.length !== 11)            { show('Informe um CPF válido (11 dígitos).'); return null; }
  if (!d.nome)                                  { show('Informe o nome.');           return null; }
  if (!d.saldo_devedor || d.saldo_devedor <= 0) { show('Informe o saldo devedor.');  return null; }
  if (!d.convenio)                              { show('Informe o convênio.');       return null; }
  if (!d.produto)                               { show('Selecione o produto.');      return null; }

  if (err) err.style.display = 'none';
  return d;
}

export function bolAddCliente() {
  _modalForm({ titulo: 'Novo Cliente', r: null, onSaveFn: 'bolSalvarCliente()' });
}

export async function bolSalvarCliente() {
  const dados = _lerFormulario();
  if (!dados) return;

  const btn = document.getElementById('bol-btn-save');
  const err = document.getElementById('bol-modal-err');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const { error } = await insertBoleto({
    ...dados,
    empresa_parceira: empresaParceira(),
  });

  if (error) {
    if (err) { err.textContent = msgErroBanco(error); err.style.display = ''; }
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }

  bolFecharModal();
  toast('Cliente salvo com sucesso!');
  await reloadAndRender();
}

export function bolEditarCliente(id) {
  const r = BO.registros.find(x => x.id === id);
  if (!r) return;
  _modalForm({ titulo: 'Editar Cliente', r, onSaveFn: `bolSalvarEdicao('${id}')` });
}

export async function bolSalvarEdicao(id) {
  const dados = _lerFormulario();
  if (!dados) return;

  const btn = document.getElementById('bol-btn-save');
  const err = document.getElementById('bol-modal-err');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const { error } = await updateBoleto(id, dados);

  if (error) {
    if (err) { err.textContent = msgErroBanco(error); err.style.display = ''; }
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }

  bolFecharModal();
  toast('Cliente atualizado!');
  await reloadAndRender();
}

export function bolFecharModal() {
  document.getElementById('bol-modal')?.classList.remove('open');
}
