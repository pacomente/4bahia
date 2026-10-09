import { Router } from 'express';
import { requireRole, STAFF } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { required, pick } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { loadSettings, DEFAULT_SETTINGS } from '../lib/pricing.js';

// CRUD genérico y simple para tablas de catálogo.
function crud(db, r, path, table, fields, requiredFields) {
  r.get(`/${path}`, (_req, res) => res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  r.post(`/${path}`, requireRole('superadmin'), (req, res) => {
    required(req.body, requiredFields);
    const data = pick(req.body, fields);
    const keys = Object.keys(data);
    const { lastInsertRowid } = db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ).run(...keys.map((k) => data[k]));
    audit(db, req, `${table}.create`, table, Number(lastInsertRowid), data);
    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(lastInsertRowid));
  });
  r.patch(`/${path}/:id`, requireRole('superadmin'), (req, res) => {
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(req.params.id)) throw notFound();
    const data = pick(req.body, fields);
    const keys = Object.keys(data);
    if (keys.length) {
      db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => data[k]), req.params.id);
    }
    audit(db, req, `${table}.update`, table, Number(req.params.id), data);
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id));
  });
}

// Rutas públicas de catálogo (necesarias para el cotizador web).
export function publicCatalogRoutes(db) {
  const r = Router();
  r.get('/localities', (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    res.json(db.prepare(`
      SELECT l.id, l.name, l.province, l.postal_code, l.home_delivery, b.name AS branch_name
      FROM localities l LEFT JOIN branches b ON b.id = l.branch_id
      WHERE l.name LIKE ? ORDER BY l.province, l.name LIMIT 100
    `).all(q));
  });
  r.get('/services', (_req, res) => res.json(db.prepare('SELECT code, name, transit_days FROM services WHERE active = 1').all()));
  r.get('/branches', (_req, res) => res.json(db.prepare(
    'SELECT id, code, name, address, city, province, phone, lat, lng FROM branches WHERE active = 1 ORDER BY name',
  ).all()));
  return r;
}

export default function catalogRoutes(db) {
  const r = Router();
  r.use(requireRole(...STAFF));

  crud(db, r, 'branches', 'branches', ['code', 'name', 'address', 'city', 'province', 'phone', 'lat', 'lng', 'active'], ['code', 'name', 'city', 'province']);
  crud(db, r, 'zones', 'zones', ['code', 'name'], ['code', 'name']);
  crud(db, r, 'localities', 'localities', ['name', 'province', 'postal_code', 'zone_id', 'branch_id', 'home_delivery'], ['name', 'province', 'zone_id']);
  crud(db, r, 'services', 'services', ['code', 'name', 'transit_days', 'price_multiplier', 'active'], ['code', 'name']);
  crud(db, r, 'tariffs', 'tariffs', ['origin_zone_id', 'dest_zone_id', 'max_weight_g', 'price_cents', 'extra_kg_cents'], ['origin_zone_id', 'dest_zone_id', 'max_weight_g', 'price_cents']);
  crud(db, r, 'customers', 'customers', ['type', 'name', 'tax_id', 'email', 'phone', 'address', 'discount_pct', 'credit_limit_cents', 'active'], ['name']);

  r.get('/pricing-settings', (_req, res) => res.json(loadSettings(db)));
  r.put('/pricing-settings', requireRole('superadmin'), (req, res) => {
    const data = pick(req.body, Object.keys(DEFAULT_SETTINGS));
    const stmt = db.prepare('INSERT INTO pricing_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(data)) stmt.run(k, String(Number(v)));
    audit(db, req, 'pricing_settings.update', 'pricing_settings', null, data);
    res.json(loadSettings(db));
  });

  return r;
}
