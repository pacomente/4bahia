'use client';
import { PageHead } from '@/components/AppShell';
import ShipmentList from '@/components/ShipmentList';

export default function EnviosSucursal() {
  return (
    <>
      <PageHead title="Buscar envíos" sub="Todos los envíos de la red" />
      <ShipmentList basePath="/sucursal/envios" showExport={false} />
    </>
  );
}
