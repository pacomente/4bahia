import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

const t = await startTestServer();
after(() => t.close());
const loc = (name) => t.q('SELECT id FROM localities WHERE name = ?', name).id;
const branch = (code) => t.q('SELECT id FROM branches WHERE code = ?', code).id;

test('circuito completo: mostrador → troncal → sucursal destino → reparto → entrega offline', async () => {
  const opBhi = await t.login('bhi.operador@4bahia.test');
  const opTar = await t.login('tar.operador@4bahia.test');
  const driver = await t.login('chofer2@4bahia.test');
  const driverId = t.q("SELECT id FROM users WHERE email = 'chofer2@4bahia.test'").id;
  const truck = t.q("SELECT id FROM vehicles WHERE plate = 'AD789GH'").id;

  // 1. Alta en mostrador Bahía Blanca con contrarreembolso.
  const created = await t.call('POST', '/shipments', { token: opBhi, body: {
    sender_name: 'Juan Pérez', sender_email: 'juan@example.test', recipient_name: 'Marta Díaz', recipient_address: 'Colón 55',
    recipient_email: 'marta@example.test', origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Tres Arroyos'),
    weight_kg: 4, delivery_type: 'home', cod_amount: 25000,
  } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.status, 'received');
  const code = created.data.tracking_code;

  // Etiqueta imprimible con QR.
  const label = await t.call('GET', `/shipments/${code}/label`, { token: opBhi });
  assert.match(label.data, /<svg/);
  assert.match(label.data, new RegExp(code));

  // 2. Clasificación y despacho troncal BHI → TAR.
  const sorted = await t.call('POST', `/branches/${branch('BHI')}/ops/sort`, { token: opBhi, body: { codes: [code] } });
  assert.equal(sorted.data.results[0].status, 'sorted');
  const dispatch = await t.call('POST', `/branches/${branch('BHI')}/ops/dispatch`, { token: opBhi, body: {
    vehicle_id: truck, driver_id: driverId, dest_branch_id: branch('TAR'), expected_minutes: 200, codes: [code],
  } });
  assert.equal(dispatch.status, 201, JSON.stringify(dispatch.data));
  assert.ok(dispatch.data.assigned[0].ok);
  const transferId = dispatch.data.trip.id;

  // 3. El chofer ve el viaje, lo inicia y reporta GPS.
  const trips = await t.call('GET', '/driver/trips', { token: driver });
  assert.ok(trips.data.some((x) => x.id === transferId));
  await t.call('POST', `/driver/trips/${transferId}/start`, { token: driver });
  const gps = await t.call('POST', '/driver/positions', { token: driver, body: { positions: [{ lat: -38.5, lng: -61, speed_kmh: 80 }, { lat: 999, lng: 0 }] } });
  assert.deepEqual(gps.data, { accepted: 1, rejected: 1 });
  assert.equal(t.q('SELECT status FROM shipments WHERE tracking_code = ?', code).status, 'in_transit');

  // 4. Tres Arroyos confirma la recepción escaneando.
  await t.call('POST', `/driver/trips/${transferId}/finish`, { token: driver });
  const recv = await t.call('POST', `/branches/${branch('TAR')}/ops/receive`, { token: opTar, body: { codes: [code, '4B0000000000'] } });
  assert.equal(recv.data.results[0].status, 'at_destination_branch');
  assert.equal(recv.data.results[1].ok, false);

  // 5. Reparto de última milla.
  const delivery = await t.call('POST', '/fleet/trips', { token: opTar, body: {
    type: 'delivery', vehicle_id: truck, driver_id: driverId, origin_branch_id: branch('TAR'), codes: [code],
  } });
  assert.equal(delivery.status, 201, JSON.stringify(delivery.data));
  const deliveryId = delivery.data.trip.id;
  await t.call('POST', `/driver/trips/${deliveryId}/start`, { token: driver });
  const detail = await t.call('GET', `/driver/trips/${deliveryId}`, { token: driver });
  assert.match(detail.data.shipments[0].navigation_url, /google\.com\/maps/);

  // 6. Sincronización offline: la app manda eventos acumulados (se procesan por fecha).
  const sync1 = await t.call('POST', '/driver/sync', { token: driver, body: { events: [
    { client_event_id: 'dev1-0002', code, status: 'out_for_delivery', occurred_at: '2026-01-01T15:00:00Z' },
    { client_event_id: 'dev1-0001', code, status: 'failed_attempt', reason: 'Destinatario ausente', occurred_at: '2026-01-01T10:00:00Z' },
  ] } });
  assert.equal(sync1.data.results[0].ok, true, JSON.stringify(sync1.data)); // visita fallida
  assert.equal(sync1.data.results[1].ok, false); // la app no puede marcar "en reparto"

  // Segunda visita: sale a reparto y se entrega con comprobante; el reenvío es idempotente.
  await t.call('POST', `/shipments/${code}/status`, { token: opTar, body: { status: 'out_for_delivery' } });
  const deliver = { client_event_id: 'dev1-0003', code, status: 'delivered', lat: -38.37, lng: -60.27,
    proof: { receiver_name: 'Marta Díaz', receiver_doc: '20111222', signature_data: 'data:image/png;base64,AAA' } };
  const sync2 = await t.call('POST', '/driver/sync', { token: driver, body: { events: [deliver] } });
  const sync3 = await t.call('POST', '/driver/sync', { token: driver, body: { events: [deliver] } });
  assert.equal(sync2.data.results[0].status, 'delivered', JSON.stringify(sync2.data));
  assert.equal(sync3.data.results[0].duplicate, true);

  // 7. Contrarreembolso cobrado, comprobante y notificaciones registradas.
  const s = t.q('SELECT * FROM shipments WHERE tracking_code = ?', code);
  assert.equal(t.q('SELECT status FROM cod_collections WHERE shipment_id = ?', s.id).status, 'collected');
  assert.equal(t.q('SELECT COUNT(*) AS n FROM delivery_proofs WHERE shipment_id = ?', s.id).n, 1);
  assert.ok(t.q('SELECT COUNT(*) AS n FROM notifications WHERE shipment_id = ?', s.id).n >= 5);

  // 8. Seguimiento público: línea de tiempo sin datos privados.
  const pub = await t.call('GET', `/public/tracking/${code.toLowerCase()}`);
  assert.equal(pub.data.status, 'delivered');
  assert.equal(pub.data.recipient, 'M**** D***');
  const raw = JSON.stringify(pub.data);
  assert.ok(!raw.includes('Colón') && !raw.includes('20111222') && !raw.includes('juan@example'));
  assert.ok(pub.data.timeline.length >= 8);
});

test('permisos por sucursal y por cliente', async () => {
  const opTar = await t.login('tar.operador@4bahia.test');
  const r = await t.call('POST', `/branches/${branch('BHI')}/ops/receive`, { token: opTar, body: { codes: ['x'] } });
  assert.equal(r.status, 403);

  const customer = await t.login('cliente@tiendademo.test');
  const own = await t.call('GET', '/shipments', { token: customer });
  assert.ok(own.data.total > 0);
  const foreign = t.q('SELECT tracking_code FROM shipments WHERE customer_id IS NULL LIMIT 1').tracking_code;
  assert.equal((await t.call('GET', `/shipments/${foreign}`, { token: customer })).status, 403);
  assert.equal((await t.call('GET', '/admin/dashboard', { token: customer })).status, 403);

  const driver = await t.login('chofer1@4bahia.test');
  assert.equal((await t.call('GET', '/users', { token: driver })).status, 403);
});

test('transición inválida devuelve 409 y las incidencias exigen motivo', async () => {
  const admin = await t.login('admin@4bahia.test');
  const code = t.q("SELECT tracking_code FROM shipments WHERE status = 'created' LIMIT 1").tracking_code;
  assert.equal((await t.call('POST', `/shipments/${code}/status`, { token: admin, body: { status: 'delivered' } })).status, 409);
  assert.equal((await t.call('POST', `/shipments/${code}/status`, { token: admin, body: { status: 'damaged' } })).status, 400);
  const ok = await t.call('POST', `/shipments/${code}/status`, { token: admin, body: { status: 'damaged', reason: 'Caja golpeada' } });
  assert.equal(ok.data.status, 'damaged');
});

test('API externa con API key: crear envío idempotente, etiqueta y webhook', async () => {
  const customer = await t.login('cliente@tiendademo.test');
  const key = (await t.call('POST', '/integrations/api-keys', { token: customer, body: { name: 'WooCommerce' } })).data.key;
  assert.match(key, /^4b_live_/);
  const hook = await t.call('POST', '/integrations/webhooks', { token: customer, body: { url: 'https://tienda.test/hook' } });
  assert.equal(hook.status, 201);

  const body = { external_ref: 'WC-1001', sender_name: 'Tienda Demo SRL', recipient_name: 'Cliente Web', recipient_address: 'Mitre 10',
    origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('La Plata'), weight_kg: 1.2, delivery_type: 'home' };
  const a = await t.call('POST', '/v1/shipments', { apiKey: key, body });
  const b = await t.call('POST', '/v1/shipments', { apiKey: key, body });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(b.status, 200);
  assert.equal(a.data.tracking_code, b.data.tracking_code);
  assert.equal(a.data.status, 'created');

  const got = await t.call('GET', `/v1/shipments/${a.data.tracking_code}`, { apiKey: key });
  assert.equal(got.data.events[0].status, 'created');
  const label = await t.call('GET', `/v1/shipments/${a.data.tracking_code}/label`, { apiKey: key });
  assert.match(label.data, /<svg/);
  assert.equal((await t.call('GET', '/v1/shipments/4B0000000000', { apiKey: 'malo' })).status, 401);

  // El cambio de estado genera una entrega de webhook (deshabilitada en tests, pero registrada).
  const admin = await t.login('admin@4bahia.test');
  await t.call('POST', `/branches/${branch('BHI')}/ops/receive`, { token: admin, body: { codes: [a.data.tracking_code] } });
  const deliveries = await t.call('GET', `/integrations/webhooks/${hook.data.id}/deliveries`, { token: customer });
  assert.equal(deliveries.data[0].event, 'shipment.status_changed');
  assert.match(deliveries.data[0].payload, /"status":"received"/);
});

test('dashboard, mapa en vivo, finanzas y auditoría', async () => {
  const admin = await t.login('admin@4bahia.test');
  const dash = await t.call('GET', '/admin/dashboard', { token: admin });
  assert.ok(dash.data.totals.shipments >= 5, JSON.stringify(dash.data));
  const live = await t.call('GET', '/fleet/live', { token: admin });
  const truck = live.data.vehicles.find((v) => v.plate === 'AB123CD');
  assert.equal(truck.connection, 'online');
  assert.ok(truck.eta.remaining_km > 0);

  const opTar = await t.login('tar.operador@4bahia.test');
  const drivers = await t.call('GET', '/fleet/drivers', { token: opTar });
  assert.ok(drivers.data.length >= 2 && drivers.data.every((d) => d.branch_code));

  const shop = t.q("SELECT id FROM customers WHERE type = 'commercial'").id;
  const acct = await t.call('GET', `/finance/accounts/${shop}`, { token: admin });
  assert.ok(acct.data.balance_cents > 0);
  await t.call('POST', '/finance/payments', { token: admin, body: { customer_id: shop, amount: 1000, method: 'transferencia' } });
  const after2 = await t.call('GET', `/finance/accounts/${shop}`, { token: admin });
  assert.equal(after2.data.balance_cents, acct.data.balance_cents - 100000);

  const csv = await fetch(`${t.base}/shipments/export.csv`, { headers: { authorization: `Bearer ${admin}` } });
  assert.match(await csv.text(), /tracking_code;created_at;status/);
  const audit = await t.call('GET', '/admin/audit', { token: admin });
  assert.ok(audit.data.some((a) => a.action === 'payment.create'));
});

test('cotizador y contacto públicos', async () => {
  const q = await t.call('POST', '/public/quotes', { body: { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Viedma'), weight_kg: 3, service_code: 'express' } });
  assert.equal(q.status, 200);
  assert.equal(q.data.service.code, 'express');
  const c = await t.call('POST', '/public/contact', { body: { type: 'claim', name: 'X', email: 'x@x.test', message: 'Llegó roto', tracking_code: '4B1' } });
  assert.equal(c.status, 201);
  const locs = await t.call('GET', '/public/localities?q=Bah');
  assert.ok(locs.data.some((l) => l.name === 'Bahía Blanca'));
});
