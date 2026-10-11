import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usePoll, useAsync } from '../lib/hooks';
import { fmtMoney, initials } from '../lib/format';
import { Rating, ErrorMsg } from '../components/ui';
import { adminApi, PageHead } from './AdminApp';

const STATUS = { available: ['Libre', 'good'], busy: ['En viaje', 'brand'], offline: ['Desconectado', ''] };

export default function Drivers() {
  const { data, refresh } = usePoll(() => adminApi('/admin/drivers'), 4000);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const patch = async (id, body) => { await adminApi(`/admin/drivers/${id}`, { method: 'PATCH', body }); refresh(); };
  const list = (data ?? []).filter((d) => !q || `${d.name} ${d.plate} ${d.unit_number}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Conductores" sub="Flota, documentación y estado en tiempo real">
        <button className="btn brand" onClick={() => setAdding(!adding)}><UserPlus size={16} /> Agregar conductor</button>
      </PageHead>
      {adding && <NewDriver onDone={() => { setAdding(false); refresh(); }} />}
      <div className="toolbar"><input placeholder="Buscar por nombre, patente o móvil" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Conductor</th><th>Vehículo</th><th>Estado</th><th className="num">Calificación</th><th className="num">Viajes 7 d</th><th className="num">Facturado 7 d</th><th>Licencia</th><th>Aprobado</th><th>Activo</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td><div className="row"><span className="avatar sm">{initials(d.name)}</span><div><div className="bold">{d.name}</div><div className="xs muted">{d.phone} {d.is_bot ? '· simulado' : '· app real'}</div></div></div></td>
                <td><div>{d.brand} {d.model} <span className="xs muted">({d.category})</span></div><div className="xs"><span className="plate">{d.plate}</span> · móvil {d.unit_number}</div></td>
                <td>
                  <span className={`badge ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                  {d.status !== 'busy' && d.approved && d.active ? <button className="btn sm ghost" style={{ marginLeft: 6 }} onClick={() => patch(d.id, { status: d.status === 'offline' ? 'available' : 'offline' })}>{d.status === 'offline' ? 'Conectar' : 'Desconectar'}</button> : null}
                </td>
                <td className="num"><Rating value={d.rating} /></td>
                <td className="num">{d.trips_week}</td>
                <td className="num">{fmtMoney(d.revenue_week_cents)}</td>
                <td className="small">{d.license_number}<div className="xs muted">vence {d.license_expires ?? '—'}</div></td>
                <td><button className={`switch ${d.approved ? 'on' : ''}`} aria-label="Aprobado" onClick={() => patch(d.id, { approved: !d.approved })} /></td>
                <td><button className={`switch ${d.active ? 'on' : ''}`} aria-label="Activo" onClick={() => patch(d.id, { active: !d.active })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NewDriver({ onDone }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', brand: '', model: '', color: 'Negro y amarillo', plate: '', year: 2022, category: 'taxi', unit_number: '', license_number: '', license_expires: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = useAsync(async () => { await adminApi('/admin/drivers', { method: 'POST', body: { ...f, year: Number(f.year) } }); onDone(); });
  return (
    <form className="card stack" style={{ marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); save.run(); }}>
      <h3 style={{ margin: 0 }}>Nuevo conductor</h3>
      <div className="form-grid">
        <label className="field">Nombre y apellido<input required value={f.name} onChange={set('name')} /></label>
        <label className="field">Email (usuario)<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label className="field">Teléfono<input value={f.phone} onChange={set('phone')} /></label>
        <label className="field">Contraseña inicial<input value={f.password} onChange={set('password')} placeholder="Por defecto, la de la demo" /></label>
        <label className="field">Licencia<input value={f.license_number} onChange={set('license_number')} /></label>
        <label className="field">Vencimiento<input type="date" value={f.license_expires} onChange={set('license_expires')} /></label>
      </div>
      <div className="form-grid">
        <label className="field">Marca<input required value={f.brand} onChange={set('brand')} /></label>
        <label className="field">Modelo<input required value={f.model} onChange={set('model')} /></label>
        <label className="field">Color<input value={f.color} onChange={set('color')} /></label>
        <label className="field">Patente<input required value={f.plate} onChange={set('plate')} style={{ textTransform: 'uppercase' }} /></label>
        <label className="field">Año<input type="number" value={f.year} onChange={set('year')} /></label>
        <label className="field">N° de móvil<input value={f.unit_number} onChange={set('unit_number')} /></label>
        <label className="field">Categoría<select value={f.category} onChange={set('category')}><option value="taxi">Taxi</option><option value="ejecutivo">Ejecutivo</option><option value="xl">XL</option></select></label>
      </div>
      <ErrorMsg error={save.error} />
      <div><button className="btn" disabled={save.busy}>Guardar conductor</button></div>
    </form>
  );
}
