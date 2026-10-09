import { randomUUID } from 'expo-crypto';
import { api } from './api';
import { enqueue, outboxStorage } from './storage';
import { createSyncEngine, buildEvent } from './syncEngine';

const listeners = new Set();
export const onSyncChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const engine = createSyncEngine({
  storage: outboxStorage,
  send: (body) => api('/driver/sync', { method: 'POST', body, timeoutMs: 30000 }),
  onChange: (status) => listeners.forEach((fn) => fn(status)),
});

// Registra una acción del chofer: se guarda local y se intenta enviar enseguida.
export function recordEvent({ code, status, reason, note, proof, coords }) {
  const event = buildEvent({ id: randomUUID(), code, status, reason, note, proof, coords });
  enqueue('event', event);
  engine.flush();
  return event;
}
