'use client';
import { PageHead } from '@/components/AppShell';
import ShipmentList from '@/components/ShipmentList';

export default function EnviosSucursal() {
  return (
    <>
      <PageHead title="Buscar envíos" />
      <ShipmentList basePath="/sucursal/envios" showExport={false} />
    </>
  );
}
