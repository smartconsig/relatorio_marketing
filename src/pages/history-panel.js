import { getClientHistory } from '../services/action-log.js';
import { normCPF } from '../utils/cpf.js';

const ACTION_LABELS = {
  classified_marketing:     { label: 'Confirmado como Marketing',     color: '#22c55e', icon: '✅' },
  classified_not_marketing: { label: 'Confirmado como Não Marketing', color: '#ef4444', icon: '❌' },
  reclassified:             { label: 'Reclassificado (voltou ao PROCV)', color: '#f59e0b', icon: '↩' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export async function openHistoryPanel(cpf, clientName) {
  const norm = normCPF(cpf);
  const panel = document.getElementById('history-panel');
  const overlay = document.getElementById('history-overlay');
  if (!panel || !overlay) return;

  // Abre o painel com loading
  document.getElementById('history-panel-title').textContent = clientName || 'Cliente';
  document.getElementById('history-panel-cpf').textContent = cpf || '';
  document.getElementById('history-panel-body').innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--gray)">Carregando histórico…</div>`;
  panel.classList.add('open');
  overlay.classList.add('open');

  const logs = await getClientHistory(norm);

  if (logs.length === 0) {
    document.getElementById('history-panel-body').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--gray)">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div>Nenhuma ação registrada para este cliente.</div>
      </div>`;
    return;
  }

  document.getElementById('history-panel-body').innerHTML = logs.map(log => {
    const info = ACTION_LABELS[log.action] || { label: log.action, color: 'var(--gray)', icon: '•' };
    return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:20px;line-height:1;margin-top:2px">${info.icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:${info.color}">${info.label}</div>
          <div style="font-size:12px;color:var(--gray-light);margin-top:3px">
            👤 ${log.user_name || '—'} &nbsp;·&nbsp; 🕐 ${fmtDate(log.created_at)}
          </div>
        </div>
      </div>`;
  }).join('');
}

export function closeHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const overlay = document.getElementById('history-overlay');
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}
