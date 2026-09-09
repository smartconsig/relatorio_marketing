// HTML dos cards da Central de BMs: perfil (nível 1) → BM (nível 2) →
// tabela de números. Funções puras de template — os listeners ficam em
// bm-lista.js.
import { perm } from '../../services/permissions.js';
import {
  B, MOTIVO_LABEL, MOTIVO_P_LABEL, STATUS_LABEL, QUAL_LABEL, TIER_LABEL,
  esc, fmtData, diasDesde, numerosDa, bmsDo, bmMatch,
} from './bm-core.js';

// ── card do perfil (nível 1) ─────────────────────────────────────────────────
function _perfilBadgeHTML(p) {
  return p.ativa
    ? '<span class="bm-badge ok">Ativo</span>'
    : `<span class="bm-badge ${p.motivo_inativa === 'banido' ? 'ruim' : 'off'}">${esc(MOTIVO_P_LABEL[p.motivo_inativa] || 'Inativo')}</span>`;
}

function _perfilResumoHTML(bms, nums) {
  const bmsBanidas = bms.filter(b => !b.ativa && b.motivo_inativa === 'banida').length;
  const numBanidos = nums.filter(n => n.status === 'banido').length;
  return [
    `${bms.length} BM${bms.length === 1 ? '' : 's'}`,
    `${nums.length} número${nums.length === 1 ? '' : 's'}`,
    bmsBanidas ? `<span class="bm-ruim-txt">${bmsBanidas} BM${bmsBanidas === 1 ? '' : 's'} banida${bmsBanidas === 1 ? '' : 's'}</span>` : null,
    numBanidos ? `<span class="bm-ruim-txt">${numBanidos} número${numBanidos === 1 ? '' : 's'} banido${numBanidos === 1 ? '' : 's'}</span>` : null,
  ].filter(Boolean).join(' · ');
}

export function perfilCardHTML(p) {
  const bms  = bmsDo(p.id);
  const nums = bms.flatMap(b => numerosDa(b.id));
  // busca ativa expande o perfil para mostrar onde bateu o resultado
  const aberta = B.abertosP.has(p.id) || (!!B.busca && bms.some(bm => bmMatch(bm)));
  const podeEditar = perm.bmEditar();
  const statusBadge = _perfilBadgeHTML(p);
  const resumo = _perfilResumoHTML(bms, nums);

  return `
    <div class="bm-card bm-perfil${p.ativa ? '' : ' off'}${aberta ? ' aberta' : ''}" data-perfil="${p.id}">
      <div class="bm-card-head" data-expandir-perfil="${p.id}">
        <svg class="bm-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <div class="bm-card-info">
          <div class="bm-card-nome bm-perfil-nome">
            ${esc(p.nome)}
            ${statusBadge}
          </div>
          <div class="bm-card-sub">${resumo}</div>
        </div>
        <div class="bm-card-acoes">
          ${podeEditar ? `<button class="bm-link" data-editar-perfil="${p.id}">Editar</button>` : ''}
          <button class="bm-switch${p.ativa ? ' on' : ''}" data-toggle-perfil="${p.id}"
                  ${podeEditar ? '' : 'disabled'}
                  title="${p.ativa ? 'Desativar perfil' : 'Reativar perfil'}"
                  aria-pressed="${p.ativa}"><span class="bm-switch-knob"></span></button>
        </div>
      </div>
      ${aberta ? _perfilBodyHTML(p, bms, podeEditar) : ''}
    </div>`;
}

function _perfilBodyHTML(p, bms, podeEditar) {
  const cards = bms.length
    ? bms.map(bm => _bmCardHTML(bm, p)).join('')
    : '<div class="bm-vazio-td">Nenhuma BM neste perfil ainda.</div>';

  return `
    <div class="bm-perfil-body">
      ${cards}
      ${podeEditar ? `<button class="bm-add-num bm-add-bm" data-add-bm="${p.id}">+ Adicionar BM</button>` : ''}
    </div>`;
}

// ── card da BM (nível 2) ─────────────────────────────────────────────────────
function _bmBadgeHTML(bm) {
  return bm.ativa
    ? '<span class="bm-badge ok">Ativa</span>'
    : `<span class="bm-badge ${bm.motivo_inativa === 'banida' ? 'ruim' : 'off'}">${esc(MOTIVO_LABEL[bm.motivo_inativa] || 'Inativa')}</span>`;
}

function _bmResumoHTML(nums) {
  const ativos  = nums.filter(n => n.status === 'ativo').length;
  const banidos = nums.filter(n => n.status === 'banido').length;
  return [
    `${nums.length} número${nums.length === 1 ? '' : 's'}`,
    ativos  ? `${ativos} ativo${ativos === 1 ? '' : 's'}` : null,
    banidos ? `<span class="bm-ruim-txt">${banidos} banido${banidos === 1 ? '' : 's'}</span>` : null,
  ].filter(Boolean).join(' · ');
}

function _bmCardHTML(bm, perfil) {
  const nums     = numerosDa(bm.id);
  const aberta   = B.abertas.has(bm.id);
  const podeEditar = perm.bmEditar();
  const statusBadge = _bmBadgeHTML(bm);
  const resumo = _bmResumoHTML(nums);

  return `
    <div class="bm-card${bm.ativa ? '' : ' off'}${aberta ? ' aberta' : ''}${perfil.ativa ? '' : ' perfil-off'}" data-bm="${bm.id}">
      <div class="bm-card-head" data-expandir="${bm.id}">
        <svg class="bm-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <div class="bm-card-info">
          <div class="bm-card-nome">
            ${esc(bm.nome)}
            ${statusBadge}
            ${perfil.ativa ? '' : '<span class="bm-badge off">Perfil fora do ar</span>'}
            ${bm.bm_id_meta ? `<span class="bm-idmeta">ID ${esc(bm.bm_id_meta)}</span>` : ''}
          </div>
          <div class="bm-card-sub">${resumo}</div>
        </div>
        <div class="bm-card-acoes">
          ${podeEditar ? `<button class="bm-link" data-editar="${bm.id}">Editar</button>` : ''}
          <button class="bm-switch${bm.ativa ? ' on' : ''}" data-toggle="${bm.id}"
                  ${podeEditar ? '' : 'disabled'}
                  title="${bm.ativa ? 'Desativar BM' : 'Reativar BM'}"
                  aria-pressed="${bm.ativa}"><span class="bm-switch-knob"></span></button>
        </div>
      </div>
      ${aberta ? _numerosHTML(bm, nums, podeEditar) : ''}
    </div>`;
}

function _numerosHTML(bm, nums, podeEditar) {
  const linhas = nums.length ? nums.map(n => {
    const dias = diasDesde(n.data_ativacao || n.created_at);
    return `
      <tr data-num="${n.id}">
        <td class="bm-td-num">${esc(n.numero)}</td>
        <td>${esc(n.nome_exibicao || '—')}</td>
        <td><span class="bm-badge ${n.status === 'ativo' ? 'ok' : n.status === 'banido' ? 'ruim' : 'off'}">${STATUS_LABEL[n.status] || n.status}</span></td>
        <td><span class="bm-qual q-${n.qualidade}">${QUAL_LABEL[n.qualidade] || n.qualidade}</span></td>
        <td>${TIER_LABEL[n.tier] || n.tier}</td>
        <td>${fmtData(n.data_ativacao)}${dias !== null ? ` <span class="bm-dias">${dias}d</span>` : ''}</td>
        <td class="bm-td-acao">${podeEditar ? `<button class="bm-link" data-editar-num="${n.id}">Editar</button>` : ''}</td>
      </tr>`;
  }).join('') : `<tr><td colspan="7" class="bm-vazio-td">Nenhum número oficial cadastrado nesta BM.</td></tr>`;

  return `
    <div class="bm-card-body">
      <table class="bm-table">
        <thead>
          <tr>
            <th>Número</th><th>Nome de exibição</th><th>Status</th>
            <th>Qualidade</th><th>Limite</th><th>Ativado em</th><th></th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      ${podeEditar ? `<button class="bm-add-num" data-add-num="${bm.id}">+ Adicionar número oficial</button>` : ''}
    </div>`;
}
