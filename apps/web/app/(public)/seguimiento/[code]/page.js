'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Timeline from '@/components/Timeline';
import { StatusBadge, ErrorBox, Loading, useApi } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';

export default function Tracking() {
  const { code } = useParams();
  const { data: t, error, loading } = useApi(`/public/tracking/${encodeURIComponent(code)}`);
  return (
    <div className="container" style={{ marginTop: 28, maxWidth: 820 }}>
      <Link href="/" className="small">← Buscar otro envío</Link>
      {loading && <Loading />}
      {error && <div style={{ marginTop: 16 }}><ErrorBox error={error.status === 404 ? new Error('No encontramos un envío con ese código. Revisá que esté bien escrito.') : error} /></div>}
      {t && (
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="row between">
              <div>
                <div className="small muted">Código de seguimiento</div>
                <h1 className="mono" style={{ margin: 0 }}>{t.tracking_code}</h1>
              </div>
              <StatusBadge status={t.status} label={t.status_label} />
            </div>
            <dl className="dl" style={{ marginTop: 16 }}>
              <dt>Origen</dt><dd>{t.origin}</dd>
              <dt>Destino</dt><dd>{t.destination}</dd>
              <dt>Destinatario</dt><dd>{t.recipient}</dd>
              <dt>Entrega</dt><dd>{t.delivery_type === 'home' ? 'A domicilio' : 'Retiro en sucursal'} · {t.packages_count} bulto{t.packages_count > 1 ? 's' : ''}</dd>
              <dt>Fecha de envío</dt><dd>{fmtDate(t.created_at)}</dd>
              {t.delivered_at
                ? <><dt>Entregado</dt><dd>{fmtDateTime(t.delivered_at)}</dd></>
                : <><dt>Entrega estimada</dt><dd>{fmtDate(t.estimated_delivery_at)}</dd></>}
              <dt>Última actualización</dt><dd>{fmtDateTime(t.last_update)}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Movimientos</h2>
            <Timeline events={t.timeline.map((e) => ({ label: e.label, note: e.note, place: e.place, at: e.at }))} />
          </div>
          <p className="small muted">¿Algún problema con tu envío? <Link href={`/contacto?codigo=${t.tracking_code}&tipo=claim`}>Hacé un reclamo</Link>.</p>
        </div>
      )}
    </div>
  );
}
