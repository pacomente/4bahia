'use client';
import { PageHead } from '@/components/AppShell';
import ShipmentList from '@/components/ShipmentList';

export default function Envios() {
  return (
    <>
      <PageHead title="Envíos" sub="Buscá, filtrá y exportá todos los envíos de la red" />
      <ShipmentList basePath="/admin/envios" />
    </>
  );
}
