'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useAuth, useRequireRole } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';
import Logo from './Logo';
import { Loading } from './ui';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// Layout de paneles internos: barra lateral + contenido, protegido por rol.
export default function AppShell({ roles, nav, children }) {
  const { user, ready } = useRequireRole(roles);
  const { logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  if (!ready) return <Loading />;

  const first = nav[0]?.items?.[0]?.href;
  const isActive = (href) => (href === first ? pathname === href : pathname.startsWith(href));
  const groups = nav
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(user.role)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="app-shell">
      <div className="topbar">
        <Logo compact />
        <button className="icon-btn" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={18} /></button>
      </div>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Logo />
        {groups.map((group) => (
          <div key={group.title ?? 'main'} style={{ display: 'contents' }}>
            {group.title && <div className="section">{group.title}</div>}
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`nav-link ${isActive(href) ? 'active' : ''}`}>
                {Icon && <Icon size={18} />} {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="user">
          <span className="avatar">{initials(user.name)}</span>
          <div className="who"><strong>{user.name}</strong><span>{ROLE_LABELS[user.role]}</span></div>
          <button className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { logout(); router.push('/ingresar'); }}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}
