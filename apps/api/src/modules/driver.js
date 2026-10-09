import { Router } from 'express';
import { requireRole } from '../lib/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { required } from '../lib/validate.js';
import { changeStatus, findShipment } from '../lib/shipments.js';
import { tripShipments, startTrip, finishTrip } from '../lib/trips.js';
import { recordPositions } from '../lib/gps.js';
import { assertCanViewShipment } from '../lib/access.js';
import { STATUS, STATUS_LABELS } from '../lib/statuses.js';

// Estados que el transportista puede registrar desde la app.
const DRIVER_STATUSES = [STATUS.DELIVERED, STATUS.FAILED_ATTEMPT, STATUS.REJECTED, STATUS.DAMAGED, STATUS.DELAYED];

export const FAILED_REASONS = [
  'Destinatario ausente', 'Domicilio incorrecto', 'Domicilio inaccesible', 'Rechazado por destinatario',
  'Sin dinero para contrarreembolso', 'Fuera de horario', 'Otro',
];

export default function driverRoutes(db) {
  const r = Router();
  r.use(requireRole('driver'));

  const myTrip = (req, id) => {
    const t = db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
    if (!t) throw notFound('Viaje no encontrado');
    if (t.driver_id !== req.user.id) throw forbidden('El viaje no está asignado a vos');
    return t;
  };

  r.get('/failed-reasons', (_req, res) => res.json(FAILED_REASONS));

  r.get('/trips', (req, res) => {
    res.json(db.prepare(`
      SELECT t.*, v.plate, ob.name AS origin_branch_name, db.name AS dest_branch_name, db.address AS dest_branch_address,
        db.lat AS dest_lat, db.lng AS dest_lng,
        (SELECT COUNT(*) FROM trip_shipments ts WHERE ts.trip_id = t.id) AS shipments_count
      FROM trips t JOIN vehicles v ON v.id = t.vehicle_id JOIN branches ob ON ob.id = t.origin_branch_id
      LEFT JOIN branches db ON db.id = t.dest_branch_id
      WHERE t.driver_id = ? AND t.status IN ('planned', 'in_progress') ORDER BY t.planned_at
    `).all(req.user.id));
  });

  r.get('/trips/:id', (req, res) => {
    const t = myTrip(req, req.params.id);
    res.json({
      ...t,
      shipments: tripShipments(db, t.id).map((s) => ({
        ...s,
        status_label: STATUS_LABELS[s.status],
        // Link de navegación (abre Google Maps / Waze en el celular).
        navigation_url: s.recipient_address
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.recipient_address}, ${s.destination}, ${s.destination_province}`)}`
          : null,
      })),
    });
  });

  r.post('/trips/:id/start', (req, res) => res.json({ results: startTrip(db, myTrip(req, req.params.id), req.user) }));
  r.post('/trips/:id/finish', (req, res) => res.json(finishTrip(db, myTrip(req, req.params.id))));

  // Escaneo de etiqueta: devuelve el envío si está en un viaje del transportista.
  r.get('/scan/:code', (req, res) => {
    const s = findShipment(db, req.params.code);
    assertCanViewShipment(db, req.user, s);
    res.json({ id: s.id, tracking_code: s.tracking_code, status: s.status, status_label: STATUS_LABELS[s.status],
      recipient_name: s.recipient_name, recipient_address: s.recipient_address, recipient_phone: s.recipient_phone,
      packages_count: s.packages_count, cod_amount_cents: s.cod_amount_cents });
  });

  // Posiciones GPS (lote). El vehículo se deduce del viaje en curso del transportista.
  r.post('/positions', (req, res) => {
    const trip = db.prepare("SELECT * FROM trips WHERE driver_id = ? AND status = 'in_progress' ORDER BY started_at DESC").get(req.user.id);
    const vehicleId = trip?.vehicle_id ?? req.body.vehicle_id;
    if (!vehicleId) throw badRequest('Sin viaje en curso: indicá vehicle_id');
    res.json(recordPositions(db, { vehicleId, driverId: req.user.id, tripId: trip?.id }, req.body.positions));
  });

  function applyEvent(req, e) {
    required(e, ['code', 'status']);
    if (!DRIVER_STATUSES.includes(e.status)) throw badRequest(`Estado no permitido desde la app: ${e.status}`);
    const s = findShipment(db, e.code);
    assertCanViewShipment(db, req.user, s);
    if (e.status === STATUS.DELIVERED && !e.proof?.receiver_name) throw badRequest('La entrega requiere proof.receiver_name');
    const trip = db.prepare(`
      SELECT t.id FROM trips t JOIN trip_shipments ts ON ts.trip_id = t.id
      WHERE ts.shipment_id = ? AND t.driver_id = ? AND t.status = 'in_progress'`).get(s.id, req.user.id);
    return changeStatus(db, s, { ...e, trip_id: trip?.id }, { user: req.user });
  }

  // Registro de un evento en línea (entrega, visita fallida, incidencia).
  r.post('/events', (req, res) => {
    const { shipment, duplicate } = applyEvent(req, req.body);
    res.json({ tracking_code: shipment.tracking_code, status: shipment.status, duplicate });
  });

  // Sincronización offline: lote de eventos con client_event_id (idempotente) + posiciones.
  r.post('/sync', (req, res) => {
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    const sorted = [...events].sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
    const results = sorted.map((e) => {
      if (!e.client_event_id) return { client_event_id: null, ok: false, error: 'client_event_id requerido' };
      try {
        const { shipment, duplicate } = applyEvent(req, e);
        return { client_event_id: e.client_event_id, ok: true, duplicate, status: shipment.status };
      } catch (err) {
        return { client_event_id: e.client_event_id, ok: false, error: err.message };
      }
    });
    let positions = null;
    if (Array.isArray(req.body.positions) && req.body.positions.length) {
      const trip = db.prepare("SELECT * FROM trips WHERE driver_id = ? AND status = 'in_progress' ORDER BY started_at DESC").get(req.user.id);
      const vehicleId = trip?.vehicle_id ?? req.body.vehicle_id;
      if (vehicleId) positions = recordPositions(db, { vehicleId, driverId: req.user.id, tripId: trip?.id }, req.body.positions);
    }
    res.json({ results, positions, server_time: new Date().toISOString() });
  });

  return r;
}
