// Aba Versões: timeline do changelog exibido na UI (src/data/changelog.json).
import changelog from '../../data/changelog.json';

export function renderVersions() {
  const TYPE_CFG = {
    feat:     { label: 'Nova funcionalidade', color: '#22c55e' },
    fix:      { label: 'Correção',            color: '#f59e0b' },
    security: { label: 'Segurança',           color: '#ef4444' },
  };

  const fmtDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return `
    <div style="max-width:720px;padding:8px 0 32px">
      <div class="section-title" style="margin-bottom:24px"><span class="bar"></span>Histórico de Versões</div>
      <div style="display:flex;flex-direction:column;gap:0">
        ${changelog.map((v, vi) => `
          <div style="display:flex;gap:0;position:relative">
            <!-- linha vertical -->
            <div style="display:flex;flex-direction:column;align-items:center;width:40px;flex-shrink:0">
              <div style="width:12px;height:12px;border-radius:50%;background:${vi === 0 ? 'var(--red)' : 'var(--border)'};
                border:2px solid ${vi === 0 ? 'var(--red)' : 'var(--gray)'};margin-top:4px;flex-shrink:0;z-index:1"></div>
              ${vi < changelog.length - 1 ? `<div style="width:2px;flex:1;background:var(--border);min-height:24px"></div>` : ''}
            </div>
            <!-- conteúdo -->
            <div style="padding:0 0 32px 16px;flex:1">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
                <span style="font-family:var(--font-h);font-weight:800;font-size:15px;color:${vi === 0 ? 'var(--red)' : 'var(--white)'}">
                  v${v.version}
                </span>
                <span style="font-family:var(--font-h);font-weight:700;font-size:13px;color:var(--white)">
                  ${v.label}
                </span>
                ${vi === 0 ? `<span style="font-size:10px;font-family:var(--font-b);background:var(--red);color:#fff;
                  padding:2px 7px;border-radius:20px;letter-spacing:0.5px">ATUAL</span>` : ''}
                <span style="font-size:11px;color:var(--gray);margin-left:auto">${fmtDate(v.date)}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${v.items.map(item => {
                  const cfg = TYPE_CFG[item.type] || TYPE_CFG.feat;
                  return `
                    <div style="display:flex;align-items:flex-start;gap:8px">
                      <span style="font-size:10px;font-family:var(--font-b);font-weight:700;
                        color:${cfg.color};background:${cfg.color}1a;padding:2px 6px;
                        border-radius:4px;white-space:nowrap;margin-top:1px;flex-shrink:0">
                        ${cfg.label}
                      </span>
                      <span style="font-size:13px;color:var(--white);line-height:1.5;font-family:var(--font-b)">
                        ${item.text}
                      </span>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}
