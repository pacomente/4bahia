'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useRequireRole } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';
import { Loading } from './ui';

// Layout de paneles internos: barra lateral + contenido, protegido por rol.
export default function AppShell({ roles, nav, children }) {
  const { user, ready } = useRequireRole(roles);
  const { logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  if (!ready) return <Loading />;

  const isActive = (href) => (href === nav[0]?.items?.[0]?.href ? pathname === href : pathname.startsWith(href));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="logo">4B</span> Expreso 4 Bahía</Link>
        {nav.map((group) => ({ ...group, items: group.items.filter((i) => !i.roles || i.roles.includes(user.role)) }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
          <div key={group.title ?? 'main'} style={{ display: 'contents' }}>
            {group.title && <div className="section">{group.title}</div>}
            {group.items.map((i) => (
              <Link key={i.href} href={i.href} className={isActive(i.href) ? 'active' : ''}>{i.label}</Link>
            ))}
          </div>
        ))}
        <div className="user">
          <div><strong>{user.name}</strong></div>
          <div>{ROLE_LABELS[user.role]}</div>
          <button className="btn ghost sm" style={{ marginTop: 8, color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}
            onClick={() => { logout(); router.push('/ingresar'); }}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function PageHead({ title, children }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}
