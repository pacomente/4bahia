'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import TripList from '@/components/TripList';
import TripForm from '@/components/TripForm';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { Field, ErrorBox, useApi, useSubmit } from '@/components/ui';

export default function Flota() {
  const [tab, setTab] = useState('trips');
  const [key, setKey] = useState(0);
  return (
    <>
      <PageHead title="Flota y viajes" sub="Vehículos, viajes troncales y repartos" />
      <div className="tabs">
        <button className={tab === 'trips' ? 'active' : ''} onClick={() => setTab('trips')}>Viajes</button>
        <button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>Nuevo viaje</button>
        <button className={tab === 'vehicles' ? 'active' : ''} onClick={() => setTab('vehicles')}>Vehículos</button>
      </div>
      {tab === 'trips' && <TripList key={key} />}
      {tab === 'new' && <TripForm onCreated={() => setKey((k) => k + 1)} />}
      {tab === 'vehicles' && <Vehicles />}
    </>
  );
}

function Vehicles() {
  const { data, error, reload } = useApi('/fleet/vehicles');
  const { data: branches } = useApi('/public/branches');
  const [f, setF] = useState({ plate: '', description: '', capacity_kg: '', branch_id: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const { run, busy, error: saveError } = useSubmit(async () => {
    await api('/fleet/vehicles', { method: 'POST', body: { ...f, capacity_kg: f.capacity_kg ? Number(f.capacity_kg) : undefined, branch_id: f.branch_id ? Number(f.branch_id) : undefined } });
    setF({ plate: '', description: '', capacity_kg: '', branch_id: '' });
    reload();
  });
  return (
    <div className="stack">
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Patente</th><th>Descripción</th><th className="num">Capacidad</th><th>Sucursal</th><th>GPS</th><th>Última posición</th></tr></thead>
          <tbody>
            {data?.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.plate}</td><td>{v.description}</td><td className="num">{v.capacity_kg ? `${v.capacity_kg} kg` : '—'}</td>
                <td>{branches?.find((b) => b.id === v.branch_id)?.code ?? '—'}</td>
                <td><span className={`badge ${v.connection === 'online' ? 'good' : v.connection === 'offline' ? 'critical' : ''}`}>{v.connection === 'online' ? 'En línea' : v.connection === 'offline' ? 'Sin señal' : 'Sin datos'}</span></td>
                <td className="small">{timeAgo(v.last_position_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <h3 style={{ margin: 0 }}>Agregar vehículo</h3>
        <div className="form-grid">
          <Field label="Patente"><input required value={f.plate} onChange={set('plate')} /></Field>
          <Field label="Descripción"><input value={f.description} onChange={set('description')} /></Field>
          <Field label="Capacidad (kg)"><input type="number" value={f.capacity_kg} onChange={set('capacity_kg')} /></Field>
          <Field label="Sucursal base">
            <select value={f.branch_id} onChange={set('branch_id')}><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
          </Field>
        </div>
        <ErrorBox error={saveError} />
        <div><button className="btn" disabled={busy}>Agregar</button></div>
      </form>
    </div>
  );
}
