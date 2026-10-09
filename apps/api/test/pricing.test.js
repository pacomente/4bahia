import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WEBHOOKS_ENABLED = 'false';
const { openDb } = await import('../src/db/index.js');
const { seed } = await import('../src/db/seed.js');
const { quote } = await import('../src/lib/pricing.js');
const { generateTrackingCode, isValidTrackingCode, maskName } = await import('../src/lib/tracking.js');
const { canTransition } = await import('../src/lib/statuses.js');

const db = openDb(':memory:');
seed(db);
const loc = (name) => db.prepare('SELECT id FROM localities WHERE name = ?').get(name).id;

test('usa el peso volumétrico cuando supera al real', () => {
  const q = quote(db, { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Tres Arroyos'), weight_kg: 2, length_cm: 50, width_cm: 50, height_cm: 40 });
  assert.equal(q.weights.volumetric_g, 20000); // 50×50×40 / 5000 = 20 kg
  assert.equal(q.weights.chargeable_g, 20000);
});

test('suma seguro, domicilio, contrarreembolso e IVA', () => {
  const q = quote(db, { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Bahía Blanca'), weight_kg: 1, delivery_type: 'home', declared_value: 200000, cod_amount: 10000 });
  assert.deepEqual(q.lines.map((l) => l.code), ['base', 'home_delivery', 'insurance', 'cod_fee']);
  assert.equal(q.tax_cents, Math.round(q.subtotal_cents * 0.21));
  assert.equal(q.total_cents, q.subtotal_cents + q.tax_cents);
});

test('aplica descuento de cliente comercial y peso excedente', () => {
  const shop = db.prepare("SELECT id FROM customers WHERE type = 'commercial'").get().id;
  const plain = quote(db, { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Viedma'), weight_kg: 45 });
  const disc = quote(db, { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Viedma'), weight_kg: 45, customer_id: shop });
  assert.ok(disc.total_cents < plain.total_cents);
  assert.ok(disc.lines.some((l) => l.code === 'discount'));
});

test('rechaza domicilio en localidad sin reparto', () => {
  assert.throws(() => quote(db, { origin_locality_id: loc('Bahía Blanca'), dest_locality_id: loc('Pigüé'), weight_kg: 1, delivery_type: 'home' }), /domicilio/);
});

test('códigos de seguimiento con dígito verificador', () => {
  for (let i = 0; i < 50; i++) assert.ok(isValidTrackingCode(generateTrackingCode()));
  assert.equal(isValidTrackingCode('4B0000000001'), false);
  assert.equal(maskName('Carlos Gómez'), 'C***** G****');
});

test('transiciones de estado', () => {
  assert.ok(canTransition('created', 'received'));
  assert.ok(!canTransition('created', 'delivered'));
  assert.ok(canTransition('in_transit', 'delayed'));
  assert.ok(!canTransition('delivered', 'delayed'));
});
