// Página de teste das peças do design system (ds-demo.html, só no `npm run dev`;
// não entra no build). Dados fictícios — não importa nada que fale com o banco.
import '../../styles/base.css';
import '../../styles/ds/ds-tokens.css';
import '../../styles/ds/ds-base.css';
import '../../styles/ds/ds-table.css';
import '../../styles/ds/ds-overlay.css';
import { dsBadge, dsChips, dsSteps, dsKv, dsWait, dsBtn, dsMenu, dsEmpty, initDsMenus,
  dsForm, dsConfirm, dsToast, dsImportReport } from './index.js';

const COLS = '22px minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) 230px 36px';
const CLIENTES = [
  { id: 1, nome: 'Maria Aparecida Souza', cpf: '123.***.***-00', conv: 'SIAPE · Cartão benefício', st: ['Boleto enviado', 'info'], acao: 'quitar' },
  { id: 2, nome: 'Ana Paula Pereira', cpf: '111.***.***-44', conv: 'SIAPE · Cartão benefício', st: ['Boleto solicitado', 'warn'], acao: 'wait' },
  { id: 3, nome: 'João Batista da Silva', cpf: '987.***.***-00', conv: 'GDF · Cartão consignado', st: ['Em alerta · 9 dias úteis', 'bad'], acao: 'ok', alerta: true },
];

const _acao = c => ({
  quitar: dsBtn({ label: 'Marcar como quitado', variant: 'primary', size: 'sm', attrs: 'data-demo="quitar"' }),
  ok: dsBtn({ label: 'Marcar como OK', variant: 'primary', size: 'sm', attrs: 'data-demo="ok"' }),
  wait: dsWait(),
}[c.acao]);

const _linha = c => `<div class="ds-tr ds-tr--item${c.alerta ? ' ds-tr--alert' : ''}" style="--ds-cols:${COLS}" data-demo-row="${c.id}">`
  + `<div><input type="checkbox" class="ds-cb"></div><div class="ds-who"><b>${c.nome}</b><span>${c.cpf}</span></div>`
  + `<div class="ds-muted">${c.conv}</div><div>${dsBadge(...c.st)}</div><div class="ds-act">${_acao(c)}</div><div class="ds-chev">▾</div></div>`
  + `<div class="ds-det" data-demo-det="${c.id}">${dsSteps(['Solicitar', 'Solicitado', 'Enviado', 'Quitado'], 2)}`
  + `<div class="ds-det__grid">${dsKv('Saldo devedor', 'R$ 6.200,00')}${dsKv('Troco', 'R$ 1.840,00')}${dsKv('Enviado em', '04/10/2026')}</div></div>`;

const MENU_IMPORTAR = [
  { action: 'planilha', label: 'Planilha de clientes', sub: 'Cadastra clientes em lote', icon: 'table' },
  { action: 'relatorio', label: 'Respaldo', sub: 'Relatório de Faturas Smart', icon: 'shield', tag: 'SMART' },
  { sep: true },
  { action: 'modelo', label: 'Baixar modelo', icon: 'download' },
];

function _render() {
  document.getElementById('app').innerHTML = `
    <div style="max-width:1100px;margin:0 auto;padding:32px 20px;display:grid;gap:20px;font-family:var(--ds-font-body);color:var(--ds-ink)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h1 style="font:700 28px var(--ds-font-display);margin:0">Teste das peças do design system</h1>
        <div class="ds-seg" id="tema"><button class="is-on" data-t="">Escuro</button><button data-t="light">Claro</button></div>
      </div>
      <div class="ds-kpis">
        <div class="ds-card ds-kpi ds-kpi--hl ds-card--lift"><div class="ds-kpi__lbl">Clientes</div><div class="ds-kpi__val">214</div><div class="ds-kpi__sub">no período</div></div>
        <div class="ds-card ds-kpi ds-card--lift"><div class="ds-kpi__lbl">Em alerta ${dsBadge('3', 'bad')}</div><div class="ds-kpi__val">3</div><div class="ds-kpi__sub">pagos sem OK</div></div>
      </div>
      <div class="ds-tbl">
        <div class="ds-tbl__toolbar">
          ${dsMenu({ label: 'Importar', icon: 'upload', items: MENU_IMPORTAR })}
          ${dsBtn({ label: 'Formulário obrigatório', attrs: 'data-demo="form"' })}
          ${dsBtn({ label: 'Confirmação', attrs: 'data-demo="confirm"' })}
          ${dsBtn({ label: 'Aviso de erro', attrs: 'data-demo="erro"' })}
          ${dsBtn({ label: 'Relatório de importação', variant: 'primary', attrs: 'data-demo="relatorio"' })}
        </div>
        <div class="ds-tbl__filters">${dsChips([{ value: '', label: 'Todos', count: 3 }, { value: 'env', label: 'Enviado', count: 1, tone: 'info' }, { value: 'al', label: 'Em alerta', count: 1, alert: true }], '')}</div>
        <div class="ds-tr ds-tr--head" style="--ds-cols:${COLS}"><div></div><div>Cliente</div><div>Convênio</div><div>Status</div><div style="text-align:right">Ação</div><div></div></div>
        ${CLIENTES.map(_linha).join('')}
        ${dsEmpty({ titulo: 'Exemplo de tela vazia', texto: 'Troque o filtro ou limpe a busca.' })}
      </div>
    </div>`;
}

async function _relatorio() {
  const r = await dsImportReport({
    eyebrow: 'Importar respaldo', title: 'Relatorio Faturas Smart lote 03.xlsx',
    resumo: [{ n: 4, label: 'prontos para gravar', tone: 'ok' }, { n: 1, label: 'sem proposta aberta', tone: 'warn' }, { n: 1, label: 'CPF não encontrado', tone: 'bad' }],
    grupos: [{ label: 'CPF não encontrado', itens: [{ titulo: 'CPF 444.***.***-12', detalhe: 'linha 17' }] },
      { label: 'Sem proposta aberta', itens: [{ titulo: 'Carlos Eduardo Lima', detalhe: 'quitado em 05/10' }] }],
    okLabel: 'Gravar 4 respaldos',
    gravar: async progresso => {
      for (let i = 1; i <= 4; i++) { await new Promise(res => setTimeout(res, 350)); progresso(i, 4); }
      return { gravados: 3, falhas: [{ titulo: 'Ana Paula Pereira', detalhe: 'sem conexão no momento' }] };
    },
  });
  if (r.gravou) dsToast(`${r.gravados} respaldos gravados`, { sub: r.falhas.length ? `${r.falhas.length} falharam` : '' });
}

const ACOES = {
  form: () => dsForm({ eyebrow: 'Resíduo pendente', title: 'Maria Aparecida Souza', sub: '123.***.***-00 · SIAPE', okLabel: 'Confirmar resíduo',
    fields: [{ id: 'valor', label: 'Valor que ficou pendente', type: 'money', required: true, min: 0.01 },
      { id: 'enq', label: 'A conta está enquadrada?', type: 'yesno', required: true }],
    nota: 'O cliente continua na Liberação com o status Resíduo pendente.' })
    .then(v => v && dsToast('Resíduo registrado', { sub: `R$ ${v.valor} · ${v.enq ? 'enquadrada' : 'não enquadrada'}` })),
  confirm: () => dsConfirm({ title: 'Excluir este cliente?', desc: 'Isso não pode ser desfeito.', okLabel: 'Excluir', danger: true })
    .then(ok => dsToast(ok ? 'Excluído (de mentira)' : 'Cancelado', { type: ok ? 'ok' : 'warn' })),
  erro: () => dsToast('Não foi possível salvar', { type: 'err', sub: 'Verifique a conexão e tente de novo.' }),
  relatorio: _relatorio,
  quitar: () => dsToast('Marcado como quitado'),
  ok: () => dsToast('Marcado como OK'),
};

function _onClick(e) {
  const t = e.target;
  const tema = t.closest('#tema button');
  if (tema) {
    if (tema.dataset.t) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    document.querySelectorAll('#tema button').forEach(b => b.classList.toggle('is-on', b === tema));
    return;
  }
  const act = t.closest('[data-demo]') || t.closest('[data-ds-action]');
  if (act) { (ACOES[act.dataset.demo] || (() => dsToast('Menu: ' + act.dataset.dsAction)))(); return; }
  if (t.closest('.ds-cb')) return;
  const row = t.closest('[data-demo-row]');
  if (row) { row.classList.toggle('is-open'); document.querySelector(`[data-demo-det="${row.dataset.demoRow}"]`).classList.toggle('is-open'); }
}

document.body.style.background = 'var(--ds-bg-glow), var(--ds-bg)';
_render();
initDsMenus();
document.addEventListener('click', _onClick);
