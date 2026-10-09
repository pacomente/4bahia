import { fmtMoney, fmtKg, fmtDate } from '@/lib/format';

export default function QuoteBreakdown({ quote }) {
  if (!quote) return null;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="small muted">
        {quote.origin.name} → {quote.destination.name} · {quote.service.name} ·{' '}
        {quote.delivery_type === 'home' ? 'Entrega a domicilio' : 'Retiro en sucursal'}
      </div>
      <div className="small">
        Peso real {fmtKg(quote.weights.real_g)} · volumétrico {fmtKg(quote.weights.volumetric_g)} ·{' '}
        <strong>facturable {fmtKg(quote.weights.chargeable_g)}</strong>
      </div>
      <table className="price-lines">
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.code}><td>{l.label}</td><td className="num">{fmtMoney(l.amount_cents)}</td></tr>
          ))}
          <tr><td className="muted">Subtotal</td><td className="num muted">{fmtMoney(quote.subtotal_cents)}</td></tr>
          <tr><td className="muted">IVA {quote.tax_pct}%</td><td className="num muted">{fmtMoney(quote.tax_cents)}</td></tr>
          <tr className="price-total"><td>Total</td><td className="num">{fmtMoney(quote.total_cents)}</td></tr>
        </tbody>
      </table>
      <div className="small muted">
        Entrega estimada: {fmtDate(quote.estimated_delivery_at)}.{' '}
        {quote.estimated ? 'Precio estimado: el definitivo se confirma al pesar y medir en sucursal.' : 'Precio definitivo.'}
      </div>
    </div>
  );
}
