import { Router } from 'express';
import { requireRole, STAFF, assertBranchAccess } from '../lib/auth.js';
import { badRequest, conflict } from '../lib/errors.js';
import { required } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { changeStatus, findShipment } from '../lib/shipments.js';
import { createTrip } from '../lib/trips.js';
import { STATUS, STATUS_LABELS, FINAL_STATUSES } from '../lib/statuses.js';

// Procesa una lista de códigos escaneados devolviendo el resultado de cada uno.
function bulk(codes, fn) {
  if (!Array.isArray(codes) || !codes.length) throw badRequest('codes debe ser una lista de códigos');
  return codes.map((code) => {
    try {
      const s = fn(code);
      return { code: s.tracking_code, ok: true, status: s.status, status_label: STATUS_LABELS[s.status] };
    } catch (e) {
      return { code, ok: false, error: e.message };
    }
  });
}

export default function branchOpsRoutes(db) {
  const r = Router({ mergeParams: true });
  r.use(requireRole(...STAFF));
  r.use((req, _res, next) => { assertBranchAccess(req.user, req.params.branchId); next(); });

  const branchId = (req) => Number(req.params.branchId);
  const ctx = (req) => ({ user: req.user });

  // Ingreso/recepción (escaneo masivo): desde mostrador, de un viaje troncal o escala intermedia.
  r.post('/receive', (req, res) => {
    const bid = branchId(req);
    const results = bulk(req.body.codes, (code) => {
      const s = findShipment(db, code);
      let status;
      if (s.status === STATUS.CREATED) status = STATUS.RECEIVED;
      else if (s.status === STATUS.IN_TRANSIT || s.status === STATUS.DELAYED) status = s.dest_branch_id === bid ? STATUS.AT_DEST_BRANCH : STATUS.RECEIVED;
      else if (s.status === STATUS.OUT_FOR_DELIVERY || s.status === STATUS.FAILED_ATTEMPT || s.status === STATUS.REJECTED) status = STATUS.AT_DEST_BRANCH;
      else throw conflict(`No se puede recibir un envío en estado ${STATUS_LABELS[s.status]}`);
      return changeStatus(db, s, { status, branch_id: bid, note: req.body.note }, ctx(req)).shipment;
    });
    audit(db, req, 'branch.receive', 'branch', bid, { results });
    res.json({ results });
  });

  r.post('/sort', (req, res) => {
    const bid = branchId(req);
    res.json({ results: bulk(req.body.codes, (code) => {
      const s = findShipment(db, code);
      if (s.current_branch_id !== bid) throw conflict('El paquete no está en esta sucursal');
      return changeStatus(db, s, { status: STATUS.SORTED, branch_id: bid }, ctx(req)).shipment;
    }) });
  });

  // Despacho / transferencia: arma un viaje troncal hacia otra sucursal.
  r.post('/dispatch', (req, res) => {
    required(req.body, ['vehicle_id', 'driver_id', 'dest_branch_id', 'codes']);
    const result = createTrip(db, {
      type: 'transfer', vehicle_id: req.body.vehicle_id, driver_id: req.body.driver_id, origin_branch_id: branchId(req),
      dest_branch_id: req.body.dest_branch_id, expected_minutes: req.body.expected_minutes, shipment_codes: req.body.codes,
    });
    audit(db, req, 'trip.create', 'trip', result.trip.id, { type: 'transfer', codes: req.body.codes });
    res.status(201).json(result);
  });

  r.post('/ready-for-pickup', (req, res) => {
    const bid = branchId(req);
    res.json({ results: bulk(req.body.codes, (code) => {
      const s = findShipment(db, code);
      if (s.current_branch_id !== bid) throw conflict('El paquete no está en esta sucursal');
      return changeStatus(db, s, { status: STATUS.READY_FOR_PICKUP, branch_id: bid }, ctx(req)).shipment;
    }) });
  });

  // Entrega en mostrador al cliente.
  r.post('/counter-delivery', (req, res) => {
    required(req.body, ['code', 'receiver_name']);
    const bid = branchId(req);
    const s = findShipment(db, req.body.code);
    if (s.current_branch_id !== bid) throw conflict('El paquete no está en esta sucursal');
    const { shipment } = changeStatus(db, s, {
      status: STATUS.DELIVERED, branch_id: bid, note: 'Entregado en sucursal',
      proof: { receiver_name: req.body.receiver_name, receiver_doc: req.body.receiver_doc, signature_data: req.body.signature_data },
    }, ctx(req));
    audit(db, req, 'shipment.counter_delivery', 'shipment', s.id);
    res.json(shipment);
  });

  // Control de pendientes: en sucursal, demorados (sin movimiento) y entrantes.
  r.get('/pending', (req, res) => {
    const bid = branchId(req);
    const staleHours = Number(req.query.stale_hours ?? 48);
    const finals = FINAL_STATUSES.map(() => '?').join(',');
    const atBranch = db.prepare(`
      SELECT s.id, s.tracking_code, s.status, s.delivery_type, s.recipient_name, s.updated_at, s.dest_branch_id, dl.name AS destination,
        (julianday('now') - julianday(s.updated_at)) * 24 AS hours_idle
      FROM shipments s JOIN localities dl ON dl.id = s.dest_locality_id
      WHERE s.current_branch_id = ? AND s.status NOT IN (${finals}) ORDER BY s.updated_at
    `).all(bid, ...FINAL_STATUSES);
    const inbound = db.prepare(`
      SELECT s.tracking_code, s.status, t.code AS trip_code, t.started_at, v.plate
      FROM trips t JOIN trip_shipments ts ON ts.trip_id = t.id JOIN shipments s ON s.id = ts.shipment_id JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.dest_branch_id = ? AND s.status = 'in_transit'
    `).all(bid);
    res.json({
      at_branch: atBranch.map((s) => ({ ...s, status_label: STATUS_LABELS[s.status], hours_idle: Math.round(s.hours_idle) })),
      stale: atBranch.filter((s) => s.hours_idle >= staleHours).map((s) => s.tracking_code),
      inbound,
      to_dispatch: atBranch.filter((s) => s.dest_branch_id !== bid).length,
      to_deliver: atBranch.filter((s) => s.dest_branch_id === bid).length,
    });
  });

  return r;
}
