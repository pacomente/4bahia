import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export function BaseMap({ center, zoom = 14, children, className = 'map-full', zoomControl = true }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className={className} zoomControl={zoomControl} attributionControl>
      <TileLayer url={TILES} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' subdomains="abcd" maxZoom={19} />
      {children}
    </MapContainer>
  );
}

// Auto visto desde arriba. color: cuerpo del auto.
function carSvg(color) {
  return `<svg width="34" height="34" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#s)"><rect x="12" y="4" width="16" height="32" rx="6" fill="${color}" stroke="#111" stroke-width="1.5"/>
    <rect x="14.5" y="10" width="11" height="6" rx="2" fill="#2b2b2b"/><rect x="14.5" y="25" width="11" height="5" rx="2" fill="#2b2b2b"/>
    <rect x="16" y="17.5" width="8" height="6" rx="1.5" fill="${color}" opacity=".85"/></g>
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity=".35"/></filter></defs></svg>`;
}

const iconCache = new Map();
function carIcon(color) {
  if (!iconCache.has(color)) {
    iconCache.set(color, L.divIcon({ className: 'car-marker', html: `<div class="car-rot">${carSvg(color)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }));
  }
  return iconCache.get(color);
}

export function CarMarker({ lat, lng, heading = 0, color = '#FFC300', tooltip, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.getElement()?.querySelector('.car-rot');
    if (el) el.style.transform = `rotate(${heading ?? 0}deg)`;
  }, [heading, lat, lng]);
  if (lat == null || lng == null) return null;
  return (
    <Marker ref={ref} position={[lat, lng]} icon={carIcon(color)} eventHandlers={onClick ? { click: onClick } : undefined}>
      {tooltip && <Tooltip direction="top" offset={[0, -14]}>{tooltip}</Tooltip>}
    </Marker>
  );
}

const pin = (cls) => L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
const PINS = { origin: pin('pin-origin'), dest: pin('pin-dest'), me: L.divIcon({ className: '', html: '<div class="pin-me"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) };

export function Pin({ point, type = 'origin', label }) {
  if (!point) return null;
  return (
    <Marker position={[point.lat, point.lng]} icon={PINS[type]}>
      {label && <Tooltip permanent direction="top" offset={[0, -10]} className="pin-label">{label}</Tooltip>}
    </Marker>
  );
}

export function Route({ coords, color = '#111', dashed = false, weight = 5 }) {
  if (!coords?.length) return null;
  return (
    <>
      <Polyline positions={coords} pathOptions={{ color: '#fff', weight: weight + 4, opacity: 0.9 }} />
      <Polyline positions={coords} pathOptions={{ color, weight, dashArray: dashed ? '2 10' : undefined, lineCap: 'round' }} />
    </>
  );
}

// Ajusta el mapa para mostrar todos los puntos cuando cambia `fitKey`.
export function FitTo({ points, fitKey, padding = [60, 60], paddingBottom = 0, maxZoom = 16 }) {
  const map = useMap();
  const pts = useMemo(() => (points ?? []).filter(Boolean).map((p) => (Array.isArray(p) ? p : [p.lat, p.lng])), [points]);
  useEffect(() => {
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], Math.min(maxZoom, 15), { animate: true }); return; }
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: padding, paddingBottomRight: [padding[0], padding[1] + paddingBottom], maxZoom, animate: true });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function MapClick({ onClick }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function CenterWatcher({ onMove }) {
  const map = useMapEvents({ moveend: () => { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }); } });
  return null;
}

export function InvalidateSize() {
  const map = useMap();
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 200); return () => clearTimeout(t); }, [map]);
  return null;
}

export const STATUS_COLORS = { available: '#12a150', busy: '#FFC300', offline: '#9a9994' };
