'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Field, ErrorBox, useApi, useSubmit } from './ui';

// Alta de viaje (troncal o reparto) con los códigos a cargar.
export default function TripForm({ originBranchId, onCreated, fixedType }) {
  const { data: vehicles } = useApi('/fleet/vehicles');
  const { data: drivers } = useApi('/fleet/drivers');
  const { data: branches } = useApi('/public/branches');
  const [f, setF] = useState({ type: fixedType ?? 'transfer', vehicle_id: '', driver_id: '', origin_branch_id: originBranchId ?? '', dest_branch_id: '', expected_minutes: '', codes: '' });
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const { run, busy, error } = useSubmit(async () => {
    const codes = f.codes.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    const r = await api('/fleet/trips', { method: 'POST', body: {
      type: f.type, vehicle_id: Number(f.vehicle_id), driver_id: Number(f.driver_id), origin_branch_id: Number(f.origin_branch_id),
      dest_branch_id: f.type === 'transfer' ? Number(f.dest_branch_id) : undefined,
      expected_minutes: f.expected_minutes ? Number(f.expected_minutes) : undefined, codes,
    } });
    setResult(r);
    setF((p) => ({ ...p, codes: '' }));
    onCreated?.(r);
  });

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
      <h3 style={{ margin: 0 }}>{f.type === 'transfer' ? 'Nuevo viaje troncal' : 'Nuevo reparto'}</h3>
      <div className="form-grid">
        {!fixedType && (
          <Field label="Tipo">
            <select value={f.type} onChange={set('type')}><option value="transfer">Troncal (entre sucursales)</option><option value="delivery">Reparto a domicilio</option></select>
          </Field>
        )}
        {!originBranchId && (
          <Field label="Sucursal de salida">
            <select required value={f.origin_branch_id} onChange={set('origin_branch_id')}>
              <option value="">Elegí…</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
          </Field>
        )}
        {f.type === 'transfer' && (
          <Field label="Sucursal de destino">
            <select required value={f.dest_branch_id} onChange={set('dest_branch_id')}>
              <option value="">Elegí…</option>
              {branches?.filter((b) => String(b.id) !== String(f.origin_branch_id)).map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Vehículo">
          <select required value={f.vehicle_id} onChange={set('vehicle_id')}>
            <option value="">Elegí…</option>
            {vehicles?.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.description}</option>)}
          </select>
        </Field>
        <Field label="Chofer">
          <select required value={f.driver_id} onChange={set('driver_id')}>
            <option value="">Elegí…</option>
            {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}{d.branch_code ? ` (${d.branch_code})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Duración prevista (min)" hint="Para alertas de demora"><input type="number" min="1" value={f.expected_minutes} onChange={set('expected_minutes')} /></Field>
      </div>
      <Field label="Códigos a cargar" hint="Escaneá uno por línea o pegalos separados por espacios">
        <textarea className="mono" value={f.codes} onChange={set('codes')} />
      </Field>
      <ErrorBox error={error} />
      {result && (
        <div className={`alert ${result.assigned.every((a) => a.ok) ? 'ok' : 'warn'}`}>
          Viaje {result.trip.code} creado. {result.assigned.filter((a) => a.ok).length} paquetes asignados.
          {result.assigned.filter((a) => !a.ok).map((a) => <div key={a.code} className="small">{a.code}: {a.error}</div>)}
        </div>
      )}
      <div><button className="btn accent" disabled={busy}>Crear viaje</button></div>
    </form>
  );
}
