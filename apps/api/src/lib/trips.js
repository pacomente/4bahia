import { randomInt } from 'node:crypto';
import { tx, nowIso } from '../db/index.js';
import { badRequest, conflict, notFound } from './errors.js';
import { changeStatus, findShipment } from './shipments.js';
import { STATUS } from './statuses.js';

export function createTrip(db, { type, vehicle_id, driver_id, origin_branch_id, dest_branch_id, expected_minutes, planned_at, shipment_codes = [] }) {
  if (!['transfer', 'delivery'].includes(type)) throw badRequest('type debe ser transfer o delivery');
  if (type === 'transfer' && !dest_branch_id) throw badRequest('Un viaje troncal requiere dest_branch_id');
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND active = 1').get(vehicle_id);
  if (!vehicle) throw notFound('Vehículo no encontrado');
  const driver = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'driver' AND active = 1").get(driver_id);
  if (!driver) throw notFound('Transportista no encontrado');

  return tx(db, () => {
    const code = `V${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomInt(1000, 9999)}`;
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO trips (code, type, vehicle_id, driver_id, origin_branch_id, dest_branch_id, expected_minutes, planned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, type, vehicle_id, driver_id, origin_branch_id, dest_branch_id ?? null, expected_minutes ?? null, planned_at ?? nowIso());
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(lastInsertRowid);
    const assigned = assignShipments(db, trip, shipment_codes);
    return { trip, assigned };
  });
}

const ASSIGNABLE = {
  transfer: [STATUS.RECEIVED, STATUS.SORTED, STATUS.DELAYED, STATUS.DAMAGED],
  delivery: [STATUS.RECEIVED, STATUS.SORTED, STATUS.AT_DEST_BRANCH, STATUS.FAILED_ATTEMPT, STATUS.READY_FOR_PICKUP, STATUS.DELAYED],
};

export function assignShipments(db, trip, codes) {
  if (trip.status !== 'planned') throw conflict('Solo se pueden asignar paquetes a viajes planificados');
  const results = [];
  let order = db.prepare('SELECT COALESCE(MAX(stop_order), 0) AS n FROM trip_shipments WHERE trip_id = ?').get(trip.id).n;
  for (const code of codes) {
    try {
      const s = findShipment(db, code);
      if (!ASSIGNABLE[trip.type].includes(s.status)) throw conflict(`Estado ${s.status} no asignable`);
      if (Number(s.current_branch_id) !== Number(trip.origin_branch_id)) throw conflict('El paquete no está en la sucursal de salida');
      if (trip.type === 'delivery' && s.delivery_type !== 'home') throw conflict('El envío es para retiro en sucursal');
      db.prepare('INSERT OR IGNORE INTO trip_shipments (trip_id, shipment_id, stop_order) VALUES (?, ?, ?)').run(trip.id, s.id, ++order);
      results.push({ code: s.tracking_code, ok: true });
    } catch (e) {
      results.push({ code, ok: false, error: e.message });
    }
  }
  return results;
}

export function tripShipments(db, tripId) {
  return db.prepare(`
    SELECT s.id, s.tracking_code, s.status, s.recipient_name, s.recipient_phone, s.recipient_address,
      s.packages_count, s.cod_amount_cents, s.delivery_type, dl.name AS destination, dl.province AS destination_province, ts.stop_order
    FROM trip_shipments ts JOIN shipments s ON s.id = ts.shipment_id JOIN localities dl ON dl.id = s.dest_locality_id
    WHERE ts.trip_id = ? ORDER BY ts.stop_order
  `).all(tripId);
}

// Iniciar viaje: los paquetes pasan a "en viaje" (troncal) o "en reparto" (última milla).
export function startTrip(db, trip, user) {
  if (trip.status !== 'planned') throw conflict('El viaje no está planificado');
  const next = trip.type === 'transfer' ? STATUS.IN_TRANSIT : STATUS.OUT_FOR_DELIVERY;
  const results = [];
  for (const s of tripShipments(db, trip.id)) {
    try {
      changeStatus(db, findShipment(db, s.id), { status: next, trip_id: trip.id }, { user });
      results.push({ code: s.tracking_code, ok: true });
    } catch (e) {
      results.push({ code: s.tracking_code, ok: false, error: e.message });
    }
  }
  db.prepare("UPDATE trips SET status = 'in_progress', started_at = ? WHERE id = ?").run(nowIso(), trip.id);
  return results;
}

export function finishTrip(db, trip) {
  if (trip.status !== 'in_progress') throw conflict('El viaje no está en curso');
  db.prepare("UPDATE trips SET status = 'completed', finished_at = ? WHERE id = ?").run(nowIso(), trip.id);
  // En troncales la recepción la confirma la sucursal destino escaneando; los no escaneados quedan pendientes.
  const pending = tripShipments(db, trip.id).filter((s) => [STATUS.IN_TRANSIT, STATUS.OUT_FOR_DELIVERY].includes(s.status));
  return { pending };
}

// Distancia en km entre dos coordenadas (haversine).
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ETA simple: distancia en línea recta × factor de ruta / velocidad. Solo si hay datos suficientes.
export function estimateArrival(vehicle, destBranch) {
  if (vehicle?.last_lat == null || destBranch?.lat == null) return null;
  const km = distanceKm({ lat: vehicle.last_lat, lng: vehicle.last_lng }, destBranch) * 1.25;
  const speed = vehicle.last_speed_kmh > 20 ? vehicle.last_speed_kmh : 65;
  return { remaining_km: Math.round(km), eta: new Date(Date.now() + (km / speed) * 3600_000).toISOString() };
}
