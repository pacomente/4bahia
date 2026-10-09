import { badRequest, notFound } from './errors.js';
import { positiveNumber, oneOf } from './validate.js';

// Valores por defecto; se sobrescriben desde la tabla pricing_settings.
export const DEFAULT_SETTINGS = {
  volumetric_divisor: 5000,        // cm³ por kg (peso volumétrico = L×A×H / divisor)
  home_delivery_cents: 250000,     // recargo entrega a domicilio
  insurance_pct: 1.0,              // % sobre valor declarado
  insurance_min_cents: 50000,      // seguro mínimo si hay valor declarado
  cod_fee_pct: 2.5,                // comisión contrarreembolso
  cod_fee_min_cents: 100000,
  fuel_surcharge_pct: 0,           // recargo combustible
  extra_package_cents: 50000,      // por bulto adicional
  tax_pct: 21,                     // IVA
};

export function loadSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM pricing_settings').all()) {
    if (row.key in out) out[row.key] = Number(row.value);
  }
  return out;
}

const pesos = (cents) => Math.round(cents) / 100;

/**
 * Cotiza un envío. Entradas en unidades "humanas" (kg, cm, pesos).
 * Devuelve el desglose en centavos + resumen en pesos.
 */
export function quote(db, input) {
  const packages = Math.max(1, Math.floor(Number(input.packages_count ?? 1)));
  const weightKg = positiveNumber(input.weight_kg, 'weight_kg');
  const deliveryType = oneOf(input.delivery_type ?? 'branch', 'delivery_type', ['home', 'branch']);
  const declaredCents = Math.round(positiveNumber(input.declared_value ?? 0, 'declared_value', { allowZero: true }) * 100);
  const codCents = Math.round(positiveNumber(input.cod_amount ?? 0, 'cod_amount', { allowZero: true }) * 100);

  const origin = db.prepare('SELECT * FROM localities WHERE id = ?').get(input.origin_locality_id);
  const dest = db.prepare('SELECT * FROM localities WHERE id = ?').get(input.dest_locality_id);
  if (!origin || !dest) throw notFound('Localidad de origen o destino inexistente');
  if (deliveryType === 'home' && !dest.home_delivery) {
    throw badRequest(`${dest.name} no tiene entrega a domicilio; elegí retiro en sucursal`);
  }

  const service = db.prepare('SELECT * FROM services WHERE code = ? AND active = 1').get(input.service_code ?? 'standard');
  if (!service) throw notFound('Servicio inexistente');

  const s = loadSettings(db);

  // Peso volumétrico: dimensiones por bulto × cantidad de bultos.
  const { length_cm: l, width_cm: w, height_cm: h } = input;
  const volumetricG = l && w && h
    ? Math.round(((Number(l) * Number(w) * Number(h)) / s.volumetric_divisor) * 1000 * packages)
    : 0;
  const realG = Math.round(weightKg * 1000);
  const chargeableG = Math.max(realG, volumetricG);

  const tiers = db.prepare(
    'SELECT * FROM tariffs WHERE origin_zone_id = ? AND dest_zone_id = ? ORDER BY max_weight_g',
  ).all(origin.zone_id, dest.zone_id);
  if (!tiers.length) throw badRequest('No hay tarifa configurada para ese recorrido');

  let baseCents;
  const tier = tiers.find((t) => chargeableG <= t.max_weight_g);
  if (tier) {
    baseCents = tier.price_cents;
  } else {
    const last = tiers[tiers.length - 1];
    const extraKg = Math.ceil((chargeableG - last.max_weight_g) / 1000);
    baseCents = last.price_cents + extraKg * last.extra_kg_cents;
  }

  const lines = [];
  const add = (code, label, cents) => { if (cents) lines.push({ code, label, amount_cents: Math.round(cents) }); };

  add('base', `Flete ${service.name}`, baseCents * service.price_multiplier);
  add('extra_packages', `Bultos adicionales (${packages - 1})`, (packages - 1) * s.extra_package_cents);
  if (deliveryType === 'home') add('home_delivery', 'Entrega a domicilio', s.home_delivery_cents);
  if (declaredCents > 0) {
    add('insurance', 'Seguro sobre valor declarado', Math.max(declaredCents * s.insurance_pct / 100, s.insurance_min_cents));
  }
  if (codCents > 0) {
    add('cod_fee', 'Gestión contrarreembolso', Math.max(codCents * s.cod_fee_pct / 100, s.cod_fee_min_cents));
  }

  let subtotal = lines.reduce((a, l) => a + l.amount_cents, 0);
  if (s.fuel_surcharge_pct) {
    add('fuel', 'Recargo combustible', subtotal * s.fuel_surcharge_pct / 100);
    subtotal = lines.reduce((a, l) => a + l.amount_cents, 0);
  }

  // Tarifa especial de cliente comercial.
  if (input.customer_id) {
    const customer = db.prepare('SELECT discount_pct FROM customers WHERE id = ?').get(input.customer_id);
    if (customer?.discount_pct) {
      add('discount', `Descuento cliente (${customer.discount_pct}%)`, -subtotal * customer.discount_pct / 100);
      subtotal = lines.reduce((a, l) => a + l.amount_cents, 0);
    }
  }

  const taxCents = Math.round(subtotal * s.tax_pct / 100);
  const totalCents = subtotal + taxCents;

  const eta = new Date();
  eta.setDate(eta.getDate() + service.transit_days + (origin.zone_id === dest.zone_id ? 0 : 1));

  return {
    estimated: !input.measured,   // definitivo cuando el peso fue verificado en sucursal
    service: { code: service.code, name: service.name, transit_days: service.transit_days },
    delivery_type: deliveryType,
    origin: { locality_id: origin.id, name: origin.name, province: origin.province, branch_id: origin.branch_id },
    destination: { locality_id: dest.id, name: dest.name, province: dest.province, branch_id: dest.branch_id },
    weights: { real_g: realG, volumetric_g: volumetricG, chargeable_g: chargeableG, packages },
    declared_value_cents: declaredCents,
    cod_amount_cents: codCents,
    lines,
    subtotal_cents: subtotal,
    tax_pct: s.tax_pct,
    tax_cents: taxCents,
    total_cents: totalCents,
    total: pesos(totalCents),
    currency: 'ARS',
    estimated_delivery_at: eta.toISOString(),
  };
}
