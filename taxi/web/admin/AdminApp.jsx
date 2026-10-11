import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map as MapIcon, PhoneCall, ListOrdered, IdCard, Users, Wallet, Tags, TicketPercent, Settings as SettingsIcon, LogOut, Menu, Zap,
} from 'lucide-react';
import { createApi, getToken, setToken } from '../lib/api';
import { useAsync, useConfig } from '../lib/hooks';
import { initials } from '../lib/format';
import { Logo, ErrorMsg } from '../components/ui';
import Dashboard from './Dashboard';
import LiveMap from './LiveMap';
import Central from './Central';
import Trips from './Trips';
import Drivers from './Drivers';
import { Riders, Settlements, Tariffs, Promos, Settings } from './Pages';

export const adminApi = createApi('admin');

const NAV = [
  { title: null, items: [['/admin', 'Panel', LayoutDashboard], ['/admin/mapa', 'Mapa en vivo', MapIcon], ['/admin/central', 'Central telefónica', PhoneCall]] },
  { title: 'Operación', items: [['/admin/viajes', 'Viajes', ListOrdered], ['/admin/conductores', 'Conductores', IdCard], ['/admin/pasajeros', 'Pasajeros', Users]] },
  { title: 'Negocio', items: [['/admin/liquidaciones', 'Liquidaciones', Wallet], ['/admin/tarifas', 'Tarifas', Tags], ['/admin/promociones', 'Promociones', TicketPercent], ['/admin/configuracion', 'Configuración', SettingsIcon]] },
];

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!getToken('admin')) { setChecked(true); return; }
    adminApi('/me').then((u) => (['admin', 'operator'].includes(u.role) ? setUser(u) : setToken('admin', null))).catch(() => {}).finally(() => setChecked(true));
  }, []);
  if (!checked) return null;
  return <div className="admin">{user ? <Shell user={user} onLogout={() => { setToken('admin', null); setUser(null); }} /> : <AdminLogin onLogin={setUser} />}</div>;
}

function Shell({ user, onLogout }) {
  const cfg = useConfig();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="admin-shell">
      <div className="admin-top">
        <Logo brand={cfg?.brand} light />
        <button className="icon-btn flat" style={{ background: '#222', color: '#fff' }} aria-label="Menú" onClick={() => setOpen(true)}><Menu size={18} /></button>
      </div>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <Logo brand={cfg?.brand} light />
        {NAV.map((g) => (
          <div key={g.title ?? 'main'} style={{ display: 'contents' }}>
            {g.title && <div className="section">{g.title}</div>}
            {g.items.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `nav ${isActive ? 'active' : ''}`}><Icon size={18} /> {label}</NavLink>
            ))}
          </div>
        ))}
        <div className="me">
          <span className="avatar sm">{initials(user.name)}</span>
          <div className="grow" style={{ fontSize: '.82rem', lineHeight: 1.3 }}><div className="bold ellipsis" style={{ color: '#fff' }}>{user.name}</div><div style={{ color: '#8a8984' }}>{user.role === 'admin' ? 'Administrador' : 'Operador'}</div></div>
          <button className="icon-btn flat" style={{ background: '#1d1d1c', color: '#fff', width: 36, height: 36 }} title="Cerrar sesión" aria-label="Cerrar sesión" onClick={onLogout}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="mapa" element={<LiveMap />} />
          <Route path="central" element={<Central />} />
          <Route path="viajes" element={<Trips />} />
          <Route path="conductores" element={<Drivers />} />
          <Route path="pasajeros" element={<Riders />} />
          <Route path="liquidaciones" element={<Settlements />} />
          <Route path="tarifas" element={<Tariffs canEdit={user.role === 'admin'} />} />
          <Route path="promociones" element={<Promos canEdit={user.role === 'admin'} />} />
          <Route path="configuracion" element={<Settings canEdit={user.role === 'admin'} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const cfg = useConfig();
  const api = createApi('public');
  const [f, setF] = useState({ email: '', password: '' });
  const done = (r) => { setToken('admin', r.token); onLogin(r.user); };
  const { run, busy, error } = useAsync(async (demo) => done(demo
    ? await api('/public/auth/demo', { method: 'POST', body: { role: demo } })
    : await api('/public/auth/login', { method: 'POST', body: { ...f, role: 'admin' } })));
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
      <div style={{ background: '#111', color: '#fff', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <Logo brand={cfg?.brand} light />
        <div>
          <h1 style={{ fontSize: '2.6rem', color: '#fff', letterSpacing: '-.04em' }}>Tu flota, <span style={{ color: 'var(--brand)' }}>en tiempo real</span></h1>
          <p style={{ color: '#a9a8a2', maxWidth: 420 }}>Mapa en vivo, central telefónica, viajes, conductores, tarifas y liquidaciones en un solo panel.</p>
        </div>
        <span style={{ color: '#6f6e69', fontSize: '.85rem' }}>Panel de administración · demo</span>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <form className="stack" style={{ width: '100%', maxWidth: 380 }} onSubmit={(e) => { e.preventDefault(); run(null); }}>
          <h2>Ingresar al panel</h2>
          <label className="field">Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field">Contraseña<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          <ErrorMsg error={error} />
          <button className="btn lg block" disabled={busy}>Ingresar</button>
          {cfg?.quick_login && (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn ghost grow" disabled={busy} onClick={() => run('admin')}><Zap size={16} /> Demo administrador</button>
              <button type="button" className="btn ghost grow" disabled={busy} onClick={() => run('operator')}><PhoneCall size={16} /> Demo central</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

export function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="card kpi">
      <span className="ic"><Icon size={20} /></span>
      <div style={{ minWidth: 0 }}><div className="label">{label}</div><div className="value">{value}</div>{hint && <div className="hint">{hint}</div>}</div>
    </div>
  );
}
