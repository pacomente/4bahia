import { Car, CheckCircle2, Wallet, Timer, Star, Activity } from 'lucide-react';
import { usePoll } from '../lib/hooks';
import { fmtMoney } from '../lib/format';
import { adminApi, PageHead, Kpi } from './AdminApp';

export default function Dashboard() {
  const { data: d } = usePoll(() => adminApi('/admin/dashboard'), 5000);
  if (!d) return <div className="spinner" />;
  const k = d.kpi;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.trips));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, trips: d.hourly.find((x) => x.hour === h)?.trips ?? 0 }));
  const maxHour = Math.max(1, ...hours.map((x) => x.trips));
  const maxCat = Math.max(1, ...d.by_category.map((x) => x.trips));
  return (
    <>
      <PageHead title="Panel de control" sub="Hoy en vivo y últimos 14 días"><span className="badge good">Actualización cada 5 s</span></PageHead>
      <div className="stack" style={{ gap: 16 }}>
        <div className="kpis">
          <Kpi icon={Activity} label="Viajes en curso" value={d.live.active_trips} hint={`${d.live.searching} buscando conductor`} />
          <Kpi icon={Car} label="Conductores" value={`${d.live.available + d.live.busy}`} hint={`${d.live.available} libres · ${d.live.busy} ocupados`} />
          <Kpi icon={CheckCircle2} label="Viajes hoy" value={k.trips} hint={`${k.completed ?? 0} completados · ${k.cancelled ?? 0} cancelados`} />
          <Kpi icon={Wallet} label="Facturación hoy" value={fmtMoney(k.revenue_cents)} hint={`Comisión ${fmtMoney(k.commission_cents)}`} />
          <Kpi icon={Timer} label="Espera promedio" value={k.avg_wait_min ? `${Math.round(k.avg_wait_min)} min` : '—'} hint="Del pedido a la llegada" />
          <Kpi icon={Star} label="Calificación" value={k.avg_rating ? Number(k.avg_rating).toFixed(2) : '—'} hint={`${k.central ?? 0} pedidos por central`} />
        </div>
        <div className="grid2">
          <div className="card">
            <h3>Viajes por día</h3>
            <div className="bars">
              {d.daily.map((x) => (
                <div key={x.day} className="b">
                  <span className="tip">{x.trips} viajes · {fmtMoney(x.revenue_cents)}</span>
                  <div className="fill" style={{ height: `${(x.trips / maxDay) * 100}%` }} />
                  <span className="lbl">{x.day.slice(8, 10)}/{x.day.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Demanda por hora</h3>
            <div className="bars">
              {hours.map((x) => (
                <div key={x.hour} className="b">
                  <span className="tip">{x.hour}h · {x.trips} viajes</span>
                  <div className="fill" style={{ height: `${(x.trips / maxHour) * 100}%`, background: 'var(--ink)' }} />
                  <span className="lbl">{x.hour % 3 === 0 ? x.hour : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid2">
          <div className="card">
            <h3>Viajes por categoría</h3>
            {d.by_category.map((c) => (
              <div key={c.category} className="hbar"><span>{c.name}</span><div className="track"><div className="fill" style={{ width: `${(c.trips / maxCat) * 100}%` }} /></div><span className="small bold" style={{ textAlign: 'right' }}>{c.trips}</span></div>
            ))}
          </div>
          <div className="card">
            <h3>Conductores destacados (7 días)</h3>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Conductor</th><th className="num">Viajes</th><th className="num">Facturado</th><th className="num">★</th></tr></thead>
                <tbody>{d.top_drivers.map((t) => <tr key={t.name}><td>{t.name}</td><td className="num">{t.trips}</td><td className="num">{fmtMoney(t.revenue_cents)}</td><td className="num">{Number(t.rating).toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

