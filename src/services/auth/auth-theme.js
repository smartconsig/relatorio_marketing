// Tema claro/escuro: atributo data-theme no <html>, persistido em
// localStorage (chave sc_theme). O escuro é o padrão (sem atributo).
import { icon } from '../../utils/icons.js';

/** Restaura o tema salvo no boot (chamado pelo initAuth). */
export function applySavedTheme() {
  const saved = localStorage.getItem('sc_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = `${icon('moon', 12)} Tema Escuro`;
  }
}

export function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sc_theme', next);
  document.getElementById('theme-toggle').innerHTML = next === 'light' ? `${icon('moon', 12)} Tema Escuro` : `${icon('sun', 12)} Tema Claro`;
}
