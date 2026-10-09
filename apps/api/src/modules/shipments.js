import { Router } from 'express';
import QRCode from 'qrcode';
import { requireRole, STAFF, assertBranchAccess } from '../lib/auth.js';
import { pagination } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { sendCsv } from '../lib/csv.js';
import { assertCanViewShipment } from '../lib/access.js';
import { createShipment, changeStatus, findShipment, shipmentEvents } from '../lib/shipments.js';
import { STATUS_LABELS, ALL_STATUSES, INCIDENT_STATUSES } from '../lib/statuses.js';
import { config } from '../config.js';

const LIST_SQL = `
  SELECT s.id, s.tracking_code, s.status, s.delivery_type, s.sender_name, s.recipient_name,
    s.packages_count, s.weight_g, s.chargeable_weight_g, s.price_cents, s.cod_amount_cents,
    s.created_at, s.updated_at, s.estimated_delivery_at, s.delivered_at, s.external_ref,
    ol.name AS origin, dl.name AS destination, dl.province AS destination_province,
    ob.code AS origin_branch, db.code AS dest_branch, cb.code AS current_branch, sv.name AS service
  FROM shipments s
  JOIN localities ol ON ol.id = s.origin_locality_id
  JOIN localities dl ON dl.id = s.dest_locality_id
  JOIN branches ob ON ob.id = s.origin_branch_id
  JOIN branches db ON db.id = s.dest_branch_id
  LEFT JOIN branches cb ON cb.id = s.current_branch_id
  JOIN services sv ON sv.id = s.service_id
`;

// Filtros comunes para listado y exportación.
function buildFilters(user, query) {
  const where = [];
  const params = [];
  if (user.role === 'customer' || user.role === 'api') { where.push('s.customer_id = ?'); params.push(user.customer_id); }
  if (query.status) { where.push(`s.status IN (${query.status.split(',').map(() => '?').join(',')})`); params.push(...query.status.split(',')); }
  if (query.incidents === 'true') { where.push(`s.status IN (${INCIDENT_STATUSES.map(() => '?').join(',')})`); params.push(...INCIDENT_STATUSES); }
  if (query.branch_id) {
    where.push('(s.origin_branch_id = ? OR s.dest_branch_id = ? OR s.current_branch_id = ?)');
    params.push(query.branch_id, query.branch_id, query.branch_id);
  }
  if (query.customer_id && STAFF.includes(user.role)) { where.push('s.customer_id = ?'); params.push(query.customer_id); }
  if (query.from) { where.push('s.created_at >= ?'); params.push(query.from); }
  if (query.to) { where.push('s.created_at <= ?'); params.push(query.to); }
  if (query.q) {
    where.push('(s.tracking_code LIKE ? OR s.sender_name LIKE ? OR s.recipient_name LIKE ? OR s.external_ref LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like, like);
  }
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
}

export async function renderLabel(shipment, db) {
  const trackUrl = `${config.publicBaseUrl}/seguimiento/${shipment.tracking_code}`;
  const qr = await QRCode.toString(shipment.tracking_code, { type: 'svg', margin: 0, width: 160 });
  const d = db.prepare(`
    SELECT ol.name AS origin, ol.province AS origin_prov, dl.name AS dest, dl.province AS dest_prov,
      ob.code AS ob, db.code AS dbc, db.name AS dest_branch_name, sv.name AS service
    FROM shipments s JOIN localities ol ON ol.id = s.origin_locality_id JOIN localities dl ON dl.id = s.dest_locality_id
    JOIN branches ob ON ob.id = s.origin_branch_id JOIN branches db ON db.id = s.dest_branch_id JOIN services sv ON sv.id = s.service_id
    WHERE s.id = ?`).get(shipment.id);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // Etiqueta 10×15 cm imprimible. Una etiqueta por bulto.
  const pages = Array.from({ length: shipment.packages_count }, (_, i) => `
  <section class="label">
    <header><strong>EXPRESO 4 BAHÍA</strong><span>${esc(d.service)} · ${shipment.delivery_type === 'home' ? 'A DOMICILIO' : 'RETIRA EN SUCURSAL'}</span></header>
    <div class="route"><span>${esc(d.ob)}</span>→<span class="big">${esc(d.dbc)}</span></div>
    <div class="qr">${qr}<div><div class="code">${esc(shipment.tracking_code)}</div><div>Bulto ${i + 1} de ${shipment.packages_count}</div>
      <div>${(shipment.chargeable_weight_g / 1000).toFixed(2)} kg</div>${shipment.cod_amount_cents ? `<div class="cod">COBRAR $ ${(shipment.cod_amount_cents / 100).toFixed(2)}</div>` : ''}</div></div>
    <div class="box"><small>DESTINATARIO</small><b>${esc(shipment.recipient_name)}</b><div>${esc(shipment.recipient_address ?? d.dest_branch_name)}</div><div>${esc(d.dest)}, ${esc(d.dest_prov)}${shipment.recipient_phone ? ` · ${esc(shipment.recipient_phone)}` : ''}</div></div>
    <div class="box"><small>REMITENTE</small><b>${esc(shipment.sender_name)}</b><div>${esc(d.origin)}, ${esc(d.origin_prov)}</div></div>
    <footer>Seguí tu envío: ${esc(trackUrl)}</footer>
  </section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta ${esc(shipment.tracking_code)}</title>
<style>
  @page { size: 100mm 150mm; margin: 0 } body { margin: 0; font-family: Arial, sans-serif; }
  .label { width: 100mm; height: 150mm; box-sizing: border-box; padding: 5mm; page-break-after: always; display: flex; flex-direction: column; gap: 3mm; border: 1px dashed #ccc; }
  header { display: flex; justify-content: space-between; font-size: 11px; border-bottom: 2px solid #000; padding-bottom: 2mm }
  .route { font-size: 28px; font-weight: bold; display: flex; gap: 4mm; align-items: center } .big { font-size: 44px }
  .qr { display: flex; gap: 4mm; align-items: center; font-size: 12px } .qr svg { width: 38mm; height: 38mm }
  .code { font-size: 18px; font-weight: bold; letter-spacing: 1px } .cod { margin-top: 2mm; font-weight: bold; border: 2px solid #000; padding: 1mm }
  .box { border: 1px solid #000; padding: 2mm; font-size: 12px } .box small { display: block; font-size: 9px; color: #444 }
  footer { margin-top: auto; font-size: 9px }
</style></head><body>${pages}</body></html>`;
}

export default function shipmentRoutes(db) {
  const r = Router();

  r.get('/statuses', (_req, res) => res.json(ALL_STATUSES.map((s) => ({ code: s, label: STATUS_LABELS[s] }))));

  r.get('/', requireRole(...STAFF, 'customer'), (req, res) => {
    const { limit, offset } = pagination(req.query);
    const f = buildFilters(req.user, req.query);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM shipments s${f.sql}`).get(...f.params).n;
    const rows = db.prepare(`${LIST_SQL}${f.sql} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`).all(...f.params, limit, offset);
    res.json({ total, limit, offset, items: rows.map((s) => ({ ...s, status_label: STATUS_LABELS[s.status] })) });
  });

  r.get('/export.csv', requireRole(...STAFF), (req, res) => {
    const f = buildFilters(req.user, req.query);
    const rows = db.prepare(`${LIST_SQL}${f.sql} ORDER BY s.created_at DESC LIMIT 50000`).all(...f.params)
      .map((s) => ({ ...s, status: STATUS_LABELS[s.status], price: s.price_cents / 100, weight_kg: s.weight_g / 1000 }));
    sendCsv(res, 'envios.csv', rows, ['tracking_code', 'created_at', 'status', 'service', 'origin', 'destination', 'destination_province',
      'sender_name', 'recipient_name', 'packages_count', 'weight_kg', 'price', 'external_ref', 'delivered_at']);
  });

  // Alta: staff en mostrador (queda recibido en su sucursal) o cliente registrado (queda generado).
  r.post('/', requireRole(...STAFF, 'customer'), (req, res) => {
    const input = { ...req.body };
    let receivedAtBranchId;
    if (req.user.role === 'customer') {
      input.customer_id = req.user.customer_id;
    } else if (req.body.receive_now !== false) {
      receivedAtBranchId = req.body.branch_id ?? req.user.branch_id;
      if (receivedAtBranchId) assertBranchAccess(req.user, receivedAtBranchId);
    }
    const shipment = createShipment(db, input, { user: req.user, receivedAtBranchId });
    audit(db, req, 'shipment.create', 'shipment', shipment.id, { tracking_code: shipment.tracking_code });
    res.status(201).json({ ...shipment, price_breakdown: JSON.parse(shipment.price_breakdown) });
  });

  r.get('/:idOrCode', (req, res) => {
    const s = findShipment(db, req.params.idOrCode);
    assertCanViewShipment(db, req.user, s);
    const events = shipmentEvents(db, s.id);
    const proof = db.prepare('SELECT receiver_name, receiver_doc, lat, lng, created_at, signature_data IS NOT NULL AS has_signature, photo_data IS NOT NULL AS has_photo FROM delivery_proofs WHERE shipment_id = ? ORDER BY id DESC').get(s.id);
    const trips = db.prepare(`SELECT t.id, t.code, t.type, t.status, v.plate FROM trip_shipments ts JOIN trips t ON t.id = ts.trip_id JOIN vehicles v ON v.id = t.vehicle_id WHERE ts.shipment_id = ? ORDER BY t.id`).all(s.id);
    const staff = STAFF.includes(req.user.role);
    res.json({
      ...s,
      status_label: STATUS_LABELS[s.status],
      price_breakdown: JSON.parse(s.price_breakdown),
      events: events.map((e) => ({ ...e, status_label: STATUS_LABELS[e.status], internal_note: staff ? e.internal_note : undefined })),
      delivery_proof: proof ?? null,
      trips,
    });
  });

  r.get('/:idOrCode/label', async (req, res) => {
    const s = findShipment(db, req.params.idOrCode);
    assertCanViewShipment(db, req.user, s);
    res.type('html').send(await renderLabel(s, db));
  });

  // Cambio de estado manual (staff): incidencias, correcciones, etc.
  r.post('/:idOrCode/status', requireRole(...STAFF), (req, res) => {
    const s = findShipment(db, req.params.idOrCode);
    const branchId = req.body.branch_id ?? req.user.branch_id ?? null;
    if (branchId) assertBranchAccess(req.user, branchId);
    const { shipment } = changeStatus(db, s, { ...req.body, branch_id: branchId }, { user: req.user });
    audit(db, req, 'shipment.status', 'shipment', s.id, { from: s.status, to: shipment.status, reason: req.body.reason });
    res.json({ ...shipment, status_label: STATUS_LABELS[shipment.status] });
  });

  return r;
}
