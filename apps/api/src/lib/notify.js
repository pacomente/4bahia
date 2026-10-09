import { createHmac } from 'node:crypto';
import { config } from '../config.js';
import { STATUS_LABELS } from './statuses.js';

// Encola emails de cambio de estado (un worker / proveedor SMTP los despacha).
export function queueStatusEmail(db, shipment, status) {
  const label = STATUS_LABELS[status] ?? status;
  const link = `${config.publicBaseUrl}/seguimiento/${shipment.tracking_code}`;
  const recipients = new Set([shipment.sender_email, shipment.recipient_email].filter(Boolean));
  for (const to of recipients) {
    db.prepare('INSERT INTO notifications (recipient, subject, body, shipment_id) VALUES (?, ?, ?, ?)').run(
      to,
      `Tu envío ${shipment.tracking_code}: ${label}`,
      `Tu envío ${shipment.tracking_code} cambió a "${label}". Seguilo en ${link}`,
      shipment.id,
    );
  }
}

export const signPayload = (secret, body) => createHmac('sha256', secret).update(body).digest('hex');

// Dispara webhooks del cliente dueño del envío. No bloquea la respuesta HTTP.
export function dispatchWebhooks(db, shipment, event, data) {
  if (!shipment.customer_id) return;
  const hooks = db.prepare('SELECT * FROM webhooks WHERE customer_id = ? AND active = 1').all(shipment.customer_id);
  for (const hook of hooks) {
    if (!hook.events.split(',').map((e) => e.trim()).includes(event)) continue;
    const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data });
    const log = (status, error) => db.prepare(
      'INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, error) VALUES (?, ?, ?, ?, ?)',
    ).run(hook.id, event, body, status ?? null, error ?? null);

    if (!config.webhooksEnabled) { log(null, 'disabled'); continue; }
    fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-4Bahia-Signature': signPayload(hook.secret, body), 'X-4Bahia-Event': event },
      body,
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => log(r.status))
      .catch((e) => log(null, e.message));
  }
}
