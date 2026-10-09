'use client';
import AppShell from '@/components/AppShell';

const NAV = [{ items: [
  { href: '/cliente', label: 'Mis envíos' },
  { href: '/cliente/nuevo', label: 'Nuevo envío' },
  { href: '/cliente/cuenta', label: 'Cuenta corriente' },
  { href: '/cliente/integraciones', label: 'Integraciones (API)' },
] }];

export default function ClienteLayout({ children }) {
  return <AppShell roles={['customer']} nav={NAV}>{children}</AppShell>;
}
