const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export const fmtMoney = (cents) => (cents == null ? '—' : money.format(Math.round(cents / 100)));
export const fmtKm = (m) => `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`;
export const fmtMin = (s) => `${Math.max(1, Math.round(s / 60))} min`;
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
export const PAYMENT = { cash: 'Efectivo', card: 'Tarjeta', mercadopago: 'Mercado Pago' };
export const STATUS = {
  searching: ['Buscando conductor', 'warn'], accepted: ['En camino al pasajero', 'info'], arrived: ['Conductor en el lugar', 'info'],
  in_progress: ['En viaje', 'brand'], completed: ['Finalizado', 'good'], cancelled: ['Cancelado', 'bad'], no_drivers: ['Sin conductores', 'bad'],
};
