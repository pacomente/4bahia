import { tx, nowIso } from '../db/index.js';
import { badRequest, conflict, notFound } from './errors.js';
import { required } from './validate.js';
import { quote } from './pricing.js';
import { generateTrackingCode, normalizeTrackingCode } from './tracking.js';
import { canTransition, STATUS, STATUS_LABELS } from './statuses.js';
import { queueStatusEmail, dispatchWebhooks } from './notify.js';

export function findShipment(db, idOrCode) {
  const code = normalizeTrackingCode(idOrCode);
  const row = /^\d+$/.test(code)
    ? db.prepare('SELECT * FROM shipments WHERE id = ?').get(Number(code))
    : db.prepare('SELECT * FROM shipments WHERE tracking_code = ?').get(code);
  if (!row) throw notFound('Envío no encontrado');
  return row;
}

function uniqueTrackingCode(db) {
  for (let i = 0; i < 10; i++) {
    const code = generateTrackingCode();
    if (!db.prepare('SELECT 1 FROM shipments WHERE tracking_code = ?').get(code)) return code;
  }
  throw new Error('No se pudo generar un código de seguimiento único');
}

/**
 * Alta de envío. `opts.receivedAtBranchId` indica que se crea en mostrador y
 * queda directamente "recibido" en esa sucursal.
 */
export function createShipment(db, input, { user, receivedAtBranchId } = {}) {
  required(input, ['sender_name', 'recipient_name', 'origin_locality_id', 'dest_locality_id', 'weight_kg']);
  if (input.delivery_type === 'home' && !input.recipient_address) {
    throw badRequest('La entrega a domicilio requiere recipient_address');
  }

  const q = quote(db, { ...input, measured: !!receivedAtBranchId });
  const originBranchId = receivedAtBranchId ?? q.origin.branch_id;
  const destBranchId = q.destination.branch_id;
  if (!originBranchId || !destBranchId) throw badRequest('Origen o destino sin sucursal asignada');
  const service = db.prepare('SELECT id FROM services WHERE code = ?').get(q.service.code);

  const created = tx(db, () => {
    const trackingCode = uniqueTrackingCode(db);
    const status = receivedAtBranchId ? STATUS.RECEIVED : STATUS.CREATED;
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO shipments (
        tracking_code, customer_id, service_id, delivery_type, status,
        sender_name, sender_phone, sender_email, sender_tax_id, sender_address,
        recipient_name, recipient_phone, recipient_email, recipient_tax_id, recipient_address,
        origin_locality_id, dest_locality_id, origin_branch_id, dest_branch_id, current_branch_id,
        packages_count, weight_g, length_cm, width_cm, height_cm, volumetric_weight_g, chargeable_weight_g,
        declared_value_cents, description, cod_amount_cents, price_cents, price_breakdown, payment_mode,
        estimated_delivery_at, external_ref, created_by
      ) VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?)
    `).run(
      trackingCode, input.customer_id ?? null, service.id, q.delivery_type, status,
      input.sender_name, input.sender_phone ?? null, input.sender_email ?? null, input.sender_tax_id ?? null, input.sender_address ?? null,
      input.recipient_name, input.recipient_phone ?? null, input.recipient_email ?? null, input.recipient_tax_id ?? null, input.recipient_address ?? null,
      q.origin.locality_id, q.destination.locality_id, originBranchId, destBranchId, receivedAtBranchId ?? null,
      q.weights.packages, q.weights.real_g, input.length_cm ?? null, input.width_cm ?? null, input.height_cm ?? null,
      q.weights.volumetric_g, q.weights.chargeable_g,
      q.declared_value_cents, input.description ?? null, q.cod_amount_cents, q.total_cents, JSON.stringify(q),
      input.payment_mode ?? (input.customer_id ? 'account' : 'origin'),
      q.estimated_delivery_at, input.external_ref ?? null, user?.id ?? null,
    );
    const id = Number(lastInsertRowid);

    insertEvent(db, { shipment_id: id, status: STATUS.CREATED, user_id: user?.id, branch_id: null, note: STATUS_LABELS.created });
    if (receivedAtBranchId) {
      insertEvent(db, { shipment_id: id, status: STATUS.RECEIVED, user_id: user?.id, branch_id: receivedAtBranchId, note: STATUS_LABELS.received });
    }

    // Cargo del flete (cuenta corriente si es cliente comercial).
    db.prepare('INSERT INTO ledger_entries (customer_id, shipment_id, branch_id, type, amount_cents, note, user_id) VALUES (?,?,?,?,?,?,?)')
      .run(input.customer_id ?? null, id, originBranchId, 'charge', q.total_cents, `Flete ${trackingCode}`, user?.id ?? null);
    if (q.cod_amount_cents > 0) {
      db.prepare('INSERT INTO cod_collections (shipment_id, amount_cents) VALUES (?, ?)').run(id, q.cod_amount_cents);
    }
    return db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  });

  queueStatusEmail(db, created, created.status);
  return created;
}

function insertEvent(db, e) {
  db.prepare(`
    INSERT INTO shipment_events (shipment_id, status, branch_id, trip_id, user_id, note, internal_note, reason, lat, lng, client_event_id, occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    e.shipment_id, e.status, e.branch_id ?? null, e.trip_id ?? null, e.user_id ?? null, e.note ?? null,
    e.internal_note ?? null, e.reason ?? null, e.lat ?? null, e.lng ?? null, e.client_event_id ?? null,
    e.occurred_at ?? nowIso(),
  );
}

// Estados que exigen motivo.
const REASON_REQUIRED = ['failed_attempt', 'rejected', 'damaged', 'lost', 'delayed', 'returned', 'cancelled'];

/**
 * Cambia el estado de un envío registrando el evento. Idempotente por client_event_id
 * (la app del transportista reenvía eventos pendientes al recuperar conexión).
 */
export function changeStatus(db, shipment, change, { user } = {}) {
  const { status, client_event_id: clientEventId } = change;
  if (clientEventId) {
    const dup = db.prepare('SELECT id FROM shipment_events WHERE client_event_id = ?').get(clientEventId);
    if (dup) return { shipment: db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipment.id), duplicate: true };
  }
  if (!STATUS_LABELS[status]) throw badRequest('Estado inválido', { status });
  if (!canTransition(shipment.status, status)) {
    throw conflict(`Transición no permitida: ${shipment.status} → ${status}`);
  }
  if (REASON_REQUIRED.includes(status) && !change.reason) {
    throw badRequest(`El estado ${status} requiere un motivo (reason)`);
  }

  const updated = tx(db, () => {
    const now = nowIso();
    const branchId = change.branch_id ?? null;
    // En viaje o en reparto el paquete no está en ninguna sucursal.
    const moving = status === STATUS.IN_TRANSIT || status === STATUS.OUT_FOR_DELIVERY;
    const currentBranch = moving ? null : (branchId ?? shipment.current_branch_id);
    db.prepare(`
      UPDATE shipments SET status = ?, current_branch_id = ?,
        delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END, updated_at = ?
      WHERE id = ?
    `).run(status, currentBranch, status, change.occurred_at ?? now, now, shipment.id);

    insertEvent(db, {
      shipment_id: shipment.id, status, branch_id: branchId, trip_id: change.trip_id, user_id: user?.id,
      note: change.note ?? STATUS_LABELS[status], internal_note: change.internal_note, reason: change.reason,
      lat: change.lat, lng: change.lng, client_event_id: clientEventId, occurred_at: change.occurred_at,
    });

    if (status === STATUS.DELIVERED) {
      db.prepare(`UPDATE cod_collections SET status = 'collected', collected_by = ?, collected_at = ? WHERE shipment_id = ? AND status = 'pending'`)
        .run(user?.id ?? null, now, shipment.id);
      if (change.proof) {
        const p = change.proof;
        db.prepare('INSERT INTO delivery_proofs (shipment_id, receiver_name, receiver_doc, signature_data, photo_data, lat, lng, user_id) VALUES (?,?,?,?,?,?,?,?)')
          .run(shipment.id, p.receiver_name ?? shipment.recipient_name, p.receiver_doc ?? null, p.signature_data ?? null, p.photo_data ?? null, change.lat ?? null, change.lng ?? null, user?.id ?? null);
      }
    }
    return db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipment.id);
  });

  queueStatusEmail(db, updated, status);
  dispatchWebhooks(db, updated, 'shipment.status_changed', {
    tracking_code: updated.tracking_code, status, status_label: STATUS_LABELS[status],
    previous_status: shipment.status, external_ref: updated.external_ref, occurred_at: change.occurred_at ?? nowIso(),
  });
  return { shipment: updated, duplicate: false };
}

export function shipmentEvents(db, shipmentId) {
  return db.prepare(`
    SELECT e.*, b.name AS branch_name, b.city AS branch_city, u.name AS user_name
    FROM shipment_events e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.shipment_id = ? ORDER BY e.occurred_at, e.id
  `).all(shipmentId);
}
