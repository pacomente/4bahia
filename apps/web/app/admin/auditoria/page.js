'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { download } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useApi, Loading } from '@/components/ui';

export default function Auditoria() {
  const [entity, setEntity] = useState('');
  const [offset, setOffset] = useState(0);
  const qs = new URLSearchParams({ limit: 100, offset });
  if (entity) qs.set('entity', entity);
  const { data, loading } = useApi(`/admin/audit?${qs}`);
  return (
    <>
      <PageHead title="Auditoría">
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setOffset(0); }}>
          <option value="">Todas las entidades</option>
          {['shipment', 'user', 'trip', 'tariffs', 'pricing_settings', 'ledger_entry', 'api_key', 'branch', 'customer'].map((e) => <option key={e}>{e}</option>)}
        </select>
        <button className="btn ghost" onClick={() => download(`/admin/audit?format=csv&limit=500${entity ? `&entity=${entity}` : ''}`, 'auditoria.csv')}>Exportar CSV</button>
      </PageHead>
      {loading && !data ? <Loading /> : (
        <div className="stack">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
              <tbody>
                {data?.map((a) => (
                  <tr key={a.id}>
                    <td className="small nowrap">{fmtDateTime(a.created_at)}</td>
                    <td>{a.user_name ?? (a.user_id ? `#${a.user_id}` : 'Sistema / API')}</td>
                    <td className="mono small">{a.action}</td>
                    <td className="small">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                    <td className="small mono" style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>{a.data ? JSON.stringify(a.data).slice(0, 200) : ''}</td>
                    <td className="small">{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Anterior</button>
            <button className="btn ghost sm" disabled={(data?.length ?? 0) < 100} onClick={() => setOffset(offset + 100)}>Siguiente</button>
          </div>
        </div>
      )}
    </>
  );
}
