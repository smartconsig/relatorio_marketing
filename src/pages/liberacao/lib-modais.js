// Modais de cliente da Liberação de Margem (adicionar/editar) + preview de
// cálculo. Os botões Salvar passam o nome da função como string
// (onclick="libSalvarCliente()" / libSalvarEdicao) — NÃO RENOMEAR sem
// atualizar main.js e scripts/verifica-handlers.mjs.
import { insertLiberacao, updateLiberacao } from '../../services/liberacao-svc.js';
import { toast, handleError } from '../../utils/ui.js';
import { parseBRL } from '../../utils/currency.js';
import { S, empresaParceira, fmtBRL, fmtDate, esc } from './lib-core.js';
import { reloadAndRender } from './lib-tabela.js';

// ── Editar Cliente ────────────────────────────────────────────────────────
// Valores iniciais do formulário de edição (mesmos fallbacks de sempre).
function _valoresEdicao(r) {
  const sd    = r.saldo_devedor || 0;
  const troco = r.troco || 0;
  return {
    cpf:      esc(r.cpf || ''),
    nome:     esc(r.nome || ''),
    convenio: esc(r.convenio || ''),
    produto:  esc(r.produto || ''),
    obs:      esc(r.obs || ''),
    sd, troco,
    total:    fmtBRL(sd + troco),
    comissao: fmtBRL((sd + troco) * 0.06),
  };
}

export function libEditarCliente(id) {
  const r = S.registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  const v = _valoresEdicao(r);
  content.innerHTML = `
    <h2 class="lib-modal-title">Editar Cliente</h2>

    <div class="lib-form-row">
      <label>CPF</label>
      <input type="text" id="lib-f-cpf" value="${v.cpf}" maxlength="14" />
    </div>

    <div class="lib-form-row">
      <label>Nome Completo</label>
      <input type="text" id="lib-f-nome" value="${v.nome}" />
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Convênio</label>
        <input type="text" id="lib-f-convenio" value="${v.convenio}" />
      </div>
      <div>
        <label>Produto</label>
        <input type="text" id="lib-f-produto" value="${v.produto}" />
      </div>
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Saldo Devedor (R$)</label>
        <input type="text" id="lib-f-sd" value="${v.sd}" oninput="libCalcPreview()" />
      </div>
      <div>
        <label>Troco (R$)</label>
        <input type="text" id="lib-f-troco" value="${v.troco}" oninput="libCalcPreview()" />
      </div>
    </div>

    <div class="lib-calc-preview">
      <div class="lib-calc-preview-item">
        <span class="lbl">Saldo Total</span>
        <span class="val" id="lib-prev-total">${v.total}</span>
      </div>
      <div class="lib-calc-preview-item">
        <span class="lbl">Comissão 6%</span>
        <span class="val" id="lib-prev-com">${v.comissao}</span>
      </div>
    </div>

    <div class="lib-modal-auto">
      Empresa: <span>${esc(r.empresa_parceira)}</span> &nbsp;·&nbsp;
      Data Quitado: <span>${fmtDate(r.data_quitado)}</span>
    </div>

    <div class="lib-form-row">
      <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <textarea id="lib-f-obs">${v.obs}</textarea>
    </div>

    <div id="lib-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="libFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="lib-btn-save" onclick="libSalvarEdicao('${id}')">Salvar</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) libFecharModal(); };
}

// Lê e valida os campos comuns do formulário (adicionar e editar usam o
// mesmo). Devolve null se algo obrigatório faltar — a mensagem já foi
// exibida, na MESMA ordem de validação original.
function _lerCamposCliente() {
  return {
    cpf:      document.getElementById('lib-f-cpf')?.value.trim(),
    nome:     document.getElementById('lib-f-nome')?.value.trim(),
    sd:       parseBRL(document.getElementById('lib-f-sd')?.value),
    troco:    parseBRL(document.getElementById('lib-f-troco')?.value) || 0,
    obs:      document.getElementById('lib-f-obs')?.value.trim() || null,
    convenio: document.getElementById('lib-f-convenio')?.value.trim(),
    produto:  document.getElementById('lib-f-produto')?.value.trim(),
  };
}

function _coletarFormCliente() {
  const err = document.getElementById('lib-modal-err');
  const falha = msg => { err.textContent = msg; err.style.display = ''; return null; };
  const d = _lerCamposCliente();

  if (!d.cpf)             return falha('Informe o CPF.');
  if (!d.nome)            return falha('Informe o nome.');
  if (!d.sd || d.sd <= 0) return falha('Informe o saldo devedor.');
  if (!d.convenio)        return falha('Informe o convênio.');
  if (!d.produto)         return falha('Informe o produto.');

  err.style.display = 'none';
  return d;
}

// Espelha os campos salvos no registro em memória (a linha some/atualiza
// de verdade no reloadAndRender logo em seguida).
function _refletirEdicaoLocal(id, d) {
  const reg = S.registros.find(r => r.id === id);
  if (!reg) return;
  reg.cpf = d.cpf; reg.nome = d.nome; reg.convenio = d.convenio; reg.produto = d.produto;
  reg.saldo_devedor = d.sd; reg.troco = d.troco; reg.obs = d.obs;
}

export async function libSalvarEdicao(id) {
  const dados = _coletarFormCliente();
  if (!dados) return;
  const { cpf, nome, convenio, produto, sd, troco, obs } = dados;

  const btn = document.getElementById('lib-btn-save');
  btn.disabled = true; btn.textContent = 'Salvando…';

  const { error } = await updateLiberacao(id, { cpf, nome, convenio, produto, saldo_devedor: sd, troco, obs });

  if (error) {
    handleError('Erro ao salvar.', error);
    btn.disabled = false; btn.textContent = 'Salvar';
    return;
  }

  _refletirEdicaoLocal(id, dados);

  libFecharModal();
  toast('Cliente atualizado!');
  await reloadAndRender();
}

// ── Modal Adicionar Cliente ─────────────────────────────────────────────────
export function libAddCliente() {
  const empresa = empresaParceira();
  const hoje = new Date().toLocaleDateString('pt-BR');

  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Novo Cliente</h2>

    <div class="lib-form-row">
      <label>CPF</label>
      <input type="text" id="lib-f-cpf" placeholder="000.000.000-00" maxlength="14" />
    </div>

    <div class="lib-form-row">
      <label>Nome Completo</label>
      <input type="text" id="lib-f-nome" placeholder="Nome do cliente" />
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Convênio</label>
        <input type="text" id="lib-f-convenio" placeholder="Convênio" />
      </div>
      <div>
        <label>Produto</label>
        <input type="text" id="lib-f-produto" placeholder="Produto" />
      </div>
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Saldo Devedor (R$)</label>
        <input type="text" id="lib-f-sd" placeholder="0,00" oninput="libCalcPreview()" />
      </div>
      <div>
        <label>Troco (R$)</label>
        <input type="text" id="lib-f-troco" placeholder="0,00" value="0" oninput="libCalcPreview()" />
      </div>
    </div>

    <div class="lib-calc-preview">
      <div class="lib-calc-preview-item">
        <span class="lbl">Saldo Total</span>
        <span class="val" id="lib-prev-total">R$ —</span>
      </div>
      <div class="lib-calc-preview-item">
        <span class="lbl">Comissão 6%</span>
        <span class="val" id="lib-prev-com">R$ —</span>
      </div>
    </div>

    <div class="lib-modal-auto">
      Empresa: <span>${esc(empresa)}</span> &nbsp;·&nbsp;
      Data Quitado: <span>${hoje}</span>
    </div>

    <div class="lib-form-row">
      <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <textarea id="lib-f-obs" placeholder="Deixe em branco se não houver observações"></textarea>
    </div>

    <div id="lib-modal-err" style="color:var(--red);font-size:.8rem;margin-bottom:8px;display:none"></div>

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="libFecharModal()">Cancelar</button>
      <button class="lib-btn-save" id="lib-btn-save" onclick="libSalvarCliente()">Salvar Cliente</button>
    </div>
  `;

  modal.classList.add('open');
  modal.onclick = e => { if (e.target === modal) libFecharModal(); };
  document.getElementById('lib-f-cpf')?.focus();
}

export function libFecharModal() {
  document.getElementById('lib-modal')?.classList.remove('open');
}

export function libCalcPreview() {
  const sd    = parseBRL(document.getElementById('lib-f-sd')?.value) || 0;
  const troco = parseBRL(document.getElementById('lib-f-troco')?.value) || 0;
  const total = sd + troco;
  const fmt   = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const t = document.getElementById('lib-prev-total');
  const c = document.getElementById('lib-prev-com');
  if (t) t.textContent = fmt(total);
  if (c) c.textContent = fmt(total * 0.06);
}

export async function libSalvarCliente() {
  const dados = _coletarFormCliente();
  if (!dados) return;
  const { cpf, nome, convenio, produto, sd, troco, obs } = dados;

  const btn = document.getElementById('lib-btn-save');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const { error } = await insertLiberacao({
    cpf,
    nome,
    convenio,
    produto,
    empresa_parceira: empresaParceira(),
    saldo_devedor:    sd,
    troco,
    data_quitado:     new Date().toISOString().slice(0,10),
    obs,
    aprovado:         false,
  });

  if (error) {
    const err = document.getElementById('lib-modal-err');
    err.textContent = 'Erro ao salvar: ' + error.message;
    err.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Salvar Cliente';
    return;
  }

  libFecharModal();
  toast('Cliente salvo com sucesso!');
  await reloadAndRender();
}
