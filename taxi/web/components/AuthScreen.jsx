import { useState } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { setToken, createApi } from '../lib/api';
import { useAsync, useConfig } from '../lib/hooks';
import { Logo, ErrorMsg } from './ui';

// Ingreso para las apps móviles. app: 'rider' | 'driver'
export default function AuthScreen({ app, onLogin }) {
  const cfg = useConfig();
  const api = createApi('public');
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const done = (r) => { setToken(app, r.token); onLogin(r.user); };
  const { run, busy, error } = useAsync(async (kind) => {
    if (kind === 'demo') return done(await api('/public/auth/demo', { method: 'POST', body: { role: app } }));
    if (mode === 'register') return done(await api('/public/auth/register', { method: 'POST', body: f }));
    return done(await api('/public/auth/login', { method: 'POST', body: { email: f.email, password: f.password, role: app } }));
  });
  const rider = app === 'rider';
  return (
    <div className="auth-screen">
      <Logo brand={cfg?.brand ?? 'Movi'} light />
      <div className="hero-art">
        <h1>{rider ? <>Tu viaje, <em>en minutos</em></> : <>Manejá y <em>ganá más</em></>}</h1>
        <p className="muted">{rider ? 'Pedí un taxi, seguilo en el mapa y pagá como quieras.' : 'Recibí viajes cerca tuyo, navegá y cobrá desde la app.'}</p>
      </div>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); run('form'); }}>
        {mode === 'register' && (
          <>
            <label className="field">Nombre<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
            <label className="field">Teléfono<input value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></label>
          </>
        )}
        <label className="field">Email<input type="email" required value={f.email} onChange={set('email')} autoComplete="username" /></label>
        <label className="field">Contraseña<input type="password" required value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        <ErrorMsg error={error} />
        <button className="btn brand lg block" disabled={busy}>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'} <ArrowRight size={18} /></button>
        {cfg?.quick_login && (
          <button type="button" className="btn ghost block" disabled={busy} onClick={() => run('demo')}>
            <Zap size={16} /> Entrar con la cuenta demo
          </button>
        )}
        {rider && (
          <button type="button" className="btn ghost block" style={{ background: 'transparent' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? '¿No tenés cuenta? Registrate' : 'Ya tengo cuenta'}
          </button>
        )}
      </form>
    </div>
  );
}
