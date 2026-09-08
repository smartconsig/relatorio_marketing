// Núcleo da Gamificação: estado compartilhado (store G) + factories +
// helpers. Todas as tabs importam daqui — nunca o contrário.

export function emptyConquista() {
  return { id: null, nome: '', descricao: '', icone: 'star', condicao_tipo: 'cursos_concluidos', condicao_valor: 1, xp_bonus: 0, ativo: true };
}
export function emptyPremio() {
  return { id: null, nome: '', descricao: '', xp_necessario: 0, ativo: true };
}

// Objeto único mutável: as tabs leem/escrevem G.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const G = {
  tab: 'xp',              // 'xp' | 'niveis' | 'conquistas' | 'premios'
  xpConfig: [],
  niveis: [],
  conquistas: [],
  premios: [],
  // estado de edição inline
  conquista: emptyConquista(),
  premio: emptyPremio(),
  editView: null,         // null | 'conquista' | 'premio'
};

export function spinner() {
  return `<div style="display:flex;align-items:center;justify-content:center;height:60vh">
    <div style="width:24px;height:24px;border:2px solid #1e1e1e;border-top-color:var(--red);border-radius:50%;animation:uni-spin .7s linear infinite"></div>
  </div>`;
}

// ⚠ Escapa só `"` e `<` de propósito — trocar por um escape "melhor" causaria
// duplo-escape de conteúdo já salvo no banco.
export function esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
