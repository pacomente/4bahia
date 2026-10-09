import { Router } from 'express';
import { checkPassword, hashPassword, signToken } from '../lib/auth.js';
import { unauthorized, conflict, badRequest } from '../lib/errors.js';
import { required } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { tx } from '../db/index.js';

export default function authRoutes(db, { authenticate }) {
  const r = Router();

  r.post('/login', (req, res) => {
    required(req.body, ['email', 'password']);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(req.body.email).toLowerCase());
    if (!user || !checkPassword(req.body.password, user.password_hash)) throw unauthorized('Email o contraseña incorrectos');
    req.user = user;
    audit(db, req, 'auth.login', 'user', user.id);
    const { password_hash, ...safe } = user;
    res.json({ token: signToken(user), user: safe });
  });

  // Registro de clientes desde la web pública.
  r.post('/register', (req, res) => {
    required(req.body, ['email', 'password', 'name']);
    const email = String(req.body.email).toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw conflict('El email ya está registrado');
    if (String(req.body.password).length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres');
    const user = tx(db, () => {
      const c = db.prepare('INSERT INTO customers (name, email, phone, tax_id) VALUES (?, ?, ?, ?)')
        .run(req.body.name, email, req.body.phone ?? null, req.body.tax_id ?? null);
      const u = db.prepare('INSERT INTO users (email, password_hash, name, phone, role, customer_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(email, hashPassword(req.body.password), req.body.name, req.body.phone ?? null, 'customer', c.lastInsertRowid);
      return db.prepare('SELECT id, email, name, role, branch_id, customer_id FROM users WHERE id = ?').get(u.lastInsertRowid);
    });
    res.status(201).json({ token: signToken(user), user });
  });

  r.get('/me', authenticate, (req, res) => res.json(req.user));

  return r;
}
