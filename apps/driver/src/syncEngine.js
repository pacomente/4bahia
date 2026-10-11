// Motor de sincronización offline. JS puro (sin React Native) para poder testearlo con node:test.
//
// Toda acción del chofer (entrega, visita fallida, incidencia) y toda posición GPS se guarda
// primero en una cola local ("outbox") y después se envía a POST /driver/sync.
// - Cada evento lleva client_event_id: el servidor ignora duplicados, así que reenviar es seguro.
// - Si no hay red, la cola queda intacta y se reintenta en el próximo flush.
// - Si el servidor rechaza un evento (ej. transición inválida), no tiene sentido reintentarlo:
//   se mueve a "rechazados" para mostrárselo al chofer.

export const MAX_EVENTS_PER_SYNC = 50;
export const MAX_POSITIONS_PER_SYNC = 500;

/**
 * storage: {
 *   pending(kind, limit) -> [{ id, payload }]     (más viejos primero)
 *   remove(ids)
 *   reject(id, error)                              (mueve un evento a rechazados)
 *   count(kind) -> number
 * }
 * send(body) -> respuesta de /driver/sync. Lanza si no hay red o el servidor falla.
 */
export function createSyncEngine({ storage, send, onChange = () => {} }) {
  let running = null;
  let lastSyncAt = null;
  let lastError = null;

  async function flushOnce() {
    const events = await storage.pending('event', MAX_EVENTS_PER_SYNC);
    const positions = await storage.pending('position', MAX_POSITIONS_PER_SYNC);
    if (!events.length && !positions.length) return { sent: 0, more: false };

    const res = await send({
      events: events.map((e) => e.payload),
      positions: positions.map((p) => p.payload),
    });

    // Las posiciones se aceptan en bloque (las inválidas el servidor las descarta).
    const done = positions.map((p) => p.id);
    const byClientId = new Map((res.results ?? []).map((r) => [r.client_event_id, r]));
    for (const e of events) {
      const r = byClientId.get(e.payload.client_event_id);
      if (!r) continue;                         // sin respuesta para ese evento: se reintenta
      if (r.ok) done.push(e.id);
      else await storage.reject(e.id, r.error ?? 'Rechazado por el servidor');
    }
    await storage.remove(done);
    return {
      sent: events.length + positions.length,
      more: events.length === MAX_EVENTS_PER_SYNC || positions.length === MAX_POSITIONS_PER_SYNC,
    };
  }

  // Vacía la cola en tandas. Llamadas concurrentes comparten la misma ejecución.
  async function flush() {
    if (running) return running;
    running = (async () => {
      try {
        let total = 0;
        for (let i = 0; i < 20; i++) {
          const { sent, more } = await flushOnce();
          total += sent;
          if (!more) break;
        }
        lastSyncAt = new Date().toISOString();
        lastError = null;
        return { ok: true, sent: total };
      } catch (err) {
        lastError = err?.message ?? String(err);
        return { ok: false, error: lastError };
      } finally {
        running = null;
        onChange(await status());
      }
    })();
    return running;
  }

  async function status() {
    return {
      pendingEvents: await storage.count('event'),
      pendingPositions: await storage.count('position'),
      rejected: await storage.count('rejected'),
      lastSyncAt,
      lastError,
    };
  }

  return { flush, status };
}

// Arma un evento listo para encolar.
export function buildEvent({ id, code, status, reason, note, proof, coords, now = new Date() }) {
  return {
    client_event_id: id,
    code,
    status,
    reason: reason || undefined,
    note: note || undefined,
    proof: proof || undefined,
    lat: coords?.latitude,
    lng: coords?.longitude,
    occurred_at: now.toISOString(),
  };
}

// Convierte una lectura de expo-location al formato de la API.
export function toPosition(loc) {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speed_kmh: loc.coords.speed != null && loc.coords.speed >= 0 ? Math.round(loc.coords.speed * 3.6) : null,
    heading: loc.coords.heading ?? null,
    accuracy_m: loc.coords.accuracy ?? null,
    recorded_at: new Date(loc.timestamp).toISOString(),
  };
}
