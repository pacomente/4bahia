const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
export const fmtMoney = (cents) => (cents == null ? '—' : money.format(cents / 100));
export const fmtKg = (grams) => (grams == null ? '—' : `${(grams / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR'));

export function timeAgo(iso) {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

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

// Tono visual por estado (siempre acompañado del texto, nunca solo color).
export function statusTone(status) {
  if (status === 'delivered') return 'good';
  if (['damaged', 'lost', 'rejected', 'cancelled'].includes(status)) return 'critical';
  if (['delayed', 'failed_attempt', 'returned'].includes(status)) return 'warning';
  if (['in_transit', 'out_for_delivery'].includes(status)) return 'info';
  return '';
}

export const ROLE_LABELS = {
  superadmin: 'Superadmin',
  branch_admin: 'Admin de sucursal',
  operator: 'Operador',
  driver: 'Transportista',
  customer: 'Cliente',
};

export const INCIDENT_REASONS = {
  delayed: ['Demora en carga troncal', 'Condiciones climáticas', 'Falla mecánica', 'Corte de ruta', 'Otro'],
  damaged: ['Embalaje roto', 'Mercadería golpeada', 'Humedad', 'Otro'],
  lost: ['No localizado en sucursal', 'Faltante en viaje', 'Otro'],
  rejected: ['Rechazado por destinatario', 'Mercadería dañada', 'Otro'],
  failed_attempt: ['Destinatario ausente', 'Domicilio incorrecto', 'Domicilio inaccesible', 'Fuera de horario', 'Otro'],
  returned: ['Rechazado', 'No retirado en plazo', 'Pedido del remitente', 'Otro'],
  cancelled: ['Pedido del cliente', 'Error de carga', 'Otro'],
};
