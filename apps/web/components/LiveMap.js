'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Popup } from 'react-leaflet';
import { timeAgo } from '@/lib/format';

const CONNECTION = {
  online: { color: '#0ca30c', label: 'En línea' },
  offline: { color: '#d03b3b', label: 'Sin señal' },
  never: { color: '#8f8e86', label: 'Sin datos' },
};

// Mapa con sucursales (cuadrado naranja), vehículos (círculo por estado de conexión) y recorrido opcional.
export default function LiveMap({ branches = [], vehicles = [], track = [], onSelectVehicle }) {
  const center = [-38.3, -61.5];
  return (
    <MapContainer center={center} zoom={6} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {branches.filter((b) => b.lat != null).map((b) => (
        <CircleMarker key={`b${b.id}`} center={[b.lat, b.lng]} radius={7}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#e2591f', fillOpacity: 1 }}>
          <Tooltip>{b.code} · {b.name}</Tooltip>
        </CircleMarker>
      ))}
      {track.length > 1 && <Polyline positions={track.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#2a78d6', weight: 3 }} />}
      {vehicles.filter((v) => v.last_lat != null).map((v) => {
        const c = CONNECTION[v.connection] ?? CONNECTION.never;
        return (
          <CircleMarker key={`v${v.id}`} center={[v.last_lat, v.last_lng]} radius={10}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: c.color, fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelectVehicle?.(v) }}>
            <Tooltip direction="top" offset={[0, -8]}>{v.plate} · {c.label}</Tooltip>
            <Popup>
              <strong>{v.plate}</strong> — {v.description}<br />
              {c.label} · última posición {timeAgo(v.last_position_at)}<br />
              {v.trip_code ? <>Viaje {v.trip_code} · {v.driver_name}<br /></> : 'Sin viaje en curso'}
              {v.eta && <>Llega aprox. {new Date(v.eta.eta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} ({v.eta.remaining_km} km)</>}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
