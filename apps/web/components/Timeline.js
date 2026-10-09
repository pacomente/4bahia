import { fmtDateTime } from '@/lib/format';

// Línea de tiempo de eventos: [{label, note, place, at, reason?, user?}]
export default function Timeline({ events }) {
  const items = [...events].reverse();
  return (
    <ol className="timeline">
      {items.map((e, i) => (
        <li key={e.id ?? i} className={i === 0 ? 'current' : ''}>
          <div className="t-title">{e.label}</div>
          <div className="t-meta">
            {fmtDateTime(e.at)}{e.place ? ` · ${e.place}` : ''}{e.user ? ` · ${e.user}` : ''}
          </div>
          {e.reason && <div className="small">Motivo: {e.reason}</div>}
          {e.note && e.note !== e.label && <div className="small muted">{e.note}</div>}
          {e.internal && <div className="small" style={{ color: 'var(--warning-text)' }}>Nota interna: {e.internal}</div>}
        </li>
      ))}
    </ol>
  );
}
