import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (m) => new HttpError(400, m);
export const notFound = (m = 'No encontrado') => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}
export function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSession(db, userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

export function authenticate(db) {
  return (req, _res, next) => {
    const h = req.get('authorization') ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return next(new HttpError(401, 'No autenticado'));
    const user = db.prepare(`
      SELECT u.id, u.role, u.name, u.email, u.phone, u.rating, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
    `).get(token);
    if (!user || !user.active) return next(new HttpError(401, 'Sesión inválida'));
    req.user = user;
    next();
  };
}

export const requireRole = (...roles) => (req, _res, next) => (roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Sin permiso')));

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (String(err?.message).includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
}
