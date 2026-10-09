import { Router } from 'express';
import { badRequest } from '../lib/errors.js';
import { required, oneOf } from '../lib/validate.js';
import { quote } from '../lib/pricing.js';
import { findShipment, shipmentEvents } from '../lib/shipments.js';
import { STATUS_LABELS } from '../lib/statuses.js';
import { maskName, isValidTrackingCode, normalizeTrackingCode } from '../lib/tracking.js';

// Endpoints sin autenticación: seguimiento público, cotizador y contacto.
export default function publicRoutes(db) {
  const r = Router();

  r.get('/tracking/:code', (req, res) => {
    const code = normalizeTrackingCode(req.params.code);
    if (!isValidTrackingCode(code)) throw badRequest('Código de seguimiento inválido');
    const s = findShipment(db, code);
    const loc = db.prepare('SELECT name, province FROM localities WHERE id = ?');
    const origin = loc.get(s.origin_locality_id);
    const dest = loc.get(s.dest_locality_id);
    // Solo datos no sensibles: sin direcciones, teléfonos, documentos ni datos del transportista.
    res.json({
      tracking_code: s.tracking_code,
      status: s.status,
      status_label: STATUS_LABELS[s.status],
      last_update: s.updated_at,
      origin: `${origin.name}, ${origin.province}`,
      destination: `${dest.name}, ${dest.province}`,
      delivery_type: s.delivery_type,
      packages_count: s.packages_count,
      recipient: maskName(s.recipient_name),
      created_at: s.created_at,
      estimated_delivery_at: s.estimated_delivery_at,
      delivered_at: s.delivered_at,
      timeline: shipmentEvents(db, s.id).map((e) => ({
        status: e.status,
        label: STATUS_LABELS[e.status],
        note: e.note,
        place: e.branch_city ?? null,
        at: e.occurred_at,
      })),
    });
  });

  r.post('/quotes', (req, res) => res.json(quote(db, req.body)));

  r.post('/contact', (req, res) => {
    required(req.body, ['type', 'name', 'email', 'message']);
    oneOf(req.body.type, 'type', ['contact', 'claim', 'quote']);
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO contact_requests (type, name, email, phone, tracking_code, message) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(req.body.type, req.body.name, req.body.email, req.body.phone ?? null, req.body.tracking_code ?? null, req.body.message);
    res.status(201).json({ id: Number(lastInsertRowid), message: 'Recibimos tu mensaje. Te contactaremos a la brevedad.' });
  });

  return r;
}
