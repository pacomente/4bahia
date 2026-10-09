'use client';
import { MapPin, Phone, Navigation } from 'lucide-react';
import { useApi, Loading, ErrorBox } from '@/components/ui';

export default function Sucursales() {
  const { data, error, loading } = useApi('/public/branches');
  return (
    <div className="container">
      <div className="page-hero" style={{ marginBottom: 20 }}>
        <span className="eyebrow">Red de sucursales</span>
        <h1>Encontrá tu sucursal</h1>
        <p>Despachá o retirá tus envíos en cualquiera de nuestros mostradores.</p>
      </div>
      {loading && <Loading />}
      <ErrorBox error={error} />
      <div className="grid grid-3">
        {data?.map((b) => (
          <div key={b.id} className="card service-card">
            <div className="row between"><span className="icon-chip"><MapPin size={22} /></span><span className="badge">{b.code}</span></div>
            <h3>{b.name}</h3>
            <p>{b.address}<br />{b.city}, {b.province}</p>
            {b.phone && <p className="row" style={{ gap: 6 }}><Phone size={14} /> {b.phone}</p>}
            {b.lat != null && (
              <a className="btn ghost sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`} target="_blank" rel="noreferrer"><Navigation size={14} /> Cómo llegar</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
