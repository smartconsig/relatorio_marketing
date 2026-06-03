import { render } from 'preact';
import { Badge } from './Badge.jsx';

const casos = [
  { status: 'pago',       label: 'Contrato Pago' },
  { status: 'quase pago', label: 'Quase Pago' },
  { status: 'aprovado',   label: 'Aprovado Banco' },
  { status: 'reprovado',  label: 'Reprovado Banco' },
  { status: 'desconhecido', label: 'Status Desconhecido' },
];

function Demo() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', background: '#0f172a', minHeight: '100vh' }}>
      <h2 style={{ color: '#e2e8f0', marginBottom: '24px' }}>Badge — demonstração</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {casos.map(c => (
          <div key={c.status} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Badge status={c.status} label={c.label} />
            <span style={{ color: '#64748b', fontSize: '13px' }}>status: "{c.status}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}

render(<Demo />, document.getElementById('app'));
