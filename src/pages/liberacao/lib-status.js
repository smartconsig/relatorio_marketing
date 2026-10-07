// Liberação de Margem — status da linha, quem age em cada etapa e o alerta
// (Fase 3 do redesenho; regras combinadas com o responsável em 06/10/2026).
//   Pendente → (Resíduo pendente → solicitado → enviado → pago) → OK
//   Resíduo: pendente/solicitado/pago = parceiro dono (ou Smart); enviado = SÓ Smart.
//   Alerta: resíduo PAGO há mais de 7 dias úteis (seg–sex) sem virar OK.
// O banco (migration 015) revalida tudo — aqui é só o espelho para a tela.
import { state } from '../../state.js';
import { perm } from '../../services/permissions.js';

export const LIB_STATUS = {
  pendente:       { label: 'Pendente',           tone: 'neutral' },
  res_pendente:   { label: 'Resíduo pendente',   tone: 'brand' },
  res_solicitado: { label: 'Resíduo solicitado', tone: 'warn' },
  res_enviado:    { label: 'Resíduo enviado',    tone: 'info' },
  res_pago:       { label: 'Resíduo pago',       tone: 'pur' },
  ok:             { label: 'OK',                 tone: 'ok' },
};
export const LIB_ORDEM = ['pendente', 'res_pendente', 'res_solicitado', 'res_enviado', 'res_pago', 'ok'];

export const statusDe = r => (r.aprovado ? 'ok' : (r.residuo_status ? 'res_' + r.residuo_status : 'pendente'));

// Smart = admin ou quem tem a permissão de resíduo (equipe interna)
export const ehSmart = () => perm.isAdmin() || perm.residuosEditar();
export const ehDono = r => ehSmart() || (!!r.empresa_parceira && r.empresa_parceira === (state.currentUser?.grupoNome || ''));

// Ações do dia a dia. who: 's' = só Smart; 'p' = dono da linha (ou Smart)
export const LIB_ACOES = {
  pendente:       [{ k: 'ok', label: 'Marcar como OK', who: 'p' }, { k: 'residuo', label: 'Resíduo', who: 'p', alt: true }],
  res_pendente:   [{ k: 'solicitado', label: 'Marcar como solicitado', who: 'p' }],
  res_solicitado: [{ k: 'enviado', label: 'Marcar como enviado', who: 's' }],
  res_enviado:    [{ k: 'pago', label: 'Marcar como pago', who: 'p' }],
  res_pago:       [{ k: 'ok', label: 'Marcar como OK', who: 'p' }],
  ok:             [],
};
export const podeAgir = (r, acao) => (acao.who === 's' ? ehSmart() : ehDono(r));

// Dias úteis (seg–sex) entre a data do pagamento e hoje — feriados contam como úteis
export function diasUteisDesde(iso, hoje = new Date()) {
  if (!iso) return 0;
  const d = new Date(iso + 'T00:00:00');
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let n = 0;
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const LIMITE_ALERTA = 7;
export const emAlerta = r => !r.aprovado && r.residuo_status === 'pago' && diasUteisDesde(r.residuo_data_pago) > LIMITE_ALERTA;
