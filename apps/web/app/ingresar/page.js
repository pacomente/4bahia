'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PackageSearch, Wallet, Plug, Truck } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '@/lib/auth';
import { Field, ErrorBox, useSubmit } from '@/components/ui';
import Logo from '@/components/Logo';

export default function Ingresar() {
  const [tab, setTab] = useState('login');
  const { login, register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '', tax_id: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const { run, busy, error } = useSubmit(async () => {
    const user = tab === 'login' ? await login(f.email, f.password) : await register(f);
    router.push(HOME_BY_ROLE[user.role] ?? '/');
  });

  return (
    <div className="auth">
      <aside className="auth-aside">
        <Logo />
        <div>
          <h2>Toda tu logística en un solo lugar</h2>
          <ul>
            <li><span className="ic"><PackageSearch size={18} /></span> Seguimiento de cada envío, en tiempo real</li>
            <li><span className="ic"><Wallet size={18} /></span> Cuenta corriente y tarifas para comercios</li>
            <li><span className="ic"><Plug size={18} /></span> Conexión con tu tienda online por API</li>
            <li><span className="ic"><Truck size={18} /></span> Flota con GPS y entregas con comprobante</li>
          </ul>
        </div>
        <span style={{ opacity: .75, fontSize: '.85rem' }}>© {new Date().getFullYear()} Expreso 4 Bahía</span>
      </aside>
      <main className="auth-main">
        <div className="auth-card stack" style={{ gap: 20 }}>
          <Link href="/" className="row small" style={{ gap: 6, color: 'var(--text-2)' }}><ArrowLeft size={16} /> Volver al sitio</Link>
          <div>
            <h1 style={{ margin: '0 0 6px' }}>{tab === 'login' ? 'Bienvenido' : 'Creá tu cuenta'}</h1>
            <p className="muted" style={{ margin: 0 }}>{tab === 'login' ? 'Ingresá con tu email para acceder a tu panel.' : 'Para comercios y particulares que envían seguido.'}</p>
          </div>
          <div className="tabs" style={{ width: '100%', marginBottom: 0 }}>
            <button style={{ flex: 1 }} className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Ingresar</button>
            <button style={{ flex: 1 }} className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Crear cuenta</button>
          </div>
          <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); run(); }}>
            {tab === 'register' && (
              <>
                <Field label="Nombre o razón social"><input required value={f.name} onChange={set('name')} /></Field>
                <div className="form-grid">
                  <Field label="CUIT / DNI"><input value={f.tax_id} onChange={set('tax_id')} /></Field>
                  <Field label="Teléfono"><input value={f.phone} onChange={set('phone')} /></Field>
                </div>
              </>
            )}
            <Field label="Email"><input type="email" required autoComplete="username" value={f.email} onChange={set('email')} placeholder="nombre@empresa.com" /></Field>
            <Field label="Contraseña" hint={tab === 'register' ? 'Mínimo 8 caracteres' : null}>
              <input type="password" required minLength={tab === 'register' ? 8 : undefined} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
            </Field>
            <ErrorBox error={error} />
            <button className="btn lg" disabled={busy}>{busy ? 'Ingresando…' : tab === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
          </form>
          <div className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>Usuarios de demostración</div>
            <div className="small muted">
              <span className="mono">admin@4bahia.test</span> · <span className="mono">bhi.operador@4bahia.test</span> · <span className="mono">cliente@tiendademo.test</span>
              {/* La contraseña solo se muestra en desarrollo; en la demo pública la define DEMO_PASSWORD en la API. */}
              {process.env.NODE_ENV === 'development' && <> — contraseña <span className="mono">Demo1234!</span></>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
