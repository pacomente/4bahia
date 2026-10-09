'use client';
import AppShell from '@/components/AppShell';

const NAV = [
  { items: [{ href: '/admin', label: 'Panel de control' }, { href: '/admin/mapa', label: 'Mapa en vivo' }] },
  { title: 'Operación', items: [
    { href: '/admin/envios', label: 'Envíos' },
    { href: '/admin/flota', label: 'Flota y viajes' },
    { href: '/admin/reclamos', label: 'Contacto y reclamos' },
    { href: '/sucursal', label: 'Ir a panel de sucursal' },
  ] },
  { title: 'Administración', items: [
    { href: '/admin/finanzas', label: 'Finanzas' },
    { href: '/admin/tarifas', label: 'Tarifas y servicios' },
    { href: '/admin/catalogo', label: 'Sucursales y clientes' },
    { href: '/admin/usuarios', label: 'Usuarios' },
    { href: '/admin/auditoria', label: 'Auditoría' },
  ] },
];

export default function AdminLayout({ children }) {
  return <AppShell roles={['superadmin']} nav={NAV}>{children}</AppShell>;
}
