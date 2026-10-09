'use client';
import { PageHead } from '@/components/AppShell';
import ShipmentList from '@/components/ShipmentList';

export default function Envios() {
  return (
    <>
      <PageHead title="Envíos" />
      <ShipmentList basePath="/admin/envios" />
    </>
  );
}
