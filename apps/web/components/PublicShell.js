'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, PackageSearch, Calculator, MapPin, Phone, Mail } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '@/lib/auth';
import Logo from './Logo';

export default function PublicShell({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <div className="site-header-wrap">
        <div className="container">
          <header className="site-header">
            <Logo />
            <span className="spacer" />
            <nav className={`site-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
              <Link href="/#servicios">Servicios</Link>
              <Link href="/sucursales">Sucursales</Link>
              <Link href="/contacto">Soporte</Link>
              <Link href={user ? (HOME_BY_ROLE[user.role] ?? '/') : '/ingresar'}>{user ? 'Mi panel' : 'Ingresar'}</Link>
            </nav>
            <div className="site-actions">
              <Link className="btn hide-sm" href={pathname === '/' ? '#seguimiento' : '/#seguimiento'}><PackageSearch size={17} /> Seguí tu envío</Link>
              <Link className="btn outline hide-sm" href="/cotizar"><Calculator size={17} /> Cotizá tu envío</Link>
              <button className="icon-btn mobile-menu-btn" aria-label="Menú" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </header>
        </div>
      </div>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="stack" style={{ gap: 12 }}>
              <Logo />
              <p style={{ margin: 0, maxWidth: 320 }}>Encomiendas y cargas desde Bahía Blanca al sudoeste bonaerense, la Patagonia y todo el país.</p>
            </div>
            <div>
              <h4>Envíos</h4>
              <ul>
                <li><Link href="/#seguimiento">Seguimiento</Link></li>
                <li><Link href="/cotizar">Cotizador</Link></li>
                <li><Link href="/ingresar">Clientes comerciales</Link></li>
              </ul>
            </div>
            <div>
              <h4>Empresa</h4>
              <ul>
                <li><Link href="/sucursales">Sucursales</Link></li>
                <li><Link href="/#servicios">Servicios</Link></li>
                <li><Link href="/contacto?tipo=claim">Reclamos</Link></li>
              </ul>
            </div>
            <div>
              <h4>Contacto</h4>
              <ul>
                <li className="row" style={{ gap: 8 }}><MapPin size={15} /> Bahía Blanca, Buenos Aires</li>
                <li className="row" style={{ gap: 8 }}><Phone size={15} /> A confirmar</li>
                <li className="row" style={{ gap: 8 }}><Mail size={15} /> <Link href="/contacto">Escribinos</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Expreso 4 Bahía. Todos los derechos reservados.</span>
            <span>Plataforma logística · versión demo</span>
          </div>
        </div>
      </footer>
    </>
  );
}
