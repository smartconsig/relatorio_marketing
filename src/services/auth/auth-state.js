// Estado compartilhado do fluxo de autenticação.
// Diferencia login explícito (cai na Home) de restauração de sessão no F5
// (volta para a tela em que a pessoa estava). Escrito por doSignIn (auth.js)
// e lido/zerado por onAuthenticated (boot-data.js) — objeto único mutável
// porque bindings ESM são somente-leitura no importador.
export const A = {
  freshLogin: false,
};
