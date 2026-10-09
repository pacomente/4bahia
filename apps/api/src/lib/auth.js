import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { unauthorized, forbidden } from './errors.js';

export const ROLES = ['superadmin', 'branch_admin', 'operator', 'driver', 'customer'];
export const STAFF = ['superadmin', 'branch_admin', 'operator'];

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, branch_id: user.branch_id, customer_id: user.customer_id },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

export const hashApiKey = (key) => createHash('sha256').update(key).digest('hex');
export const generateApiKey = () => `4b_live_${randomBytes(24).toString('hex')}`;

// Autentica por JWT (Authorization: Bearer) o API key (X-Api-Key).
export function authenticate(db) {
  return (req, _res, next) => {
    const apiKey = req.get('x-api-key');
    if (apiKey) {
      const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').get(hashApiKey(apiKey));
      if (!row) return next(unauthorized('API key inválida'));
      db.prepare("UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(row.id);
      req.user = { id: null, role: 'api', customer_id: row.customer_id, api_key_id: row.id };
      return next();
    }
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(unauthorized());
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = db.prepare('SELECT id, email, name, role, branch_id, customer_id, active FROM users WHERE id = ?').get(payload.sub);
      if (!user || !user.active) return next(unauthorized('Usuario inactivo'));
      req.user = user;
      next();
    } catch {
      next(unauthorized('Token inválido o vencido'));
    }
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

// Staff de sucursal solo opera sobre su sucursal; superadmin sobre todas.
export function assertBranchAccess(user, branchId) {
  if (user.role === 'superadmin') return;
  if (Number(user.branch_id) !== Number(branchId)) throw forbidden('Sin acceso a esta sucursal');
}
