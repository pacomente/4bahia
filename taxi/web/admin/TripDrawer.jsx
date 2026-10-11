import { X } from 'lucide-react';
import { usePoll, useAsync } from '../lib/hooks';
import { fmtMoney, fmtKm, fmtMin, fmtDateTime, fmtTime, PAYMENT } from '../lib/format';
import { BaseMap, CarMarker, Pin, Route, FitTo, InvalidateSize } from '../components/Map';
import { StatusBadge, Rating, ErrorMsg } from '../components/ui';
import { adminApi } from './AdminApp';

export default function TripDrawer({ id, onClose }) {
  const { data: t, refresh } = usePoll(() => adminApi(`/admin/trips/${id}`), 2500, [id]);
  const cancel = useAsync(async () => { if (confirm('¿Cancelar este viaje?')) { await adminApi(`/admin/trips/${id}/cancel`, { method: 'POST', body: { reason: 'Cancelado desde el panel' } }); refresh(); } });
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Detalle del viaje">
        <div className="drawer-head">
          <div className="grow"><div className="bold" style={{ fontSize: '1.1rem' }}>Viaje {t?.code ?? ''}</div>{t && <StatusBadge status={t.status} />}</div>
          <button className="icon-btn flat" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        </div>
        {!t ? <div className="drawer-body"><div className="spinner" /></div> : (
          <div className="drawer-body">
            <div className="map-box">
              <BaseMap center={t.origin} zoom={13} className="map-box" zoomControl={false}>
                <InvalidateSize />
                <Pin point={t.origin} type="origin" /><Pin point={t.dest} type="dest" />
                <Route coords={t.route} />
                {t.pickup_route && t.status === 'accepted' && <Route coords={t.pickup_route} dashed weight={3} />}
                {t.driver && ['accepted', 'arrived', 'in_progress'].includes(t.status) && <CarMarker lat={t.driver.lat} lng={t.driver.lng} heading={t.driver.heading} />}
                <FitTo points={t.route ?? [t.origin, t.dest]} fitKey={t.id} padding={[30, 30]} />
              </BaseMap>
            </div>
            <dl className="dl">
              <dt>Origen</dt><dd>{t.origin.address}</dd>
              <dt>Destino</dt><dd>{t.dest.address}</dd>
              <dt>Pasajero</dt><dd>{t.rider?.name ?? '—'} {t.rider?.phone ? `· ${t.rider.phone}` : ''} <span className="badge">{t.source === 'central' ? 'Central' : 'App'}</span></dd>
              <dt>Conductor</dt><dd>{t.driver ? <>{t.driver.name} · <Rating value={t.driver.rating} /> · {t.driver.vehicle.brand} {t.driver.vehicle.model} <span className="plate">{t.driver.vehicle.plate}</span></> : '—'}</dd>
              <dt>Recorrido</dt><dd>{fmtKm(t.distance_m)} · {fmtMin(t.duration_s)}</dd>
              <dt>Pago</dt><dd>{PAYMENT[t.payment_method]}{t.promo_code ? ` · promo ${t.promo_code}` : ''}</dd>
              {t.notes && <><dt>Notas</dt><dd>{t.notes}</dd></>}
              {t.rating_for_driver > 0 && <><dt>Calificación</dt><dd>{'★'.repeat(t.rating_for_driver)}{t.tip_cents ? ` · propina ${fmtMoney(t.tip_cents)}` : ''}</dd></>}
            </dl>
            <div className="card" style={{ padding: 14 }}>
              {t.fare_breakdown.lines?.map((l) => <div key={l.code} className="row between small"><span className="muted">{l.label}</span><span>{fmtMoney(l.cents)}</span></div>)}
              <div className="divider" />
              <div className="row between bold"><span>Total</span><span>{fmtMoney(t.fare_cents)}</span></div>
              {t.commission_cents != null && <div className="row between small"><span className="muted">Comisión empresa</span><span>{fmtMoney(t.commission_cents)}</span></div>}
            </div>
            <div>
              <h3>Línea de tiempo</h3>
              <ul className="timeline">{t.events.map((e, i) => <li key={i}><b>{fmtTime(e.at)}</b> · {e.note ?? e.type}</li>)}</ul>
            </div>
            {t.messages.length > 0 && (
              <div><h3>Mensajes</h3>{t.messages.map((m, i) => <div key={i} className="small"><b>{m.sender === 'rider' ? 'Pasajero' : 'Conductor'}:</b> {m.text} <span className="muted">{fmtTime(m.at)}</span></div>)}</div>
            )}
            <div className="small muted">Pedido {fmtDateTime(t.requested_at)}</div>
            <ErrorMsg error={cancel.error} />
            {['searching', 'accepted', 'arrived', 'in_progress'].includes(t.status) && <button className="btn danger" disabled={cancel.busy} onClick={() => cancel.run()}>Cancelar viaje</button>}
          </div>
        )}
      </aside>
    </>
  );
}
