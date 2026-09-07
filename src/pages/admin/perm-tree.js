// Árvore de permissões dos grupos de acesso: definição (PERM_TREE) + widget
// de checkboxes com grupos expansíveis/indeterminados.

const PERM_TREE = [
  { key: 'home', label: 'Home (boas-vindas)' },
  { label: 'Importação', children: [
    { key: 'importacao_fb03',      label: 'Importar FB03' },
    { key: 'importacao_fb06',      label: 'Importar FB06' },
    { key: 'importacao_ecorban',   label: 'Importar Ecorban' },
    { key: 'importacao_smart',     label: 'Importar Smart' },
    { key: 'importacao_processar', label: 'Processar Dados' },
  ]},
  { key: 'visao_geral', label: 'Visão Geral' },
  { key: 'ranking',     label: 'Ranking de Vendas' },
  { label: 'Gestão', children: [
    { label: 'PROCV', children: [
      { key: 'gestao_procv_visualizar', label: 'Visualizar' },
      { key: 'gestao_procv_confirmar',  label: 'Confirmar Divergência' },
      { key: 'gestao_procv_exportar',   label: 'Exportar' },
    ]},
    { label: 'Revisão Manual', children: [
      { key: 'gestao_revisao_visualizar',  label: 'Visualizar' },
      { key: 'gestao_revisao_classificar', label: 'Classificar Status' },
    ]},
    { key: 'gestao_clientes', label: 'Clientes — Visualizar' },
  ]},
  { key: 'propostas',      label: 'Propostas de Marketing' },
  { label: 'Metas', children: [
    { key: 'metas_visualizar', label: 'Visualizar' },
    { key: 'metas_editar',     label: 'Editar' },
  ]},
  { key: 'bsc',                  label: 'Ranking BSC' },
  { key: 'parceiros',            label: 'Ranking Parceiros' },
  { key: 'perfil_visualizar',    label: 'Perfil de Cliente' },
  { key: 'quitacoes_visualizar', label: 'Quitações' },
  { label: 'Esteira de Conteúdo', children: [
    { key: 'conteudo_visualizar', label: 'Visualizar o board' },
    { key: 'conteudo_editar',     label: 'Criar e mover cards' },
    { key: 'conteudo_aprovar',    label: 'Aprovar / pedir ajustes' },
  ]},
  { label: 'Central de BMs', children: [
    { key: 'bm_visualizar', label: 'Visualizar BMs e números' },
    { key: 'bm_editar',     label: 'Criar / editar / ligar-desligar' },
  ]},
  { label: 'Tráfego (Ads)', children: [
    { key: 'trafego_visualizar', label: 'Visualizar página e métricas' },
    { key: 'trafego_editar',     label: 'Preencher / editar dias' },
  ]},
  { key: 'liberacao_margem',    label: 'Liberação de Margem Master' },
  { key: 'quitacao_boleto',     label: 'Quitação de Boleto' },
  { label: 'Resíduos', children: [
    { key: 'residuos_visualizar', label: 'Visualizar a tela' },
    { key: 'residuos_editar',     label: 'Mover da Liberação / mudar status' },
  ]},
  { label: 'Universidade Smart', children: [
    { key: 'universidade_acessar',    label: 'Acessar Universidade' },
    { key: 'universidade_criador',    label: 'Criador de Cursos (Admin)' },
    { key: 'universidade_gamificacao',label: 'Gamificação (Admin)' },
  ]},
  { label: 'Administração', children: [
    { key: 'admin_usuarios', label: 'Gerenciar Usuários' },
    { key: 'admin_grupos',   label: 'Gerenciar Grupos de Acesso' },
  ]},
];

// Coleta todas as chaves folha de um nó
function leafKeys(node) {
  if (node.key) return [node.key];
  return (node.children || []).flatMap(leafKeys);
}

export function renderPermTree(container, permissoes = {}) {
  container.innerHTML = '';

  function buildNode(node, depth = 0) {
    const wrap = document.createElement('div');
    wrap.className = `perm-node depth-${depth}`;

    if (node.key) {
      // Folha com checkbox direto
      const label = document.createElement('label');
      label.className = 'perm-leaf';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.key = node.key;
      cb.checked = permissoes[node.key] === true;
      label.append(cb, document.createTextNode(' ' + node.label));
      wrap.appendChild(label);
    } else {
      // Nó pai: checkbox de grupo + label expansível
      const header = document.createElement('div');
      header.className = 'perm-group-header';

      const cbGroup = document.createElement('input');
      cbGroup.type = 'checkbox';
      cbGroup.className = 'perm-group-cb';
      const keys = leafKeys(node);
      const allChecked = keys.every(k => permissoes[k] === true);
      const someChecked = keys.some(k => permissoes[k] === true);
      cbGroup.checked = allChecked;
      cbGroup.indeterminate = !allChecked && someChecked;

      const groupLabel = document.createElement('span');
      groupLabel.className = 'perm-group-label';
      groupLabel.textContent = node.label;

      const toggle = document.createElement('span');
      toggle.className = 'perm-toggle';
      toggle.textContent = '▼';

      header.append(cbGroup, groupLabel, toggle);
      wrap.appendChild(header);

      const children = document.createElement('div');
      children.className = 'perm-children';
      (node.children || []).forEach(child => children.appendChild(buildNode(child, depth + 1)));
      wrap.appendChild(children);

      // Toggle collapse
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        children.classList.toggle('collapsed');
        toggle.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
      });

      // Grupo checkbox: marca/desmarca todos os filhos
      cbGroup.addEventListener('change', () => {
        children.querySelectorAll('input[data-key]').forEach(cb => {
          cb.checked = cbGroup.checked;
        });
        _syncParents(container);
      });
    }

    return wrap;
  }

  PERM_TREE.forEach(node => container.appendChild(buildNode(node, 0)));

  // Ao mudar qualquer checkbox folha, sincroniza os pais
  container.addEventListener('change', (e) => {
    if (e.target.dataset?.key) _syncParents(container);
  });
}

function _syncParents(container) {
  container.querySelectorAll('.perm-group-header').forEach(header => {
    const cbGroup = header.querySelector('.perm-group-cb');
    if (!cbGroup) return;
    const children = header.nextElementSibling;
    const leaves = children.querySelectorAll('input[data-key]');
    const total   = leaves.length;
    const checked = [...leaves].filter(c => c.checked).length;
    cbGroup.checked = checked === total;
    cbGroup.indeterminate = checked > 0 && checked < total;
  });
}

export function readPermissoes(container) {
  const result = {};
  container.querySelectorAll('input[data-key]').forEach(cb => {
    result[cb.dataset.key] = cb.checked;
  });
  return result;
}
