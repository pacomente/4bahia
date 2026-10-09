import { forbidden } from './errors.js';
import { STAFF } from './auth.js';

// ¿Puede este usuario ver el envío?
export function assertCanViewShipment(db, user, shipment) {
  if (STAFF.includes(user.role)) return;
  if ((user.role === 'customer' || user.role === 'api') && user.customer_id && user.customer_id === shipment.customer_id) return;
  if (user.role === 'driver') {
    const assigned = db.prepare(`
      SELECT 1 FROM trip_shipments ts JOIN trips t ON t.id = ts.trip_id
      WHERE ts.shipment_id = ? AND t.driver_id = ? AND t.status IN ('planned','in_progress')
    `).get(shipment.id, user.id);
    if (assigned) return;
  }
  throw forbidden('Sin acceso a este envío');
}
