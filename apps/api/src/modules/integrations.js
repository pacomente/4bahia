import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireRole, generateApiKey, hashApiKey } from '../lib/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { required } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { quote } from '../lib/pricing.js';
import { createShipment, findShipment, shipmentEvents } from '../lib/shipments.js';
import { STATUS_LABELS } from '../lib/statuses.js';
import { renderLabel } from './shipments.js';

// Gestión de API keys y webhooks (superadmin para cualquier cliente; cliente para sí mismo).
export function integrationAdminRoutes(db) {
  const r = Router();
  r.use(requireRole('superadmin', 'customer'));

  const customerId = (req) => {
    const id = req.user.role === 'superadmin' ? Number(req.body.customer_id ?? req.query.customer_id) : req.user.customer_id;
    if (!id) throw badRequest('customer_id requerido');
    return id;
  };

  r.get('/api-keys', (req, res) => res.json(db.prepare(
    'SELECT id, customer_id, name, prefix, active, last_used_at, created_at FROM api_keys WHERE customer_id = ?',
  ).all(customerId(req))));

  r.post('/api-keys', (req, res) => {
    const cid = customerId(req);
    const key = generateApiKey();
    const { lastInsertRowid } = db.prepare('INSERT INTO api_keys (customer_id, name, prefix, key_hash) VALUES (?, ?, ?, ?)')
      .run(cid, req.body.name ?? 'API key', key.slice(0, 12), hashApiKey(key));
    audit(db, req, 'api_key.create', 'api_key', Number(lastInsertRowid), { customer_id: cid });
    // La clave completa se muestra una sola vez.
    res.status(201).json({ id: Number(lastInsertRowid), key, warning: 'Guardá esta clave: no se vuelve a mostrar' });
  });

  r.delete('/api-keys/:id', (req, res) => {
    const k = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!k) throw notFound();
    if (req.user.role !== 'superadmin' && k.customer_id !== req.user.customer_id) throw forbidden();
    db.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(k.id);
    audit(db, req, 'api_key.revoke', 'api_key', k.id);
    res.status(204).end();
  });

  r.get('/webhooks', (req, res) => res.json(db.prepare('SELECT id, customer_id, url, events, active, created_at FROM webhooks WHERE customer_id = ?').all(customerId(req))));

  r.post('/webhooks', (req, res) => {
    required(req.body, ['url']);
    if (!/^https?:\/\//.test(req.body.url)) throw badRequest('url debe ser http(s)');
    const secret = randomBytes(24).toString('hex');
    const { lastInsertRowid } = db.prepare('INSERT INTO webhooks (customer_id, url, secret, events) VALUES (?, ?, ?, ?)')
      .run(customerId(req), req.body.url, secret, req.body.events ?? 'shipment.status_changed');
    res.status(201).json({ id: Number(lastInsertRowid), url: req.body.url, secret, note: 'Verificá X-4Bahia-Signature = HMAC-SHA256(secret, body)' });
  });

  r.get('/webhooks/:id/deliveries', (req, res) => {
    const h = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
    if (!h) throw notFound();
    if (req.user.role !== 'superadmin' && h.customer_id !== req.user.customer_id) throw forbidden();
    res.json(db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 100').all(h.id));
  });

  return r;
}

// API pública versionada para tiendas y sistemas externos (auth por X-Api-Key).
export function externalApiRoutes(db) {
  const r = Router();
  r.use(requireRole('api', 'customer'));

  r.post('/quotes', (req, res) => res.json(quote(db, { ...req.body, customer_id: req.user.customer_id })));

  r.post('/shipments', (req, res) => {
    // Idempotencia por external_ref: reintentos de la tienda no duplican envíos.
    if (req.body.external_ref) {
      const existing = db.prepare('SELECT * FROM shipments WHERE customer_id = ? AND external_ref = ?').get(req.user.customer_id, req.body.external_ref);
      if (existing) return res.status(200).json(present(existing));
    }
    const s = createShipment(db, { ...req.body, customer_id: req.user.customer_id }, { user: null });
    audit(db, req, 'api.shipment.create', 'shipment', s.id, { external_ref: s.external_ref });
    res.status(201).json(present(s));
  });

  const own = (req) => {
    const s = findShipment(db, req.params.code);
    if (s.customer_id !== req.user.customer_id) throw notFound('Envío no encontrado');
    return s;
  };

  r.get('/shipments/:code', (req, res) => {
    const s = own(req);
    res.json({ ...present(s), events: shipmentEvents(db, s.id).map((e) => ({ status: e.status, label: STATUS_LABELS[e.status], at: e.occurred_at, place: e.branch_city })) });
  });

  r.get('/shipments/:code/label', async (req, res) => res.type('html').send(await renderLabel(own(req), db)));

  function present(s) {
    return {
      tracking_code: s.tracking_code, status: s.status, status_label: STATUS_LABELS[s.status], external_ref: s.external_ref,
      price: s.price_cents / 100, currency: 'ARS', estimated_delivery_at: s.estimated_delivery_at,
      label_url: `/api/v1/shipments/${s.tracking_code}/label`, created_at: s.created_at,
    };
  }

  return r;
}
