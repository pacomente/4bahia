import { Router } from 'express';
import { hashPassword, requireRole, ROLES } from '../lib/auth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { required, oneOf, pick } from '../lib/validate.js';
import { audit } from '../lib/audit.js';

const SAFE_COLS = 'u.id, u.email, u.name, u.phone, u.role, u.branch_id, u.customer_id, u.active, u.created_at';

// branch_admin solo gestiona operadores y transportistas de su propia sucursal.
function assertCanManage(actor, target) {
  if (actor.role === 'superadmin') return;
  if (!['operator', 'driver'].includes(target.role) || Number(target.branch_id) !== Number(actor.branch_id)) {
    throw forbidden('Solo podés gestionar operadores y transportistas de tu sucursal');
  }
}

export default function userRoutes(db) {
  const r = Router();
  r.use(requireRole('superadmin', 'branch_admin'));

  r.get('/', (req, res) => {
    const where = [];
    const params = [];
    if (req.user.role === 'branch_admin') { where.push('u.branch_id = ?'); params.push(req.user.branch_id); }
    if (req.query.role) { where.push('u.role = ?'); params.push(req.query.role); }
    if (req.query.branch_id) { where.push('u.branch_id = ?'); params.push(req.query.branch_id); }
    const rows = db.prepare(`
      SELECT ${SAFE_COLS}, b.name AS branch_name FROM users u LEFT JOIN branches b ON b.id = u.branch_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.name
    `).all(...params);
    res.json(rows);
  });

  r.post('/', (req, res) => {
    required(req.body, ['email', 'password', 'name', 'role']);
    oneOf(req.body.role, 'role', ROLES);
    const target = { role: req.body.role, branch_id: req.body.branch_id ?? req.user.branch_id };
    assertCanManage(req.user, target);
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (email, password_hash, name, phone, role, branch_id, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(String(req.body.email).toLowerCase(), hashPassword(req.body.password), req.body.name, req.body.phone ?? null,
      target.role, target.branch_id ?? null, req.body.customer_id ?? null);
    audit(db, req, 'user.create', 'user', Number(lastInsertRowid), { role: target.role, branch_id: target.branch_id });
    res.status(201).json(db.prepare(`SELECT ${SAFE_COLS} FROM users u WHERE id = ?`).get(lastInsertRowid));
  });

  r.patch('/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw notFound('Usuario no encontrado');
    assertCanManage(req.user, user);
    const changes = pick(req.body, ['name', 'phone', 'active', 'branch_id', 'role']);
    if (changes.role) { oneOf(changes.role, 'role', ROLES); assertCanManage(req.user, { ...user, ...changes }); }
    if (req.body.password) changes.password_hash = hashPassword(req.body.password);
    const keys = Object.keys(changes);
    if (keys.length) {
      db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => changes[k]), user.id);
    }
    audit(db, req, 'user.update', 'user', user.id, { ...changes, password_hash: changes.password_hash ? '***' : undefined });
    res.json(db.prepare(`SELECT ${SAFE_COLS} FROM users u WHERE id = ?`).get(user.id));
  });

  return r;
}
