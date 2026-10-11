import { getSetting } from './db.js';

export function isNight(date, start, end) {
  const h = date.getHours();
  return start > end ? (h >= start || h < end) : (h >= start && h < end);
}

/**
 * Tarifa: bajada de bandera + km + minutos, con mínimo, recargo nocturno,
 * multiplicador dinámico y promoción. Todo en centavos.
 */
export function computeFare(db, { category, distance_m, duration_s, promo, at = new Date() }) {
  const t = db.prepare('SELECT * FROM tariffs WHERE category = ? AND active = 1').get(category);
  if (!t) return null;
  const km = distance_m / 1000;
  const min = duration_s / 60;
  const lines = [
    { code: 'base', label: 'Bajada de bandera', cents: t.base_cents },
    { code: 'distance', label: `Distancia (${km.toFixed(1)} km)`, cents: Math.round(km * t.per_km_cents) },
    { code: 'time', label: `Tiempo (${Math.round(min)} min)`, cents: Math.round(min * t.per_min_cents) },
  ];
  let subtotal = lines.reduce((s, l) => s + l.cents, 0);
  if (subtotal < t.minimum_cents) {
    lines.push({ code: 'minimum', label: 'Ajuste a tarifa mínima', cents: t.minimum_cents - subtotal });
    subtotal = t.minimum_cents;
  }
  const nightPct = getSetting(db, 'night_surcharge_pct', 20);
  if (nightPct && isNight(at, getSetting(db, 'night_start', 22), getSetting(db, 'night_end', 6))) {
    const c = Math.round(subtotal * nightPct / 100);
    lines.push({ code: 'night', label: `Recargo nocturno (${nightPct}%)`, cents: c });
    subtotal += c;
  }
  const surge = Number(getSetting(db, 'surge_multiplier', 1));
  if (surge > 1) {
    const c = Math.round(subtotal * (surge - 1));
    lines.push({ code: 'surge', label: `Alta demanda (x${surge})`, cents: c });
    subtotal += c;
  }
  let discount = 0;
  if (promo) {
    discount = Math.round(subtotal * promo.pct / 100);
    if (promo.max_cents) discount = Math.min(discount, promo.max_cents);
    lines.push({ code: 'promo', label: `Promoción ${promo.code} (-${promo.pct}%)`, cents: -discount });
  }
  // Redondeo a $10 para que el precio sea "de taxi".
  const total = Math.max(0, Math.round((subtotal - discount) / 1000) * 1000);
  return { category: t.category, name: t.name, total_cents: total, discount_cents: discount, lines };
}

export function findPromo(db, code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM promos WHERE code = ? AND active = 1').get(String(code).trim().toUpperCase()) ?? null;
}
