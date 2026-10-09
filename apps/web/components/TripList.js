'use client';
import { Fragment, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { ErrorBox, Loading, Empty, useApi, StatusBadge } from './ui';

const TRIP_STATUS = { planned: 'Planificado', in_progress: 'En curso', completed: 'Finalizado', cancelled: 'Cancelado' };

export default function TripList({ branchId }) {
  const [status, setStatus] = useState('');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (branchId) params.set('branch_id', branchId);
  const { data, error, loading, reload } = useApi(`/fleet/trips?${params}`);
  const [open, setOpen] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function act(id, action) {
    setActionError(null);
    try { await api(`/fleet/trips/${id}/${action}`, { method: 'POST' }); reload(); } catch (e) { setActionError(e); }
  }

  return (
    <div className="stack">
      <div className="row">
        <select style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(TRIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <ErrorBox error={error ?? actionError} />
      {loading && !data ? <Loading /> : !data?.length ? <Empty>No hay viajes.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Viaje</th><th>Tipo</th><th>Estado</th><th>Recorrido</th><th>Vehículo</th><th>Chofer</th><th className="num">Paquetes</th><th>Inicio</th><th /></tr></thead>
            <tbody>
              {data.map((t) => (
                <Fragment key={t.id}>
                  <tr>
                    <td className="mono">{t.code}</td>
                    <td>{t.type === 'transfer' ? 'Troncal' : 'Reparto'}</td>
                    <td><span className={`badge ${t.status === 'in_progress' ? 'info' : t.status === 'completed' ? 'good' : ''}`}>{TRIP_STATUS[t.status]}</span></td>
                    <td>{t.origin_branch}{t.dest_branch ? ` → ${t.dest_branch}` : ' (última milla)'}</td>
                    <td>{t.plate}</td>
                    <td>{t.driver_name}</td>
                    <td className="num">{t.shipments_count}</td>
                    <td className="small nowrap">{fmtDateTime(t.started_at)}</td>
                    <td className="nowrap">
                      <button className="btn ghost sm" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Ocultar' : 'Ver'}</button>{' '}
                      {t.status === 'planned' && <button className="btn sm" onClick={() => act(t.id, 'start')}>Iniciar</button>}
                      {t.status === 'in_progress' && <button className="btn sm" onClick={() => act(t.id, 'finish')}>Finalizar</button>}
                    </td>
                  </tr>
                  {open === t.id && <tr key={`d${t.id}`}><td colSpan={9}><TripDetail id={t.id} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TripDetail({ id }) {
  const { data } = useApi(`/fleet/trips/${id}`);
  if (!data) return <span className="small muted">Cargando…</span>;
  if (!data.shipments.length) return <span className="small muted">Sin paquetes asignados.</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {data.shipments.map((s) => (
        <li key={s.id} className="small"><span className="mono">{s.tracking_code}</span> · <StatusBadge status={s.status} /> · {s.recipient_name} · {s.destination}</li>
      ))}
    </ul>
  );
}
