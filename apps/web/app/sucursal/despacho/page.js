'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { BranchPicker, useBranch } from '@/components/BranchContext';
import TripForm from '@/components/TripForm';
import TripList from '@/components/TripList';

export default function Despacho() {
  const { branchId } = useBranch();
  const [type, setType] = useState('transfer');
  const [key, setKey] = useState(0);
  if (!branchId) return null;
  return (
    <>
      <PageHead title="Despachos y repartos"><BranchPicker /></PageHead>
      <div className="stack">
        <div className="tabs">
          <button className={type === 'transfer' ? 'active' : ''} onClick={() => setType('transfer')}>Transferencia a otra sucursal</button>
          <button className={type === 'delivery' ? 'active' : ''} onClick={() => setType('delivery')}>Reparto a domicilio</button>
        </div>
        <TripForm key={`${type}-${branchId}`} fixedType={type} originBranchId={branchId} onCreated={() => setKey((k) => k + 1)} />
        <h2 style={{ marginTop: 8 }}>Viajes de la sucursal</h2>
        <TripList key={`${key}-${branchId}`} branchId={branchId} />
      </div>
    </>
  );
}
