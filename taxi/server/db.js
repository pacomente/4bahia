import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('admin','operator','driver','rider')),
  name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, password_hash TEXT,
  rating REAL NOT NULL DEFAULT 5, ratings_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY, brand TEXT NOT NULL, model TEXT NOT NULL, color TEXT, plate TEXT NOT NULL UNIQUE,
  year INTEGER, category TEXT NOT NULL, unit_number TEXT
);
CREATE TABLE IF NOT EXISTS drivers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id), vehicle_id INTEGER REFERENCES vehicles(id),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','available','busy')),
  lat REAL, lng REAL, heading REAL, last_seen TEXT,
  approved INTEGER NOT NULL DEFAULT 1, is_bot INTEGER NOT NULL DEFAULT 0,
  simulate INTEGER NOT NULL DEFAULT 1,        -- 1: el servidor mueve el auto (demo); 0: usa el GPS del celular
  license_number TEXT, license_expires TEXT, docs_status TEXT NOT NULL DEFAULT 'ok'
);
CREATE TABLE IF NOT EXISTS tariffs (
  category TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, seats INTEGER NOT NULL DEFAULT 4,
  base_cents INTEGER NOT NULL, per_km_cents INTEGER NOT NULL, per_min_cents INTEGER NOT NULL,
  minimum_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS promos (
  code TEXT PRIMARY KEY, description TEXT, pct INTEGER NOT NULL, max_cents INTEGER, active INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','central')),
  rider_id INTEGER REFERENCES users(id), rider_name TEXT, rider_phone TEXT,
  driver_id INTEGER REFERENCES users(id), category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('searching','accepted','arrived','in_progress','completed','cancelled','no_drivers')),
  origin_lat REAL NOT NULL, origin_lng REAL NOT NULL, origin_address TEXT NOT NULL,
  dest_lat REAL NOT NULL, dest_lng REAL NOT NULL, dest_address TEXT NOT NULL,
  route TEXT, pickup_route TEXT, distance_m INTEGER NOT NULL, duration_s INTEGER NOT NULL,
  fare_estimate_cents INTEGER NOT NULL, fare_breakdown TEXT NOT NULL, fare_final_cents INTEGER,
  discount_cents INTEGER NOT NULL DEFAULT 0, promo_code TEXT, tip_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER, payment_method TEXT NOT NULL DEFAULT 'cash',
  rating_for_driver INTEGER, rating_for_rider INTEGER, rider_comment TEXT,
  cancel_reason TEXT, cancelled_by TEXT, share_token TEXT NOT NULL, notes TEXT,
  requested_at TEXT NOT NULL, accepted_at TEXT, arrived_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_rider ON trips(rider_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE TABLE IF NOT EXISTS trip_offers (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id), driver_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  distance_m INTEGER, offered_at TEXT NOT NULL, expires_at TEXT NOT NULL, responded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_offers_driver ON trip_offers(driver_id, status);
CREATE TABLE IF NOT EXISTS trip_events (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id), type TEXT NOT NULL, note TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL REFERENCES trips(id), sender TEXT NOT NULL CHECK (sender IN ('rider','driver')),
  text TEXT NOT NULL, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export function openDb(path = config.dbPath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

export const now = () => new Date().toISOString();

export function getSetting(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) && row.value.trim() !== '' ? n : row.value;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
