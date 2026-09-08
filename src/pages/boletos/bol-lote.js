// Importação de lote (ZIP de boletos ou faturas) da Quitação de Boleto.
// Casa com clientes em boleto_solicitado/boleto_enviado; quem estava
// SOLICITADO e recebe o 1º doc vira BOLETO_ENVIADO (trigger no banco).
// Nada é gravado antes da tela de conferência.
import { icon } from '../../utils/icons.js';
import { toast } from '../../utils/ui.js';
import { analisarZipBoletos, executarImportBoletos } from '../../services/boleto-docs-svc.js';
import { BO, fmtCpf, esc, elegiveis, loadData } from './bol-core.js';
import { updateTable } from './bol-tabela.js';

export function bolAbrirLote() {
  if (!elegiveis().length) {
    toast('Nenhum cliente em Boleto Solicitado/Enviado — o lote não teria com quem casar.', 'err');
    return;
  }
  document.getElementById('bol-zip-input')?.click();
}

export async function bolOnZipFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;

  const content = document.getElementById('bol-lote-content');
  const modal   = document.getElementById('bol-lote-modal');
  if (!content || !modal) return;

  modal.classList.add('open');
  modal.onclick = null; // durante análise/upload não fecha clicando fora
  content.innerHTML = `
    <h2 class="lib-modal-title">Importar lote de documentos</h2>
    <p style="font-size:.85rem;color:var(--gray);margin:0 0 14px">${esc(file.name)} · ${(file.size/1048576).toFixed(1)} MB</p>
    <div class="res-progress"><div class="res-progress-bar" id="bol-prg-bar" style="width:2%"></div></div>
    <p class="res-prg-txt" id="bol-prg-txt">Abrindo o arquivo…</p>
  `;

  try {
    const todosDocs = [...(BO.docs.values() || [])].flat();
    BO.plano = await analisarZipBoletos(file, elegiveis(), todosDocs, (n, total, etapa) => {
      const b = document.getElementById('bol-prg-bar');
      const t = document.getElementById('bol-prg-txt');
      if (b && total) b.style.width = Math.max(2, Math.round((n/total)*100)) + '%';
      if (t) t.textContent = etapa || `Analisando ${n}/${total}…`;
    });
  } catch (e) {
    console.error(e);
    content.innerHTML = `
      <h2 class="lib-modal-title">Importar lote de documentos</h2>
      <p style="color:var(--red-hover);font-size:.9rem">Não consegui ler o ZIP: ${esc(e?.message || 'erro desconhecido')}</p>
      <div class="lib-modal-actions"><button class="lib-btn-save" onclick="bolFecharLote()">Fechar</button></div>`;
    return;
  }

  _renderConferenciaLote(file.name);
}

function _renderConferenciaLote(zipName) {
  const content = document.getElementById('bol-lote-content');
  const modal   = document.getElementById('bol-lote-modal');
  if (!content || !modal || !BO.plano) return;
  modal.onclick = null;

  const { itens, orfaos, jaAnexados, clientesSemArquivo } = BO.plano;
  const clientesCasados = new Set(itens.map(i => i.alvo.id)).size;
  const viraEnviado = new Set(itens.filter(i => i.alvo.status === 'boleto_solicitado').map(i => i.alvo.id)).size;

  const amostra = itens.slice(0, 60);
  const linhas = amostra.map(i => `
    <div class="res-mrow">
      <span class="res-mfile" title="${esc(i.nomeArquivo)}">${i.tipo === 'boleto' ? icon('file', 11) : icon('receipt', 11)} ${esc(i.nomeArquivo)}</span>
      <span class="res-mto">→</span>
      <span class="res-mwho" title="${esc(i.alvo.nome)} · ${esc(i.alvo.produto || '')}">${esc(i.alvo.nome)}</span>
      <span class="res-mtag ${i.metodo === 'nome' ? 'res-mtag-nome' : 'res-mtag-cpf'}">${i.metodo === 'nome' ? 'nome ≈' : 'CPF ✓'}</span>
    </div>`).join('');

  const eleg = elegiveis();
  const orfLinhas = orfaos.map((o, idx) => `
    <div class="res-orow">
      <span class="res-mfile" title="${esc(o.path)}">${o.tipo === 'boleto' ? icon('file', 11) : icon('receipt', 11)} ${esc(o.nomeArquivo)}<em class="res-omotivo">${esc(o.motivo || '')}</em></span>
      <select class="res-osel" onchange="bolAtribuirOrfaoLote(${idx}, this.value)">
        <option value="">Ignorar este arquivo</option>
        ${eleg.map(r => `<option value="${r.id}">${esc(r.nome)} · ${fmtCpf(r.cpf)} · ${esc(r.produto || '')}</option>`).join('')}
      </select>
    </div>`).join('');

  const semArq = clientesSemArquivo.length
    ? `<div class="res-sumchip res-sum-warn" title="${esc(clientesSemArquivo.map(c => c.nome).join(', '))}">${clientesSemArquivo.length} cliente(s) em Solicitado sem arquivo neste lote</div>`
    : '';

  content.innerHTML = `
    <h2 class="lib-modal-title">Conferência do lote</h2>
    <p style="font-size:.85rem;color:var(--gray);margin:0 0 12px">${esc(zipName)} — nada foi gravado ainda. Confira e confirme.</p>

    <div class="res-sumchips">
      <div class="res-sumchip res-sum-ok">${itens.length} documento(s) para anexar em ${clientesCasados} cliente(s)</div>
      ${viraEnviado ? `<div class="res-sumchip">${viraEnviado} cliente(s) passarão de Solicitado para Enviado</div>` : ''}
      ${jaAnexados.length ? `<div class="res-sumchip">${jaAnexados.length} já anexado(s) antes — serão pulados</div>` : ''}
      ${orfaos.length ? `<div class="res-sumchip res-sum-warn">${orfaos.length} sem correspondência</div>` : ''}
      ${semArq}
    </div>

    ${itens.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Casamentos propostos${itens.length > amostra.length ? ` (mostrando ${amostra.length} de ${itens.length})` : ''}</div>
        <div class="res-mbody">${linhas}</div>
      </div>` : ''}

    ${orfaos.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Sem correspondência — atribuir manualmente ou ignorar</div>
        <div class="res-mbody">${orfLinhas}</div>
      </div>` : ''}

    <div class="lib-modal-actions">
      <button class="lib-btn-cancel" onclick="bolFecharLote()">Cancelar</button>
      <button class="lib-btn-save" id="bol-btn-lote" onclick="bolConfirmarLote()">Confirmar e anexar</button>
    </div>
  `;
  _updateLoteBtn();
}

function _updateLoteBtn() {
  const btn = document.getElementById('bol-btn-lote');
  if (!btn || !BO.plano) return;
  const extra = BO.plano.orfaos.filter(o => o._alvoId).length;
  const total = BO.plano.itens.length + extra;
  btn.disabled = total === 0;
  btn.textContent = `Confirmar e anexar ${total} documento(s)`;
}

export function bolAtribuirOrfaoLote(idx, boletoId) {
  if (!BO.plano?.orfaos?.[idx]) return;
  BO.plano.orfaos[idx]._alvoId = boletoId || null;
  _updateLoteBtn();
}

export async function bolConfirmarLote() {
  if (!BO.plano || BO.importando) return;
  const content = document.getElementById('bol-lote-content');
  if (!content) return;

  const atribuidos = BO.plano.orfaos
    .filter(o => o._alvoId)
    .map(o => ({
      alvo: BO.registros.find(r => r.id === o._alvoId),
      nomeArquivo: o.nomeArquivo, tipo: o.tipo, contrato: o.contrato,
      blob: o.blob, metodo: 'manual',
    }))
    .filter(i => i.alvo);

  const fila = [...BO.plano.itens, ...atribuidos];
  if (!fila.length) return;

  BO.importando = true;
  content.innerHTML = `
    <h2 class="lib-modal-title">Anexando documentos…</h2>
    <div class="res-progress"><div class="res-progress-bar" id="bol-prg-bar" style="width:2%"></div></div>
    <p class="res-prg-txt" id="bol-prg-txt">Enviando 1/${fila.length}…</p>
    <p style="font-size:.78rem;color:var(--gray)">Não feche esta janela até terminar.</p>
  `;

  const { ok, falhas } = await executarImportBoletos(fila, (n, total, item) => {
    const b = document.getElementById('bol-prg-bar');
    const t = document.getElementById('bol-prg-txt');
    if (b) b.style.width = Math.max(2, Math.round((n/total)*100)) + '%';
    if (t) t.textContent = item ? `Enviando ${n+1}/${total} — ${item.nomeArquivo}` : 'Finalizando…';
  });

  BO.importando = false;
  await loadData();
  updateTable();

  content.innerHTML = `
    <h2 class="lib-modal-title">Importação concluída</h2>
    <div class="res-sumchips" style="margin-top:8px">
      <div class="res-sumchip res-sum-ok">${ok.length} documento(s) anexado(s)</div>
      ${falhas.length ? `<div class="res-sumchip res-sum-err">${falhas.length} falha(s)</div>` : ''}
    </div>
    ${falhas.length ? `
      <div class="res-mtbl">
        <div class="res-mhead">Falhas (o restante foi gravado normalmente)</div>
        <div class="res-mbody">${falhas.map(f => `
          <div class="res-mrow">
            <span class="res-mfile">${esc(f.nomeArquivo)}</span>
            <span class="res-mto">·</span>
            <span class="res-mwho" style="color:var(--red-hover)">${esc(f.erro)}</span>
            <span></span>
          </div>`).join('')}</div>
      </div>
      <p style="font-size:.8rem;color:var(--gray)">Importe o mesmo ZIP de novo para tentar só as falhas — o que já foi anexado é pulado automaticamente.</p>` : ''}
    <div class="lib-modal-actions">
      <button class="lib-btn-save" onclick="bolFecharLote()">Fechar</button>
    </div>
  `;
  BO.plano = null;
}

export function bolFecharLote() {
  const modal = document.getElementById('bol-lote-modal');
  if (modal) modal.classList.remove('open');
  BO.plano = null;
}
