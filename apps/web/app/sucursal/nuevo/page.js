'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/AppShell';
import { BranchPicker, useBranch } from '@/components/BranchContext';
import ShipmentForm from '@/components/ShipmentForm';
import { api, openLabel } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { useLocalities } from '@/components/LocalitySelect';

export default function NuevoEnvio() {
  const { branchId, branch } = useBranch();
  const [created, setCreated] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const localities = useLocalities();
  // Origen por defecto: la localidad de la sucursal.
  const originId = localities.find((l) => branch && l.name === branch.city)?.id ?? null;

  async function submit(body) {
    const s = await api('/shipments', { method: 'POST', body: { ...body, branch_id: branchId } });
    setCreated(s);
    openLabel(s.tracking_code);
  }

  return (
    <>
      <PageHead title="Nuevo envío en mostrador"><BranchPicker /></PageHead>
      {created && (
        <div className="alert ok" style={{ marginBottom: 16 }}>
          <div className="row between">
            <span>Envío <strong className="mono">{created.tracking_code}</strong> generado y recibido en sucursal · {fmtMoney(created.price_cents)}</span>
            <span className="row">
              <button className="btn sm" onClick={() => openLabel(created.tracking_code)}>Reimprimir etiqueta</button>
              <Link className="btn ghost sm" href={`/sucursal/envios/${created.tracking_code}`}>Ver detalle</Link>
              <button className="btn ghost sm" onClick={() => { setCreated(null); setFormKey((k) => k + 1); }}>Cargar otro</button>
            </span>
          </div>
        </div>
      )}
      {branchId && localities.length > 0 && (
        <ShipmentForm key={`${formKey}-${branchId}`} initial={{ origin_locality_id: originId }} onSubmit={submit} submitLabel="Generar e imprimir etiqueta" />
      )}
    </>
  );
}
