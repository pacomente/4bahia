// Datos de DEMOSTRACIÓN: tarifas, conductores, autos y lugares son ilustrativos.
import { hashPassword } from './auth.js';
import { setSetting, now } from './db.js';
import { randomPointNear } from './geo.js';
import { config } from './config.js';

export const PLACES = {
  'Buenos Aires': [
    ['Obelisco', 'Av. 9 de Julio y Corrientes', -34.6037, -58.3816],
    ['Aeroparque Jorge Newbery', 'Av. Costanera Rafael Obligado', -34.5592, -58.4156],
    ['Plaza Serrano (Palermo Soho)', 'Serrano y Honduras', -34.5885, -58.4302],
    ['Puerto Madero', 'Puente de la Mujer', -34.6084, -58.3654],
    ['Cementerio de la Recoleta', 'Junín 1760', -34.5875, -58.3934],
    ['Estación Retiro', 'Av. Ramos Mejía 1302', -34.5915, -58.3746],
    ['Plaza de Mayo', 'Hipólito Yrigoyen y Bolívar', -34.6083, -58.3712],
    ['Parque Rivadavia', 'Av. Rivadavia 4800', -34.6185, -58.4347],
    ['Barrancas de Belgrano', 'Virrey Vértiz y Juramento', -34.5626, -58.4523],
    ['Plaza Dorrego (San Telmo)', 'Defensa y Humberto Primo', -34.6205, -58.3713],
    ['Abasto Shopping', 'Av. Corrientes 3247', -34.6037, -58.4106],
    ['La Bombonera', 'Brandsen 805', -34.6356, -58.3647],
  ],
};

export function cityPlaces() {
  const list = PLACES[config.city];
  if (list) return list.map(([name, address, lat, lng]) => ({ name, address, lat, lng }));
  // Ciudad sin lista: puntos alrededor del centro configurado.
  return Array.from({ length: 8 }, (_, i) => ({ name: `Punto de interés ${i + 1}`, address: config.city, ...randomPointNear(config.center, 3500) }));
}

const DRIVERS = [
  ['Carlos Gómez', 'Toyota', 'Corolla', 'Negro y amarillo', 'AE 123 KD', 'taxi', '1024'],
  ['Laura Benítez', 'Chevrolet', 'Onix Plus', 'Negro y amarillo', 'AF 456 LM', 'taxi', '1187'],
  ['Martín Sosa', 'Fiat', 'Cronos', 'Negro y amarillo', 'AD 789 PQ', 'taxi', '0932'],
  ['Romina Díaz', 'Volkswagen', 'Virtus', 'Negro y amarillo', 'AE 321 RS', 'taxi', '1450'],
  ['Diego Fernández', 'Peugeot', '408', 'Negro y amarillo', 'AF 654 TU', 'taxi', '1311'],
  ['Valeria Ruiz', 'Renault', 'Logan', 'Negro y amarillo', 'AD 987 VW', 'taxi', '0877'],
  ['Javier Morales', 'Toyota', 'Corolla Cross', 'Negro', 'AG 111 XY', 'ejecutivo', 'E-21'],
  ['Paula Herrera', 'Volkswagen', 'Vento', 'Gris oscuro', 'AG 222 ZA', 'ejecutivo', 'E-34'],
  ['Sergio Castro', 'Audi', 'A4', 'Negro', 'AG 333 BC', 'ejecutivo', 'E-07'],
  ['Natalia Romero', 'Chevrolet', 'Spin', 'Blanco', 'AF 444 DE', 'xl', 'X-12'],
  ['Hernán Acosta', 'Toyota', 'Hiace', 'Plata', 'AE 555 FG', 'xl', 'X-05'],
  ['Florencia Medina', 'Fiat', 'Cronos', 'Negro y amarillo', 'AF 666 HJ', 'taxi', '1502'],
];

export function seed(db) {
  db.exec('BEGIN');
  try {
    const tariffs = [
      ['taxi', 'Taxi', 'El clásico negro y amarillo', 4, 180000, 110000, 15000, 300000, 1],
      ['ejecutivo', 'Ejecutivo', 'Autos premium y conductores seleccionados', 4, 280000, 160000, 22000, 500000, 2],
      ['xl', 'XL', 'Hasta 6 pasajeros o equipaje grande', 6, 300000, 150000, 20000, 500000, 3],
    ];
    for (const t of tariffs) {
      db.prepare('INSERT INTO tariffs (category, name, description, seats, base_cents, per_km_cents, per_min_cents, minimum_cents, sort) VALUES (?,?,?,?,?,?,?,?,?)').run(...t);
    }
    for (const [k, v] of Object.entries({
      commission_pct: 15, night_surcharge_pct: 20, night_start: 22, night_end: 6, surge_multiplier: 1,
      offer_timeout_s: 20, sim_speed: 3, bot_accept_delay_s: 3, bots_enabled: 1,
    })) setSetting(db, k, v);
    db.prepare("INSERT INTO promos (code, description, pct, max_cents) VALUES ('BIENVENIDA', '50% en tu primer viaje', 50, 500000)").run();
    db.prepare("INSERT INTO promos (code, description, pct, max_cents) VALUES ('NOCHE10', '10% de descuento', 10, NULL)").run();

    const pw = hashPassword(config.demoPassword);
    const user = (role, name, email, phone) => Number(db.prepare('INSERT INTO users (role, name, email, phone, password_hash) VALUES (?,?,?,?,?)').run(role, name, email, phone, pw).lastInsertRowid);
    user('admin', 'Administración', 'admin@demo.com', '11 4000-0000');
    user('operator', 'Central Telefónica', 'central@demo.com', '11 4000-0001');
    user('rider', 'Sofía Martínez', 'pasajero@demo.com', '11 5555-1234');
    for (const [n, e] of [['Tomás Pereyra', 'tomas@demo.com'], ['Lucía Vega', 'lucia@demo.com'], ['Andrés Ibarra', 'andres@demo.com']]) user('rider', n, e, '11 5555-0000');

    // Conductor "humano" para la app del conductor (el servidor simula el recorrido salvo que use GPS real).
    const vHuman = Number(db.prepare("INSERT INTO vehicles (brand, model, color, plate, year, category, unit_number) VALUES ('Chevrolet', 'Prisma', 'Negro y amarillo', 'AB 000 CD', 2022, 'taxi', '2000')").run().lastInsertRowid);
    const hId = user('driver', 'Pablo Conductor', 'conductor@demo.com', '11 6666-0000');
    const hp = randomPointNear(config.center, 600);
    db.prepare("INSERT INTO drivers (user_id, vehicle_id, status, lat, lng, is_bot, simulate, license_number, license_expires) VALUES (?, ?, 'offline', ?, ?, 0, 1, 'B-1000000', '2028-05-01')").run(hId, vHuman, hp.lat, hp.lng);

    DRIVERS.forEach(([name, brand, model, color, plate, category, unit], i) => {
      const v = Number(db.prepare('INSERT INTO vehicles (brand, model, color, plate, year, category, unit_number) VALUES (?,?,?,?,?,?,?)').run(brand, model, color, plate, 2019 + (i % 6), category, unit).lastInsertRowid);
      const id = user('driver', name, `${name.split(' ')[0].toLowerCase()}.bot@demo.com`, `11 6${String(100 + i).padStart(3, '0')}-${String(1000 + i * 37).slice(-4)}`);
      const p = randomPointNear(config.center, 4500);
      db.prepare("INSERT INTO drivers (user_id, vehicle_id, status, lat, lng, last_seen, is_bot, simulate, license_number, license_expires) VALUES (?, ?, 'available', ?, ?, ?, 1, 1, ?, '2027-12-31')").run(id, v, p.lat, p.lng, now(), `B-${2000000 + i}`);
      db.prepare('UPDATE users SET rating = ?, ratings_count = ? WHERE id = ?').run(Math.round((4.6 + Math.random() * 0.4) * 100) / 100, 40 + i * 13, id);
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  seedHistory(db);
}

// Historial de viajes de los últimos 14 días para que el panel tenga datos.
function seedHistory(db) {
  const places = cityPlaces();
  const riders = db.prepare("SELECT id, name, phone FROM users WHERE role = 'rider'").all();
  const drivers = db.prepare("SELECT d.user_id, v.category FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.is_bot = 1").all();
  const tariff = Object.fromEntries(db.prepare('SELECT * FROM tariffs').all().map((t) => [t.category, t]));
  const ins = db.prepare(`
    INSERT INTO trips (code, source, rider_id, rider_name, rider_phone, driver_id, category, status, origin_lat, origin_lng, origin_address,
      dest_lat, dest_lng, dest_address, distance_m, duration_s, fare_estimate_cents, fare_breakdown, fare_final_cents, tip_cents, commission_cents,
      payment_method, rating_for_driver, rating_for_rider, cancel_reason, cancelled_by, share_token, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  let n = 0;
  for (let day = 13; day >= 0; day--) {
    const count = 14 + Math.floor(Math.random() * 12) + (day % 7 === 1 || day % 7 === 2 ? 8 : 0);
    for (let k = 0; k < count; k++) {
      const o = places[Math.floor(Math.random() * places.length)];
      let d = places[Math.floor(Math.random() * places.length)];
      if (d === o) d = places[(places.indexOf(o) + 3) % places.length];
      const drv = drivers[Math.floor(Math.random() * drivers.length)];
      const t = tariff[drv.category];
      const rider = riders[Math.floor(Math.random() * riders.length)];
      const dist = Math.round(1.35 * Math.hypot((o.lat - d.lat) * 111320, (o.lng - d.lng) * 92000));
      const dur = Math.round(dist / 6.5) + 120;
      const fare = Math.max(t.minimum_cents, t.base_cents + Math.round(dist / 1000 * t.per_km_cents) + Math.round(dur / 60 * t.per_min_cents));
      const total = Math.round(fare / 1000) * 1000;
      const req = new Date(Date.now() - day * 86400_000);
      req.setHours(day === 0 ? Math.max(0, new Date().getHours() - 1 - Math.floor(Math.random() * 6)) : 7 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 60), 0, 0);
      const at = (m) => new Date(req.getTime() + m * 1000).toISOString();
      const cancelled = Math.random() < 0.07;
      const central = Math.random() < 0.25;
      const tip = !cancelled && Math.random() < 0.3 ? 50000 * (1 + Math.floor(Math.random() * 3)) : 0;
      const wait = 120 + Math.floor(Math.random() * 360);
      n++;
      ins.run(
        `V${String(10000 + n)}`, central ? 'central' : 'app', central ? null : rider.id, rider.name, rider.phone, cancelled ? null : drv.user_id, drv.category,
        cancelled ? 'cancelled' : 'completed', o.lat, o.lng, o.name, d.lat, d.lng, d.name, dist, dur, total,
        JSON.stringify({ lines: [{ code: 'base', label: 'Tarifa', cents: total }], total_cents: total }),
        cancelled ? null : total, tip, cancelled ? null : Math.round(total * 0.15),
        ['cash', 'card', 'mercadopago'][Math.floor(Math.random() * 3)],
        cancelled ? null : (Math.random() < 0.8 ? 5 : 4), cancelled ? null : 5,
        cancelled ? 'El pasajero ya no necesita el viaje' : null, cancelled ? 'rider' : null,
        Math.random().toString(36).slice(2, 12), req.toISOString(),
        cancelled ? null : at(15), cancelled ? null : at(wait), cancelled ? null : at(wait + 60), cancelled ? null : at(wait + 60 + dur), cancelled ? at(90) : null,
      );
    }
  }
  db.exec('COMMIT');
}
