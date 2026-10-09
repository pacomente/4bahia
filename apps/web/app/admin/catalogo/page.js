'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import CrudTable from '@/components/CrudTable';
import { useApi } from '@/components/ui';

export default function Catalogo() {
  const [tab, setTab] = useState('branches');
  const { data: zones } = useApi('/catalog/zones');
  const { data: branches } = useApi('/catalog/branches');
  const zoneOpts = zones?.map((z) => ({ value: z.id, label: z.code })) ?? [];
  const branchOpts = branches?.map((b) => ({ value: b.id, label: b.code })) ?? [];
  return (
    <>
      <PageHead title="Sucursales, localidades y clientes" sub="Cobertura de la red y clientes comerciales" />
      <div className="tabs">
        {[['branches', 'Sucursales'], ['localities', 'Localidades'], ['customers', 'Clientes']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'branches' && <CrudTable endpoint="/catalog/branches" columns={[
        { key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' }, { key: 'address', label: 'Dirección' },
        { key: 'city', label: 'Ciudad' }, { key: 'province', label: 'Provincia' }, { key: 'phone', label: 'Teléfono' },
        { key: 'lat', label: 'Latitud', type: 'number' }, { key: 'lng', label: 'Longitud', type: 'number' },
        { key: 'active', label: 'Activa', type: 'bool' },
      ]} defaults={{ active: true }} />}
      {tab === 'localities' && zones && branches && <CrudTable endpoint="/catalog/localities" columns={[
        { key: 'name', label: 'Localidad' }, { key: 'province', label: 'Provincia' }, { key: 'postal_code', label: 'CP' },
        { key: 'zone_id', label: 'Zona', type: 'select', options: zoneOpts },
        { key: 'branch_id', label: 'Sucursal', type: 'select', options: branchOpts },
        { key: 'home_delivery', label: 'Reparto a domicilio', type: 'bool' },
      ]} defaults={{ home_delivery: true }} />}
      {tab === 'customers' && <CrudTable endpoint="/catalog/customers" columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'individual', label: 'Particular' }, { value: 'commercial', label: 'Comercial' }] },
        { key: 'tax_id', label: 'CUIT/DNI' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Teléfono' },
        { key: 'discount_pct', label: 'Descuento %', type: 'number' },
        { key: 'credit_limit_cents', label: 'Límite de crédito', type: 'money' },
        { key: 'active', label: 'Activo', type: 'bool' },
      ]} defaults={{ type: 'commercial', active: true }} />}
    </>
  );
}
