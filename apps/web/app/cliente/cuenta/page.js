'use client';
import { PageHead } from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
import { fmtMoney, fmtDateTime } from '@/lib/format';
import { Wallet, CreditCard, BadgePercent } from 'lucide-react';
import { useApi, Loading, ErrorBox, Kpi } from '@/components/ui';

export default function Cuenta() {
  const { user } = useAuth();
  const { data, error, loading } = useApi(user?.customer_id ? `/finance/accounts/${user.customer_id}` : null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  return (
    <>
      <PageHead title="Cuenta corriente" sub="Cargos y pagos de tu cuenta" />
      <div className="stack">
        <div className="grid grid-3">
          <Kpi icon={Wallet} label="Saldo" value={fmtMoney(data.balance_cents)} hint={data.balance_cents > 0 ? 'A pagar' : 'Sin deuda'} />
          {data.customer.credit_limit_cents > 0 && <Kpi icon={CreditCard} label="Límite de crédito" value={fmtMoney(data.customer.credit_limit_cents)} />}
          {data.customer.discount_pct > 0 && <Kpi icon={BadgePercent} label="Tarifa especial" value={`${data.customer.discount_pct}% off`} />}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th></tr></thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="small nowrap">{fmtDateTime(e.created_at)}</td>
                  <td>{e.type === 'payment' ? `Pago (${e.method})` : e.note}</td>
                  <td className="num">{e.type === 'payment' ? '−' : ''}{fmtMoney(e.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Las facturas fiscales se emitirán cuando esté activa la integración con ARCA.</p>
      </div>
    </>
  );
}
