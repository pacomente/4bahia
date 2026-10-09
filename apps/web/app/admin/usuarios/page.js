'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { api } from '@/lib/api';
import { ROLE_LABELS, fmtDate } from '@/lib/format';
import { Field, ErrorBox, useApi, useSubmit } from '@/components/ui';

export default function Usuarios() {
  const [role, setRole] = useState('');
  const { data, error, reload } = useApi(`/users${role ? `?role=${role}` : ''}`);
  const { data: branches } = useApi('/public/branches');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'operator', branch_id: '', phone: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const { run, busy, error: saveError } = useSubmit(async () => {
    await api('/users', { method: 'POST', body: { ...f, branch_id: f.branch_id ? Number(f.branch_id) : undefined } });
    setF({ name: '', email: '', password: '', role: 'operator', branch_id: '', phone: '' });
    reload();
  });
  const toggle = async (u) => { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: u.active ? 0 : 1 } }); reload(); };

  return (
    <>
      <PageHead title="Usuarios">
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageHead>
      <div className="stack">
        <ErrorBox error={error} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Sucursal</th><th>Alta</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role]}</td><td>{u.branch_name ?? '—'}</td>
                  <td className="small">{fmtDate(u.created_at)}</td>
                  <td><span className={`badge ${u.active ? 'good' : ''}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td><button className="btn ghost sm" onClick={() => toggle(u)}>{u.active ? 'Desactivar' : 'Activar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <h3 style={{ margin: 0 }}>Nuevo usuario</h3>
          <div className="form-grid">
            <Field label="Nombre"><input required value={f.name} onChange={set('name')} /></Field>
            <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
            <Field label="Contraseña inicial"><input required minLength={8} value={f.password} onChange={set('password')} /></Field>
            <Field label="Teléfono"><input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Rol">
              <select value={f.role} onChange={set('role')}>
                {['superadmin', 'branch_admin', 'operator', 'driver'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            {f.role !== 'superadmin' && (
              <Field label="Sucursal">
                <select required value={f.branch_id} onChange={set('branch_id')}><option value="">Elegí…</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select>
              </Field>
            )}
          </div>
          <ErrorBox error={saveError} />
          <div><button className="btn" disabled={busy}>Crear usuario</button></div>
        </form>
      </div>
    </>
  );
}
