// Vista de detalhe da Quitação: comprovante "impresso", visualizador de
// documento (Storage assinado + fallback base64 legado) e o modal de
// comprovante estilo transferência. Recebe sempre o cliente `c` por parâmetro.
import { getDocSignedUrl } from '../../services/quitacoes-service.js';

function _money(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _fmtDate(str) {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function renderDetail(c) {
  const vd = document.getElementById('q-view-detail');
  if (!vd) return;

  const p      = c.profissional || {};
  const q      = c.quitacao    || {};
  const hasDoc = !!(c.doc_path || c.doc_pdf);
  const hasQuit = q.val_boleto || q.val_ted;

  vd.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <button class="q-back-btn" style="margin-bottom:0" onclick="q_backToList()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Voltar à lista
      </button>
      <button onclick="q_openEditModal('${c.id}')"
        style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:var(--surface3);border:1px solid var(--border);color:var(--white);border-radius:8px;font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;transition:border-color .15s"
        onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>
    </div>

    <div class="q-split">

      <!-- ESQUERDA: comprovante (branco) -->
      <div class="q-split-left">
        <div class="q-comprovante">

          <div class="q-comp-header">
            <div class="q-comp-brand">Smart<em>Consig</em></div>
            <span class="q-comp-status" style="${hasQuit ? '' : 'background:#bf360c'}">
              ${hasQuit ? '✓ QUITADO' : 'PENDENTE'}
            </span>
          </div>

          <div class="q-comp-body">

            <!-- Dados Pessoais -->
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados Pessoais</div>
              <div class="q-comp-row"><span class="lbl">Nome</span><span class="val">${c.nome}</span></div>
              <div class="q-comp-row"><span class="lbl">CPF</span><span class="val">${c.cpf || '—'}</span></div>
              ${c.rg ? `<div class="q-comp-row"><span class="lbl">RG</span><span class="val">${c.rg}</span></div>` : ''}
              ${c.endereco ? `<div class="q-comp-row">
                <span class="lbl">Endereço</span>
                <span class="val" style="font-size:11px;max-width:58%;text-align:right">
                  ${c.endereco}${c.bairro ? ', ' + c.bairro : ''}${c.cidade ? ', ' + c.cidade : ''}${c.uf ? ' / ' + c.uf : ''}
                </span>
              </div>` : ''}
              ${c.cep ? `<div class="q-comp-row"><span class="lbl">CEP</span><span class="val">${c.cep}</span></div>` : ''}
            </div>

            <!-- Dados Profissionais -->
            ${p.cargo || p.unidade ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados Profissionais</div>
              ${p.cargo     ? `<div class="q-comp-row"><span class="lbl">Cargo</span><span class="val">${p.cargo}</span></div>` : ''}
              ${p.categoria ? `<div class="q-comp-row"><span class="lbl">Categoria</span><span class="val">${p.categoria}</span></div>` : ''}
              ${p.unidade   ? `<div class="q-comp-row">
                <span class="lbl">Unidade</span>
                <span class="val" style="font-size:11px;max-width:58%;text-align:right">${p.unidade}</span>
              </div>` : ''}
              ${p.banco_sal ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row"><span class="lbl">Banco (Salário)</span><span class="val">${p.banco_sal}</span></div>
              ` : ''}
              ${p.agencia ? `<div class="q-comp-row"><span class="lbl">Agência</span><span class="val">${p.agencia}</span></div>` : ''}
              ${p.conta   ? `<div class="q-comp-row"><span class="lbl">Conta Corrente</span><span class="val">${p.conta}</span></div>` : ''}
            </div>` : ''}

            <!-- Dados do Contrato -->
            ${q.banco || q.contrato ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Dados do Contrato</div>
              ${q.banco    ? `<div class="q-comp-row"><span class="lbl">Banco</span><span class="val">${q.banco}</span></div>` : ''}
              ${q.contrato ? `<div class="q-comp-row"><span class="lbl">Nº Contrato</span><span class="val">${q.contrato}</span></div>` : ''}
            </div>` : ''}

            <!-- Pagamentos -->
            ${hasQuit ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Pagamentos Realizados</div>

              ${q.val_boleto ? `
              <div class="q-comp-row q-boleto-click" onclick="q_showComprovante('${c.id}')" title="Ver comprovante">
                <span class="lbl">Boleto quitado <span style="font-size:10px;color:#940b10;margin-left:6px;font-weight:700">↗ comprovante</span></span>
                <span class="val green">${_money(q.val_boleto)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data do pagamento</span>
                <span class="val muted">${_fmtDate(q.data_boleto)}</span>
              </div>` : ''}

              ${q.val_ted ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row q-boleto-click" onclick="q_showComprovante('${c.id}')" title="Ver comprovante">
                <span class="lbl">Carta TED quitada ${!q.val_boleto ? '<span style="font-size:10px;color:#940b10;margin-left:6px;font-weight:700">↗ comprovante</span>' : ''}</span>
                <span class="val green">${_money(q.val_ted)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data do pagamento</span>
                <span class="val muted">${_fmtDate(q.data_ted)}</span>
              </div>` : ''}

              ${q.devolvida ? `
              <div class="q-comp-divider"></div>
              <div class="q-comp-row">
                <span class="lbl">TED devolvida</span>
                <span class="val red">− ${_money(q.val_devolucao)}</span>
              </div>
              <div class="q-comp-row" style="margin-top:-4px">
                <span class="lbl" style="font-size:11px">Data da devolução</span>
                <span class="val muted">${_fmtDate(q.data_devolucao)}</span>
              </div>` : ''}
            </div>` : ''}

            <!-- Pagador -->
            ${q.pag_nome ? `
            <div class="q-comp-section">
              <div class="q-comp-section-title">Pagador</div>
              <div class="q-comp-row">
                <span class="lbl">Empresa</span>
                <span class="val" style="font-size:11px;max-width:60%;text-align:right">${q.pag_nome}</span>
              </div>
              ${q.pag_cnpj ? `<div class="q-comp-row"><span class="lbl">CNPJ</span><span class="val">${q.pag_cnpj}</span></div>` : ''}
            </div>` : ''}

          </div><!-- /comp-body -->

          <!-- Anexar documento (se não tiver) -->
          ${!hasDoc ? `
          <div style="padding:0 22px 18px">
            <div class="q-attach-bar">
              <span>Nenhum documento anexado.</span>
              <label class="btn-sm btn-ghost" style="cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Anexar Documento
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style="display:none" onchange="q_attachDoc('${c.id}', this)">
              </label>
            </div>
          </div>` : ''}

        </div><!-- /q-comprovante -->
      </div><!-- /q-split-left -->

      <!-- DIREITA: visualizador de documento -->
      <div class="q-split-right" id="q-doc-panel">
        ${hasDoc
          ? `<div class="q-no-doc" id="q-doc-loading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:.3">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div style="font-size:13px;font-weight:700;color:var(--gray-light)">Carregando documento...</div>
            </div>`
          : `<div class="q-no-doc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style="font-size:13px;font-weight:700;color:var(--gray-light)">Documento não anexado</div>
              <div style="font-size:12px">Clique em "Anexar Documento" ao lado.</div>
            </div>`}
      </div>

    </div><!-- /q-split -->`;

  if (hasDoc) _renderDoc(c);
}

function _showDocUrl(url, nome) {
  const panel = document.getElementById('q-doc-panel');
  if (!panel) return;
  const ext = (nome || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    panel.innerHTML = `<img src="${url}" style="width:100%;height:auto;border-radius:6px;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.4)">`;
  } else {
    panel.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="width:100%;height:100%;min-height:400px;border:none;border-radius:6px"></iframe>`;
  }
}

async function _renderDoc(c) {
  const panel = document.getElementById('q-doc-panel');
  if (!panel) return;

  // ── Storage (novo) ────────────────────────────────
  if (c.doc_path) {
    try {
      const url = await getDocSignedUrl(c.doc_path);
      _showDocUrl(url, c.doc_nome);
    } catch (e) {
      panel.innerHTML = `<div class="q-no-doc"><div>Erro ao carregar o documento.</div></div>`;
      console.error(e);
    }
    return;
  }

  // ── Legado base64 ────────────────────────────────
  if (c.doc_pdf) {
    if (c.doc_pdf.startsWith('data:image/')) {
      panel.innerHTML = `<img src="${c.doc_pdf}" style="width:100%;height:auto;border-radius:6px;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.4)">`;
    } else {
      try {
        const base64 = c.doc_pdf.split(',')[1];
        const binary  = atob(base64);
        const bytes   = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);
        panel.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="width:100%;height:100%;min-height:400px;border:none;border-radius:6px"></iframe>`;
      } catch (e) {
        panel.innerHTML = `<div class="q-no-doc"><div>Erro ao carregar o documento.</div></div>`;
        console.error(e);
      }
    }
  }
}

export function buildComprovanteHTML(c) {
  const q      = c.quitacao    || {};
  const p      = c.profissional || {};
  const dataStr = q.data_hora_tx || '—';
  const txId    = q.txid || '—';
  const valorTx = (q.val_boleto && q.val_boleto > 0) ? q.val_boleto : q.val_ted;

  return `
    <div style="padding:22px 26px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0">
      <div style="font-size:14px;font-weight:800;color:#1a1a1a;font-family:var(--font-h)">Comprovante de transferência</div>
      <button onclick="q_closeComprovante()" style="width:30px;height:30px;border-radius:8px;border:none;background:#f0f0f0;cursor:pointer;font-size:17px;color:#5e5e5e;display:flex;align-items:center;justify-content:center">×</button>
    </div>
    <div style="padding:0 26px 26px">

      <div class="q-nu-date">${dataStr}</div>

      <div class="q-nu-section">
        <div class="q-nu-row">
          <span class="q-nu-lbl">Valor</span>
          <span class="q-nu-val">${_money(valorTx)}</span>
        </div>
        <div class="q-nu-row">
          <span class="q-nu-lbl">Tipo de transferência</span>
          <span class="q-nu-val">TED</span>
        </div>
        <div class="q-nu-row">
          <span class="q-nu-lbl">ID da transação</span>
          <span class="q-nu-val q-nu-txid">${txId}</span>
        </div>
      </div>

      <div class="q-nu-group-label">Destino</div>
      <div class="q-nu-section">
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${q.destino_nome || q.banco || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CNPJ</span><span class="q-nu-val">${q.destino_cnpj || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Banco</span><span class="q-nu-val">${q.destino_banco || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${q.destino_agencia || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${q.destino_conta || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Tipo de conta</span><span class="q-nu-val">Conta Corrente</span></div>
      </div>

      <div class="q-nu-group-label">Origem</div>
      <div class="q-nu-section">
        ${q.origem_nome ? `
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${q.origem_nome}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CNPJ</span><span class="q-nu-val">${q.origem_cnpj || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${q.origem_agencia || '—'}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${q.origem_conta || '—'}</span></div>
        ` : `
        <div class="q-nu-row"><span class="q-nu-lbl">Nome</span><span class="q-nu-val">${c.nome}</span></div>
        <div class="q-nu-row"><span class="q-nu-lbl">CPF</span><span class="q-nu-val">${c.cpf || '—'}</span></div>
        ${p.banco_sal ? `<div class="q-nu-row"><span class="q-nu-lbl">Banco</span><span class="q-nu-val">${p.banco_sal}</span></div>` : ''}
        ${p.agencia   ? `<div class="q-nu-row"><span class="q-nu-lbl">Agência</span><span class="q-nu-val">${p.agencia}</span></div>` : ''}
        ${p.conta     ? `<div class="q-nu-row"><span class="q-nu-lbl">Conta</span><span class="q-nu-val">${p.conta}</span></div>` : ''}
        `}
      </div>

    </div>`;
}

