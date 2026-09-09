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
export function libEditarCliente(id) {
  const r = S.registros.find(x => x.id === id);
  if (!r) return;

  const content = document.getElementById('lib-modal-content');
  const modal   = document.getElementById('lib-modal');
  if (!content || !modal) return;

  content.innerHTML = `
    <h2 class="lib-modal-title">Editar Cliente</h2>

    <div class="lib-form-row">
      <label>CPF</label>
      <input type="text" id="lib-f-cpf" value="${esc(r.cpf || '')}" maxlength="14" />
    </div>

    <div class="lib-form-row">
      <label>Nome Completo</label>
      <input type="text" id="lib-f-nome" value="${esc(r.nome || '')}" />
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Convênio</label>
        <input type="text" id="lib-f-convenio" value="${esc(r.convenio || '')}" />
      </div>
      <div>
        <label>Produto</label>
        <input type="text" id="lib-f-produto" value="${esc(r.produto || '')}" />
      </div>
    </div>

    <div class="lib-form-row-2">
      <div>
        <label>Saldo Devedor (R$)</label>
        <input type="text" id="lib-f-sd" value="${r.saldo_devedor || 0}" oninput="libCalcPreview()" />
      </div>
      <div>
        <label>Troco (R$)</label>
        <input type="text" id="lib-f-troco" value="${r.troco || 0}" oninput="libCalcPreview()" />
      </div>
    </div>

    <div class="lib-calc-preview">
      <div class="lib-calc-preview-item">
        <span class="lbl">Saldo Total</span>
        <span class="val" id="lib-prev-total">${fmtBRL((r.saldo_devedor || 0) + (r.troco || 0))}</span>
      </div>
      <div class="lib-calc-preview-item">
        <span class="lbl">Comissão 6%</span>
        <span class="val" id="lib-prev-com">${fmtBRL(((r.saldo_devedor || 0) + (r.troco || 0)) * 0.06)}</span>
      </div>
    </div>

    <div class="lib-modal-auto">
      Empresa: <span>${esc(r.empresa_parceira)}</span> &nbsp;·&nbsp;
      Data Quitado: <span>${fmtDate(r.data_quitado)}</span>
    </div>

    <div class="lib-form-row">
      <label>Observações <span style="font-weight:400;text-transform:none">(opcional)</span></label>
      <textarea id="lib-f-obs">${esc(r.obs || '')}</textarea>
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

export async function libSalvarEdicao(id) {
  const cpf   = document.getElementById('lib-f-cpf')?.value.trim();
  const nome  = document.getElementById('lib-f-nome')?.value.trim();
  const sd    = parseBRL(document.getElementById('lib-f-sd')?.value);
  const troco = parseBRL(document.getElementById('lib-f-troco')?.value) || 0;
  const obs   = document.getElementById('lib-f-obs')?.value.trim() || null;
  const err   = document.getElementById('lib-modal-err');
  const btn   = document.getElementById('lib-btn-save');

  if (!cpf)       { err.textContent = 'Informe o CPF.';           err.style.display = ''; return; }
  if (!nome)      { err.textContent = 'Informe o nome.';          err.style.display = ''; return; }
  if (!sd || sd <= 0) { err.textContent = 'Informe o saldo devedor.'; err.style.display = ''; return; }

  const convenio = document.getElementById('lib-f-convenio')?.value.trim();
  const produto  = document.getElementById('lib-f-produto')?.value.trim();
  if (!convenio) { err.textContent = 'Informe o convênio.'; err.style.display = ''; return; }
  if (!produto)  { err.textContent = 'Informe o produto.';  err.style.display = ''; return; }

  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Salvando…';

  const { error } = await updateLiberacao(id, { cpf, nome, convenio, produto, saldo_devedor: sd, troco, obs });

  if (error) {
    handleError('Erro ao salvar.', error);
    btn.disabled = false; btn.textContent = 'Salvar';
    return;
  }

  const reg = S.registros.find(r => r.id === id);
  if (reg) { reg.cpf = cpf; reg.nome = nome; reg.convenio = convenio; reg.produto = produto; reg.saldo_devedor = sd; reg.troco = troco; reg.obs = obs; }

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
  const cpf   = document.getElementById('lib-f-cpf')?.value.trim();
  const nome  = document.getElementById('lib-f-nome')?.value.trim();
  const sd    = parseBRL(document.getElementById('lib-f-sd')?.value);
  const troco = parseBRL(document.getElementById('lib-f-troco')?.value) || 0;
  const obs   = document.getElementById('lib-f-obs')?.value.trim() || null;
  const err   = document.getElementById('lib-modal-err');
  const btn   = document.getElementById('lib-btn-save');

  if (!cpf)       { err.textContent = 'Informe o CPF.';           err.style.display = ''; return; }
  if (!nome)      { err.textContent = 'Informe o nome.';          err.style.display = ''; return; }
  if (!sd || sd <= 0) { err.textContent = 'Informe o saldo devedor.'; err.style.display = ''; return; }

  const convenio = document.getElementById('lib-f-convenio')?.value.trim();
  const produto  = document.getElementById('lib-f-produto')?.value.trim();
  if (!convenio) { err.textContent = 'Informe o convênio.'; err.style.display = ''; return; }
  if (!produto)  { err.textContent = 'Informe o produto.';  err.style.display = ''; return; }

  err.style.display = 'none';
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
