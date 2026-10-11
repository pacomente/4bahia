import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.ROUTING = 'off'; // sin red: recorrido simulado
const { createServer } = await import('../server/index.js');
const { setSetting } = await import('../server/db.js');

const { app, db, engine } = createServer({ dbPath: ':memory:', loop: false });
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api`;
after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}
const login = async (role) => (await call('POST', '/public/auth/demo', { body: { role } })).data.token;
const OBELISCO = { lat: -34.6037, lng: -58.3816, address: 'Obelisco' };
const PALERMO = { lat: -34.5885, lng: -58.4302, address: 'Plaza Serrano' };
const tickUntil = async (cond, max = 400) => { for (let i = 0; i < max; i++) { await engine.tick(); if (await cond()) return true; await new Promise((r) => setTimeout(r, 5)); } return false; };

test('cotización con las tres categorías y código promocional', async () => {
  const rider = await login('rider');
  const q = await call('POST', '/rider/quote', { token: rider, body: { origin: OBELISCO, dest: PALERMO, promoCode: 'BIENVENIDA' } });
  assert.equal(q.status, 200);
  assert.deepEqual(q.data.options.map((o) => o.category), ['taxi', 'ejecutivo', 'xl']);
  assert.ok(q.data.options[0].lines.some((l) => l.code === 'promo'));
  assert.ok(q.data.options[1].total_cents > q.data.options[0].total_cents);
  assert.equal(q.data.promo.code, 'BIENVENIDA');
});

test('viaje completo con el conductor de la app (prioridad sobre los robots)', async () => {
  const rider = await login('rider');
  const driver = await login('driver');
  assert.equal((await call('POST', '/driver/status', { token: driver, body: { online: true } })).data.status, 'available');

  const created = await call('POST', '/rider/trips', { token: rider, body: { origin: OBELISCO, dest: PALERMO, category: 'taxi', payment_method: 'card' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.status, 'searching');
  const tripId = created.data.id;

  // No se puede pedir otro viaje con uno activo.
  assert.equal((await call('POST', '/rider/trips', { token: rider, body: { origin: OBELISCO, dest: PALERMO } })).status, 409);

  let st = await call('GET', '/driver/state', { token: driver });
  assert.ok(st.data.offer, 'el conductor real recibe la oferta');
  assert.equal(st.data.offer.trip.id, tripId);

  await call('POST', `/driver/offers/${st.data.offer.id}/accept`, { token: driver });
  let r = await call('GET', '/rider/state', { token: rider });
  assert.equal(r.data.trip.status, 'accepted');
  assert.equal(r.data.trip.driver.name, 'Pablo Conductor');
  assert.equal(r.data.trip.driver.vehicle.plate, 'AB 000 CD');
  assert.ok(r.data.trip.eta_min >= 1);
  assert.ok(r.data.trip.pickup_route.length > 1);

  // Chat
  await call('POST', `/rider/trips/${tripId}/messages`, { token: rider, body: { text: 'Estoy en la esquina' } });
  st = await call('GET', '/driver/state', { token: driver });
  assert.equal(st.data.messages[0].text, 'Estoy en la esquina');

  // Simulación: el auto se mueve hacia el pasajero.
  setSetting(db, 'sim_speed', 300);
  const before = st.data.driver;
  await engine.tick();
  const moved = (await call('GET', '/driver/state', { token: driver })).data.driver;
  assert.ok(moved.lat !== before.lat || moved.lng !== before.lng, 'el auto avanza');

  assert.equal((await call('POST', `/driver/trips/${tripId}/start`, { token: driver })).status, 409, 'no puede iniciar sin llegar');
  await call('POST', `/driver/trips/${tripId}/arrived`, { token: driver });
  r = await call('GET', '/rider/state', { token: rider });
  assert.equal(r.data.trip.status, 'arrived');
  await call('POST', `/driver/trips/${tripId}/start`, { token: driver });
  assert.equal((await call('POST', `/rider/trips/${tripId}/cancel`, { token: rider })).status, 409, 'no se cancela un viaje en curso');
  const done = await call('POST', `/driver/trips/${tripId}/complete`, { token: driver });
  assert.equal(done.data.status, 'completed');
  st = await call('GET', '/driver/state', { token: driver });
  assert.equal(st.data.driver.status, 'available');
  assert.equal(st.data.today.trips, 1);
  assert.ok(st.data.today.earnings_cents > 0);
  await call('POST', `/driver/trips/${tripId}/rate`, { token: driver, body: { stars: 5 } });
  await call('POST', `/rider/trips/${tripId}/rate`, { token: rider, body: { stars: 4 } });
  await call('POST', '/driver/status', { token: driver, body: { online: false } });
});

test('viaje atendido por un robot de punta a punta', async () => {
  const rider = await login('rider');
  // Asegura que no haya viaje activo del test anterior.
  const s = await call('GET', '/rider/state', { token: rider });
  if (s.data.trip && ['searching', 'accepted', 'arrived'].includes(s.data.trip.status)) await call('POST', `/rider/trips/${s.data.trip.id}/cancel`, { token: rider });
  const driver = await login('driver');
  await call('POST', '/driver/status', { token: driver, body: { online: false } });
  setSetting(db, 'sim_speed', 20000); // el robot puede arrancar lejos: se acelera la simulación
  setSetting(db, 'bot_accept_delay_s', 0);

  const created = await call('POST', '/rider/trips', { token: rider, body: { origin: PALERMO, dest: OBELISCO, category: 'ejecutivo', promo_code: 'NOCHE10' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.id;
  const ok = await tickUntil(() => engine.getTrip(id).status === 'arrived');
  assert.ok(ok, `el robot llega (estado ${engine.getTrip(id).status})`);
  // El robot espera unos segundos antes de iniciar: se adelanta el reloj.
  for (const m of engine.motions.values()) if (m.purpose === 'wait') m.waitUntil = 0;
  assert.ok(await tickUntil(() => engine.getTrip(id).status === 'completed'), 'el robot completa el viaje');

  const t = engine.getTrip(id);
  assert.ok(t.fare_final_cents > 0 && t.commission_cents > 0);
  assert.equal(t.promo_code, 'NOCHE10');
  const r = await call('GET', '/rider/state', { token: rider });
  assert.equal(r.data.trip.status, 'completed', 'queda pendiente de calificar');
  const rated = await call('POST', `/rider/trips/${id}/rate`, { token: rider, body: { stars: 5, tip_cents: 100000, comment: 'Excelente' } });
  assert.equal(rated.data.tip_cents, 100000);
  assert.equal((await call('GET', '/rider/state', { token: rider })).data.trip, null);
  setSetting(db, 'sim_speed', 3);

  // Seguimiento compartido sin datos personales.
  const pub = await call('GET', `/public/track/${t.share_token}`);
  assert.equal(pub.data.code, t.code);
  assert.equal(pub.data.rider, null);
  assert.equal(pub.data.driver.phone, null);
});

test('si el conductor rechaza, el viaje pasa al siguiente', async () => {
  const rider = await login('rider');
  const s = await call('GET', '/rider/state', { token: rider });
  if (s.data.trip) await call('POST', `/rider/trips/${s.data.trip.id}/${s.data.trip.status === 'completed' ? 'dismiss' : 'cancel'}`, { token: rider });
  const driver = await login('driver');
  await call('POST', '/driver/status', { token: driver, body: { online: true } });
  setSetting(db, 'bot_accept_delay_s', 0);
  const created = await call('POST', '/rider/trips', { token: rider, body: { origin: OBELISCO, dest: PALERMO } });
  const offer = (await call('GET', '/driver/state', { token: driver })).data.offer;
  assert.ok(offer);
  await call('POST', `/driver/offers/${offer.id}/reject`, { token: driver });
  await engine.tick();
  const t = engine.getTrip(created.data.id);
  assert.equal(t.status, 'accepted', 'lo toma un robot');
  assert.notEqual(t.driver_id, (await call('GET', '/me', { token: driver })).data.id);
  await call('POST', `/rider/trips/${t.id}/cancel`, { token: rider, body: { reason: 'Me fui caminando' } });
  assert.equal(engine.getTrip(t.id).status, 'cancelled');
  await call('POST', '/driver/status', { token: driver, body: { online: false } });
});

test('central telefónica con asignación manual y panel de administración', async () => {
  const admin = await login('admin');
  const live = await call('GET', '/admin/live', { token: admin });
  const freeBot = live.data.drivers.find((d) => d.status === 'available' && d.is_bot && d.category === 'taxi');
  const res = await call('POST', '/admin/dispatch', { token: admin, body: {
    rider_name: 'Doña Rosa', rider_phone: '11 4444-5555', origin: OBELISCO, dest: PALERMO, category: 'taxi', driver_id: freeBot.id, notes: 'Toca timbre 3B',
  } });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.status, 'accepted');
  assert.equal(res.data.source, 'central');
  assert.equal(res.data.driver.id, freeBot.id);

  const detail = await call('GET', `/admin/trips/${res.data.id}`, { token: admin });
  assert.ok(detail.data.events.some((e) => e.note.includes('central')));
  const dash = await call('GET', '/admin/dashboard', { token: admin });
  assert.ok(dash.data.daily.length >= 10, 'historial de 14 días');
  assert.ok(dash.data.live.active_trips >= 1);
  const csv = await fetch(`${base}/admin/trips?format=csv`, { headers: { authorization: `Bearer ${admin}` } });
  assert.match(await csv.text(), /code;requested_at;status/);

  // Tarifas y configuración
  const up = await call('PUT', '/admin/tariffs/taxi', { token: admin, body: { base_cents: 200000 } });
  assert.equal(up.data.base_cents, 200000);
  const st = await call('PUT', '/admin/settings', { token: admin, body: { surge_multiplier: 1.5 } });
  assert.equal(st.data.surge_multiplier, 1.5);
  const rider = await login('rider');
  const q = await call('POST', '/rider/quote', { token: rider, body: { origin: OBELISCO, dest: PALERMO } });
  assert.ok(q.data.options[0].lines.some((l) => l.code === 'surge'));
  await call('PUT', '/admin/settings', { token: admin, body: { surge_multiplier: 1 } });

  // Permisos
  assert.equal((await call('GET', '/admin/dashboard', { token: rider })).status, 403);
  assert.equal((await call('POST', '/public/auth/login', { body: { email: 'pasajero@demo.com', password: 'demo1234', role: 'driver' } })).status, 403);
  assert.equal((await call('POST', '/public/auth/login', { body: { email: 'pasajero@demo.com', password: 'mal' } })).status, 401);
});

test('un conductor real sin señal reciente no recibe ofertas (evita esperas)', async () => {
  const rider = await login('rider');
  const s = await call('GET', '/rider/state', { token: rider });
  if (s.data.trip) await call('POST', `/rider/trips/${s.data.trip.id}/${s.data.trip.status === 'completed' ? 'dismiss' : 'cancel'}`, { token: rider });
  const driver = await login('driver');
  await call('POST', '/driver/status', { token: driver, body: { online: true } });
  const me = (await call('GET', '/me', { token: driver })).data.id;
  db.prepare('UPDATE drivers SET last_seen = ? WHERE user_id = ?').run(new Date(Date.now() - 90_000).toISOString(), me);
  const created = await call('POST', '/rider/trips', { token: rider, body: { origin: OBELISCO, dest: PALERMO } });
  const offer = db.prepare("SELECT * FROM trip_offers WHERE trip_id = ? AND status = 'pending'").get(created.data.id);
  assert.notEqual(offer.driver_id, me, 'la oferta va a otro conductor');
  // A los 2 minutos sin señal pasa a desconectado.
  db.prepare('UPDATE drivers SET last_seen = ? WHERE user_id = ?').run(new Date(Date.now() - 180_000).toISOString(), me);
  await engine.tick();
  assert.equal(db.prepare('SELECT status FROM drivers WHERE user_id = ?').get(me).status, 'offline');
  await call('POST', `/rider/trips/${created.data.id}/cancel`, { token: rider });
});

test('después de un reinicio los viajes en curso retoman el movimiento', async () => {
  const rider = await login('rider');
  setSetting(db, 'bot_accept_delay_s', 0);
  const created = await call('POST', '/rider/trips', { token: rider, body: { origin: OBELISCO, dest: PALERMO } });
  await engine.tick();
  const t = engine.getTrip(created.data.id);
  assert.equal(t.status, 'accepted');
  engine.motions.clear();          // simula el reinicio (se pierde la memoria)
  engine.recover();
  assert.equal(engine.motions.get(t.driver_id)?.purpose, 'pickup');
  await call('POST', `/rider/trips/${t.id}/cancel`, { token: rider });
});
