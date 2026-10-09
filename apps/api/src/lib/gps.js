import { badRequest } from './errors.js';
import { config } from '../config.js';

// Registra un lote de posiciones (la app las acumula offline y las envía juntas).
export function recordPositions(db, { vehicleId, driverId, tripId }, positions) {
  if (!Array.isArray(positions) || !positions.length) throw badRequest('positions debe ser una lista');
  const ins = db.prepare(`
    INSERT INTO gps_positions (vehicle_id, trip_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let latest = null;
  let accepted = 0;
  for (const p of positions) {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) continue;
    const at = p.recorded_at ? new Date(p.recorded_at).toISOString() : new Date().toISOString();
    ins.run(vehicleId, tripId ?? null, driverId ?? null, lat, lng, p.speed_kmh ?? null, p.heading ?? null, p.accuracy_m ?? null, at);
    accepted++;
    if (!latest || at > latest.at) latest = { lat, lng, speed: p.speed_kmh ?? null, at };
  }
  if (latest) {
    db.prepare(`
      UPDATE vehicles SET last_lat = ?, last_lng = ?, last_speed_kmh = ?, last_position_at = ?
      WHERE id = ? AND (last_position_at IS NULL OR last_position_at < ?)
    `).run(latest.lat, latest.lng, latest.speed, latest.at, vehicleId, latest.at);
  }
  return { accepted, rejected: positions.length - accepted };
}

export function connectionStatus(lastPositionAt) {
  if (!lastPositionAt) return 'never';
  const minutes = (Date.now() - new Date(lastPositionAt).getTime()) / 60000;
  return minutes <= config.gpsOfflineMinutes ? 'online' : 'offline';
}

// Política de privacidad: purga posiciones más viejas que la retención configurada.
export function purgeOldPositions(db, days = config.gpsRetentionDays) {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  return Number(db.prepare('DELETE FROM gps_positions WHERE recorded_at < ?').run(cutoff).changes);
}
