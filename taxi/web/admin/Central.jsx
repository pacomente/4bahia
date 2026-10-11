import { useEffect, useMemo, useState } from 'react';
import { PhoneCall, MapPin, Flag, Send } from 'lucide-react';
import { usePoll, useAsync, useConfig } from '../lib/hooks';
import { fmtMoney, fmtKm, fmtMin, fmtTime, PAYMENT } from '../lib/format';
import { BaseMap, CarMarker, Pin, Route, FitTo, MapClick, InvalidateSize, STATUS_COLORS } from '../components/Map';
import PlaceSearch from '../components/PlaceSearch';
import { StatusBadge, ErrorMsg } from '../components/ui';
import { adminApi, PageHead } from './AdminApp';
import TripDrawer from './TripDrawer';

const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 92);

// Central telefónica: carga de viajes para quien llama por teléfono.
export default function Central() {
  const cfg = useConfig();
  const [f, setF] = useState({ rider_name: '', rider_phone: '', category: 'taxi', payment_method: 'cash', notes: '' });
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [active, setActive] = useState('origin');
  const [assign, setAssign] = useState('auto');
  const [quote, setQuote] = useState(null);
  const [created, setCreated] = useState(null);
  const [open, setOpen] = useState(null);
  const { data: live } = usePoll(() => adminApi('/admin/live'), 3000);
  const { data: recent, refresh } = usePoll(() => adminApi('/admin/trips?source=central&limit=8'), 3000);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    setQuote(null);
    if (!origin || !dest) return;
    adminApi('/admin/quote', { method: 'POST', body: { origin, dest } }).then(setQuote).catch(() => {});
  }, [origin, dest]);

  const nearby = useMemo(() => (live && origin ? live.drivers
    .filter((d) => d.status === 'available' && d.category === f.category)
    .map((d) => ({ ...d, km: dist(d, origin) }))
    .sort((a, b) => a.km - b.km).slice(0, 6) : []), [live, origin, f.category]);

  const pickPoint = (p) => {
    if (active === 'origin') { setOrigin(p); setActive('dest'); } else { setDest(p); }
  };
  const submit = useAsync(async () => {
    const t = await adminApi('/admin/dispatch', { method: 'POST', body: { ...f, origin, dest, driver_id: assign === 'auto' ? undefined : Number(assign) } });
    setCreated(t);
    setF({ rider_name: '', rider_phone: '', category: f.category, payment_method: 'cash', notes: '' });
    setOrigin(null); setDest(null); setActive('origin'); setAssign('auto');
    refresh();
  });
  const option = quote?.options.find((o) => o.category === f.category);
  if (!cfg) return null;

  return (
    <>
      <PageHead title="Central telefónica" sub="Cargá el pedido de quien llama y asignalo automática o manualmente" />
      {created && (
        <div className="alert good" style={{ marginBottom: 14 }}>
          Viaje <b>{created.code}</b> creado para {created.rider?.name}. {created.driver ? `Asignado a ${created.driver.name}.` : 'Buscando conductor…'}{' '}
          <button className="btn sm ghost" onClick={() => setOpen(created.id)}>Ver</button>
        </div>
      )}
      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 420px' }}>
        <div className="stack">
          <div style={{ position: 'relative' }}>
            <BaseMap center={cfg.center} zoom={13} className="admin-map" >
              <InvalidateSize />
              <MapClick onClick={(p) => pickPoint({ ...p, address: active === 'origin' ? 'Punto marcado en el mapa' : 'Destino marcado en el mapa' })} />
              <Pin point={origin} type="origin" label={origin ? 'Origen' : null} />
              <Pin point={dest} type="dest" label={dest ? 'Destino' : null} />
              <Route coords={quote?.route} />
              {live?.drivers.filter((d) => d.status !== 'offline').map((d) => <CarMarker key={d.id} lat={d.lat} lng={d.lng} heading={d.heading} color={STATUS_COLORS[d.status]} tooltip={`${d.name} · ${d.category}`} onClick={() => d.status === 'available' && setAssign(String(d.id))} />)}
              <FitTo points={quote?.route ?? [origin, dest].filter(Boolean)} fitKey={`${origin?.lat}-${dest?.lat}-${quote?.route?.length}`} padding={[50, 50]} />
            </BaseMap>
            <div className="card small" style={{ position: 'absolute', top: 12, left: 60, zIndex: 500, padding: '8px 12px' }}>
              Clic en el mapa para marcar el <b>{active === 'origin' ? 'origen' : 'destino'}</b>
            </div>
          </div>
          <div className="card">
            <h3>Pedidos de la central</h3>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Hora</th><th>Viaje</th><th>Pasajero</th><th>Estado</th><th>Conductor</th><th className="num">Importe</th></tr></thead>
                <tbody>
                  {recent?.items.map((t) => (
                    <tr key={t.id} className="click" onClick={() => setOpen(t.id)}>
                      <td className="small">{fmtTime(t.requested_at)}</td><td className="bold">{t.code}</td><td>{t.rider_name}</td>
                      <td><StatusBadge status={t.status} /></td><td>{t.driver_name ?? '—'}</td><td className="num">{fmtMoney(t.fare_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); submit.run(); }}>
          <h3 className="row" style={{ margin: 0 }}><PhoneCall size={18} /> Nuevo pedido</h3>
          <div className="form-grid">
            <label className="field">Nombre del pasajero<input required value={f.rider_name} onChange={set('rider_name')} /></label>
            <label className="field">Teléfono<input value={f.rider_phone} onChange={set('rider_phone')} inputMode="tel" /></label>
          </div>
          <div className="tabs" style={{ margin: 0, width: '100%' }}>
            <button type="button" className={active === 'origin' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setActive('origin')}><MapPin size={14} /> {origin ? 'Origen ✓' : 'Origen'}</button>
            <button type="button" className={active === 'dest' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setActive('dest')}><Flag size={14} /> {dest ? 'Destino ✓' : 'Destino'}</button>
          </div>
          <div className="small">
            <div><b>Origen:</b> {origin?.address ?? <span className="muted">sin definir</span>}</div>
            <div><b>Destino:</b> {dest?.address ?? <span className="muted">sin definir</span>}</div>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
            <PlaceSearch key={active} center={cfg.center} city={cfg.city} autoFocus={false} placeholder={active === 'origin' ? 'Buscar dirección de origen' : 'Buscar dirección de destino'} onPick={pickPoint} />
          </div>
          <div className="form-grid">
            <label className="field">Categoría
              <select value={f.category} onChange={set('category')}>{cfg.categories.map((c) => <option key={c.category} value={c.category}>{c.name}</option>)}</select>
            </label>
            <label className="field">Pago
              <select value={f.payment_method} onChange={set('payment_method')}>{Object.entries(PAYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <label className="field">Asignación
            <select value={assign} onChange={(e) => setAssign(e.target.value)}>
              <option value="auto">Automática (el más cercano acepta)</option>
              {nearby.map((d) => <option key={d.id} value={d.id}>{d.name} · móvil {d.unit_number} · a {d.km.toFixed(1)} km</option>)}
            </select>
          </label>
          <label className="field">Notas para el conductor<input value={f.notes} onChange={set('notes')} placeholder="Ej. timbre 3B, lleva mascota" /></label>
          {option && (
            <div className="row between" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px' }}>
              <div className="small muted">{fmtKm(quote.distance_m)} · {fmtMin(quote.duration_s)}{option.pickup_eta_min ? ` · llega en ${option.pickup_eta_min} min` : ''}</div>
              <div className="bold" style={{ fontSize: '1.2rem' }}>{fmtMoney(option.total_cents)}</div>
            </div>
          )}
          <ErrorMsg error={submit.error} />
          <button className="btn brand lg" disabled={submit.busy || !origin || !dest}><Send size={18} /> Despachar viaje</button>
        </form>
      </div>
      {open && <TripDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
