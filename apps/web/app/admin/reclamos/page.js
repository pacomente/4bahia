'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/AppShell';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useApi, Empty } from '@/components/ui';

const TYPES = { contact: 'Consulta', claim: 'Reclamo', quote: 'Cotización' };
const STATUSES = { open: 'Abierto', in_progress: 'En curso', closed: 'Cerrado' };

export default function Reclamos() {
  const [status, setStatus] = useState('');
  const { data, reload } = useApi(`/admin/requests${status ? `?status=${status}` : ''}`);
  const update = async (id, s) => { await api(`/admin/requests/${id}`, { method: 'PATCH', body: { status: s } }); reload(); };
  return (
    <>
      <PageHead title="Contacto y reclamos" sub="Mensajes recibidos desde la web">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageHead>
      {!data?.length ? <Empty>No hay mensajes.</Empty> : (
        <div className="stack">
          {data.map((r) => (
            <div key={r.id} className="card">
              <div className="row between">
                <div className="row">
                  <span className={`badge ${r.type === 'claim' ? 'warning' : 'info'}`}>{TYPES[r.type]}</span>
                  <strong>{r.name}</strong>
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone && <span className="small muted">{r.phone}</span>}
                </div>
                <div className="row">
                  <span className="small muted">{fmtDateTime(r.created_at)}</span>
                  <select value={r.status} onChange={(e) => update(r.id, e.target.value)} style={{ width: 'auto' }}>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              {r.tracking_code && <div className="small" style={{ marginTop: 6 }}>Envío: <Link className="mono" href={`/admin/envios/${r.tracking_code}`}>{r.tracking_code}</Link></div>}
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
