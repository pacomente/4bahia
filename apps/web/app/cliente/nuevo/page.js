'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/AppShell';
import ShipmentForm from '@/components/ShipmentForm';
import { api, openLabel } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NuevoEnvioCliente() {
  const { user } = useAuth();
  const [created, setCreated] = useState(null);
  if (created) {
    return (
      <>
        <PageHead title="Envío generado" />
        <div className="card stack" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0 }}>Tu código de seguimiento es <strong className="mono">{created.tracking_code}</strong>.</p>
          <p className="muted" style={{ margin: 0 }}>Imprimí la etiqueta, pegala en el paquete y llevalo a la sucursal de origen. El precio se confirma al pesarlo.</p>
          <div className="row">
            <button className="btn accent" onClick={() => openLabel(created.tracking_code)}>Imprimir etiqueta</button>
            <Link className="btn ghost" href={`/cliente/envios/${created.tracking_code}`}>Ver envío</Link>
            <button className="btn ghost" onClick={() => setCreated(null)}>Cargar otro</button>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Nuevo envío" />
      <ShipmentForm
        initial={{ sender_name: user?.name ?? '' }}
        quotePath="/v1/quotes"
        onSubmit={async (body) => setCreated(await api('/shipments', { method: 'POST', body }))}
      />
    </>
  );
}
