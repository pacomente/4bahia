'use client';
import AppShell from '@/components/AppShell';
import { useApi, Loading, Empty } from '@/components/ui';

// Vista mínima: la operación del chofer se hace desde la app móvil (etapa 3).
function Viajes() {
  const { data, loading } = useApi('/driver/trips');
  if (loading) return <Loading />;
  return (
    <div className="stack">
      <h1>Mis viajes</h1>
      <div className="alert warn">Las entregas, el escaneo y el GPS se registran desde la app del transportista (en desarrollo).</div>
      {!data?.length ? <Empty>No tenés viajes asignados.</Empty> : data.map((t) => (
        <div key={t.id} className="card">
          <strong>{t.code}</strong> · {t.type === 'transfer' ? `Troncal ${t.origin_branch_name} → ${t.dest_branch_name}` : `Reparto desde ${t.origin_branch_name}`}
          <div className="small muted">{t.plate} · {t.shipments_count} paquetes · {t.status === 'in_progress' ? 'En curso' : 'Planificado'}</div>
        </div>
      ))}
    </div>
  );
}

export default function Chofer() {
  return <AppShell roles={['driver']} nav={[{ items: [{ href: '/chofer', label: 'Mis viajes' }] }]}><Viajes /></AppShell>;
}
