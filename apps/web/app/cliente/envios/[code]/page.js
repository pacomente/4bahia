'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ShipmentDetail from '@/components/ShipmentDetail';

export default function EnvioCliente() {
  const { code } = useParams();
  return (
    <div className="stack">
      <Link href="/cliente" className="small">← Mis envíos</Link>
      <ShipmentDetail code={code} />
    </div>
  );
}
