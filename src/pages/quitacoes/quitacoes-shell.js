// Shell estático da tela de Quitações: vistas lista/detalhe, modal de
// cadastro (34 campos) e modal de comprovante. Construído uma única vez por
// sessão (flag Q.built no orquestrador). Os on* inline chamam os globais q_*.

function _inp(id, placeholder, extra = '') {
  return `<input type="text" id="${id}" placeholder="${placeholder}" class="q-form-input" ${extra}>`;
}
function _dat(id) {
  return `<input type="date" id="${id}" class="q-form-input">`;
}

export function buildShell(el) {
  el.innerHTML = `
    <div style="padding:28px 30px;max-width:1200px">

      <!-- Vista: Lista -->
      <div id="q-view-list">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px">
          <div>
            <div style="font-size:20px;font-family:var(--font-h);font-weight:800;color:var(--white)">Quitações</div>
            <div style="font-size:12px;color:var(--gray);margin-top:4px">Comprovantes de pagamento e quitação de contratos</div>
          </div>
          <button onclick="q_openModal()" style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Cliente
          </button>
        </div>

        <!-- Busca -->
        <div style="position:relative;margin-bottom:16px">
          <svg style="position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--gray);pointer-events:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="q-search" type="text" placeholder="Pesquisar por nome ou CPF..."
            oninput="q_search(this.value)"
            style="width:100%;padding:11px 16px 11px 42px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--white);font-family:var(--font-b);font-size:13px;outline:none;transition:border-color .15s"
            onfocus="this.style.borderColor='var(--red)'" onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- Stats -->
        <div id="q-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px"></div>

        <!-- Tabela -->
        <div id="q-table"></div>
      </div>

      <!-- Vista: Detalhe -->
      <div id="q-view-detail" style="display:none"></div>

    </div>

    <!-- ── Modal: Novo Cliente ─────────────────────────── -->
    ${_modalClienteHTML()}

    <!-- ── Modal: Comprovante ──────────────────────────── -->
    ${_modalComprovanteHTML()}
  `;
}

// Campos de quitação + destino TED do formulário (mesmos IDs q-f-*)
function _camposQuitacaoHTML() {
  return `
            <div class="q-form-divider"><span>Dados de Quitação</span></div>

            <div class="q-form-group">
              <label class="q-form-label">Banco</label>
              ${_inp('q-f-banco', 'Ex: Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Nº Contrato</label>
              ${_inp('q-f-contrato', 'Ex: 857102')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Valor Boleto Quitado</label>
              ${_inp('q-f-boleto-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Data Quitação Boleto</label>
              ${_dat('q-f-boleto-data')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Valor Carta TED</label>
              ${_inp('q-f-ted-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Data Quitação TED</label>
              ${_dat('q-f-ted-data')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">TED Devolvida?</label>
              <select id="q-f-devolvida" class="q-form-input" onchange="q_toggleDev()">
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div class="q-form-group" id="q-grp-dev-data" style="display:none">
              <label class="q-form-label">Data Devolução</label>
              ${_dat('q-f-dev-data')}
            </div>
            <div class="q-form-group full" id="q-grp-dev-val" style="display:none">
              <label class="q-form-label">Valor Devolvido</label>
              ${_inp('q-f-dev-val', 'R$ 0,00', 'oninput="q_maskMoney(this)"')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Pagador — Empresa</label>
              ${_inp('q-f-pag-nome', 'Razão Social da empresa pagadora')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">CNPJ do Pagador</label>
              ${_inp('q-f-pag-cnpj', '00.000.000/0000-00', 'oninput="q_maskCNPJ(this)"')}
            </div>

            <div class="q-form-divider"><span>Dados do Destino (TED)</span></div>

            <div class="q-form-group full">
              <label class="q-form-label">Nome do Destino</label>
              ${_inp('q-f-dest-nome', 'Ex: Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CNPJ do Destino</label>
              ${_inp('q-f-dest-cnpj', '00.000.000/0000-00', 'oninput="q_maskCNPJ(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Banco Destino</label>
              ${_inp('q-f-dest-banco', 'Ex: 643 - Banco Pine S/A')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Agência Destino</label>
              ${_inp('q-f-dest-agencia', 'Ex: 0001-9')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Conta Destino</label>
              ${_inp('q-f-dest-conta', 'Ex: 900.026-9')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">ID da Transação (TXID)</label>
              ${_inp('q-f-txid', 'Ex: E1A2B3C4D...')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Data e Hora da Transação</label>
              ${_inp('q-f-data-hora-tx', 'Ex: 09 ABR 2026 - 14:32:17')}
            </div>

  `;
}

// ── Modal de cadastro/edição (contrato de IDs q-f-* com quitacoes-form) ────
function _modalClienteHTML() {
  return `
    <div id="q-modal-overlay" onclick="if(event.target===this)q_closeModal()"
      style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;padding:20px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto">
        <div style="padding:22px 26px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface2);z-index:10">
          <div id="q-modal-title" style="font-family:var(--font-h);font-size:16px;font-weight:800;color:var(--white)">Novo Cliente</div>
          <button onclick="q_closeModal()" style="width:30px;height:30px;border-radius:8px;border:none;background:var(--surface3);cursor:pointer;font-size:17px;color:var(--gray);display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="padding:22px 26px">
          <div class="q-form-grid">

            <div class="q-form-group full">
              <label class="q-form-label">Nome Completo</label>
              ${_inp('q-f-nome', 'Ex: WILTON BORGES VIANA')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CPF</label>
              ${_inp('q-f-cpf', '000.000.000-00', 'oninput="q_maskCPF(this)"')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">RG</label>
              ${_inp('q-f-rg', 'Ex: 21.973.887-7')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Telefone</label>
              ${_inp('q-f-tel', '(11) 99999-9999')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">CEP</label>
              ${_inp('q-f-cep', '00000-000')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Endereço</label>
              ${_inp('q-f-end', 'Rua, número')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Bairro</label>
              ${_inp('q-f-bairro', 'Bairro')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Cidade</label>
              ${_inp('q-f-cidade', 'Cidade')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">UF</label>
              ${_inp('q-f-uf', 'SP')}
            </div>

            ${_camposQuitacaoHTML()}

            <div class="q-form-divider"><span>Dados Profissionais</span></div>

            <div class="q-form-group full">
              <label class="q-form-label">Cargo / Função</label>
              ${_inp('q-f-cargo', 'Ex: Policial Penal IV')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Categoria</label>
              ${_inp('q-f-categoria', 'Ex: Titular de Cargo Efetivo')}
            </div>
            <div class="q-form-group full">
              <label class="q-form-label">Órgão / Unidade</label>
              ${_inp('q-f-unidade', 'Ex: Centro de Detenção Provisória de Suzano')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Banco (Salário)</label>
              ${_inp('q-f-banco-sal', 'Ex: Banco do Brasil')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Agência</label>
              ${_inp('q-f-agencia', 'Ex: 0097')}
            </div>
            <div class="q-form-group">
              <label class="q-form-label">Conta Corrente</label>
              ${_inp('q-f-conta', 'Ex: 71921-8')}
            </div>

            <div class="q-form-divider"><span>Documento do Cliente (PDF ou Imagem)</span></div>

            <div class="q-file-upload" id="q-upload-area" onclick="document.getElementById('q-f-doc').click()">
              <input type="file" id="q-f-doc" accept=".pdf,.png,.jpg,.jpeg" onchange="q_onDocSelect(this)" style="display:none">
              <div style="font-size:13px;font-weight:600;color:var(--gray-light)">Clique para selecionar o documento</div>
              <div style="font-size:11px;color:var(--gray);margin-top:4px">PDF, PNG ou JPEG — CNH, RG ou outro documento</div>
            </div>
            <div class="q-file-done" id="q-file-done" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span id="q-file-done-name"></span>
            </div>

          </div>
        </div>
        <div style="padding:0 26px 22px;display:flex;justify-content:flex-end;gap:10px">
          <button onclick="q_closeModal()" class="btn-sm btn-ghost">Cancelar</button>
          <button onclick="q_save()" class="btn-sm btn-primary">Salvar Cliente</button>
        </div>
      </div>
    </div>

  `;
}

// ── Modal do comprovante estilo transferência ──────────────────────────────
function _modalComprovanteHTML() {
  return `
    <div id="q-comp-overlay" onclick="if(event.target===this)q_closeComprovante()"
      style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;align-items:center;justify-content:center;padding:20px">
      <div id="q-comp-content"
        style="background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:92vh;overflow-y:auto;color:#1a1a1a"></div>
    </div>  `;
}

