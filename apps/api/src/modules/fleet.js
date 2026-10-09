import { Router } from 'express';
import { requireRole, STAFF, assertBranchAccess } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { required, pick } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { createTrip, assignShipments, tripShipments, startTrip, finishTrip, estimateArrival } from '../lib/trips.js';
import { connectionStatus, purgeOldPositions } from '../lib/gps.js';
import { config } from '../config.js';

export function computeAlerts(db) {
  const alerts = [];
  // Demoras: viajes en curso que superaron el tiempo esperado.
  for (const t of db.prepare(`
    SELECT t.id, t.code, t.started_at, t.expected_minutes, v.plate, u.name AS driver
    FROM trips t JOIN vehicles v ON v.id = t.vehicle_id JOIN users u ON u.id = t.driver_id
    WHERE t.status = 'in_progress' AND t.expected_minutes IS NOT NULL
      AND (julianday('now') - julianday(t.started_at)) * 1440 > t.expected_minutes
  `).all()) {
    alerts.push({ type: 'trip_delayed', severity: 'warning', trip_id: t.id, message: `Viaje ${t.code} (${t.plate}) superó los ${t.expected_minutes} min previstos` });
  }
  // Sin señal: vehículos con viaje en curso y sin posición reciente.
  for (const v of db.prepare(`
    SELECT DISTINCT v.id, v.plate, v.last_position_at FROM vehicles v JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
  `).all()) {
    if (connectionStatus(v.last_position_at) !== 'online') {
      alerts.push({ type: 'gps_offline', severity: 'warning', vehicle_id: v.id, message: `${v.plate} sin señal GPS desde ${v.last_position_at ?? 'el inicio del viaje'}` });
    }
  }
  return alerts;
}

export default function fleetRoutes(db) {
  const r = Router();
  r.use(requireRole(...STAFF));

  r.get('/vehicles', (_req, res) => res.json(db.prepare('SELECT * FROM vehicles ORDER BY plate').all()
    .map((v) => ({ ...v, connection: connectionStatus(v.last_position_at) }))));

  r.post('/vehicles', requireRole('superadmin', 'branch_admin'), (req, res) => {
    required(req.body, ['plate']);
    const d = pick(req.body, ['plate', 'description', 'capacity_kg', 'branch_id']);
    const { lastInsertRowid } = db.prepare('INSERT INTO vehicles (plate, description, capacity_kg, branch_id) VALUES (?, ?, ?, ?)')
      .run(String(d.plate).toUpperCase(), d.description ?? null, d.capacity_kg ?? null, d.branch_id ?? req.user.branch_id ?? null);
    audit(db, req, 'vehicle.create', 'vehicle', Number(lastInsertRowid), d);
    res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(lastInsertRowid));
  });

  // Transportistas para asignar a viajes. Se listan todos (los troncales cruzan sucursales),
  // primero los de la sucursal del usuario.
  r.get('/drivers', (req, res) => {
    res.json(db.prepare(`
      SELECT u.id, u.name, u.phone, u.branch_id, b.code AS branch_code FROM users u LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.role = 'driver' AND u.active = 1 ORDER BY (u.branch_id = ?) DESC, u.name
    `).all(req.user.branch_id ?? 0));
  });

  // Mapa en vivo: vehículos con última posición, estado de conexión, viaje activo y ETA.
  r.get('/live', (_req, res) => {
    const vehicles = db.prepare(`
      SELECT v.*, t.id AS trip_id, t.code AS trip_code, t.type AS trip_type, t.dest_branch_id, u.name AS driver_name
      FROM vehicles v
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'in_progress'
      LEFT JOIN users u ON u.id = t.driver_id
      WHERE v.active = 1
    `).all();
    const branch = db.prepare('SELECT id, name, lat, lng FROM branches WHERE id = ?');
    res.json({
      gps_offline_minutes: config.gpsOfflineMinutes,
      vehicles: vehicles.map((v) => ({
        ...v,
        connection: connectionStatus(v.last_position_at),
        eta: v.dest_branch_id ? estimateArrival(v, branch.get(v.dest_branch_id)) : null,
      })),
      branches: db.prepare('SELECT id, code, name, lat, lng FROM branches WHERE active = 1').all(),
      alerts: computeAlerts(db),
    });
  });

  // Historial de recorrido de un vehículo (sujeto a la retención configurada).
  r.get('/vehicles/:id/track', (req, res) => {
    const from = req.query.from ?? new Date(Date.now() - 86400_000).toISOString();
    const to = req.query.to ?? new Date().toISOString();
    const points = db.prepare(`
      SELECT lat, lng, speed_kmh, heading, recorded_at, trip_id FROM gps_positions
      WHERE vehicle_id = ? AND recorded_at BETWEEN ? AND ? ORDER BY recorded_at LIMIT 20000
    `).all(req.params.id, from, to);
    res.json({ vehicle_id: Number(req.params.id), from, to, points });
  });

  r.get('/alerts', (_req, res) => res.json(computeAlerts(db)));

  r.post('/gps/purge', requireRole('superadmin'), (req, res) => {
    const deleted = purgeOldPositions(db);
    audit(db, req, 'gps.purge', null, null, { deleted });
    res.json({ deleted, retention_days: config.gpsRetentionDays });
  });

  // Viajes
  r.get('/trips', (req, res) => {
    const where = [];
    const params = [];
    if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
    if (req.query.branch_id) { where.push('(t.origin_branch_id = ? OR t.dest_branch_id = ?)'); params.push(req.query.branch_id, req.query.branch_id); }
    res.json(db.prepare(`
      SELECT t.*, v.plate, u.name AS driver_name, ob.code AS origin_branch, db.code AS dest_branch,
        (SELECT COUNT(*) FROM trip_shipments ts WHERE ts.trip_id = t.id) AS shipments_count
      FROM trips t JOIN vehicles v ON v.id = t.vehicle_id JOIN users u ON u.id = t.driver_id
      JOIN branches ob ON ob.id = t.origin_branch_id LEFT JOIN branches db ON db.id = t.dest_branch_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.id DESC LIMIT 200
    `).all(...params));
  });

  r.post('/trips', (req, res) => {
    required(req.body, ['type', 'vehicle_id', 'driver_id', 'origin_branch_id']);
    assertBranchAccess(req.user, req.body.origin_branch_id);
    const result = createTrip(db, { ...req.body, shipment_codes: req.body.codes ?? [] });
    audit(db, req, 'trip.create', 'trip', result.trip.id, { type: req.body.type });
    res.status(201).json(result);
  });

  const loadTrip = (id) => {
    const t = db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
    if (!t) throw notFound('Viaje no encontrado');
    return t;
  };

  r.get('/trips/:id', (req, res) => {
    const t = loadTrip(req.params.id);
    res.json({ ...t, shipments: tripShipments(db, t.id) });
  });

  r.post('/trips/:id/shipments', (req, res) => {
    const t = loadTrip(req.params.id);
    assertBranchAccess(req.user, t.origin_branch_id);
    res.json({ results: assignShipments(db, t, req.body.codes ?? []) });
  });

  r.post('/trips/:id/start', (req, res) => {
    const t = loadTrip(req.params.id);
    assertBranchAccess(req.user, t.origin_branch_id);
    res.json({ results: startTrip(db, t, req.user) });
  });

  r.post('/trips/:id/finish', (req, res) => res.json(finishTrip(db, loadTrip(req.params.id))));

  return r;
}
