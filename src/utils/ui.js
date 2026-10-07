import { dsToast } from '../components/ds/ds-toast.js';

export function handleError(msg, error) {
  console.error(msg, error);
  toast(msg, 'err');
}

// Emoji no começo da mensagem (ex.: '⚠️ Erro ao salvar…') vira redundante com o
// ícone do aviso novo — tira só o emoji inicial, o texto fica igual.
const EMOJI_INICIAL = /^(?:[☀-➿]|\p{Extended_Pictographic})️?\s*/u;

// Aviso rápido do sistema inteiro (~155 chamadas). Desde a Fase 1 do redesenho
// usa o visual do design system (dsToast); a assinatura continua a mesma:
// toast(msg) = sucesso, toast(msg, 'err') = erro, toast(msg, 'warn') = atenção.
export function toast(msg, type = 'ok') {
  dsToast(String(msg ?? '').replace(EMOJI_INICIAL, ''), { type: type === 'err' || type === 'warn' ? type : 'ok' });
}

/** Botão "Mostrar/Ocultar" dos campos de senha (login e criar senha). */
export function toggleSenha(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const mostrar = el.type === 'password';
  el.type = mostrar ? 'text' : 'password';
  if (btn) btn.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  el.focus();
}

export function toggleAccordion(id) {
  const row = document.getElementById(id);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}
