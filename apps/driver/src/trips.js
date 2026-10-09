import { api, isNetworkError } from './api';
import { cacheGet, cacheSet, pendingEvents } from './storage';

// Aplica encima de los datos del servidor las acciones que todavía no se enviaron,
// para que el chofer vea el estado real aunque esté sin señal.
function overlay(trip) {
  const pending = pendingEvents();
  if (!pending.length || !trip?.shipments) return trip;
  const last = new Map();
  for (const e of pending) last.set(e.code, e.status);
  return {
    ...trip,
    shipments: trip.shipments.map((sh) => (last.has(sh.tracking_code) ? { ...sh, status: last.get(sh.tracking_code), pendingSync: true } : sh)),
  };
}

// Devuelve { data, offline }. Si no hay red usa la última copia guardada.
async function withCache(key, path) {
  try {
    const data = await api(path);
    cacheSet(key, data);
    return { data, offline: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const cached = cacheGet(key);
    if (!cached) throw e;
    return { data: cached, offline: true };
  }
}

export async function loadTrips() {
  return withCache('trips', '/driver/trips');
}

export async function loadTrip(id) {
  const r = await withCache(`trip:${id}`, `/driver/trips/${id}`);
  return { ...r, data: overlay(r.data) };
}

export async function loadFailedReasons() {
  try {
    return (await withCache('failed-reasons', '/driver/failed-reasons')).data;
  } catch {
    return ['Destinatario ausente', 'Domicilio incorrecto', 'Domicilio inaccesible', 'Rechazado por destinatario', 'Fuera de horario', 'Otro'];
  }
}

// Iniciar y finalizar viaje cambian el estado de muchos paquetes en el servidor: requieren conexión.
export const startTrip = (id) => api(`/driver/trips/${id}/start`, { method: 'POST' });
export const finishTrip = (id) => api(`/driver/trips/${id}/finish`, { method: 'POST' });
