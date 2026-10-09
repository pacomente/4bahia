'use client';
import Link from 'next/link';
import { PageHead } from '@/components/AppShell';
import { BarChart, HBarList } from '@/components/Charts';
import { Kpi, Loading, ErrorBox, useApi } from '@/components/ui';
import { fmtMoney, fmtNum, STATUS_LABELS } from '@/lib/format';

export default function Dashboard() {
  const { data: d, error, loading } = useApi('/admin/dashboard', { interval: 60000 });
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const t = d.totals;
  return (
    <>
      <PageHead title="Panel de control"><span className="small muted">Últimos 30 días</span></PageHead>
      <div className="stack">
        <div className="grid grid-4">
          <Kpi label="Envíos" value={fmtNum(t.shipments)} hint={`${fmtNum(t.active)} activos`} />
          <Kpi label="Entregados" value={fmtNum(t.delivered)} hint={t.on_time_pct != null ? `${t.on_time_pct}% a tiempo` : 'Sin entregas aún'} />
          <Kpi label="Facturación" value={fmtMoney(t.billed_cents)} hint={`Contrarreembolsos ${fmtMoney(t.cod_cents)}`} />
          <Kpi label="Incidencias" value={fmtNum(t.incidents)} hint={<Link href="/admin/envios">Ver envíos</Link>} />
          <Kpi label="Viajes en curso" value={fmtNum(d.fleet.trips_in_progress)} hint={`${d.fleet.vehicles} vehículos activos`} />
          <Kpi label="Consultas abiertas" value={fmtNum(d.open_requests)} hint={<Link href="/admin/reclamos">Ver reclamos</Link>} />
        </div>

        {d.alerts.length > 0 && (
          <div className="card">
            <h3>Alertas</h3>
            <div className="stack" style={{ gap: 8 }}>
              {d.alerts.map((a, i) => <div key={i} className="alert warn">⚠ {a.message}</div>)}
            </div>
          </div>
        )}

        <div className="grid grid-2">
          <div className="card">
            <h3>Envíos por día</h3>
            {d.daily.length ? (
              <BarChart ariaLabel="Envíos por día" data={d.daily.map((x) => ({ label: x.day.slice(5).split('-').reverse().join('/'), title: x.day, value: x.shipments }))} />
            ) : <p className="muted">Sin datos.</p>}
          </div>
          <div className="card">
            <h3>Envíos por estado</h3>
            <HBarList data={[...d.by_status].sort((a, b) => b.n - a.n).map((x) => ({ label: STATUS_LABELS[x.status] ?? x.status, value: x.n }))} />
          </div>
        </div>

        <div className="card">
          <h3>Por sucursal de origen</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Sucursal</th><th className="num">Envíos</th><th className="num">Facturación</th></tr></thead>
              <tbody>
                {d.by_branch.map((b) => (
                  <tr key={b.code}><td>{b.code} · {b.name}</td><td className="num">{fmtNum(b.shipments)}</td><td className="num">{fmtMoney(b.billed_cents)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
