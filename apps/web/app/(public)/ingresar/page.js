'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, HOME_BY_ROLE } from '@/lib/auth';
import { Field, ErrorBox, useSubmit } from '@/components/ui';

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
    <div className="container" style={{ marginTop: 40, maxWidth: 440 }}>
      <div className="card">
        <div className="tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Ingresar</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Crear cuenta</button>
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
          {tab === 'register' && (
            <>
              <Field label="Nombre o razón social"><input required value={f.name} onChange={set('name')} /></Field>
              <Field label="CUIT / DNI"><input value={f.tax_id} onChange={set('tax_id')} /></Field>
              <Field label="Teléfono"><input value={f.phone} onChange={set('phone')} /></Field>
            </>
          )}
          <Field label="Email"><input type="email" required autoComplete="username" value={f.email} onChange={set('email')} /></Field>
          <Field label="Contraseña" hint={tab === 'register' ? 'Mínimo 8 caracteres' : null}>
            <input type="password" required minLength={tab === 'register' ? 8 : undefined} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
          </Field>
          <ErrorBox error={error} />
          <button className="btn accent lg" disabled={busy}>{tab === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        </form>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Demo: <span className="mono">admin@4bahia.test</span>, <span className="mono">bhi.operador@4bahia.test</span> o <span className="mono">cliente@tiendademo.test</span> — contraseña <span className="mono">Demo1234!</span>
      </p>
    </div>
  );
}
