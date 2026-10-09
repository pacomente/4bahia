'use client';
import { LayoutDashboard, Map as MapIcon, Package, Truck, MessageSquare, Store, Wallet, Tags, Building2, Users, ScrollText } from 'lucide-react';
import AppShell from '@/components/AppShell';

const NAV = [
  { items: [{ href: '/admin', label: 'Panel de control', icon: LayoutDashboard }, { href: '/admin/mapa', label: 'Mapa en vivo', icon: MapIcon }] },
  { title: 'Operación', items: [
    { href: '/admin/envios', label: 'Envíos', icon: Package },
    { href: '/admin/flota', label: 'Flota y viajes', icon: Truck },
    { href: '/admin/reclamos', label: 'Contacto y reclamos', icon: MessageSquare },
    { href: '/sucursal', label: 'Ir a panel de sucursal', icon: Store },
  ] },
  { title: 'Administración', items: [
    { href: '/admin/finanzas', label: 'Finanzas', icon: Wallet },
    { href: '/admin/tarifas', label: 'Tarifas y servicios', icon: Tags },
    { href: '/admin/catalogo', label: 'Sucursales y clientes', icon: Building2 },
    { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { href: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
  ] },
];

export default function AdminLayout({ children }) {
  return <AppShell roles={['superadmin']} nav={NAV}>{children}</AppShell>;
}
