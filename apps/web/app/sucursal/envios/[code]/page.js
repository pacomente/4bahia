'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ShipmentDetail from '@/components/ShipmentDetail';

export default function EnvioSucursal() {
  const { code } = useParams();
  return (
    <div className="stack">
      <Link href="/sucursal/envios" className="small">← Envíos</Link>
      <ShipmentDetail code={code} />
    </div>
  );
}
