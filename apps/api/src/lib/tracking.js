import { randomInt } from 'node:crypto';

// Código de seguimiento: 4B + 9 dígitos + dígito verificador (Luhn). Ej: 4B1234567893
const ALPHABET = '0123456789';

function luhnDigit(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

export function generateTrackingCode() {
  let body = '';
  for (let i = 0; i < 9; i++) body += ALPHABET[randomInt(10)];
  return `4B${body}${luhnDigit(body)}`;
}

export function isValidTrackingCode(code) {
  const m = /^4B(\d{9})(\d)$/.exec(String(code ?? '').toUpperCase());
  return !!m && luhnDigit(m[1]) === m[2];
}

export const normalizeTrackingCode = (code) => String(code ?? '').trim().toUpperCase();

// Enmascara datos personales para el seguimiento público.
export function maskName(name) {
  if (!name) return null;
  return name.split(/\s+/).map((p) => p[0] + '*'.repeat(Math.max(p.length - 1, 1))).join(' ');
}
