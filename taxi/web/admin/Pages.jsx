import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePoll, useAsync } from '../lib/hooks';
import { fmtMoney, fmtDateTime, initials } from '../lib/format';
import { Rating, ErrorMsg } from '../components/ui';
import { adminApi, PageHead } from './AdminApp';

export function Riders() {
  const { data, refresh } = usePoll(() => adminApi('/admin/riders'), 8000);
  return (
    <>
      <PageHead title="Pasajeros" sub="Usuarios registrados en la app" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Pasajero</th><th>Contacto</th><th className="num">Viajes</th><th className="num">Gastado</th><th className="num">Calificación</th><th>Último viaje</th><th>Activo</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id}>
                <td><div className="row"><span className="avatar sm">{initials(r.name)}</span><span className="bold">{r.name}</span></div></td>
                <td className="small">{r.email}<div className="xs muted">{r.phone}</div></td>
                <td className="num">{r.trips}</td><td className="num">{fmtMoney(r.spent_cents)}</td><td className="num"><Rating value={r.rating} /></td>
                <td className="small">{fmtDateTime(r.last_trip)}</td>
                <td><button className={`switch ${r.active ? 'on' : ''}`} aria-label="Activo" onClick={async () => { await adminApi(`/admin/riders/${r.id}`, { method: 'PATCH', body: { active: !r.active } }); refresh(); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Settlements() {
  const { data } = usePoll(() => adminApi('/admin/settlements'), 10000);
  const totals = (data ?? []).reduce((a, r) => ({ gross: a.gross + r.gross_cents, com: a.com + r.commission_cents, cash: a.cash + r.cash_cents }), { gross: 0, com: 0, cash: 0 });
  return (
    <>
      <PageHead title="Liquidaciones" sub="Últimos 7 días: lo que facturó cada conductor y la comisión de la empresa" />
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card"><div className="small muted bold">Facturado</div><div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{fmtMoney(totals.gross)}</div></div>
        <div className="card"><div className="small muted bold">Comisión empresa</div><div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{fmtMoney(totals.com)}</div></div>
        <div className="card"><div className="small muted bold">Cobrado en efectivo por conductores</div><div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{fmtMoney(totals.cash)}</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Conductor</th><th>Móvil</th><th className="num">Viajes</th><th className="num">Facturado</th><th className="num">Efectivo</th><th className="num">Digital</th><th className="num">Comisión</th><th className="num">Propinas</th><th className="num">Saldo</th></tr></thead>
          <tbody>
            {data?.map((r) => {
              // Saldo: lo digital lo cobra la empresa (le debe al conductor); el efectivo lo tiene el conductor (debe la comisión).
              const balance = r.digital_cents - r.commission_cents + r.tips_cents;
              return (
                <tr key={r.id}>
                  <td className="bold">{r.name}</td><td>{r.unit_number}</td><td className="num">{r.trips}</td><td className="num">{fmtMoney(r.gross_cents)}</td>
                  <td className="num">{fmtMoney(r.cash_cents)}</td><td className="num">{fmtMoney(r.digital_cents)}</td><td className="num">{fmtMoney(r.commission_cents)}</td><td className="num">{fmtMoney(r.tips_cents)}</td>
                  <td className="num bold" style={{ color: balance >= 0 ? 'var(--good-text)' : 'var(--bad-text)' }}>{balance >= 0 ? 'A pagar ' : 'A cobrar '}{fmtMoney(Math.abs(balance))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>Saldo = pagos digitales cobrados por la empresa − comisión + propinas. Positivo: la empresa le paga al conductor; negativo: el conductor rinde la comisión del efectivo.</p>
    </>
  );
}

export function Tariffs({ canEdit }) {
  const { data, refresh } = usePoll(() => adminApi('/admin/tariffs'), 0);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <>
      <PageHead title="Tarifas" sub="Bajada de bandera, precio por kilómetro y por minuto de cada categoría" />
      <div className="grid2">{data?.map((t) => <TariffCard key={t.category} t={t} canEdit={canEdit} onSaved={refresh} />)}</div>
    </>
  );
}

function TariffCard({ t, canEdit, onSaved }) {
  const toPesos = (c) => c / 100;
  const [f, setF] = useState({ base: toPesos(t.base_cents), km: toPesos(t.per_km_cents), min: toPesos(t.per_min_cents), minimum: toPesos(t.minimum_cents), active: !!t.active });
  const [ok, setOk] = useState(false);
  const save = useAsync(async () => {
    await adminApi(`/admin/tariffs/${t.category}`, { method: 'PUT', body: { base_cents: Math.round(f.base * 100), per_km_cents: Math.round(f.km * 100), per_min_cents: Math.round(f.min * 100), minimum_cents: Math.round(f.minimum * 100), active: f.active ? 1 : 0 } });
    setOk(true); setTimeout(() => setOk(false), 2000); onSaved();
  });
  const example = Math.max(f.minimum, f.base + 5 * f.km + 15 * f.min);
  const n = (k) => ({ type: 'number', min: 0, step: 10, value: f[k], disabled: !canEdit, onChange: (e) => setF({ ...f, [k]: Number(e.target.value) }) });
  return (
    <div className="card stack">
      <div className="row between"><h3 style={{ margin: 0 }}>{t.name}</h3><button className={`switch ${f.active ? 'on' : ''}`} disabled={!canEdit} aria-label="Activa" onClick={() => setF({ ...f, active: !f.active })} /></div>
      <div className="small muted">{t.description} · {t.seats} pasajeros</div>
      <div className="form-grid">
        <label className="field">Bajada de bandera ($)<input {...n('base')} /></label>
        <label className="field">Por km ($)<input {...n('km')} /></label>
        <label className="field">Por minuto ($)<input {...n('min')} /></label>
        <label className="field">Tarifa mínima ($)<input {...n('minimum')} /></label>
      </div>
      <div className="small" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>Ejemplo 5 km / 15 min: <b>{fmtMoney(example * 100)}</b></div>
      <ErrorMsg error={save.error} />
      {canEdit && <button className="btn" disabled={save.busy} onClick={() => save.run()}>{ok ? 'Guardado ✓' : 'Guardar'}</button>}
    </div>
  );
}

export function Promos({ canEdit }) {
  const { data, refresh } = usePoll(() => adminApi('/admin/promos'), 8000);
  const [f, setF] = useState({ code: '', description: '', pct: 10, max: '' });
  const add = useAsync(async () => { await adminApi('/admin/promos', { method: 'POST', body: { code: f.code, description: f.description, pct: Number(f.pct), max_cents: f.max ? Math.round(Number(f.max) * 100) : null } }); setF({ code: '', description: '', pct: 10, max: '' }); refresh(); });
  return (
    <>
      <PageHead title="Promociones" sub="Códigos de descuento para los pasajeros" />
      <div className="split">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Descripción</th><th className="num">Descuento</th><th className="num">Tope</th><th className="num">Usos</th><th>Activa</th></tr></thead>
            <tbody>{data?.map((p) => (
              <tr key={p.code}><td className="bold mono">{p.code}</td><td>{p.description}</td><td className="num">{p.pct}%</td><td className="num">{p.max_cents ? fmtMoney(p.max_cents) : '—'}</td><td className="num">{p.uses}</td>
                <td><button className={`switch ${p.active ? 'on' : ''}`} disabled={!canEdit} aria-label="Activa" onClick={async () => { await adminApi(`/admin/promos/${p.code}`, { method: 'PATCH', body: { active: !p.active } }); refresh(); }} /></td></tr>
            ))}</tbody>
          </table>
        </div>
        {canEdit && (
          <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.run(); }}>
            <h3 style={{ margin: 0 }}>Nueva promoción</h3>
            <label className="field">Código<input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
            <label className="field">Descripción<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <div className="form-grid">
              <label className="field">Descuento (%)<input type="number" min="1" max="100" required value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} /></label>
              <label className="field">Tope ($)<input type="number" min="0" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label>
            </div>
            <ErrorMsg error={add.error} />
            <button className="btn" disabled={add.busy}><Plus size={16} /> Crear</button>
          </form>
        )}
      </div>
    </>
  );
}

export function Settings({ canEdit }) {
  const [f, setF] = useState(null);
  const [ok, setOk] = useState(false);
  useEffect(() => { adminApi('/admin/settings').then(setF); }, []);
  const save = useAsync(async () => { setF(await adminApi('/admin/settings', { method: 'PUT', body: f })); setOk(true); setTimeout(() => setOk(false), 2000); });
  if (!f) return <div className="spinner" />;
  const num = (k, props = {}) => <input type="number" value={f[k]} disabled={!canEdit} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />;
  return (
    <>
      <PageHead title="Configuración" sub="Reglas del negocio y de la simulación de la demo" />
      <div className="grid2">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Negocio</h3>
          <label className="field">Comisión de la empresa (%){num('commission_pct', { min: 0, max: 100 })}</label>
          <div className="form-grid">
            <label className="field">Recargo nocturno (%){num('night_surcharge_pct', { min: 0 })}</label>
            <label className="field">Desde (hora){num('night_start', { min: 0, max: 23 })}</label>
            <label className="field">Hasta (hora){num('night_end', { min: 0, max: 23 })}</label>
          </div>
          <label className="field">Tarifa dinámica (multiplicador por alta demanda): <b>x{Number(f.surge_multiplier).toFixed(1)}</b>
            <input type="range" min="1" max="2.5" step="0.1" value={f.surge_multiplier} disabled={!canEdit} onChange={(e) => setF({ ...f, surge_multiplier: e.target.value })} style={{ padding: 0, background: 'none' }} />
          </label>
          <label className="field">Tiempo para aceptar un viaje (segundos){num('offer_timeout_s', { min: 5, max: 120 })}</label>
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Simulación de la demo</h3>
          <div className="row between"><span className="small bold">Conductores simulados circulando</span><button className={`switch ${Number(f.bots_enabled) ? 'on' : ''}`} disabled={!canEdit} aria-label="Conductores simulados" onClick={() => setF({ ...f, bots_enabled: Number(f.bots_enabled) ? 0 : 1 })} /></div>
          <label className="field">Velocidad de la simulación: <b>x{f.sim_speed}</b>
            <input type="range" min="1" max="10" step="1" value={f.sim_speed} disabled={!canEdit} onChange={(e) => setF({ ...f, sim_speed: e.target.value })} style={{ padding: 0, background: 'none' }} />
          </label>
          <label className="field">Demora de aceptación de los simulados (segundos){num('bot_accept_delay_s', { min: 0, max: 30 })}</label>
          <p className="small muted" style={{ margin: 0 }}>Con velocidad x3 un viaje de 5 km dura cerca de 4 minutos: ideal para mostrar el flujo completo en una reunión.</p>
        </div>
      </div>
      <ErrorMsg error={save.error} />
      {canEdit && <button className="btn lg" style={{ marginTop: 16 }} disabled={save.busy} onClick={() => save.run()}>{ok ? 'Guardado ✓' : 'Guardar configuración'}</button>}
    </>
  );
}
