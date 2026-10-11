import { Star, CarTaxiFront } from 'lucide-react';
import { STATUS } from '../lib/format';

export function Logo({ brand = 'Movi', light = false }) {
  return (
    <span className="logo" style={{ color: light ? '#fff' : 'inherit' }}>
      <span className="mark"><CarTaxiFront size={22} /></span>{brand}
    </span>
  );
}

export function Stars({ value = 0, onChange, size = 30 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={n <= value ? 'on' : ''} aria-label={`${n} estrellas`} aria-checked={n === value} role="radio" onClick={() => onChange?.(n)}>
          <Star size={size} fill="currentColor" strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

export function Rating({ value }) {
  return <span className="row" style={{ gap: 4, display: 'inline-flex' }}><Star size={14} fill="#f0b400" color="#f0b400" /> {Number(value ?? 5).toFixed(2)}</span>;
}

export function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] ?? [status, ''];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export const ErrorMsg = ({ error }) => (error ? <div className="alert bad">{error.message ?? String(error)}</div> : null);

// Ícono lateral de auto para las categorías.
export function CarSide({ category = 'taxi' }) {
  const body = { taxi: '#FFC300', ejecutivo: '#1f1f1f', xl: '#e9e8e3' }[category] ?? '#FFC300';
  const long = category === 'xl';
  return (
    <svg className="car-ic" viewBox="0 0 64 40" aria-hidden="true">
      <path d={long ? 'M4 26 L8 14 Q10 10 15 10 L46 10 Q52 10 55 14 L60 22 Q62 24 62 27 L62 30 L4 30 Z' : 'M5 27 L11 17 Q14 12 20 12 L38 12 Q44 12 48 17 L56 22 Q60 23 60 27 L60 30 L5 30 Z'} fill={body} stroke="#111" strokeWidth="1.6" />
      <path d={long ? 'M12 15 L16 12 L44 12 L50 18 L12 18 Z' : 'M15 18 L21 14 L37 14 L44 19 L15 19 Z'} fill="#9fc4e8" stroke="#111" strokeWidth="1.2" />
      {category === 'taxi' && <rect x="26" y="7" width="10" height="5" rx="1.5" fill="#FFC300" stroke="#111" strokeWidth="1.2" />}
      <circle cx="17" cy="30" r="5.5" fill="#222" /><circle cx="17" cy="30" r="2.2" fill="#aaa" />
      <circle cx={long ? 50 : 47} cy="30" r="5.5" fill="#222" /><circle cx={long ? 50 : 47} cy="30" r="2.2" fill="#aaa" />
    </svg>
  );
}
