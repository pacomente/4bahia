-- Plataforma logística 4 Bahía — esquema MVP
-- Diseñado para SQLite (prototipo). Tipos y nombres compatibles con una
-- migración posterior a PostgreSQL. Montos en centavos (INTEGER), pesos en gramos,
-- dimensiones en centímetros, fechas en ISO-8601 UTC.

PRAGMA foreign_keys = ON;

-- ───────────────────────── Organización ─────────────────────────

CREATE TABLE IF NOT EXISTS branches (
  id            INTEGER PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- ej: BHI
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT NOT NULL,
  province      TEXT NOT NULL,
  phone         TEXT,
  lat           REAL,
  lng           REAL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Roles: superadmin | branch_admin | operator | driver | customer
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('superadmin','branch_admin','operator','driver','customer')),
  branch_id     INTEGER REFERENCES branches(id),   -- sucursal de pertenencia (staff)
  customer_id   INTEGER REFERENCES customers(id),  -- cuenta cliente (role=customer)
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────── Catálogo comercial ─────────────────────────

CREATE TABLE IF NOT EXISTS zones (
  id            INTEGER PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS localities (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  province      TEXT NOT NULL,
  postal_code   TEXT,
  zone_id       INTEGER NOT NULL REFERENCES zones(id),
  branch_id     INTEGER REFERENCES branches(id),   -- sucursal que la atiende
  home_delivery INTEGER NOT NULL DEFAULT 1,
  UNIQUE (name, province)
);

-- Servicios: estándar, express, etc.
CREATE TABLE IF NOT EXISTS services (
  id                 INTEGER PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  transit_days       INTEGER NOT NULL DEFAULT 2,
  price_multiplier   REAL NOT NULL DEFAULT 1.0,
  active             INTEGER NOT NULL DEFAULT 1
);

-- Tarifa base por par de zonas (origen→destino), con tramos de peso.
CREATE TABLE IF NOT EXISTS tariffs (
  id                 INTEGER PRIMARY KEY,
  origin_zone_id     INTEGER NOT NULL REFERENCES zones(id),
  dest_zone_id       INTEGER NOT NULL REFERENCES zones(id),
  max_weight_g       INTEGER NOT NULL,      -- tope del tramo (inclusive)
  price_cents        INTEGER NOT NULL,      -- precio del tramo
  extra_kg_cents     INTEGER NOT NULL DEFAULT 0, -- por kg adicional sobre el último tramo
  UNIQUE (origin_zone_id, dest_zone_id, max_weight_g)
);

-- Parámetros globales del cotizador (clave/valor).
CREATE TABLE IF NOT EXISTS pricing_settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- ───────────────────────── Clientes ─────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id               INTEGER PRIMARY KEY,
  type             TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual','commercial')),
  name             TEXT NOT NULL,
  tax_id           TEXT,                -- CUIT/CUIL/DNI
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  discount_pct     REAL NOT NULL DEFAULT 0,   -- tarifa especial comercial
  credit_limit_cents INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────── Envíos ─────────────────────────

CREATE TABLE IF NOT EXISTS shipments (
  id                    INTEGER PRIMARY KEY,
  tracking_code         TEXT NOT NULL UNIQUE,
  customer_id           INTEGER REFERENCES customers(id),
  service_id            INTEGER NOT NULL REFERENCES services(id),
  delivery_type         TEXT NOT NULL CHECK (delivery_type IN ('home','branch')),
  status                TEXT NOT NULL,

  sender_name           TEXT NOT NULL,
  sender_phone          TEXT,
  sender_email          TEXT,
  sender_tax_id         TEXT,
  sender_address        TEXT,
  recipient_name        TEXT NOT NULL,
  recipient_phone       TEXT,
  recipient_email       TEXT,
  recipient_tax_id      TEXT,
  recipient_address     TEXT,

  origin_locality_id    INTEGER NOT NULL REFERENCES localities(id),
  dest_locality_id      INTEGER NOT NULL REFERENCES localities(id),
  origin_branch_id      INTEGER NOT NULL REFERENCES branches(id),
  dest_branch_id        INTEGER NOT NULL REFERENCES branches(id),
  current_branch_id     INTEGER REFERENCES branches(id),

  packages_count        INTEGER NOT NULL DEFAULT 1,
  weight_g              INTEGER NOT NULL,
  length_cm             REAL,
  width_cm              REAL,
  height_cm             REAL,
  volumetric_weight_g   INTEGER NOT NULL DEFAULT 0,
  chargeable_weight_g   INTEGER NOT NULL,
  declared_value_cents  INTEGER NOT NULL DEFAULT 0,
  description           TEXT,

  cod_amount_cents      INTEGER NOT NULL DEFAULT 0,   -- contrarreembolso a cobrar
  price_cents           INTEGER NOT NULL,
  price_breakdown       TEXT NOT NULL,                -- JSON del cálculo
  payment_mode          TEXT NOT NULL DEFAULT 'origin' CHECK (payment_mode IN ('origin','destination','account')),

  estimated_delivery_at TEXT,
  delivered_at          TEXT,
  external_ref          TEXT,                         -- id de orden de tienda / integración
  created_by            INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_current_branch ON shipments(current_branch_id);

-- Historial completo de cada envío (línea de tiempo).
CREATE TABLE IF NOT EXISTS shipment_events (
  id               INTEGER PRIMARY KEY,
  shipment_id      INTEGER NOT NULL REFERENCES shipments(id),
  status           TEXT NOT NULL,
  branch_id        INTEGER REFERENCES branches(id),
  trip_id          INTEGER REFERENCES trips(id),
  user_id          INTEGER REFERENCES users(id),
  note             TEXT,                      -- visible para el cliente
  internal_note    TEXT,                      -- solo staff
  reason           TEXT,                      -- motivo (visita fallida, rechazo, daño…)
  lat              REAL,
  lng              REAL,
  client_event_id  TEXT UNIQUE,               -- idempotencia para sync offline de la app
  occurred_at      TEXT NOT NULL,             -- momento real (puede ser offline)
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_shipment ON shipment_events(shipment_id);

-- Comprobante de entrega: firma, foto, DNI de quien recibe.
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id               INTEGER PRIMARY KEY,
  shipment_id      INTEGER NOT NULL REFERENCES shipments(id),
  receiver_name    TEXT NOT NULL,
  receiver_doc     TEXT,
  signature_data   TEXT,     -- data URL / ref a storage (S3) en producción
  photo_data       TEXT,
  lat              REAL,
  lng              REAL,
  user_id          INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────── Flota y GPS ─────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id               INTEGER PRIMARY KEY,
  plate            TEXT NOT NULL UNIQUE,
  description      TEXT,
  capacity_kg      INTEGER,
  branch_id        INTEGER REFERENCES branches(id),
  active           INTEGER NOT NULL DEFAULT 1,
  last_lat         REAL,
  last_lng         REAL,
  last_speed_kmh   REAL,
  last_position_at TEXT
);

-- Viaje: troncal entre sucursales (transfer) o reparto de última milla (delivery).
CREATE TABLE IF NOT EXISTS trips (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN ('transfer','delivery')),
  vehicle_id       INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id        INTEGER NOT NULL REFERENCES users(id),
  origin_branch_id INTEGER NOT NULL REFERENCES branches(id),
  dest_branch_id   INTEGER REFERENCES branches(id),     -- null en repartos
  status           TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  planned_at       TEXT,
  started_at       TEXT,
  finished_at      TEXT,
  expected_minutes INTEGER,     -- para alertas de demora
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS trip_shipments (
  trip_id          INTEGER NOT NULL REFERENCES trips(id),
  shipment_id      INTEGER NOT NULL REFERENCES shipments(id),
  stop_order       INTEGER,
  PRIMARY KEY (trip_id, shipment_id)
);

CREATE TABLE IF NOT EXISTS gps_positions (
  id               INTEGER PRIMARY KEY,
  vehicle_id       INTEGER NOT NULL REFERENCES vehicles(id),
  trip_id          INTEGER REFERENCES trips(id),
  driver_id        INTEGER REFERENCES users(id),
  lat              REAL NOT NULL,
  lng              REAL NOT NULL,
  speed_kmh        REAL,
  heading          REAL,
  accuracy_m       REAL,
  recorded_at      TEXT NOT NULL,     -- hora del dispositivo
  received_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_positions(vehicle_id, recorded_at);

-- ───────────────────────── Finanzas ─────────────────────────

-- Movimientos de cuenta: cargos (+) y pagos (−) por cliente / envío.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id               INTEGER PRIMARY KEY,
  customer_id      INTEGER REFERENCES customers(id),
  shipment_id      INTEGER REFERENCES shipments(id),
  branch_id        INTEGER REFERENCES branches(id),
  type             TEXT NOT NULL CHECK (type IN ('charge','payment','adjustment')),
  amount_cents     INTEGER NOT NULL,
  method           TEXT,             -- efectivo, transferencia, cuenta corriente…
  note             TEXT,
  user_id          INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Contrarreembolsos: cobrado por el transportista/sucursal y luego rendido al cliente.
CREATE TABLE IF NOT EXISTS cod_collections (
  id               INTEGER PRIMARY KEY,
  shipment_id      INTEGER NOT NULL UNIQUE REFERENCES shipments(id),
  amount_cents     INTEGER NOT NULL,
  collected_by     INTEGER REFERENCES users(id),
  collected_at     TEXT,
  settled_at       TEXT,             -- rendido al cliente
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','collected','settled'))
);

-- ───────────────────────── Atención al cliente ─────────────────────────

CREATE TABLE IF NOT EXISTS contact_requests (
  id               INTEGER PRIMARY KEY,
  type             TEXT NOT NULL CHECK (type IN ('contact','claim','quote')),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  tracking_code    TEXT,
  message          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Cola de notificaciones por email (el envío real lo hace un worker / proveedor SMTP).
CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY,
  channel          TEXT NOT NULL DEFAULT 'email',
  recipient        TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  shipment_id      INTEGER REFERENCES shipments(id),
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────── Integraciones ─────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id               INTEGER PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  name             TEXT NOT NULL,
  prefix           TEXT NOT NULL,       -- primeros caracteres visibles
  key_hash         TEXT NOT NULL UNIQUE,
  active           INTEGER NOT NULL DEFAULT 1,
  last_used_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
  id               INTEGER PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  url              TEXT NOT NULL,
  secret           TEXT NOT NULL,
  events           TEXT NOT NULL DEFAULT 'shipment.status_changed',
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id               INTEGER PRIMARY KEY,
  webhook_id       INTEGER NOT NULL REFERENCES webhooks(id),
  event            TEXT NOT NULL,
  payload          TEXT NOT NULL,
  response_status  INTEGER,
  error            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────── Auditoría ─────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id),
  action           TEXT NOT NULL,          -- ej: shipment.create, user.update
  entity           TEXT,
  entity_id        INTEGER,
  data             TEXT,                   -- JSON
  ip               TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
