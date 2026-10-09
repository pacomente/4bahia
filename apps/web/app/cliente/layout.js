'use client';
import { Package, PackagePlus, Wallet, Plug } from 'lucide-react';
import AppShell from '@/components/AppShell';

const NAV = [{ items: [
  { href: '/cliente', label: 'Mis envíos', icon: Package },
  { href: '/cliente/nuevo', label: 'Nuevo envío', icon: PackagePlus },
  { href: '/cliente/cuenta', label: 'Cuenta corriente', icon: Wallet },
  { href: '/cliente/integraciones', label: 'Integraciones (API)', icon: Plug },
] }];

export default function ClienteLayout({ children }) {
  return <AppShell roles={['customer']} nav={NAV}>{children}</AppShell>;
}
