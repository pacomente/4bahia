// Ciclo de vida de un envío y transiciones permitidas.

export const STATUS = {
  CREATED: 'created',                     // generado (web, API o mostrador), aún no ingresó
  RECEIVED: 'received',                   // recibido en sucursal de origen
  SORTED: 'sorted',                       // clasificado por destino
  IN_TRANSIT: 'in_transit',               // en viaje troncal entre sucursales
  AT_DEST_BRANCH: 'at_destination_branch',// recepción confirmada en sucursal destino
  OUT_FOR_DELIVERY: 'out_for_delivery',   // en reparto a domicilio
  READY_FOR_PICKUP: 'ready_for_pickup',   // disponible para retiro en mostrador
  DELIVERED: 'delivered',
  FAILED_ATTEMPT: 'failed_attempt',       // visita fallida
  DELAYED: 'delayed',
  DAMAGED: 'damaged',
  LOST: 'lost',
  REJECTED: 'rejected',                   // rechazado por destinatario
  RETURNED: 'returned',                   // devuelto al remitente
  CANCELLED: 'cancelled',
};

export const STATUS_LABELS = {
  created: 'Envío generado',
  received: 'Recibido en sucursal',
  sorted: 'Clasificado',
  in_transit: 'En viaje',
  at_destination_branch: 'En sucursal de destino',
  out_for_delivery: 'En reparto',
  ready_for_pickup: 'Listo para retirar',
  delivered: 'Entregado',
  failed_attempt: 'Visita fallida',
  delayed: 'Demorado',
  damaged: 'Dañado',
  lost: 'Extraviado',
  rejected: 'Rechazado',
  returned: 'Devuelto al remitente',
  cancelled: 'Cancelado',
};

export const FINAL_STATUSES = ['delivered', 'returned', 'cancelled', 'lost'];
export const INCIDENT_STATUSES = ['failed_attempt', 'delayed', 'damaged', 'lost', 'rejected'];

const S = STATUS;
const TRANSITIONS = {
  [S.CREATED]: [S.RECEIVED, S.CANCELLED],
  [S.RECEIVED]: [S.SORTED, S.IN_TRANSIT, S.READY_FOR_PICKUP, S.OUT_FOR_DELIVERY],
  [S.SORTED]: [S.IN_TRANSIT, S.READY_FOR_PICKUP, S.OUT_FOR_DELIVERY],
  [S.IN_TRANSIT]: [S.AT_DEST_BRANCH, S.RECEIVED],  // RECEIVED = escala en sucursal intermedia
  [S.AT_DEST_BRANCH]: [S.OUT_FOR_DELIVERY, S.READY_FOR_PICKUP, S.SORTED],
  [S.OUT_FOR_DELIVERY]: [S.DELIVERED, S.FAILED_ATTEMPT, S.REJECTED, S.AT_DEST_BRANCH],
  [S.READY_FOR_PICKUP]: [S.DELIVERED, S.OUT_FOR_DELIVERY, S.RETURNED],
  [S.FAILED_ATTEMPT]: [S.OUT_FOR_DELIVERY, S.AT_DEST_BRANCH, S.READY_FOR_PICKUP, S.RETURNED],
  [S.REJECTED]: [S.AT_DEST_BRANCH, S.RETURNED],
  [S.DELAYED]: [S.IN_TRANSIT, S.AT_DEST_BRANCH, S.OUT_FOR_DELIVERY, S.READY_FOR_PICKUP, S.RECEIVED, S.SORTED],
  [S.DAMAGED]: [S.RECEIVED, S.SORTED, S.IN_TRANSIT, S.AT_DEST_BRANCH, S.OUT_FOR_DELIVERY, S.READY_FOR_PICKUP, S.RETURNED],
  [S.LOST]: [S.RECEIVED, S.AT_DEST_BRANCH],  // reaparición
  [S.DELIVERED]: [],
  [S.RETURNED]: [],
  [S.CANCELLED]: [],
};

// Las incidencias "demorado" y "dañado" pueden marcarse desde cualquier estado no final.
const ANYTIME = [S.DELAYED, S.DAMAGED, S.LOST];

export function canTransition(from, to) {
  if (from === to) return false;
  if (FINAL_STATUSES.includes(from) && from !== S.LOST) return false;
  if (ANYTIME.includes(to)) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export const ALL_STATUSES = Object.values(STATUS);
