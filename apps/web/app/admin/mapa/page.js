'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { useApi, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false, loading: () => <div className="map" /> });

const CONN = { online: ['good', 'En línea'], offline: ['critical', 'Sin señal'], never: ['', 'Sin datos'] };

export default function Mapa() {
  const { data, error } = useApi('/fleet/live', { interval: 15000 });
  const [track, setTrack] = useState([]);
  const [selected, setSelected] = useState(null);

  async function showTrack(v) {
    setSelected(v.id);
    const r = await api(`/fleet/vehicles/${v.id}/track`);
    setTrack(r.points);
  }

  return (
    <>
      <PageHead title="Mapa en vivo"><span className="small muted">Se actualiza cada 15 s</span></PageHead>
      <ErrorBox error={error} />
      <div className="form-layout">
        <LiveMap branches={data?.branches} vehicles={data?.vehicles} track={track} onSelectVehicle={showTrack} />
        <div className="stack">
          <div className="card">
            <h3>Vehículos</h3>
            <div className="stack" style={{ gap: 10 }}>
              {data?.vehicles.map((v) => (
                <button key={v.id} className="card" style={{ textAlign: 'left', padding: 12, cursor: 'pointer', outline: selected === v.id ? '2px solid var(--focus)' : 'none' }} onClick={() => showTrack(v)}>
                  <div className="row between"><strong>{v.plate}</strong><span className={`badge ${CONN[v.connection][0]}`}>{CONN[v.connection][1]}</span></div>
                  <div className="small muted">{v.description}</div>
                  <div className="small">{v.trip_code ? `Viaje ${v.trip_code} · ${v.driver_name}` : 'Sin viaje en curso'}</div>
                  <div className="small muted">Última posición: {timeAgo(v.last_position_at)}</div>
                  {v.eta && <div className="small">Llega aprox. {new Date(v.eta.eta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {v.eta.remaining_km} km</div>}
                </button>
              ))}
            </div>
          </div>
          {data?.alerts.length > 0 && (
            <div className="card">
              <h3>Alertas</h3>
              {data.alerts.map((a, i) => <div key={i} className="alert warn small" style={{ marginBottom: 6 }}>⚠ {a.message}</div>)}
            </div>
          )}
          <p className="small muted">El GPS depende de la app del conductor, sus permisos, la conectividad y el dispositivo. Un vehículo figura &quot;sin señal&quot; si no reporta en {data?.gps_offline_minutes ?? 10} minutos.</p>
        </div>
      </div>
    </>
  );
}
