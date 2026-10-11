import * as SQLite from 'expo-sqlite';

// Base local: cola de envío (outbox), eventos rechazados y caché de viajes para trabajar sin señal.
const db = SQLite.openDatabaseSync('4bahia-driver.db');
db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rejected (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, error TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export function enqueue(kind, payload) {
  db.runSync('INSERT INTO outbox (kind, payload, created_at) VALUES (?, ?, ?)', kind, JSON.stringify(payload), new Date().toISOString());
}

// Implementa la interfaz que espera syncEngine.
export const outboxStorage = {
  async pending(kind, limit) {
    const rows = await db.getAllAsync('SELECT id, payload FROM outbox WHERE kind = ? ORDER BY id LIMIT ?', kind, limit);
    return rows.map((r) => ({ id: r.id, payload: JSON.parse(r.payload) }));
  },
  async remove(ids) {
    if (!ids.length) return;
    await db.runAsync(`DELETE FROM outbox WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
  },
  async reject(id, error) {
    const row = await db.getFirstAsync('SELECT payload FROM outbox WHERE id = ?', id);
    if (row) await db.runAsync('INSERT OR REPLACE INTO rejected (id, payload, error, created_at) VALUES (?, ?, ?, ?)', id, row.payload, error, new Date().toISOString());
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
  },
  async count(kind) {
    const row = kind === 'rejected'
      ? await db.getFirstAsync('SELECT COUNT(*) AS n FROM rejected')
      : await db.getFirstAsync('SELECT COUNT(*) AS n FROM outbox WHERE kind = ?', kind);
    return row?.n ?? 0;
  },
};

export function listRejected() {
  return db.getAllSync('SELECT * FROM rejected ORDER BY id DESC').map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}
export function clearRejected() { db.runSync('DELETE FROM rejected'); }

// Eventos aún no enviados (para reflejar el estado local en pantalla).
export function pendingEvents() {
  return db.getAllSync("SELECT payload FROM outbox WHERE kind = 'event' ORDER BY id").map((r) => JSON.parse(r.payload));
}

export function cacheSet(key, value) {
  db.runSync('INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}
export function cacheGet(key) {
  const row = db.getFirstSync('SELECT value FROM cache WHERE key = ?', key);
  return row ? JSON.parse(row.value) : null;
}

// Al cerrar sesión se borra todo menos lo pendiente de enviar.
export function clearCache() { db.runSync('DELETE FROM cache'); }
