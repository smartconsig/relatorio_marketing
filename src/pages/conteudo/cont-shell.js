// Shell da Esteira de Conteúdo (renderizado uma vez): toolbar, board, modal
// do card, modal de motivo e lightbox. Os listeners são ligados pelo
// orquestrador (bindShell em conteudo-page.js).
import { COLUNAS, CANAIS, TIPOS, statusDoTipo } from '../../services/conteudo-svc.js';

export function shellHTML() {
  const canalOpts = CANAIS.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
  return `
  <div class="cont-wrap">
    <div class="cont-toolbar">
      <div class="cont-toolbar-left">
        <button class="btn btn-primary" id="cont-novo">+ Novo conteúdo</button>
        <select class="cont-select" id="cont-filtro-resp">
          <option value="">Todos os responsáveis</option>
        </select>
        <select class="cont-select" id="cont-filtro-canal">
          <option value="">Todos os canais</option>
          ${canalOpts}
        </select>
      </div>
      <div class="cont-toolbar-right">
        <span class="cont-hint" id="cont-resumo"></span>
      </div>
    </div>

    <div class="cont-board" id="cont-board"></div>
  </div>

  <!-- Modal: criar/editar card -->
  <div class="cont-modal-bg" id="cont-modal" style="display:none">
    <div class="cont-modal">
      <div class="cont-modal-head">
        <h3 id="cont-modal-title">Novo conteúdo</h3>
        <button class="cont-x" id="cont-fechar">&times;</button>
      </div>
      <div class="cont-modal-body">
        <label class="cont-label">Título</label>
        <input class="cont-input" id="cont-f-titulo" placeholder="Ex.: Reels — 3 erros ao pedir empréstimo" maxlength="140">

        <div class="cont-row">
          <div>
            <label class="cont-label">Canal</label>
            <select class="cont-input" id="cont-f-canal">
              <option value="">—</option>
              ${canalOpts}
            </select>
          </div>
          <div>
            <label class="cont-label">Responsável</label>
            <select class="cont-input" id="cont-f-resp"></select>
          </div>
        </div>

        <div class="cont-row">
          <div>
            <label class="cont-label">Tipo</label>
            <select class="cont-input" id="cont-f-tipo">
              <option value="">—</option>
              ${TIPOS.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="cont-label">Status de produção</label>
            <select class="cont-input" id="cont-f-status"></select>
          </div>
        </div>

        <div class="cont-row">
          <div>
            <label class="cont-label">Data alvo</label>
            <input class="cont-input" id="cont-f-data" type="date">
          </div>
          <div>
            <label class="cont-label">Etapa</label>
            <select class="cont-input" id="cont-f-coluna">
              ${COLUNAS.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <label class="cont-label">Link (Drive, Canva…)</label>
        <input class="cont-input" id="cont-f-link" placeholder="https://">

        <label class="cont-label">Descrição / briefing</label>
        <textarea class="cont-input cont-textarea" id="cont-f-desc" rows="3"></textarea>

        <div class="cont-anexos-wrap" id="cont-anexos-wrap">
          <div class="cont-hist-head">
            Artes
            <button class="cont-anexar" id="cont-anexar">+ Anexar imagem</button>
          </div>
          <div class="cont-anexos" id="cont-anexos"></div>
          <input type="file" id="cont-file" accept="image/*" multiple hidden>
        </div>

        <div class="cont-hist-wrap" id="cont-hist-wrap">
          <div class="cont-hist-head">Histórico</div>
          <div class="cont-hist" id="cont-hist"></div>
          <div class="cont-chat-box" id="cont-chat-box">
            <textarea class="cont-input cont-textarea" id="cont-chat-txt" rows="2"
                      placeholder="Escreva um comentário… (Enter envia)"></textarea>
            <button class="btn btn-ghost cont-chat-send" id="cont-chat-send">Enviar</button>
          </div>
        </div>
      </div>
      <div class="cont-modal-foot">
        <button class="btn btn-ghost cont-del" id="cont-excluir">Excluir</button>
        <div class="cont-foot-right">
          <button class="btn btn-ghost" id="cont-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="cont-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: motivo do ajuste -->
  <div class="cont-modal-bg" id="cont-motivo-modal" style="display:none">
    <div class="cont-modal cont-modal-sm">
      <div class="cont-modal-head">
        <h3>Pedir ajustes</h3>
        <button class="cont-x" id="cont-motivo-x">&times;</button>
      </div>
      <div class="cont-modal-body">
        <p class="cont-hint" style="margin-bottom:10px">O card volta para <b>Em produção</b> com o motivo registrado.</p>
        <label class="cont-label">O que precisa ser ajustado?</label>
        <textarea class="cont-input cont-textarea" id="cont-motivo-txt" rows="3" placeholder="Ex.: faltou a legenda e o CTA no final"></textarea>
      </div>
      <div class="cont-modal-foot">
        <div class="cont-foot-right">
          <button class="btn btn-ghost" id="cont-motivo-cancel">Cancelar</button>
          <button class="btn btn-primary" id="cont-motivo-ok">Enviar para ajustes</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Visualizador de imagem -->
  <div class="cont-lightbox" id="cont-lightbox" style="display:none">
    <img id="cont-lightbox-img" alt="">
  </div>`;
}

/**
 * Preenche o select de status do modal conforme o tipo escolhido.
 * Sem tipo, o campo fica vazio e desabilitado — status só existe com tipo.
 */
export function popularStatusModal(tipo, atual) {
  const sel = document.getElementById('cont-f-status');
  if (!tipo) {
    sel.innerHTML = '<option value="">—</option>';
    sel.value = '';
    sel.disabled = true;
    return;
  }
  const validos = statusDoTipo(tipo);
  sel.innerHTML = validos.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
  sel.value = validos.some(s => s.key === atual) ? atual : 'roteiro';
  sel.disabled = false;
}
