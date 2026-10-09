'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Search, MapPin, Flag, CalendarClock, User, Package, MessageSquareWarning } from 'lucide-react';
import Timeline from '@/components/Timeline';
import ShipmentProgress from '@/components/ShipmentProgress';
import { StatusBadge, ErrorBox, Loading, useApi } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';

export default function Tracking() {
  const { code } = useParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data: t, error, loading } = useApi(`/public/tracking/${encodeURIComponent(code)}`);
  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: 12 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <Link href="/" className="row small" style={{ gap: 6, color: 'var(--text-2)' }}><ArrowLeft size={16} /> Inicio</Link>
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/seguimiento/${q.trim().toUpperCase()}`); }}>
          <div className="input-icon"><Search size={16} /><input className="track-input" style={{ width: 240, padding: '9px 12px 9px 36px' }} placeholder="Buscar otro envío" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn sm">Rastrear</button>
        </form>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error.status === 404 ? new Error('No encontramos un envío con ese código. Revisá que esté bien escrito.') : error} />}
      {t && (
        <div className="stack" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 28 }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <span className="eyebrow">Seguimiento</span>
                <h1 className="mono" style={{ margin: '12px 0 4px', fontSize: '1.9rem' }}>{t.tracking_code}</h1>
                <div className="muted small">Actualizado {fmtDateTime(t.last_update)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={t.status} label={t.status_label} />
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.02em' }}>{t.status_label}</div>
              </div>
            </div>
            <div style={{ marginTop: 26 }}>
              <ShipmentProgress status={t.status} deliveryType={t.delivery_type} history={t.timeline.map((e) => e.status)} />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h3>Detalle del envío</h3>
              <div className="stack" style={{ gap: 12 }}>
                <Info icon={MapPin} label="Origen" value={t.origin} />
                <Info icon={Flag} label="Destino" value={t.destination} />
                <Info icon={User} label="Destinatario" value={t.recipient} />
                <Info icon={Package} label="Entrega" value={`${t.delivery_type === 'home' ? 'A domicilio' : 'Retiro en sucursal'} · ${t.packages_count} bulto${t.packages_count > 1 ? 's' : ''}`} />
                <Info icon={CalendarClock} label={t.delivered_at ? 'Entregado' : 'Entrega estimada'} value={t.delivered_at ? fmtDateTime(t.delivered_at) : fmtDate(t.estimated_delivery_at)} />
              </div>
            </div>
            <div className="card">
              <h3>Movimientos</h3>
              <Timeline events={t.timeline.map((e) => ({ label: e.label, note: e.note, place: e.place, at: e.at }))} />
            </div>
          </div>
          <div className="alert info">
            <MessageSquareWarning size={18} />
            <span>¿Algún problema con tu envío? <Link href={`/contacto?codigo=${t.tracking_code}&tipo=claim`}>Hacé un reclamo</Link> y te respondemos por email.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--text-2)' }}><Icon size={16} /></span>
      <div><div className="small muted">{label}</div><div style={{ fontWeight: 650 }}>{value}</div></div>
    </div>
  );
}
