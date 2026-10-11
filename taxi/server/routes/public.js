import { Router } from 'express';
import { config } from '../config.js';
import { cityPlaces } from '../seed.js';
import { checkPassword, createSession, hashPassword, bad, conflict, HttpError, notFound } from '../auth.js';

export default function publicRoutes(db, engine) {
  const r = Router();

  r.get('/config', (_req, res) => res.json({
    brand: config.brand, city: config.city, center: config.center, quick_login: config.quickLogin,
    categories: db.prepare('SELECT category, name, description, seats FROM tariffs WHERE active = 1 ORDER BY sort').all(),
  }));

  r.get('/places', (_req, res) => res.json(cityPlaces()));

  // Autos visibles en el mapa del pasajero (sin datos personales).
  r.get('/nearby', (req, res) => {
    const lat = Number(req.query.lat) || config.center.lat;
    const lng = Number(req.query.lng) || config.center.lng;
    const rows = db.prepare(`
      SELECT d.user_id AS id, d.lat, d.lng, d.heading, v.category FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id
      WHERE d.status = 'available' AND d.lat IS NOT NULL`).all();
    res.json(rows.filter((d) => Math.abs(d.lat - lat) < 0.08 && Math.abs(d.lng - lng) < 0.1));
  });

  r.get('/track/:token', (req, res) => {
    const trip = db.prepare('SELECT * FROM trips WHERE share_token = ?').get(req.params.token);
    if (!trip) throw notFound('Viaje no encontrado');
    res.json(engine.tripView(trip, { forRole: 'public' }));
  });

  r.post('/auth/login', (req, res) => {
    const { email, password, role } = req.body ?? {};
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email ?? '').trim().toLowerCase());
    if (!user || !checkPassword(String(password ?? ''), user.password_hash)) throw new HttpError(401, 'Email o contraseña incorrectos');
    const allowed = { rider: ['rider'], driver: ['driver'], admin: ['admin', 'operator'] }[role] ?? null;
    if (allowed && !allowed.includes(user.role)) throw new HttpError(403, 'Este usuario no tiene acceso a esta app');
    if (user.role === 'driver') {
      const d = db.prepare('SELECT is_bot, approved FROM drivers WHERE user_id = ?').get(user.id);
      if (d?.is_bot) throw new HttpError(403, 'Conductor simulado: usá conductor@demo.com');
      if (!d?.approved) throw new HttpError(403, 'Tu cuenta de conductor está pendiente de aprobación');
    }
    res.json({ token: createSession(db, user.id), user: publicUser(user) });
  });

  // Entrada rápida para demos.
  r.post('/auth/demo', (req, res) => {
    if (!config.quickLogin) throw new HttpError(403, 'Entrada rápida deshabilitada');
    const email = { rider: 'pasajero@demo.com', driver: 'conductor@demo.com', admin: 'admin@demo.com', operator: 'central@demo.com' }[req.body?.role];
    if (!email) throw bad('Rol inválido');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    res.json({ token: createSession(db, user.id), user: publicUser(user) });
  });

  r.post('/auth/register', (req, res) => {
    const { name, email, phone, password } = req.body ?? {};
    if (!name || !email || !password) throw bad('Completá nombre, email y contraseña');
    if (String(password).length < 6) throw bad('La contraseña debe tener al menos 6 caracteres');
    const e = String(email).trim().toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw conflict('Ese email ya está registrado');
    const id = Number(db.prepare("INSERT INTO users (role, name, email, phone, password_hash) VALUES ('rider', ?, ?, ?, ?)").run(name, e, phone ?? null, hashPassword(password)).lastInsertRowid);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.status(201).json({ token: createSession(db, id), user: publicUser(user) });
  });

  return r;
}

export const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, rating: u.rating });
