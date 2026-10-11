import { config } from './config.js';

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function pathLength(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += distanceM({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] });
  return d;
}

// Punto a `meters` metros del inicio del recorrido.
export function pointAlong(coords, meters) {
  let left = meters;
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][0], lng: coords[i - 1][1] };
    const b = { lat: coords[i][0], lng: coords[i][1] };
    const seg = distanceM(a, b);
    if (left <= seg || i === coords.length - 1) {
      const t = seg ? Math.min(1, left / seg) : 1;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b), done: i === coords.length - 1 && left >= seg };
    }
    left -= seg;
  }
  const last = coords[coords.length - 1];
  return { lat: last[0], lng: last[1], heading: 0, done: true };
}

// Recorrido simulado "en escalera" (imita una grilla de calles) cuando no hay servicio de ruteo.
export function syntheticRoute(a, b) {
  const steps = 3;
  const coords = [[a.lat, a.lng]];
  for (let i = 1; i <= steps; i++) {
    const lat = a.lat + ((b.lat - a.lat) * i) / steps;
    const lng = a.lng + ((b.lng - a.lng) * i) / steps;
    coords.push([lat, coords[coords.length - 1][1]]); // tramo norte-sur
    coords.push([lat, lng]);                          // tramo este-oeste
  }
  const distance = pathLength(coords);
  return { coords, distance_m: Math.round(distance), duration_s: Math.round(distance / 7.5) + 60, source: 'synthetic' };
}

const cache = new Map();
let osrmDownUntil = 0;

// Ruta por calles (OSRM). Cae al recorrido simulado si el servicio no responde.
export async function route(a, b) {
  const key = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join(',');
  if (cache.has(key)) return cache.get(key);
  let result = null;
  if (config.routingEnabled && Date.now() > osrmDownUntil) {
    try {
      const url = `${config.osrmUrl}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { 'User-Agent': 'taxi-demo' } });
      const data = await res.json();
      const r = data.routes?.[0];
      if (r) {
        result = { coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance_m: Math.round(r.distance), duration_s: Math.round(r.duration), source: 'osrm' };
      }
    } catch {
      osrmDownUntil = Date.now() + 60_000; // no reintentar durante un minuto
    }
  }
  result ??= syntheticRoute(a, b);
  if (cache.size > 2000) cache.clear();
  cache.set(key, result);
  return result;
}

// Simplifica un recorrido para guardarlo / enviarlo (máx. ~200 puntos).
export function simplify(coords, max = 200) {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.floor(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}

// Punto aleatorio a `radius` metros del centro.
export function randomPointNear(center, radius) {
  const r = radius * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  return {
    lat: center.lat + (r * Math.cos(t)) / 111320,
    lng: center.lng + (r * Math.sin(t)) / (111320 * Math.cos(rad(center.lat))),
  };
}
