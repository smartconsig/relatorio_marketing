// Tema claro/escuro: atributo data-theme no <html>, persistido em
// localStorage (chave sc_theme). O escuro é o padrão (sem atributo).
// Desde a Fase 1 do redesenho o seletor fica no topo (#theme-seg: Claro | Escuro).

function _syncSeletor(tema) {
  document.querySelectorAll('#theme-seg [data-theme-set]').forEach(b =>
    b.classList.toggle('is-on', b.dataset.themeSet === tema));
}

/** Aplica e salva o tema ('light' | 'dark'). */
export function setTheme(tema) {
  const t = tema === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('sc_theme', t); } catch {}
  _syncSeletor(t);
}

/** Restaura o tema salvo no boot (chamado pelo initAuth). */
export function applySavedTheme() {
  let saved = null;
  try { saved = localStorage.getItem('sc_theme'); } catch {}
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  _syncSeletor(saved === 'light' ? 'light' : 'dark');
}

/** Alterna (mantida para compatibilidade com chamadas antigas). */
export function toggleTheme() {
  setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
}
