import { badRequest } from './errors.js';

// Validación mínima y explícita. Reemplazable por zod/valibot cuando crezca.
export function required(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
  if (missing.length) throw badRequest('Faltan campos obligatorios', { missing });
}

export function positiveNumber(value, field, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    throw badRequest(`El campo ${field} debe ser un número ${allowZero ? 'no negativo' : 'positivo'}`);
  }
  return n;
}

export function oneOf(value, field, options) {
  if (!options.includes(value)) throw badRequest(`Valor inválido para ${field}`, { options });
  return value;
}

// Copia solo las claves permitidas presentes en body.
export function pick(body, keys) {
  const out = {};
  for (const k of keys) if (body?.[k] !== undefined) out[k] = body[k];
  return out;
}

export function pagination(query) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}
