// Datos de DEMOSTRACIÓN. Sucursales, tarifas y coordenadas son ilustrativas y
// deben reemplazarse por la información real de Expreso 4 Bahía.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './index.js';
import { hashPassword } from '../lib/auth.js';
import { createShipment, changeStatus } from '../lib/shipments.js';
import { createTrip, startTrip } from '../lib/trips.js';
import { recordPositions } from '../lib/gps.js';
import { config } from '../config.js';

export const DEMO_PASSWORD = 'Demo1234!';

const BRANCHES = [
  ['BHI', 'Casa Central Bahía Blanca', 'Bahía Blanca', 'Buenos Aires', -38.7183, -62.2663],
  ['PAL', 'Sucursal Punta Alta', 'Punta Alta', 'Buenos Aires', -38.876, -62.0736],
  ['TAR', 'Sucursal Tres Arroyos', 'Tres Arroyos', 'Buenos Aires', -38.3739, -60.2798],
  ['CSU', 'Sucursal Coronel Suárez', 'Coronel Suárez', 'Buenos Aires', -37.4547, -61.9334],
  ['BUE', 'Sucursal Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'CABA', -34.6037, -58.3816],
  ['VDM', 'Sucursal Viedma', 'Viedma', 'Río Negro', -40.8135, -62.9967],
];

const ZONES = [
  ['Z1', 'Bahía Blanca y alrededores'],
  ['Z2', 'Sudoeste bonaerense'],
  ['Z3', 'AMBA'],
  ['Z4', 'Patagonia norte'],
];

// [localidad, provincia, CP, zona, sucursal, entrega a domicilio]
const LOCALITIES = [
  ['Bahía Blanca', 'Buenos Aires', '8000', 'Z1', 'BHI', 1],
  ['Ingeniero White', 'Buenos Aires', '8103', 'Z1', 'BHI', 1],
  ['Punta Alta', 'Buenos Aires', '8109', 'Z1', 'PAL', 1],
  ['Médanos', 'Buenos Aires', '8132', 'Z2', 'BHI', 1],
  ['Tres Arroyos', 'Buenos Aires', '7500', 'Z2', 'TAR', 1],
  ['Coronel Dorrego', 'Buenos Aires', '8150', 'Z2', 'TAR', 1],
  ['Coronel Suárez', 'Buenos Aires', '7540', 'Z2', 'CSU', 1],
  ['Pigüé', 'Buenos Aires', '8170', 'Z2', 'CSU', 0],
  ['Ciudad Autónoma de Buenos Aires', 'CABA', '1000', 'Z3', 'BUE', 1],
  ['La Plata', 'Buenos Aires', '1900', 'Z3', 'BUE', 1],
  ['Viedma', 'Río Negro', '8500', 'Z4', 'VDM', 1],
  ['Carmen de Patagones', 'Buenos Aires', '8504', 'Z4', 'VDM', 1],
];

// Factor por par de zonas (simétrico) sobre la tarifa base.
const ZONE_FACTORS = {
  'Z1-Z1': 1, 'Z1-Z2': 1.3, 'Z1-Z3': 1.9, 'Z1-Z4': 1.5,
  'Z2-Z2': 1.2, 'Z2-Z3': 1.7, 'Z2-Z4': 1.8,
  'Z3-Z3': 1.1, 'Z3-Z4': 2.3, 'Z4-Z4': 1.1,
};
// [hasta g, precio base en centavos]
const BASE_TIERS = [[5000, 600000], [10000, 850000], [20000, 1200000], [30000, 1550000]];
const BASE_EXTRA_KG = 45000;

export function seed(db) {
  tx(db, () => {
    const branchId = {};
    for (const [code, name, city, province, lat, lng] of BRANCHES) {
      branchId[code] = Number(db.prepare('INSERT INTO branches (code, name, address, city, province, phone, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(code, name, 'Dirección a confirmar', city, province, null, lat, lng).lastInsertRowid);
    }
    const zoneId = {};
    for (const [code, name] of ZONES) zoneId[code] = Number(db.prepare('INSERT INTO zones (code, name) VALUES (?, ?)').run(code, name).lastInsertRowid);
    for (const [name, prov, cp, z, b, home] of LOCALITIES) {
      db.prepare('INSERT INTO localities (name, province, postal_code, zone_id, branch_id, home_delivery) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, prov, cp, zoneId[z], branchId[b], home);
    }
    for (const a of Object.keys(zoneId)) {
      for (const b of Object.keys(zoneId)) {
        const factor = ZONE_FACTORS[`${a}-${b}`] ?? ZONE_FACTORS[`${b}-${a}`];
        for (const [maxG, price] of BASE_TIERS) {
          db.prepare('INSERT INTO tariffs (origin_zone_id, dest_zone_id, max_weight_g, price_cents, extra_kg_cents) VALUES (?, ?, ?, ?, ?)')
            .run(zoneId[a], zoneId[b], maxG, Math.round(price * factor), Math.round(BASE_EXTRA_KG * factor));
        }
      }
    }
    db.prepare("INSERT INTO services (code, name, transit_days, price_multiplier) VALUES ('standard', 'Estándar', 2, 1.0)").run();
    db.prepare("INSERT INTO services (code, name, transit_days, price_multiplier) VALUES ('express', 'Express', 1, 1.5)").run();

    const shop = Number(db.prepare(`INSERT INTO customers (type, name, tax_id, email, phone, discount_pct, credit_limit_cents)
      VALUES ('commercial', 'Tienda Demo SRL', '30-00000000-0', 'compras@tiendademo.test', '291 400-0000', 10, 50000000)`).run().lastInsertRowid);

    const pw = hashPassword(DEMO_PASSWORD);
    const users = [
      ['admin@4bahia.test', 'Superadmin', 'superadmin', null, null],
      ['bhi.admin@4bahia.test', 'Admin Bahía Blanca', 'branch_admin', branchId.BHI, null],
      ['bhi.operador@4bahia.test', 'Operador Bahía Blanca', 'operator', branchId.BHI, null],
      ['tar.operador@4bahia.test', 'Operador Tres Arroyos', 'operator', branchId.TAR, null],
      ['bue.operador@4bahia.test', 'Operador Buenos Aires', 'operator', branchId.BUE, null],
      ['chofer1@4bahia.test', 'Juan Chofer', 'driver', branchId.BHI, null],
      ['chofer2@4bahia.test', 'María Chofer', 'driver', branchId.BHI, null],
      ['cliente@tiendademo.test', 'Tienda Demo', 'customer', null, shop],
    ];
    for (const [email, name, role, b, c] of users) {
      db.prepare('INSERT INTO users (email, password_hash, name, role, branch_id, customer_id) VALUES (?, ?, ?, ?, ?, ?)').run(email, pw, name, role, b, c);
    }
    db.prepare("INSERT INTO vehicles (plate, description, capacity_kg, branch_id) VALUES ('AB123CD', 'Semirremolque troncal', 24000, ?)").run(branchId.BHI);
    db.prepare("INSERT INTO vehicles (plate, description, capacity_kg, branch_id) VALUES ('AC456EF', 'Utilitario reparto', 1500, ?)").run(branchId.BHI);
    db.prepare("INSERT INTO vehicles (plate, description, capacity_kg, branch_id) VALUES ('AD789GH', 'Camión mediano', 8000, ?)").run(branchId.TAR);
  });

  seedDemoActivity(db);
}

// Algunos envíos y un viaje en curso para que los paneles no estén vacíos.
function seedDemoActivity(db) {
  const id = (sql, ...p) => db.prepare(sql).get(...p).id;
  const loc = (name) => id('SELECT id FROM localities WHERE name = ?', name);
  const user = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const operator = user('bhi.operador@4bahia.test');
  const bhi = id("SELECT id FROM branches WHERE code = 'BHI'");
  const tar = id("SELECT id FROM branches WHERE code = 'TAR'");
  const shop = id("SELECT id FROM customers WHERE name = 'Tienda Demo SRL'");

  const base = { sender_name: 'Tienda Demo SRL', sender_phone: '291 400-0000', sender_email: 'compras@tiendademo.test', customer_id: shop };
  const mk = (over) => createShipment(db, { ...base, ...over }, { user: operator, receivedAtBranchId: bhi });

  const toTar = [
    mk({ recipient_name: 'Carlos Gómez', recipient_address: 'Av. Moreno 123', recipient_phone: '2983 111111', dest_locality_id: loc('Tres Arroyos'), origin_locality_id: loc('Bahía Blanca'), weight_kg: 3.2, delivery_type: 'home', declared_value: 45000 }),
    mk({ recipient_name: 'Lucía Fernández', dest_locality_id: loc('Coronel Dorrego'), origin_locality_id: loc('Bahía Blanca'), weight_kg: 12, length_cm: 60, width_cm: 40, height_cm: 40, delivery_type: 'branch', packages_count: 2 }),
  ];
  const local = mk({ recipient_name: 'Pedro Martínez', recipient_address: 'Alsina 450', recipient_phone: '291 222222', dest_locality_id: loc('Bahía Blanca'), origin_locality_id: loc('Bahía Blanca'), weight_kg: 1.5, delivery_type: 'home', cod_amount: 18000 });
  mk({ recipient_name: 'Ana López', recipient_address: 'Av. Corrientes 1500', dest_locality_id: loc('Ciudad Autónoma de Buenos Aires'), origin_locality_id: loc('Bahía Blanca'), weight_kg: 8, delivery_type: 'home', service_code: 'express' });
  createShipment(db, { sender_name: 'Particular', recipient_name: 'Sofía Ruiz', origin_locality_id: loc('Viedma'), dest_locality_id: loc('Bahía Blanca'), weight_kg: 2, delivery_type: 'branch' }, {});

  const truck = id("SELECT id FROM vehicles WHERE plate = 'AB123CD'");
  const van = id("SELECT id FROM vehicles WHERE plate = 'AC456EF'");
  const d1 = user('chofer1@4bahia.test');
  const d2 = user('chofer2@4bahia.test');

  // Troncal BHI → TAR en curso con recorrido GPS.
  const { trip } = createTrip(db, { type: 'transfer', vehicle_id: truck, driver_id: d1.id, origin_branch_id: bhi, dest_branch_id: tar, expected_minutes: 180, shipment_codes: toTar.map((s) => s.tracking_code) });
  startTrip(db, trip, d1);
  const now = Date.now();
  const path = [[-38.7183, -62.2663], [-38.69, -62.0], [-38.62, -61.6], [-38.55, -61.2], [-38.49, -60.9]];
  recordPositions(db, { vehicleId: truck, driverId: d1.id, tripId: trip.id },
    path.map(([lat, lng], i) => ({ lat, lng, speed_kmh: 85, recorded_at: new Date(now - (path.length - 1 - i) * 4 * 60000).toISOString() })));

  // Reparto local planificado con contrarreembolso.
  createTrip(db, { type: 'delivery', vehicle_id: van, driver_id: d2.id, origin_branch_id: bhi, expected_minutes: 240, shipment_codes: [local.tracking_code] });

  // Una incidencia para el panel.
  changeStatus(db, db.prepare('SELECT * FROM shipments WHERE recipient_name = ?').get('Ana López'),
    { status: 'delayed', reason: 'Demora en carga troncal', branch_id: bhi }, { user: operator });
}

// Ejecución directa: `npm run seed` recrea la base.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const suffix of ['', '-wal', '-shm']) rmSync(config.dbPath + suffix, { force: true });
  const db = openDb();
  seed(db);
  console.log(`Base recreada en ${config.dbPath}. Usuarios demo con contraseña ${DEMO_PASSWORD}`);
}
