// Motor de viajes: creación, asignación (dispatch), estados y simulación de movimiento.
import { randomBytes, randomInt } from 'node:crypto';
import { now, getSetting } from './db.js';
import { route, simplify, distanceM, pathLength, pointAlong, randomPointNear } from './geo.js';
import { computeFare, findPromo } from './pricing.js';
import { bad, conflict, notFound, HttpError } from './auth.js';
import { config } from './config.js';

const BASE_SPEED = 8.3;          // m/s (~30 km/h en ciudad)
const MAX_PICKUP_M = 15000;      // radio máximo de búsqueda de conductores
const ACTIVE = ['searching', 'accepted', 'arrived', 'in_progress'];
export const STATUS_LABELS = {
  searching: 'Buscando conductor', accepted: 'Conductor en camino', arrived: 'El conductor llegó',
  in_progress: 'En viaje', completed: 'Finalizado', cancelled: 'Cancelado', no_drivers: 'Sin conductores disponibles',
};

export function createEngine(db) {
  // Movimiento simulado de cada conductor: driverId -> { coords, pos, length, purpose, tripId, waitUntil }
  const motions = new Map();
  const pendingRoutes = new Set();
  const simSpeed = () => Number(getSetting(db, 'sim_speed', 3));
  const event = (tripId, type, note) => db.prepare('INSERT INTO trip_events (trip_id, type, note) VALUES (?, ?, ?)').run(tripId, type, note ?? null);
  const getTrip = (id) => db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
  const getDriver = (id) => db.prepare('SELECT d.*, u.name, u.phone, u.rating, u.active FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?').get(id);

  // ───────── Cotización ─────────
  async function quote({ origin, dest, promoCode }) {
    validatePoint(origin, 'origen');
    validatePoint(dest, 'destino');
    const r = await route(origin, dest);
    const promo = findPromo(db, promoCode);
    const tariffs = db.prepare('SELECT category FROM tariffs WHERE active = 1 ORDER BY sort').all();
    const options = tariffs.map(({ category }) => {
      const fare = computeFare(db, { category, distance_m: r.distance_m, duration_s: r.duration_s, promo });
      const t = db.prepare('SELECT name, description, seats FROM tariffs WHERE category = ?').get(category);
      const nearest = nearestDrivers(origin, category, new Set(), 1)[0];
      return {
        ...fare, description: t.description, seats: t.seats,
        pickup_eta_min: nearest ? Math.max(1, Math.round((nearest.distance * 1.3) / BASE_SPEED / 60)) : null,
        available: !!nearest,
      };
    });
    return {
      distance_m: r.distance_m, duration_s: r.duration_s, route: simplify(r.coords), route_source: r.source,
      promo: promoCode ? (promo ? { code: promo.code, pct: promo.pct, description: promo.description } : { invalid: true }) : null,
      options,
    };
  }

  // ───────── Creación ─────────
  async function createTrip({ riderId = null, riderName, riderPhone, origin, dest, category = 'taxi', paymentMethod = 'cash', promoCode, source = 'app', notes, driverId }) {
    validatePoint(origin, 'origen');
    validatePoint(dest, 'destino');
    if (riderId) {
      const active = db.prepare(`SELECT id FROM trips WHERE rider_id = ? AND status IN (${ACTIVE.map(() => '?').join(',')})`).get(riderId, ...ACTIVE);
      if (active) throw conflict('Ya tenés un viaje en curso');
    }
    if (!['cash', 'card', 'mercadopago'].includes(paymentMethod)) throw bad('Medio de pago inválido');
    const r = await route(origin, dest);
    const promo = findPromo(db, promoCode);
    const fare = computeFare(db, { category, distance_m: r.distance_m, duration_s: r.duration_s, promo });
    if (!fare) throw bad('Categoría inexistente');
    const code = `V${randomInt(100000, 999999)}`;
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO trips (code, source, rider_id, rider_name, rider_phone, category, status, origin_lat, origin_lng, origin_address,
        dest_lat, dest_lng, dest_address, route, distance_m, duration_s, fare_estimate_cents, fare_breakdown, discount_cents, promo_code,
        payment_method, share_token, notes, requested_at)
      VALUES (?,?,?,?,?,?,'searching',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(code, source, riderId, riderName ?? null, riderPhone ?? null, category,
      origin.lat, origin.lng, origin.address ?? 'Punto en el mapa', dest.lat, dest.lng, dest.address ?? 'Punto en el mapa',
      JSON.stringify(simplify(r.coords)), r.distance_m, r.duration_s, fare.total_cents, JSON.stringify(fare), fare.discount_cents,
      promo?.code ?? null, paymentMethod, randomBytes(8).toString('hex'), notes ?? null, now());
    const id = Number(lastInsertRowid);
    if (promo) db.prepare('UPDATE promos SET uses = uses + 1 WHERE code = ?').run(promo.code);
    event(id, 'requested', source === 'central' ? 'Pedido cargado por la central' : 'Pedido desde la app');
    if (driverId) await assignDirect(id, Number(driverId));
    else offerNext(id);
    return getTrip(id);
  }

  // ───────── Dispatch ─────────
  function nearestDrivers(point, category, exclude, limit = 5) {
    const rows = db.prepare(`
      SELECT d.user_id, d.lat, d.lng, d.is_bot FROM drivers d JOIN users u ON u.id = d.user_id JOIN vehicles v ON v.id = d.vehicle_id
      WHERE d.status = 'available' AND d.approved = 1 AND u.active = 1 AND v.category = ? AND d.lat IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM trip_offers o WHERE o.driver_id = d.user_id AND o.status = 'pending')
        -- Conductores reales: solo si la app dio señales recientemente (evita "fantasmas" que cerraron la app).
        AND (d.is_bot = 1 OR d.last_seen > ?)
        ${Number(getSetting(db, 'bots_enabled', 1)) ? '' : 'AND d.is_bot = 0'}
    `).all(category, new Date(Date.now() - 40_000).toISOString());
    return rows
      .filter((d) => !exclude.has(d.user_id))
      .map((d) => ({ ...d, distance: distanceM(point, d) }))
      .filter((d) => d.distance <= MAX_PICKUP_M)
      // Prioridad a conductores reales (app abierta) para que la demo con el celular reciba el pedido.
      .sort((a, b) => (a.is_bot - b.is_bot) || (a.distance - b.distance))
      .slice(0, limit);
  }

  function offerNext(tripId) {
    const trip = getTrip(tripId);
    if (!trip || trip.status !== 'searching') return;
    const tried = new Set(db.prepare('SELECT driver_id FROM trip_offers WHERE trip_id = ?').all(tripId).map((o) => o.driver_id));
    const [candidate] = nearestDrivers({ lat: trip.origin_lat, lng: trip.origin_lng }, trip.category, tried, 1);
    if (!candidate) {
      // Sin candidatos: se sigue intentando en cada ciclo (puede liberarse un conductor) hasta 90 s.
      const age = (Date.now() - new Date(trip.requested_at).getTime()) / 1000;
      if (age > 90) {
        db.prepare("UPDATE trips SET status = 'no_drivers', cancelled_at = ? WHERE id = ?").run(now(), tripId);
        event(tripId, 'no_drivers', 'No hay conductores disponibles');
      }
      return;
    }
    const timeout = Number(getSetting(db, 'offer_timeout_s', 20));
    db.prepare('INSERT INTO trip_offers (trip_id, driver_id, distance_m, offered_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(tripId, candidate.user_id, Math.round(candidate.distance), now(), new Date(Date.now() + timeout * 1000).toISOString());
    event(tripId, 'offered', `Ofrecido a ${getDriver(candidate.user_id).name} (${(candidate.distance / 1000).toFixed(1)} km)`);
  }

  async function acceptOffer(driverId, offerId) {
    const offer = db.prepare("SELECT * FROM trip_offers WHERE id = ? AND driver_id = ?").get(offerId, driverId);
    if (!offer) throw notFound('Oferta no encontrada');
    if (offer.status !== 'pending') throw conflict('La oferta ya no está disponible');
    const trip = getTrip(offer.trip_id);
    if (trip.status !== 'searching') throw conflict('El viaje ya no está disponible');
    db.prepare("UPDATE trip_offers SET status = 'accepted', responded_at = ? WHERE id = ?").run(now(), offerId);
    await assign(trip.id, driverId);
    return getTrip(trip.id);
  }

  function rejectOffer(driverId, offerId) {
    const offer = db.prepare("SELECT * FROM trip_offers WHERE id = ? AND driver_id = ? AND status = 'pending'").get(offerId, driverId);
    if (!offer) throw notFound('Oferta no encontrada');
    db.prepare("UPDATE trip_offers SET status = 'rejected', responded_at = ? WHERE id = ?").run(now(), offerId);
    event(offer.trip_id, 'rejected', `${getDriver(driverId).name} rechazó el viaje`);
    offerNext(offer.trip_id);
  }

  async function assignDirect(tripId, driverId) {
    const d = getDriver(driverId);
    if (!d || d.status !== 'available') throw conflict('El conductor elegido no está disponible');
    db.prepare("INSERT INTO trip_offers (trip_id, driver_id, status, offered_at, expires_at, responded_at) VALUES (?, ?, 'accepted', ?, ?, ?)").run(tripId, driverId, now(), now(), now());
    await assign(tripId, driverId, 'Asignado por la central');
  }

  async function assign(tripId, driverId, note) {
    const d = getDriver(driverId);
    const trip = getTrip(tripId);
    db.prepare("UPDATE trips SET driver_id = ?, status = 'accepted', accepted_at = ? WHERE id = ?").run(driverId, now(), tripId);
    db.prepare("UPDATE drivers SET status = 'busy' WHERE user_id = ?").run(driverId);
    db.prepare("UPDATE trip_offers SET status = 'cancelled' WHERE trip_id = ? AND status = 'pending'").run(tripId);
    event(tripId, 'accepted', note ?? `${d.name} aceptó el viaje`);
    const r = await route({ lat: d.lat, lng: d.lng }, { lat: trip.origin_lat, lng: trip.origin_lng });
    const coords = simplify(r.coords, 150);
    db.prepare('UPDATE trips SET pickup_route = ? WHERE id = ?').run(JSON.stringify(coords), tripId);
    if (d.simulate || d.is_bot) startMotion(driverId, coords, 'pickup', tripId);
  }

  // ───────── Transiciones del conductor ─────────
  function ownTrip(driverId, tripId) {
    const trip = getTrip(tripId);
    if (!trip || trip.driver_id !== driverId) throw notFound('Viaje no encontrado');
    return trip;
  }

  function arrived(driverId, tripId) {
    const trip = ownTrip(driverId, tripId);
    if (trip.status !== 'accepted') throw conflict('El viaje no está en camino al pasajero');
    db.prepare("UPDATE trips SET status = 'arrived', arrived_at = ? WHERE id = ?").run(now(), tripId);
    const d = getDriver(driverId);
    // Al llegar el auto queda en el punto de encuentro.
    db.prepare('UPDATE drivers SET lat = ?, lng = ? WHERE user_id = ?').run(trip.origin_lat, trip.origin_lng, driverId);
    motions.delete(driverId);
    event(tripId, 'arrived', `${d.name} llegó al punto de encuentro`);
    return getTrip(tripId);
  }

  function start(driverId, tripId) {
    const trip = ownTrip(driverId, tripId);
    if (trip.status !== 'arrived') throw conflict('Primero marcá que llegaste');
    db.prepare("UPDATE trips SET status = 'in_progress', started_at = ? WHERE id = ?").run(now(), tripId);
    event(tripId, 'started', 'Comenzó el viaje');
    const d = getDriver(driverId);
    if (d.simulate || d.is_bot) startMotion(driverId, JSON.parse(trip.route), 'trip', tripId);
    return getTrip(tripId);
  }

  function complete(driverId, tripId) {
    const trip = ownTrip(driverId, tripId);
    if (trip.status !== 'in_progress') throw conflict('El viaje no está en curso');
    const final = trip.fare_estimate_cents;
    const commission = Math.round(final * Number(getSetting(db, 'commission_pct', 15)) / 100);
    db.prepare("UPDATE trips SET status = 'completed', completed_at = ?, fare_final_cents = ?, commission_cents = ? WHERE id = ?").run(now(), final, commission, tripId);
    db.prepare("UPDATE drivers SET status = 'available', lat = ?, lng = ? WHERE user_id = ?").run(trip.dest_lat, trip.dest_lng, driverId);
    motions.delete(driverId);
    event(tripId, 'completed', 'Viaje finalizado');
    return getTrip(tripId);
  }

  function cancel(tripId, by, reason) {
    const trip = getTrip(tripId);
    if (!trip) throw notFound('Viaje no encontrado');
    if (!ACTIVE.includes(trip.status)) throw conflict('El viaje ya terminó');
    if ((by === 'rider' || by === 'driver') && trip.status === 'in_progress') throw conflict('El viaje ya comenzó');
    db.prepare("UPDATE trips SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?").run(now(), by, reason ?? null, tripId);
    db.prepare("UPDATE trip_offers SET status = 'cancelled' WHERE trip_id = ? AND status = 'pending'").run(tripId);
    if (trip.driver_id) {
      db.prepare("UPDATE drivers SET status = 'available' WHERE user_id = ? AND status = 'busy'").run(trip.driver_id);
      motions.delete(trip.driver_id);
    }
    const who = { rider: 'el pasajero', driver: 'el conductor', admin: 'la central' }[by] ?? by;
    event(tripId, 'cancelled', `Cancelado por ${who}${reason ? `: ${reason}` : ''}`);
    // Si cancela el conductor, se busca otro.
    if (by === 'driver') {
      db.prepare("UPDATE trips SET status = 'searching', driver_id = NULL, cancelled_at = NULL, cancelled_by = NULL, accepted_at = NULL, pickup_route = NULL WHERE id = ?").run(tripId);
      event(tripId, 'searching', 'Buscando otro conductor');
      offerNext(tripId);
    }
    return getTrip(tripId);
  }

  function rate(tripId, { by, stars, tipCents = 0, comment }) {
    const trip = getTrip(tripId);
    if (!trip || trip.status !== 'completed') throw conflict('Solo se califican viajes finalizados');
    const s = Math.round(Number(stars));
    if (!(s >= 1 && s <= 5)) throw bad('La calificación va de 1 a 5');
    const targetId = by === 'rider' ? trip.driver_id : trip.rider_id;
    const col = by === 'rider' ? 'rating_for_driver' : 'rating_for_rider';
    if (trip[col]) throw conflict('Ya calificaste este viaje');
    db.prepare(`UPDATE trips SET ${col} = ? WHERE id = ?`).run(s, tripId);
    if (by === 'rider') {
      const tip = Math.max(0, Math.round(Number(tipCents) || 0));
      db.prepare('UPDATE trips SET tip_cents = ?, rider_comment = ? WHERE id = ?').run(tip, comment ?? null, tripId);
    }
    if (targetId) {
      db.prepare('UPDATE users SET rating = ROUND((rating * ratings_count + ?) / (ratings_count + 1), 2), ratings_count = ratings_count + 1 WHERE id = ?').run(s, targetId);
    }
    return getTrip(tripId);
  }

  // ───────── Simulación ─────────
  function startMotion(driverId, coords, purpose, tripId = null) {
    if (!coords?.length) return;
    motions.set(driverId, { coords, pos: 0, length: pathLength(coords), purpose, tripId });
  }

  function remainingSeconds(driverId) {
    const m = motions.get(driverId);
    if (!m || m.purpose === 'wait') return null;
    return Math.round((m.length - m.pos) / (BASE_SPEED * simSpeed()));
  }

  async function wander(driverId, d) {
    if (pendingRoutes.has(driverId)) return;
    pendingRoutes.add(driverId);
    try {
      let target = randomPointNear({ lat: d.lat, lng: d.lng }, 2200);
      if (distanceM(target, config.center) > 6000) target = randomPointNear(config.center, 3000);
      const r = await route({ lat: d.lat, lng: d.lng }, target);
      const fresh = getDriver(driverId);
      if (fresh.status === 'available' && !motions.has(driverId)) startMotion(driverId, simplify(r.coords, 120), 'wander');
    } finally {
      pendingRoutes.delete(driverId);
    }
  }

  let lastTick = Date.now();
  async function tick() {
    const nowMs = Date.now();
    const dt = Math.min(5, (nowMs - lastTick) / 1000);
    lastTick = nowMs;
    const ts = now();

    // 1. Ofertas vencidas → siguiente conductor.
    for (const o of db.prepare("SELECT * FROM trip_offers WHERE status = 'pending' AND expires_at < ?").all(ts)) {
      db.prepare("UPDATE trip_offers SET status = 'expired', responded_at = ? WHERE id = ?").run(ts, o.id);
      event(o.trip_id, 'expired', `${getDriver(o.driver_id)?.name ?? 'Conductor'} no respondió a tiempo`);
      offerNext(o.trip_id);
    }
    // 2. Viajes buscando sin oferta pendiente (por ejemplo, recién se conectó un conductor).
    for (const t of db.prepare("SELECT id FROM trips WHERE status = 'searching' AND NOT EXISTS (SELECT 1 FROM trip_offers o WHERE o.trip_id = trips.id AND o.status = 'pending')").all()) offerNext(t.id);

    // 3. Los robots aceptan sus ofertas después de unos segundos.
    const delay = Number(getSetting(db, 'bot_accept_delay_s', 3)) * 1000;
    for (const o of db.prepare("SELECT o.* FROM trip_offers o JOIN drivers d ON d.user_id = o.driver_id WHERE o.status = 'pending' AND d.is_bot = 1").all()) {
      if (nowMs - new Date(o.offered_at).getTime() >= delay) await acceptOffer(o.driver_id, o.id).catch(() => {});
    }

    // 4. Movimiento.
    const speed = BASE_SPEED * simSpeed();
    for (const [driverId, m] of motions) {
      if (m.purpose === 'wait') {
        if (nowMs >= m.waitUntil) {
          motions.delete(driverId);
          if (m.next === 'start') { try { start(driverId, m.tripId); } catch {} }
        }
        continue;
      }
      m.pos = Math.min(m.length, m.pos + speed * dt);
      const p = pointAlong(m.coords, m.pos);
      db.prepare('UPDATE drivers SET lat = ?, lng = ?, heading = ?, last_seen = ? WHERE user_id = ?').run(p.lat, p.lng, p.heading, ts, driverId);
      if (m.pos >= m.length) {
        motions.delete(driverId);
        const d = getDriver(driverId);
        if (!d.is_bot) continue;  // el conductor real marca "Llegué" / "Finalizar" desde la app
        try {
          if (m.purpose === 'pickup') {
            arrived(driverId, m.tripId);
            motions.set(driverId, { purpose: 'wait', waitUntil: nowMs + 6000, next: 'start', tripId: m.tripId });
          } else if (m.purpose === 'trip') {
            complete(driverId, m.tripId);
            const t = getTrip(m.tripId);
            if (t.rider_id) rateRiderLater(m.tripId);
          }
        } catch { /* el viaje pudo cancelarse en el medio */ }
      }
    }

    // 5. Conductores reales sin señal hace más de 2 minutos pasan a desconectados.
    db.prepare("UPDATE drivers SET status = 'offline' WHERE is_bot = 0 AND status = 'available' AND (last_seen IS NULL OR last_seen < ?)").run(new Date(nowMs - 120_000).toISOString());

    // 6. Robots disponibles circulan por la ciudad; se mantienen "en línea".
    if (Number(getSetting(db, 'bots_enabled', 1))) {
      for (const d of db.prepare("SELECT user_id, lat, lng FROM drivers WHERE is_bot = 1 AND status = 'available'").all()) {
        if (!motions.has(d.user_id)) wander(d.user_id, d);
      }
      db.prepare("UPDATE drivers SET last_seen = ? WHERE is_bot = 1 AND status != 'offline'").run(ts);
    }
  }

  function rateRiderLater(tripId) {
    try { rate(tripId, { by: 'driver', stars: 5 }); } catch {}
  }

  // Tras un reinicio del servidor, retoma el movimiento de los viajes que estaban en curso.
  function recover() {
    for (const t of db.prepare("SELECT * FROM trips WHERE status IN ('accepted','arrived','in_progress') AND driver_id IS NOT NULL").all()) {
      const d = getDriver(t.driver_id);
      if (!d || !(d.simulate || d.is_bot)) continue;
      if (t.status === 'accepted' && t.pickup_route) startMotion(d.user_id, JSON.parse(t.pickup_route), 'pickup', t.id);
      else if (t.status === 'in_progress' && t.route) startMotion(d.user_id, JSON.parse(t.route), 'trip', t.id);
      else if (t.status === 'arrived' && d.is_bot) motions.set(d.user_id, { purpose: 'wait', waitUntil: Date.now() + 3000, next: 'start', tripId: t.id });
    }
    // Robots ocupados sin viaje activo (estado inconsistente) vuelven a estar libres.
    db.prepare("UPDATE drivers SET status = 'available' WHERE is_bot = 1 AND status = 'busy' AND user_id NOT IN (SELECT driver_id FROM trips WHERE status IN ('accepted','arrived','in_progress') AND driver_id IS NOT NULL)").run();
  }

  let timer = null;
  let running = false;
  function startLoop(ms = config.simTickMs) {
    recover();
    timer = setInterval(async () => {
      if (running) return;
      running = true;
      try { await tick(); } catch (e) { console.error('tick', e); } finally { running = false; }
    }, ms);
  }
  const stopLoop = () => clearInterval(timer);

  // ───────── Vistas ─────────
  function tripView(trip, { forRole } = {}) {
    if (!trip) return null;
    const d = trip.driver_id ? db.prepare(`
      SELECT u.id, u.name, u.phone, u.rating, d.lat, d.lng, d.heading, d.is_bot, v.brand, v.model, v.color, v.plate, v.unit_number, v.category
      FROM users u JOIN drivers d ON d.user_id = u.id LEFT JOIN vehicles v ON v.id = d.vehicle_id WHERE u.id = ?`).get(trip.driver_id) : null;
    let etaMin = null;
    if (d && ['accepted', 'in_progress'].includes(trip.status)) {
      const rem = remainingSeconds(d.id);
      const target = trip.status === 'accepted' ? { lat: trip.origin_lat, lng: trip.origin_lng } : { lat: trip.dest_lat, lng: trip.dest_lng };
      const secs = rem ?? (distanceM(d, target) * 1.3) / BASE_SPEED;
      etaMin = Math.max(1, Math.ceil(secs / 60));
    }
    const rider = trip.rider_id ? db.prepare('SELECT name, phone, rating FROM users WHERE id = ?').get(trip.rider_id) : null;
    return {
      id: trip.id, code: trip.code, status: trip.status, status_label: STATUS_LABELS[trip.status], source: trip.source, category: trip.category,
      origin: { lat: trip.origin_lat, lng: trip.origin_lng, address: trip.origin_address },
      dest: { lat: trip.dest_lat, lng: trip.dest_lng, address: trip.dest_address },
      route: trip.route ? JSON.parse(trip.route) : null,
      pickup_route: trip.pickup_route ? JSON.parse(trip.pickup_route) : null,
      distance_m: trip.distance_m, duration_s: trip.duration_s,
      fare_cents: trip.fare_final_cents ?? trip.fare_estimate_cents, fare_breakdown: JSON.parse(trip.fare_breakdown),
      discount_cents: trip.discount_cents, promo_code: trip.promo_code, tip_cents: trip.tip_cents, payment_method: trip.payment_method,
      rating_for_driver: trip.rating_for_driver, rating_for_rider: trip.rating_for_rider,
      eta_min: etaMin,
      driver: d && {
        id: d.id, name: d.name, phone: forRole === 'public' ? null : d.phone, rating: d.rating,
        lat: d.lat, lng: d.lng, heading: d.heading,
        vehicle: { brand: d.brand, model: d.model, color: d.color, plate: d.plate, unit_number: d.unit_number },
      },
      rider: forRole === 'public' ? null : (rider ? { ...rider } : { name: trip.rider_name, phone: trip.rider_phone, rating: null }),
      share_token: forRole === 'public' ? undefined : trip.share_token,
      notes: trip.notes, cancel_reason: trip.cancel_reason, cancelled_by: trip.cancelled_by,
      requested_at: trip.requested_at, accepted_at: trip.accepted_at, arrived_at: trip.arrived_at,
      started_at: trip.started_at, completed_at: trip.completed_at, cancelled_at: trip.cancelled_at,
    };
  }

  return {
    quote, createTrip, acceptOffer, rejectOffer, arrived, start, complete, cancel, rate, assignDirect,
    tick, startLoop, stopLoop, recover, tripView, getTrip, getDriver, nearestDrivers, motions, remainingSeconds, ACTIVE,
  };
}

function validatePoint(p, label) {
  if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) throw bad(`Falta el ${label}`);
  if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) throw bad(`Coordenadas de ${label} inválidas`);
}

export { HttpError };
