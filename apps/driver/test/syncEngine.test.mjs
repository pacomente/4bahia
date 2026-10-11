import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncEngine, buildEvent, toPosition, MAX_POSITIONS_PER_SYNC } from '../src/syncEngine.js';

// Almacenamiento en memoria con la misma interfaz que el de SQLite.
function memoryStorage() {
  let seq = 0;
  const rows = [];
  const rejected = [];
  return {
    rows, rejected,
    add(kind, payload) { rows.push({ id: ++seq, kind, payload }); },
    async pending(kind, limit) { return rows.filter((r) => r.kind === kind).slice(0, limit); },
    async remove(ids) { for (const id of ids) { const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); } },
    async reject(id, error) { const i = rows.findIndex((r) => r.id === id); rejected.push({ ...rows[i], error }); rows.splice(i, 1); },
    async count(kind) { return kind === 'rejected' ? rejected.length : rows.filter((r) => r.kind === kind).length; },
  };
}

const ev = (id, status = 'delivered') => buildEvent({ id, code: '4B1', status, now: new Date('2026-01-01T10:00:00Z') });

test('sin red: la cola queda intacta y se informa el error', async () => {
  const storage = memoryStorage();
  storage.add('event', ev('a'));
  storage.add('position', { lat: 1, lng: 2 });
  const engine = createSyncEngine({ storage, send: async () => { throw new Error('Network request failed'); } });
  const r = await engine.flush();
  assert.equal(r.ok, false);
  const s = await engine.status();
  assert.equal(s.pendingEvents, 1);
  assert.equal(s.pendingPositions, 1);
  assert.equal(s.lastError, 'Network request failed');
});

test('con red: borra lo aceptado y mueve a rechazados lo que el servidor no acepta', async () => {
  const storage = memoryStorage();
  storage.add('event', ev('a'));
  storage.add('event', ev('b', 'failed_attempt'));
  storage.add('event', ev('c'));
  storage.add('position', { lat: 1, lng: 2 });
  let body;
  const engine = createSyncEngine({ storage, send: async (b) => {
    body = b;
    return { results: [
      { client_event_id: 'a', ok: true },
      { client_event_id: 'b', ok: false, error: 'Transición no permitida' },
      // 'c' sin respuesta: se reintenta
    ] };
  } });
  const r = await engine.flush();
  assert.equal(r.ok, true);
  assert.equal(body.events.length, 3);
  assert.equal(body.positions.length, 1);
  const s = await engine.status();
  assert.equal(s.pendingEvents, 1);
  assert.equal(storage.rows[0].payload.client_event_id, 'c');
  assert.equal(s.pendingPositions, 0);
  assert.equal(s.rejected, 1);
  assert.equal(storage.rejected[0].error, 'Transición no permitida');
});

test('envía en tandas cuando hay muchas posiciones acumuladas', async () => {
  const storage = memoryStorage();
  for (let i = 0; i < MAX_POSITIONS_PER_SYNC * 2 + 10; i++) storage.add('position', { lat: 0, lng: i / 1000 });
  let calls = 0;
  const engine = createSyncEngine({ storage, send: async () => { calls++; return { results: [] }; } });
  await engine.flush();
  assert.equal(calls, 3);
  assert.equal((await engine.status()).pendingPositions, 0);
});

test('flush concurrentes comparten una sola ejecución', async () => {
  const storage = memoryStorage();
  storage.add('event', ev('a'));
  let calls = 0;
  const engine = createSyncEngine({ storage, send: async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { results: [{ client_event_id: 'a', ok: true }] }; } });
  await Promise.all([engine.flush(), engine.flush(), engine.flush()]);
  assert.equal(calls, 1);
});

test('formatos de evento y posición', () => {
  const e = buildEvent({ id: 'x', code: '4B9', status: 'failed_attempt', reason: 'Destinatario ausente', coords: { latitude: -38.7, longitude: -62.2 }, now: new Date('2026-01-01T10:00:00Z') });
  assert.deepEqual(e, { client_event_id: 'x', code: '4B9', status: 'failed_attempt', reason: 'Destinatario ausente', note: undefined, proof: undefined, lat: -38.7, lng: -62.2, occurred_at: '2026-01-01T10:00:00.000Z' });
  const p = toPosition({ timestamp: Date.UTC(2026, 0, 1), coords: { latitude: 1, longitude: 2, speed: 25, heading: 90, accuracy: 8 } });
  assert.deepEqual(p, { lat: 1, lng: 2, speed_kmh: 90, heading: 90, accuracy_m: 8, recorded_at: '2026-01-01T00:00:00.000Z' });
  assert.equal(toPosition({ timestamp: 0, coords: { latitude: 1, longitude: 2, speed: -1 } }).speed_kmh, null);
});
