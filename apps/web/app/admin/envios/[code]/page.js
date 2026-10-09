'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ShipmentDetail from '@/components/ShipmentDetail';

export default function EnvioDetalle() {
  const { code } = useParams();
  return (
    <div className="stack">
      <Link href="/admin/envios" className="small">← Envíos</Link>
      <ShipmentDetail code={code} />
    </div>
  );
}
