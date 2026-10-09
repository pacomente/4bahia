import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#f6f6f4',
  surface: '#ffffff',
  border: '#e2e1dc',
  text: '#121212',
  text2: '#52514e',
  brand: '#12305a',
  accent: '#e2591f',
  good: '#006300',
  goodBg: '#e6f4e6',
  warn: '#8a5a00',
  warnBg: '#fdf3dc',
  bad: '#b22c2c',
  badBg: '#fbe9e9',
  info: '#1c5cab',
  infoBg: '#e7f0fb',
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.text2 },
  small: { fontSize: 13, color: colors.text2 },
  mono: { fontFamily: 'monospace', fontSize: 15, color: colors.text, letterSpacing: 0.5 },
  label: { fontSize: 13, color: colors.text2, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});

export const STATUS = {
  received: ['Recibido', 'neutral'],
  sorted: ['Clasificado', 'neutral'],
  in_transit: ['En viaje', 'info'],
  at_destination_branch: ['En sucursal destino', 'neutral'],
  out_for_delivery: ['En reparto', 'info'],
  ready_for_pickup: ['Listo para retirar', 'neutral'],
  delivered: ['Entregado', 'good'],
  failed_attempt: ['Visita fallida', 'warn'],
  delayed: ['Demorado', 'warn'],
  damaged: ['Dañado', 'bad'],
  rejected: ['Rechazado', 'bad'],
  lost: ['Extraviado', 'bad'],
  returned: ['Devuelto', 'warn'],
};

export const money = (cents) => `$ ${(cents / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
