'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { BranchPicker, useBranch } from '@/components/BranchContext';
import ScanStation from '@/components/ScanStation';

const MODES = [
  ['receive', 'Recibir', 'Ingreso desde mostrador, recepción de viajes troncales y devoluciones de reparto.'],
  ['sort', 'Clasificar', 'Marca los paquetes como clasificados por destino.'],
  ['ready-for-pickup', 'Listo para retirar', 'Avisa al destinatario que puede retirar en mostrador.'],
];

export default function Escaner() {
  const { branchId } = useBranch();
  const [mode, setMode] = useState('receive');
  const [batch, setBatch] = useState(false);
  const current = MODES.find((m) => m[0] === mode);
  return (
    <>
      <PageHead title="Escáner"><BranchPicker /></PageHead>
      <div className="tabs">
        {MODES.map(([k, l]) => <button key={k} className={mode === k ? 'active' : ''} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>{current[2]}</p>
        <label className="checkbox"><input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} /> Modo lote (acumular y procesar juntos)</label>
      </div>
      {branchId && <ScanStation key={`${mode}-${batch}-${branchId}`} endpoint={`/branches/${branchId}/ops/${mode}`} actionLabel={current[1]} immediate={!batch} />}
    </>
  );
}
