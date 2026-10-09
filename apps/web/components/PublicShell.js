'use client';
import Link from 'next/link';
import { useAuth, HOME_BY_ROLE } from '@/lib/auth';

export default function PublicShell({ children }) {
  const { user } = useAuth();
  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="brand"><span className="logo">4B</span> Expreso 4 Bahía</Link>
          <nav className="site-nav">
            <Link href="/#seguimiento">Seguimiento</Link>
            <Link href="/cotizar">Cotizar</Link>
            <Link href="/sucursales">Sucursales</Link>
            <Link href="/contacto">Contacto</Link>
          </nav>
          <span className="spacer" />
          {user
            ? <Link className="btn accent sm" href={HOME_BY_ROLE[user.role] ?? '/'}>Mi panel</Link>
            : <Link className="btn accent sm" href="/ingresar">Ingresar</Link>}
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container row between">
          <span>© {new Date().getFullYear()} Expreso 4 Bahía · Encomiendas y cargas</span>
          <span><Link href="/contacto">Reclamos</Link> · <Link href="/ingresar">Clientes comerciales</Link></span>
        </div>
      </footer>
    </>
  );
}
