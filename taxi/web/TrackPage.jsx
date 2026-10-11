import { useParams } from 'react-router-dom';
import { usePoll, useConfig } from './lib/hooks';
import { fmtMoney } from './lib/format';
import { BaseMap, CarMarker, Pin, Route, FitTo } from './components/Map';
import { StatusBadge, Rating, Logo } from './components/ui';
import PhoneFrame from './components/PhoneFrame';

// Seguimiento compartido por el pasajero (sin datos personales).
export default function TrackPage() {
  const { token } = useParams();
  const cfg = useConfig();
  const { data: t, error } = usePoll(() => fetch(`/api/public/track/${token}`).then((r) => { if (!r.ok) throw new Error('Viaje no encontrado'); return r.json(); }), 3000, [token]);
  return (
    <PhoneFrame>
      <div className="mobile-app">
        {error && !t && <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 24 }}><p>{error.message}</p></div>}
        {t && (
          <>
            <BaseMap center={t.origin} zoom={14}>
              <Pin point={t.origin} type="origin" /><Pin point={t.dest} type="dest" />
              <Route coords={t.status === 'accepted' ? t.pickup_route : t.route} dashed={t.status === 'accepted'} />
              {t.driver && ['accepted', 'arrived', 'in_progress'].includes(t.status) && <CarMarker lat={t.driver.lat} lng={t.driver.lng} heading={t.driver.heading} />}
              <FitTo points={t.route ?? [t.origin, t.dest]} fitKey={t.status} paddingBottom={220} />
            </BaseMap>
            <div className="top-bar"><span className="pill-status"><Logo brand={cfg?.brand} /></span></div>
            <div className="sheet">
              <div className="row between"><h3 style={{ margin: 0 }}>Viaje compartido</h3><StatusBadge status={t.status} /></div>
              <div className="small muted" style={{ margin: '6px 0 10px' }}>{t.origin.address} → {t.dest.address}</div>
              {t.eta_min && <div className="eta-bubble" style={{ marginBottom: 10 }}>{t.eta_min} min <small>{t.status === 'accepted' ? 'para el encuentro' : 'para llegar'}</small></div>}
              {t.driver && <div className="small">{t.driver.name} · <Rating value={t.driver.rating} /> · {t.driver.vehicle.brand} {t.driver.vehicle.model} <span className="plate">{t.driver.vehicle.plate}</span></div>}
              {t.status === 'completed' && <div className="alert good" style={{ marginTop: 10 }}>Llegó a destino · {fmtMoney(t.fare_cents)}</div>}
            </div>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}
