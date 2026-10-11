import { Router } from 'express';
import { requireRole, notFound, bad } from '../auth.js';

export default function riderRoutes(db, engine) {
  const r = Router();
  r.use(requireRole('rider'));
  const own = (req) => {
    const t = engine.getTrip(Number(req.params.id));
    if (!t || t.rider_id !== req.user.id) throw notFound('Viaje no encontrado');
    return t;
  };

  r.post('/quote', async (req, res) => res.json(await engine.quote(req.body ?? {})));

  r.post('/trips', async (req, res) => {
    const b = req.body ?? {};
    const trip = await engine.createTrip({
      riderId: req.user.id, riderName: req.user.name, riderPhone: req.user.phone,
      origin: b.origin, dest: b.dest, category: b.category, paymentMethod: b.payment_method, promoCode: b.promo_code, notes: b.notes,
    });
    res.status(201).json(engine.tripView(trip));
  });

  // Estado para el polling de la app: viaje activo o último sin calificar.
  r.get('/state', (req, res) => {
    const active = db.prepare(`SELECT * FROM trips WHERE rider_id = ? AND status IN ('searching','accepted','arrived','in_progress') ORDER BY id DESC`).get(req.user.id);
    const toRate = active ? null : db.prepare(`SELECT * FROM trips WHERE rider_id = ? AND status IN ('completed','no_drivers','cancelled') AND rating_for_driver IS NULL
      AND COALESCE(completed_at, cancelled_at) > ? ORDER BY id DESC`).get(req.user.id, new Date(Date.now() - 15 * 60_000).toISOString());
    const trip = active ?? toRate;
    res.json({ trip: engine.tripView(trip), messages: trip ? db.prepare('SELECT sender, text, at FROM messages WHERE trip_id = ? ORDER BY id').all(trip.id) : [] });
  });

  r.get('/trips', (req, res) => {
    res.json(db.prepare(`SELECT * FROM trips WHERE rider_id = ? ORDER BY id DESC LIMIT 50`).all(req.user.id).map((t) => engine.tripView(t)));
  });

  r.post('/trips/:id/cancel', (req, res) => res.json(engine.tripView(engine.cancel(own(req).id, 'rider', req.body?.reason))));
  r.post('/trips/:id/rate', (req, res) => res.json(engine.tripView(engine.rate(own(req).id, { by: 'rider', stars: req.body?.stars, tipCents: req.body?.tip_cents, comment: req.body?.comment }))));
  r.post('/trips/:id/dismiss', (req, res) => {
    const t = own(req);
    // Cerrar la pantalla de un viaje sin conductor / cancelado sin calificar.
    if (t.status !== 'completed') db.prepare('UPDATE trips SET rating_for_driver = 0 WHERE id = ?').run(t.id);
    res.json({ ok: true });
  });
  r.post('/trips/:id/messages', (req, res) => {
    const t = own(req);
    const text = String(req.body?.text ?? '').trim().slice(0, 300);
    if (!text) throw bad('Mensaje vacío');
    db.prepare("INSERT INTO messages (trip_id, sender, text) VALUES (?, 'rider', ?)").run(t.id, text);
    res.status(201).json({ ok: true });
  });

  return r;
}
