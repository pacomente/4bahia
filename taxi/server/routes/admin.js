import { Router } from 'express';
import { requireRole, notFound, bad, hashPassword } from '../auth.js';
import { getSetting, setSetting, now } from '../db.js';
import { config } from '../config.js';
import { randomPointNear } from '../geo.js';

const SETTINGS = ['commission_pct', 'night_surcharge_pct', 'night_start', 'night_end', 'surge_multiplier', 'offer_timeout_s', 'sim_speed', 'bot_accept_delay_s', 'bots_enabled'];

export default function adminRoutes(db, engine) {
  const r = Router();
  r.use(requireRole('admin', 'operator'));
  const adminOnly = requireRole('admin');
  const startOfDay = (d = 0) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - d); return x.toISOString(); };

  // ───────── Panel ─────────
  r.get('/dashboard', (_req, res) => {
    const today = startOfDay();
    const kpi = db.prepare(`
      SELECT COUNT(*) AS trips,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status IN ('cancelled','no_drivers') THEN 1 ELSE 0 END) AS cancelled,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN fare_final_cents END), 0) AS revenue_cents,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN commission_cents END), 0) AS commission_cents,
        AVG(CASE WHEN arrived_at IS NOT NULL THEN (julianday(arrived_at) - julianday(requested_at)) * 1440 END) AS avg_wait_min,
        AVG(rating_for_driver) AS avg_rating,
        SUM(CASE WHEN source = 'central' THEN 1 ELSE 0 END) AS central
      FROM trips WHERE requested_at >= ?`).get(today);
    const live = db.prepare(`SELECT
        (SELECT COUNT(*) FROM trips WHERE status IN ('searching','accepted','arrived','in_progress')) AS active_trips,
        (SELECT COUNT(*) FROM trips WHERE status = 'searching') AS searching,
        (SELECT COUNT(*) FROM drivers WHERE status = 'available') AS available,
        (SELECT COUNT(*) FROM drivers WHERE status = 'busy') AS busy,
        (SELECT COUNT(*) FROM drivers WHERE status = 'offline') AS offline`).get();
    const daily = db.prepare(`
      SELECT substr(requested_at, 1, 10) AS day, COUNT(*) AS trips, COALESCE(SUM(CASE WHEN status = 'completed' THEN fare_final_cents END), 0) AS revenue_cents
      FROM trips WHERE requested_at >= ? GROUP BY day ORDER BY day`).all(startOfDay(13));
    const hourly = db.prepare(`
      SELECT CAST(strftime('%H', requested_at, 'localtime') AS INTEGER) AS hour, COUNT(*) AS trips FROM trips WHERE requested_at >= ? GROUP BY hour`).all(startOfDay(13));
    const byCategory = db.prepare(`
      SELECT t.category, tf.name, COUNT(*) AS trips FROM trips t JOIN tariffs tf ON tf.category = t.category WHERE t.requested_at >= ? GROUP BY t.category ORDER BY trips DESC`).all(startOfDay(13));
    const topDrivers = db.prepare(`
      SELECT u.name, u.rating, COUNT(*) AS trips, SUM(t.fare_final_cents) AS revenue_cents FROM trips t JOIN users u ON u.id = t.driver_id
      WHERE t.status = 'completed' AND t.requested_at >= ? GROUP BY t.driver_id ORDER BY trips DESC LIMIT 5`).all(startOfDay(6));
    res.json({ kpi, live, daily, hourly, by_category: byCategory, top_drivers: topDrivers });
  });

  // ───────── Mapa en vivo ─────────
  r.get('/live', (_req, res) => {
    const drivers = db.prepare(`
      SELECT d.user_id AS id, u.name, u.phone, u.rating, d.status, d.lat, d.lng, d.heading, d.last_seen, d.is_bot,
        v.plate, v.brand, v.model, v.unit_number, v.category,
        (SELECT id FROM trips WHERE driver_id = d.user_id AND status IN ('accepted','arrived','in_progress') ORDER BY id DESC LIMIT 1) AS trip_id
      FROM drivers d JOIN users u ON u.id = d.user_id LEFT JOIN vehicles v ON v.id = d.vehicle_id WHERE d.approved = 1 AND u.active = 1`).all();
    const trips = db.prepare("SELECT * FROM trips WHERE status IN ('searching','accepted','arrived','in_progress') ORDER BY id DESC").all().map((t) => engine.tripView(t));
    res.json({ center: config.center, drivers, trips });
  });

  // ───────── Viajes ─────────
  r.get('/trips', (req, res) => {
    const where = [];
    const params = [];
    if (req.query.status) { where.push(`t.status IN (${req.query.status.split(',').map(() => '?').join(',')})`); params.push(...req.query.status.split(',')); }
    if (req.query.source) { where.push('t.source = ?'); params.push(req.query.source); }
    if (req.query.q) { where.push('(t.code LIKE ? OR t.rider_name LIKE ? OR u.name LIKE ? OR t.origin_address LIKE ? OR t.dest_address LIKE ?)'); const q = `%${req.query.q}%`; params.push(q, q, q, q, q); }
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;
    const sql = `FROM trips t LEFT JOIN users u ON u.id = t.driver_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const total = db.prepare(`SELECT COUNT(*) AS n ${sql}`).get(...params).n;
    const rows = db.prepare(`SELECT t.*, u.name AS driver_name ${sql} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    if (req.query.format === 'csv') {
      const cols = ['code', 'requested_at', 'status', 'source', 'category', 'rider_name', 'driver_name', 'origin_address', 'dest_address', 'distance_km', 'fare', 'tip', 'commission', 'payment_method', 'rating_for_driver'];
      const lines = rows.map((t) => [t.code, t.requested_at, t.status, t.source, t.category, t.rider_name, t.driver_name, t.origin_address, t.dest_address,
        (t.distance_m / 1000).toFixed(1), (t.fare_final_cents ?? t.fare_estimate_cents) / 100, t.tip_cents / 100, (t.commission_cents ?? 0) / 100, t.payment_method, t.rating_for_driver ?? '']
        .map((v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';'));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="viajes.csv"');
      return res.send('﻿' + [cols.join(';'), ...lines].join('\r\n'));
    }
    res.json({ total, items: rows.map((t) => ({ ...engine.tripView(t), driver_name: t.driver_name, rider_name: t.rider_name })) });
  });

  r.get('/trips/:id', (req, res) => {
    const t = engine.getTrip(Number(req.params.id));
    if (!t) throw notFound();
    res.json({
      ...engine.tripView(t),
      events: db.prepare('SELECT type, note, at FROM trip_events WHERE trip_id = ? ORDER BY id').all(t.id),
      offers: db.prepare('SELECT o.*, u.name AS driver_name FROM trip_offers o JOIN users u ON u.id = o.driver_id WHERE o.trip_id = ? ORDER BY o.id').all(t.id),
      messages: db.prepare('SELECT sender, text, at FROM messages WHERE trip_id = ? ORDER BY id').all(t.id),
      commission_cents: t.commission_cents,
    });
  });

  r.post('/trips/:id/cancel', (req, res) => res.json(engine.tripView(engine.cancel(Number(req.params.id), 'admin', req.body?.reason))));

  // ───────── Central telefónica ─────────
  r.post('/dispatch', async (req, res) => {
    const b = req.body ?? {};
    if (!b.rider_name) throw bad('Falta el nombre del pasajero');
    const trip = await engine.createTrip({
      riderName: b.rider_name, riderPhone: b.rider_phone, origin: b.origin, dest: b.dest, category: b.category,
      paymentMethod: b.payment_method ?? 'cash', source: 'central', notes: b.notes, driverId: b.driver_id || undefined,
    });
    res.status(201).json(engine.tripView(trip));
  });
  r.post('/quote', async (req, res) => res.json(await engine.quote(req.body ?? {})));

  // ───────── Conductores ─────────
  r.get('/drivers', (_req, res) => {
    const week = startOfDay(6);
    res.json(db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.rating, u.ratings_count, u.active, u.created_at,
        d.status, d.approved, d.is_bot, d.simulate, d.license_number, d.license_expires, d.docs_status, d.last_seen,
        v.id AS vehicle_id, v.brand, v.model, v.color, v.plate, v.year, v.category, v.unit_number,
        (SELECT COUNT(*) FROM trips WHERE driver_id = u.id AND status = 'completed' AND requested_at >= ?) AS trips_week,
        (SELECT COALESCE(SUM(fare_final_cents), 0) FROM trips WHERE driver_id = u.id AND status = 'completed' AND requested_at >= ?) AS revenue_week_cents
      FROM users u JOIN drivers d ON d.user_id = u.id LEFT JOIN vehicles v ON v.id = d.vehicle_id ORDER BY d.is_bot, u.name`).all(week, week));
  });

  r.post('/drivers', adminOnly, (req, res) => {
    const b = req.body ?? {};
    for (const k of ['name', 'email', 'plate', 'brand', 'model', 'category']) if (!b[k]) throw bad(`Falta ${k}`);
    db.exec('BEGIN');
    try {
      const v = Number(db.prepare('INSERT INTO vehicles (brand, model, color, plate, year, category, unit_number) VALUES (?,?,?,?,?,?,?)')
        .run(b.brand, b.model, b.color ?? null, String(b.plate).toUpperCase(), b.year ?? null, b.category, b.unit_number ?? null).lastInsertRowid);
      const id = Number(db.prepare("INSERT INTO users (role, name, email, phone, password_hash) VALUES ('driver', ?, ?, ?, ?)")
        .run(b.name, String(b.email).toLowerCase(), b.phone ?? null, hashPassword(b.password || config.demoPassword)).lastInsertRowid);
      const p = randomPointNear(config.center, 1500);
      db.prepare("INSERT INTO drivers (user_id, vehicle_id, status, lat, lng, approved, is_bot, simulate, license_number, license_expires, docs_status) VALUES (?, ?, 'offline', ?, ?, ?, 0, 1, ?, ?, ?)")
        .run(id, v, p.lat, p.lng, b.approved === false ? 0 : 1, b.license_number ?? null, b.license_expires ?? null, b.approved === false ? 'pending' : 'ok');
      db.exec('COMMIT');
      res.status(201).json({ id });
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  r.patch('/drivers/:id', (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    if (!db.prepare('SELECT 1 FROM drivers WHERE user_id = ?').get(id)) throw notFound();
    if (b.approved !== undefined) db.prepare('UPDATE drivers SET approved = ?, docs_status = ? WHERE user_id = ?').run(b.approved ? 1 : 0, b.approved ? 'ok' : 'pending', id);
    if (b.active !== undefined) {
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id);
      if (!b.active) db.prepare("UPDATE drivers SET status = 'offline' WHERE user_id = ? AND status = 'available'").run(id);
    }
    if (b.status && ['offline', 'available'].includes(b.status)) db.prepare("UPDATE drivers SET status = ? WHERE user_id = ? AND status != 'busy'").run(b.status, id);
    res.json({ ok: true });
  });

  // ───────── Pasajeros ─────────
  r.get('/riders', (_req, res) => {
    res.json(db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.rating, u.active, u.created_at,
        COUNT(t.id) AS trips, COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.fare_final_cents END), 0) AS spent_cents, MAX(t.requested_at) AS last_trip
      FROM users u LEFT JOIN trips t ON t.rider_id = u.id WHERE u.role = 'rider' GROUP BY u.id ORDER BY trips DESC`).all());
  });
  r.patch('/riders/:id', adminOnly, (req, res) => {
    db.prepare("UPDATE users SET active = ? WHERE id = ? AND role = 'rider'").run(req.body?.active ? 1 : 0, Number(req.params.id));
    res.json({ ok: true });
  });

  // ───────── Liquidaciones ─────────
  r.get('/settlements', (req, res) => {
    const from = req.query.from ?? startOfDay(6);
    res.json(db.prepare(`
      SELECT u.id, u.name, v.unit_number, COUNT(t.id) AS trips,
        COALESCE(SUM(t.fare_final_cents), 0) AS gross_cents, COALESCE(SUM(t.commission_cents), 0) AS commission_cents,
        COALESCE(SUM(t.tip_cents), 0) AS tips_cents,
        COALESCE(SUM(CASE WHEN t.payment_method = 'cash' THEN t.fare_final_cents END), 0) AS cash_cents,
        COALESCE(SUM(CASE WHEN t.payment_method != 'cash' THEN t.fare_final_cents END), 0) AS digital_cents
      FROM users u JOIN drivers d ON d.user_id = u.id LEFT JOIN vehicles v ON v.id = d.vehicle_id
      LEFT JOIN trips t ON t.driver_id = u.id AND t.status = 'completed' AND t.completed_at >= ?
      GROUP BY u.id HAVING trips > 0 ORDER BY gross_cents DESC`).all(from));
  });

  // ───────── Tarifas, promociones y configuración ─────────
  r.get('/tariffs', (_req, res) => res.json(db.prepare('SELECT * FROM tariffs ORDER BY sort').all()));
  r.put('/tariffs/:category', adminOnly, (req, res) => {
    const b = req.body ?? {};
    const fields = ['name', 'description', 'seats', 'base_cents', 'per_km_cents', 'per_min_cents', 'minimum_cents', 'active'].filter((k) => b[k] !== undefined);
    if (!fields.length) throw bad('Nada para actualizar');
    db.prepare(`UPDATE tariffs SET ${fields.map((k) => `${k} = ?`).join(', ')} WHERE category = ?`).run(...fields.map((k) => b[k]), req.params.category);
    res.json(db.prepare('SELECT * FROM tariffs WHERE category = ?').get(req.params.category));
  });

  r.get('/promos', (_req, res) => res.json(db.prepare('SELECT * FROM promos ORDER BY code').all()));
  r.post('/promos', adminOnly, (req, res) => {
    const b = req.body ?? {};
    if (!b.code || !b.pct) throw bad('Código y porcentaje son obligatorios');
    db.prepare('INSERT INTO promos (code, description, pct, max_cents) VALUES (?, ?, ?, ?)').run(String(b.code).toUpperCase().trim(), b.description ?? null, Number(b.pct), b.max_cents ?? null);
    res.status(201).json({ ok: true });
  });
  r.patch('/promos/:code', adminOnly, (req, res) => {
    db.prepare('UPDATE promos SET active = ? WHERE code = ?').run(req.body?.active ? 1 : 0, req.params.code);
    res.json({ ok: true });
  });

  r.get('/settings', (_req, res) => res.json(Object.fromEntries(SETTINGS.map((k) => [k, getSetting(db, k, null)]))));
  r.put('/settings', adminOnly, (req, res) => {
    for (const k of SETTINGS) if (req.body?.[k] !== undefined) setSetting(db, k, Number(req.body[k]));
    res.json(Object.fromEntries(SETTINGS.map((k) => [k, getSetting(db, k, null)])));
  });

  return r;
}
