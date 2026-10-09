'use client';
import { ClipboardList, ScanLine, PackagePlus, Truck, HandHelping, Search, LayoutDashboard } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { BranchProvider } from '@/components/BranchContext';

const NAV = [
  { items: [
    { href: '/sucursal', label: 'Pendientes', icon: ClipboardList },
    { href: '/sucursal/escaner', label: 'Escáner (recepción)', icon: ScanLine },
    { href: '/sucursal/nuevo', label: 'Nuevo envío', icon: PackagePlus },
    { href: '/sucursal/despacho', label: 'Despachos y repartos', icon: Truck },
    { href: '/sucursal/mostrador', label: 'Entrega en mostrador', icon: HandHelping },
    { href: '/sucursal/envios', label: 'Buscar envíos', icon: Search },
  ] },
  { title: 'Superadmin', items: [{ href: '/admin', label: 'Volver al panel general', roles: ['superadmin'], icon: LayoutDashboard }] },
];

export default function SucursalLayout({ children }) {
  return (
    <AppShell roles={['superadmin', 'branch_admin', 'operator']} nav={NAV}>
      <BranchProvider>{children}</BranchProvider>
    </AppShell>
  );
}
