'use client';
import Link from 'next/link';
import { PageHead } from '@/components/AppShell';
import ShipmentList from '@/components/ShipmentList';

export default function MisEnvios() {
  return (
    <>
      <PageHead title="Mis envíos"><Link className="btn accent" href="/cliente/nuevo">Nuevo envío</Link></PageHead>
      <ShipmentList basePath="/cliente/envios" showExport={false} />
    </>
  );
}
