import { Fragment, useState } from 'react';
import { usePoll } from '../lib/hooks';
import { fmtMoney, initials } from '../lib/format';
import { BaseMap, CarMarker, Pin, Route, InvalidateSize, STATUS_COLORS } from '../components/Map';
import { StatusBadge, Rating } from '../components/ui';
import { adminApi, PageHead } from './AdminApp';
import TripDrawer from './TripDrawer';

export default function LiveMap() {
  const { data } = usePoll(() => adminApi('/admin/live'), 2000);
  const [filter, setFilter] = useState('all');
  const [openTrip, setOpenTrip] = useState(null);
  const [sel, setSel] = useState(null);
  if (!data) return <div className="spinner" />;
  const drivers = data.drivers.filter((d) => filter === 'all' || d.status === filter);
  const count = (s) => data.drivers.filter((d) => d.status === s).length;
  const selected = data.drivers.find((d) => d.id === sel);
  return (
    <>
      <PageHead title="Mapa en vivo" sub="Flota y viajes activos, actualizado cada 2 segundos">
        <div className="tabs" style={{ margin: 0 }}>
          {[['all', `Todos (${data.drivers.length})`], ['available', `Libres (${count('available')})`], ['busy', `Ocupados (${count('busy')})`], ['offline', `Desconectados (${count('offline')})`]].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </PageHead>
      <div className="split">
        <div style={{ position: 'relative' }}>
          <BaseMap center={data.center} zoom={13} className="admin-map">
            <InvalidateSize />
            {data.trips.map((t) => (
              <Fragment key={t.id}>
                <Pin point={t.origin} type="origin" />
                <Pin point={t.dest} type="dest" />
                {t.status === 'accepted' && <Route coords={t.pickup_route} dashed weight={3} />}
                {t.status === 'in_progress' && <Route coords={t.route} color="#2563eb" weight={4} />}
              </Fragment>
            ))}
            {drivers.map((d) => (
              <CarMarker key={d.id} lat={d.lat} lng={d.lng} heading={d.heading} color={STATUS_COLORS[d.status]}
                tooltip={`${d.name} · ${d.plate} · ${{ available: 'Libre', busy: 'Ocupado', offline: 'Desconectado' }[d.status]}`}
                onClick={() => setSel(d.id)} />
            ))}
          </BaseMap>
          <div className="card legend" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 500, padding: '8px 12px' }}>
            <span><i style={{ background: STATUS_COLORS.available }} />Libre</span>
            <span><i style={{ background: STATUS_COLORS.busy }} />Ocupado</span>
            <span><i style={{ background: STATUS_COLORS.offline }} />Desconectado</span>
          </div>
        </div>
        <div className="stack">
          {selected && (
            <div className="card stack" style={{ gap: 8 }}>
              <div className="row"><span className="avatar">{initials(selected.name)}</span><div className="grow"><div className="bold">{selected.name}</div><div className="small muted"><Rating value={selected.rating} /> · Móvil {selected.unit_number}</div></div></div>
              <div className="small">{selected.brand} {selected.model} · <span className="plate">{selected.plate}</span></div>
              <div className="row small"><span className={`badge ${selected.status === 'available' ? 'good' : selected.status === 'busy' ? 'brand' : ''}`}>{{ available: 'Libre', busy: 'En viaje', offline: 'Desconectado' }[selected.status]}</span>{selected.is_bot ? <span className="badge">Simulado</span> : <span className="badge info">App real</span>}</div>
              {selected.trip_id && <button className="btn sm" onClick={() => setOpenTrip(selected.trip_id)}>Ver viaje</button>}
            </div>
          )}
          <div className="card">
            <h3>Viajes activos ({data.trips.length})</h3>
            {data.trips.length === 0 && <p className="small muted">No hay viajes en curso. Pedí uno desde la app del pasajero o la central.</p>}
            <div className="stack" style={{ gap: 8 }}>
              {data.trips.map((t) => (
                <button key={t.id} className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setOpenTrip(t.id)}>
                  <div className="row between"><span className="bold">{t.code}</span><StatusBadge status={t.status} /></div>
                  <div className="small ellipsis">{t.origin.address} → {t.dest.address}</div>
                  <div className="xs muted">{t.rider?.name} · {t.driver ? t.driver.name : 'sin conductor'} · {fmtMoney(t.fare_cents)}{t.eta_min ? ` · ${t.eta_min} min` : ''}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {openTrip && <TripDrawer id={openTrip} onClose={() => setOpenTrip(null)} />}
    </>
  );
}
