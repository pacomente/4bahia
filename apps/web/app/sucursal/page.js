'use client';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/AppShell';
import { BranchPicker, useBranch } from '@/components/BranchContext';
import { Boxes, Send, PackageOpen, Clock, Truck } from 'lucide-react';
import { Kpi, StatusBadge, Loading, ErrorBox, Empty, useApi } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

export default function Pendientes() {
  const { branchId } = useBranch();
  const router = useRouter();
  const { data, error, loading } = useApi(branchId ? `/branches/${branchId}/ops/pending` : null, { interval: 30000 });
  return (
    <>
      <PageHead title="Pendientes de la sucursal" sub="Qué hay en el depósito y qué falta mover"><BranchPicker /></PageHead>
      {loading && <Loading />}
      <ErrorBox error={error} />
      {data && (
        <div className="stack">
          <div className="kpi-grid">
            <Kpi icon={Boxes} label="En sucursal" value={data.at_branch.length} />
            <Kpi icon={Send} label="Para despachar" value={data.to_dispatch} hint="Destino otra sucursal" />
            <Kpi icon={PackageOpen} label="Para entregar" value={data.to_deliver} hint="Reparto o mostrador" />
            <Kpi icon={Clock} label="Demorados" value={data.stale.length} hint="Más de 48 h sin movimiento" />
            <Kpi icon={Truck} label="Entrantes" value={data.inbound.length} hint="En viaje hacia acá" />
          </div>
          <div className="card">
            <h3>Paquetes en la sucursal</h3>
            {!data.at_branch.length ? <Empty>No hay paquetes pendientes.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Código</th><th>Estado</th><th>Destino</th><th>Destinatario</th><th>Entrega</th><th className="num">Horas sin movimiento</th></tr></thead>
                  <tbody>
                    {data.at_branch.map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => router.push(`/sucursal/envios/${s.tracking_code}`)}>
                        <td className="mono">{s.tracking_code}</td>
                        <td><StatusBadge status={s.status} label={s.status_label} /></td>
                        <td>{s.destination}{s.dest_branch_id === branchId ? '' : <span className="small muted"> (despachar)</span>}</td>
                        <td>{s.recipient_name}</td>
                        <td>{s.delivery_type === 'home' ? 'Domicilio' : 'Mostrador'}</td>
                        <td className="num" style={{ color: s.hours_idle >= 48 ? 'var(--warning-text)' : undefined }}>{s.hours_idle >= 48 ? '⚠ ' : ''}{s.hours_idle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {data.inbound.length > 0 && (
            <div className="card">
              <h3>Entrantes</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Código</th><th>Viaje</th><th>Vehículo</th><th>Salió</th></tr></thead>
                  <tbody>{data.inbound.map((s) => <tr key={s.tracking_code}><td className="mono">{s.tracking_code}</td><td>{s.trip_code}</td><td>{s.plate}</td><td>{fmtDateTime(s.started_at)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
