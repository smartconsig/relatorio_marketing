// Estado compartilhado da tela de Quitações. Objeto único mutável — os
// módulos leem/escrevem Q.campo (bindings ESM são somente-leitura no
// importador; reatribuir uma variável importada quebraria).
export const Q = {
  clientes: [],
  search: '',
  docBase64: null,  // base64 apenas para preview no modal
  docNome: null,
  docFile: null,    // File object para upload no Storage
  built: false,
  editingId: null,  // id do cliente sendo editado (null = novo)
};
