'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { download } from '@/lib/api';
import { fmtMoney, fmtDateTime, STATUS_LABELS } from '@/lib/format';
import { StatusBadge, ErrorBox, Loading, Empty, useApi } from './ui';

// Listado de envíos con filtros. basePath: ruta al detalle (ej. /admin/envios).
export default function ShipmentList({ basePath, fixedFilters = {}, showExport = true }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [incidents, setIncidents] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const params = new URLSearchParams({ ...fixedFilters, limit, offset });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (incidents) params.set('incidents', 'true');
  const { data, error, loading } = useApi(`/shipments?${params}`);
  const exportParams = new URLSearchParams(params);
  exportParams.delete('limit'); exportParams.delete('offset');

  return (
    <div className="stack">
      <div className="row">
        <input style={{ maxWidth: 320 }} placeholder="Buscar código, remitente, destinatario…" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        <select style={{ maxWidth: 220 }} value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="checkbox"><input type="checkbox" checked={incidents} onChange={(e) => { setIncidents(e.target.checked); setOffset(0); }} /> Solo incidencias</label>
        <span className="spacer" />
        {showExport && <button className="btn ghost" onClick={() => download(`/shipments/export.csv?${exportParams}`, 'envios.csv')}>Exportar CSV</button>}
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data?.items.length === 0 ? <Empty>No hay envíos con esos filtros.</Empty> : data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Código</th><th>Estado</th><th>Origen → Destino</th><th>Remitente</th><th>Destinatario</th><th>Ubicación</th><th className="num">Precio</th><th>Actualizado</th></tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => router.push(`${basePath}/${s.tracking_code}`)}>
                    <td className="mono nowrap">{s.tracking_code}</td>
                    <td><StatusBadge status={s.status} label={s.status_label} /></td>
                    <td>{s.origin} → {s.destination}<div className="small muted">{s.service} · {s.delivery_type === 'home' ? 'domicilio' : 'sucursal'}</div></td>
                    <td>{s.sender_name}</td>
                    <td>{s.recipient_name}</td>
                    <td className="small">{s.current_branch ?? (['in_transit', 'out_for_delivery'].includes(s.status) ? 'En camino' : '—')}</td>
                    <td className="num nowrap">{fmtMoney(s.price_cents)}</td>
                    <td className="small nowrap">{fmtDateTime(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row between small muted">
            <span>{data.total} envíos</span>
            <div className="row">
              <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button>
              <button className="btn ghost sm" disabled={offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
