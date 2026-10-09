'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <>
      <section className="hero" id="seguimiento">
        <div className="container">
          <h1>Tus encomiendas, seguidas de punta a punta</h1>
          <p>Envíos entre sucursales y a domicilio en Bahía Blanca, el sudoeste bonaerense y todo el país. Consultá el estado de tu envío con el código de seguimiento.</p>
          <form className="track-box" onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/seguimiento/${code.trim().toUpperCase()}`); }}>
            <input aria-label="Código de seguimiento" placeholder="Código de seguimiento (ej. 4B1234567890)" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn accent lg">Seguir envío</button>
          </form>
        </div>
      </section>
      <section className="container" style={{ marginTop: 32 }}>
        <div className="grid grid-3">
          <div className="card">
            <h3>Cotizá al instante</h3>
            <p className="muted">Precio por origen, destino, peso y medidas. Con seguro y contrarreembolso.</p>
            <Link className="btn" href="/cotizar">Cotizar envío</Link>
          </div>
          <div className="card">
            <h3>Clientes comerciales</h3>
            <p className="muted">Cuenta corriente, tarifas especiales, historial de envíos y conexión con tu tienda online.</p>
            <Link className="btn" href="/ingresar">Ingresar o registrarme</Link>
          </div>
          <div className="card">
            <h3>Sucursales</h3>
            <p className="muted">Despachá o retirá tus paquetes en la sucursal más cercana.</p>
            <Link className="btn" href="/sucursales">Ver sucursales</Link>
          </div>
        </div>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          {[
            ['Puerta a puerta', 'Retiramos y entregamos a domicilio donde hay cobertura.'],
            ['Entre sucursales', 'La opción más económica: despachás y retirás en mostrador.'],
            ['Express', 'Prioridad en la carga troncal para llegar antes.'],
            ['Contrarreembolso', 'Cobramos al destinatario y te rendimos el importe.'],
          ].map(([t, d]) => (
            <div key={t} className="card"><h3>{t}</h3><p className="small muted" style={{ margin: 0 }}>{d}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
