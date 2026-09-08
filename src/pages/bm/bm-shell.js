// Shell da Central de BMs (renderizado uma vez): toolbar, resumo, lista e
// os 4 modais (perfil, BM, número, motivo). Os listeners são ligados pelo
// orquestrador (bindShell em bm-page.js).
import { STATUS_NUMERO, QUALIDADES, TIERS } from '../../services/bm-svc.js';
import { opts } from './bm-core.js';

export function shellHTML() {
  return `
  <div class="bm-wrap">
    <div class="bm-toolbar">
      <div class="bm-toolbar-left">
        <button class="btn btn-primary" id="bm-novo-perfil">+ Novo Perfil</button>
        <div class="bm-seg">
          <button class="bm-seg-btn active" data-filtro="todos">Todos</button>
          <button class="bm-seg-btn" data-filtro="ativos">Ativos</button>
          <button class="bm-seg-btn" data-filtro="inativos">Inativos</button>
        </div>
        <input class="bm-input bm-search" id="bm-busca" placeholder="Buscar perfil, BM ou número…">
      </div>
    </div>

    <div class="bm-resumo" id="bm-resumo"></div>
    <div class="bm-lista" id="bm-lista"></div>
  </div>

  <!-- Modal: criar/editar perfil -->
  <div class="bm-modal-bg" id="bm-perfil-modal" style="display:none">
    <div class="bm-modal">
      <div class="bm-modal-head">
        <h3 id="bm-p-title">Novo Perfil</h3>
        <button class="bm-x" id="bm-p-x">&times;</button>
      </div>
      <div class="bm-modal-body">
        <label class="bm-label">Nome do perfil</label>
        <input class="bm-input" id="bm-p-nome" placeholder="Ex.: Perfil João" maxlength="120">

        <label class="bm-label">Observação</label>
        <textarea class="bm-input bm-textarea" id="bm-p-obs" rows="3"
                  placeholder="Ex.: perfil aquecido desde março, usado só para BMs de servidor"></textarea>

        <div class="bm-hist-wrap" id="bm-p-hist-wrap" style="display:none">
          <div class="bm-hist-head">Histórico</div>
          <div class="bm-hist" id="bm-p-hist"></div>
        </div>
      </div>
      <div class="bm-modal-foot">
        <button class="btn btn-ghost bm-del" id="bm-p-excluir">Excluir</button>
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-p-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="bm-p-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: criar/editar BM -->
  <div class="bm-modal-bg" id="bm-modal" style="display:none">
    <div class="bm-modal">
      <div class="bm-modal-head">
        <h3 id="bm-modal-title">Nova BM</h3>
        <button class="bm-x" id="bm-fechar">&times;</button>
      </div>
      <div class="bm-modal-body">
        <label class="bm-label">Nome da BM</label>
        <input class="bm-input" id="bm-f-nome" placeholder="Ex.: BM-07 Smart Vendas" maxlength="120">

        <label class="bm-label">Perfil</label>
        <select class="bm-input" id="bm-f-perfil"></select>

        <div class="bm-row">
          <div>
            <label class="bm-label">ID da BM na Meta</label>
            <input class="bm-input" id="bm-f-idmeta" placeholder="Opcional">
          </div>
          <div>
            <label class="bm-label">Data de criação</label>
            <input class="bm-input" id="bm-f-data" type="date">
          </div>
        </div>

        <label class="bm-label">Observação</label>
        <textarea class="bm-input bm-textarea" id="bm-f-obs" rows="3"
                  placeholder="Ex.: BM do cartão X, usada só para campanha de servidor"></textarea>

        <div class="bm-hist-wrap" id="bm-hist-wrap" style="display:none">
          <div class="bm-hist-head">Histórico</div>
          <div class="bm-hist" id="bm-hist"></div>
        </div>
      </div>
      <div class="bm-modal-foot">
        <button class="btn btn-ghost bm-del" id="bm-excluir">Excluir</button>
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="bm-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: criar/editar número oficial -->
  <div class="bm-modal-bg" id="bm-num-modal" style="display:none">
    <div class="bm-modal bm-modal-sm">
      <div class="bm-modal-head">
        <h3 id="bm-num-title">Novo número oficial</h3>
        <button class="bm-x" id="bm-num-x">&times;</button>
      </div>
      <div class="bm-modal-body">
        <div class="bm-row">
          <div>
            <label class="bm-label">Número</label>
            <input class="bm-input" id="bm-n-numero" placeholder="+55 62 90000-0000">
          </div>
          <div>
            <label class="bm-label">Nome de exibição</label>
            <input class="bm-input" id="bm-n-nome" placeholder="Ex.: Smart Consig">
          </div>
        </div>

        <div class="bm-row">
          <div>
            <label class="bm-label">Status</label>
            <select class="bm-input" id="bm-n-status">${opts(STATUS_NUMERO)}</select>
          </div>
          <div>
            <label class="bm-label">Qualidade</label>
            <select class="bm-input" id="bm-n-qual">${opts(QUALIDADES)}</select>
          </div>
        </div>

        <div class="bm-row">
          <div>
            <label class="bm-label">Limite de conversas</label>
            <select class="bm-input" id="bm-n-tier">${opts(TIERS)}</select>
          </div>
          <div>
            <label class="bm-label">Ativado em</label>
            <input class="bm-input" id="bm-n-data" type="date">
          </div>
        </div>

        <label class="bm-label">Observação</label>
        <textarea class="bm-input bm-textarea" id="bm-n-obs" rows="2"
                  placeholder="Ex.: banido após disparo em massa no dia 12"></textarea>
      </div>
      <div class="bm-modal-foot">
        <button class="btn btn-ghost bm-del" id="bm-n-excluir">Excluir</button>
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-n-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="bm-n-salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: motivo da desativação (BM ou perfil) -->
  <div class="bm-modal-bg" id="bm-motivo-modal" style="display:none">
    <div class="bm-modal bm-modal-sm">
      <div class="bm-modal-head">
        <h3 id="bm-motivo-title">Desativar</h3>
        <button class="bm-x" id="bm-motivo-x">&times;</button>
      </div>
      <div class="bm-modal-body">
        <p class="bm-hint" style="margin-bottom:10px">
          O motivo fica registrado no histórico — é ele que separa banimento de desativação por opção.
        </p>
        <label class="bm-label">Por que saiu do ar?</label>
        <select class="bm-input" id="bm-motivo-sel"></select>
        <label class="bm-label">Detalhe (opcional)</label>
        <textarea class="bm-input bm-textarea" id="bm-motivo-txt" rows="2"
                  placeholder="Ex.: banimento por política de mensagens"></textarea>
      </div>
      <div class="bm-modal-foot">
        <div class="bm-foot-right">
          <button class="btn btn-ghost" id="bm-motivo-cancel">Cancelar</button>
          <button class="btn btn-primary" id="bm-motivo-ok">Desativar</button>
        </div>
      </div>
    </div>
  </div>`;
}

