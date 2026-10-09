'use client';
import { useApi, Loading, ErrorBox } from '@/components/ui';

export default function Sucursales() {
  const { data, error, loading } = useApi('/public/branches');
  return (
    <div className="container" style={{ marginTop: 28 }}>
      <h1>Sucursales</h1>
      {loading && <Loading />}
      <ErrorBox error={error} />
      <div className="grid grid-3">
        {data?.map((b) => (
          <div key={b.id} className="card">
            <h3>{b.name}</h3>
            <p className="muted" style={{ margin: 0 }}>{b.address}<br />{b.city}, {b.province}</p>
            {b.phone && <p className="small" style={{ margin: '8px 0 0' }}>Tel. {b.phone}</p>}
            {b.lat != null && (
              <a className="small" href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">Ver en el mapa</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
