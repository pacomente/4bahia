import { Router } from 'express';
import { requireRole, notFound, bad } from '../auth.js';
import { now } from '../db.js';

export default function driverRoutes(db, engine) {
  const r = Router();
  r.use(requireRole('driver'));

  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

  r.get('/state', (req, res) => {
    const id = req.user.id;
    // Cada consulta de la app cuenta como señal de vida del conductor.
    db.prepare('UPDATE drivers SET last_seen = ? WHERE user_id = ?').run(now(), id);
    const d = db.prepare(`
      SELECT d.*, v.brand, v.model, v.color, v.plate, v.unit_number, v.category FROM drivers d LEFT JOIN vehicles v ON v.id = d.vehicle_id WHERE d.user_id = ?`).get(id);
    const offer = db.prepare("SELECT * FROM trip_offers WHERE driver_id = ? AND status = 'pending' ORDER BY id DESC").get(id);
    const active = db.prepare("SELECT * FROM trips WHERE driver_id = ? AND status IN ('accepted','arrived','in_progress') ORDER BY id DESC").get(id);
    const stats = db.prepare(`
      SELECT COUNT(*) AS trips, COALESCE(SUM(fare_final_cents - commission_cents + tip_cents), 0) AS earnings_cents,
        COALESCE(SUM(tip_cents), 0) AS tips_cents, COALESCE(SUM(distance_m), 0) AS distance_m
      FROM trips WHERE driver_id = ? AND status = 'completed' AND completed_at >= ?`).get(id, today());
    const offerTrip = offer ? engine.getTrip(offer.trip_id) : null;
    res.json({
      driver: {
        status: d.status, lat: d.lat, lng: d.lng, heading: d.heading, simulate: !!d.simulate, rating: req.user.rating,
        vehicle: { brand: d.brand, model: d.model, color: d.color, plate: d.plate, unit_number: d.unit_number, category: d.category },
      },
      offer: offer && offerTrip ? {
        id: offer.id, expires_at: offer.expires_at, offered_at: offer.offered_at, pickup_distance_m: offer.distance_m,
        trip: engine.tripView(offerTrip),
      } : null,
      trip: engine.tripView(active),
      messages: active ? db.prepare('SELECT sender, text, at FROM messages WHERE trip_id = ? ORDER BY id').all(active.id) : [],
      today: stats,
      server_time: now(),
    });
  });

  r.post('/status', (req, res) => {
    const online = !!req.body?.online;
    const d = db.prepare('SELECT status FROM drivers WHERE user_id = ?').get(req.user.id);
    if (d.status === 'busy') throw bad('Terminá el viaje en curso antes de desconectarte');
    db.prepare('UPDATE drivers SET status = ?, last_seen = ? WHERE user_id = ?').run(online ? 'available' : 'offline', now(), req.user.id);
    if (!online) db.prepare("UPDATE trip_offers SET status = 'expired', responded_at = ? WHERE driver_id = ? AND status = 'pending'").run(now(), req.user.id);
    res.json({ status: online ? 'available' : 'offline' });
  });

  // Modo GPS real (celular) o simulado (el servidor mueve el auto).
  r.post('/mode', (req, res) => {
    db.prepare('UPDATE drivers SET simulate = ? WHERE user_id = ?').run(req.body?.simulate ? 1 : 0, req.user.id);
    res.json({ simulate: !!req.body?.simulate });
  });

  r.post('/location', (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw bad('Ubicación inválida');
    const d = db.prepare('SELECT simulate FROM drivers WHERE user_id = ?').get(req.user.id);
    if (!d.simulate) db.prepare('UPDATE drivers SET lat = ?, lng = ?, heading = ?, last_seen = ? WHERE user_id = ?').run(lat, lng, req.body?.heading ?? null, now(), req.user.id);
    res.json({ ok: true });
  });

  r.post('/offers/:id/accept', async (req, res) => res.json(engine.tripView(await engine.acceptOffer(req.user.id, Number(req.params.id)))));
  r.post('/offers/:id/reject', (req, res) => { engine.rejectOffer(req.user.id, Number(req.params.id)); res.json({ ok: true }); });

  r.post('/trips/:id/arrived', (req, res) => res.json(engine.tripView(engine.arrived(req.user.id, Number(req.params.id)))));
  r.post('/trips/:id/start', (req, res) => res.json(engine.tripView(engine.start(req.user.id, Number(req.params.id)))));
  r.post('/trips/:id/complete', (req, res) => res.json(engine.tripView(engine.complete(req.user.id, Number(req.params.id)))));
  r.post('/trips/:id/cancel', (req, res) => {
    const t = engine.getTrip(Number(req.params.id));
    if (!t || t.driver_id !== req.user.id) throw notFound('Viaje no encontrado');
    res.json(engine.tripView(engine.cancel(t.id, 'driver', req.body?.reason)));
  });
  r.post('/trips/:id/rate', (req, res) => {
    const t = engine.getTrip(Number(req.params.id));
    if (!t || t.driver_id !== req.user.id) throw notFound('Viaje no encontrado');
    res.json(engine.tripView(engine.rate(t.id, { by: 'driver', stars: req.body?.stars })));
  });
  r.post('/trips/:id/messages', (req, res) => {
    const t = engine.getTrip(Number(req.params.id));
    if (!t || t.driver_id !== req.user.id) throw notFound('Viaje no encontrado');
    const text = String(req.body?.text ?? '').trim().slice(0, 300);
    if (!text) throw bad('Mensaje vacío');
    db.prepare("INSERT INTO messages (trip_id, sender, text) VALUES (?, 'driver', ?)").run(t.id, text);
    res.status(201).json({ ok: true });
  });

  r.get('/trips', (req, res) => {
    res.json(db.prepare("SELECT * FROM trips WHERE driver_id = ? AND status IN ('completed','cancelled') ORDER BY id DESC LIMIT 50").all(req.user.id).map((t) => engine.tripView(t)));
  });

  return r;
}
