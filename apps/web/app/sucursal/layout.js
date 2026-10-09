'use client';
import AppShell from '@/components/AppShell';
import { BranchProvider } from '@/components/BranchContext';

const NAV = [
  { items: [
    { href: '/sucursal', label: 'Pendientes' },
    { href: '/sucursal/escaner', label: 'Escáner (recepción)' },
    { href: '/sucursal/nuevo', label: 'Nuevo envío' },
    { href: '/sucursal/despacho', label: 'Despachos y repartos' },
    { href: '/sucursal/mostrador', label: 'Entrega en mostrador' },
    { href: '/sucursal/envios', label: 'Buscar envíos' },
  ] },
  { title: 'Superadmin', items: [{ href: '/admin', label: 'Volver al panel general', roles: ['superadmin'] }] },
];

export default function SucursalLayout({ children }) {
  return (
    <AppShell roles={['superadmin', 'branch_admin', 'operator']} nav={NAV}>
      <BranchProvider>{children}</BranchProvider>
    </AppShell>
  );
}
