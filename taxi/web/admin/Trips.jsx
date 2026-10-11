import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { usePoll } from '../lib/hooks';
import { getToken } from '../lib/api';
import { fmtMoney, fmtDateTime, fmtKm, PAYMENT } from '../lib/format';
import { StatusBadge } from '../components/ui';
import { adminApi, PageHead } from './AdminApp';
import TripDrawer from './TripDrawer';

export default function Trips() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);
  const qs = new URLSearchParams({ limit: 50, offset });
  if (q) qs.set('q', q);
  if (status) qs.set('status', status);
  if (source) qs.set('source', source);
  const { data } = usePoll(() => adminApi(`/admin/trips?${qs}`), 4000, [qs.toString()]);
  const exportCsv = async () => {
    const res = await fetch(`/api/admin/trips?format=csv&limit=500&${qs}`, { headers: { authorization: `Bearer ${getToken('admin')}` } });
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement('a'), { href: url, download: 'viajes.csv' }).click();
  };
  return (
    <>
      <PageHead title="Viajes" sub="Historial completo con filtros"><button className="btn ghost" onClick={exportCsv}><Download size={16} /> Exportar CSV</button></PageHead>
      <div className="toolbar">
        <div style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-3)' }} /><input style={{ paddingLeft: 36 }} placeholder="Código, pasajero, conductor, dirección" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} /></div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="">Todos los estados</option>
          <option value="searching,accepted,arrived,in_progress">En curso</option>
          <option value="completed">Finalizados</option>
          <option value="cancelled,no_drivers">Cancelados / sin conductor</option>
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }}>
          <option value="">App y central</option><option value="app">App</option><option value="central">Central telefónica</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Viaje</th><th>Fecha</th><th>Estado</th><th>Pasajero</th><th>Conductor</th><th>Recorrido</th><th className="num">Km</th><th>Pago</th><th className="num">Importe</th></tr></thead>
          <tbody>
            {data?.items.map((t) => (
              <tr key={t.id} className="click" onClick={() => setOpen(t.id)}>
                <td className="bold">{t.code}{t.source === 'central' && <span className="badge" style={{ marginLeft: 6 }}>Central</span>}</td>
                <td className="small nowrap">{fmtDateTime(t.requested_at)}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>{t.rider_name ?? t.rider?.name}</td>
                <td>{t.driver_name ?? '—'}</td>
                <td className="small" style={{ maxWidth: 280 }}><div className="ellipsis">{t.origin.address} → {t.dest.address}</div></td>
                <td className="num">{fmtKm(t.distance_m)}</td>
                <td className="small">{PAYMENT[t.payment_method]}</td>
                <td className="num bold">{fmtMoney(t.fare_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between small muted" style={{ marginTop: 10 }}>
        <span>{data?.total ?? 0} viajes</span>
        <div className="row">
          <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</button>
          <button className="btn ghost sm" disabled={!data || offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Siguiente</button>
        </div>
      </div>
      {open && <TripDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
