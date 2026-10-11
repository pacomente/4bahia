'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck, Calculator, ArrowRight, Home as HomeIcon, Building2, Zap, HandCoins, ShieldCheck, Plug,
  PackagePlus, ScanLine, Route, PackageCheck, Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtMoney, fmtDate } from '@/lib/format';
import LocalitySelect from '@/components/LocalitySelect';
import { useApi, ErrorBox } from '@/components/ui';

export default function Home() {
  const { data: branches } = useApi('/public/branches');
  const { data: localities } = useApi('/public/localities');
  const { data: services } = useApi('/public/services');
  return (
    <>
      <section className="hero" id="seguimiento">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <span className="eyebrow">Gestioná tus envíos</span>
          <h1>Tus encomiendas, seguidas <em>de punta a punta</em></h1>
          <p className="lead">Despachá, cotizá y seguí tus envíos en tiempo real. Desde Bahía Blanca a todo el país.</p>
          <TrackQuoteWidget />
        </div>
      </section>

      <section className="section" id="servicios" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Nuestros servicios</span>
            <h2>Soluciones y servicios a tu medida</h2>
            <p>Para particulares, comercios y empresas que necesitan mover mercadería con confianza.</p>
          </div>
          <div className="services-grid">
            {[
              [HomeIcon, 'Puerta a puerta', 'Retiramos y entregamos en domicilio en todas las localidades con cobertura.'],
              [Building2, 'Entre sucursales', 'La opción más económica: despachás y retirás en el mostrador más cercano.'],
              [Zap, 'Express', 'Prioridad en la carga troncal para que tu envío llegue antes.'],
              [HandCoins, 'Contrarreembolso', 'Cobramos al destinatario y te rendimos el importe en tu cuenta.'],
              [ShieldCheck, 'Seguro de carga', 'Declarás el valor y tu mercadería viaja asegurada.'],
              [Plug, 'Integración con tu tienda', 'Generá envíos y etiquetas desde tu sistema o tienda online por API.'],
            ].map(([Icon, t, d]) => (
              <div key={t} className="card service-card">
                <span className="icon-chip"><Icon size={22} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Cómo funciona</span>
            <h2>Enviar es simple</h2>
          </div>
          <div className="grid grid-4 steps-grid">
            {[
              [PackagePlus, 'Generá tu envío', 'Cotizá online o acercate a una sucursal con tu paquete.'],
              [ScanLine, 'Lo recibimos', 'Pesamos, etiquetamos y te damos el código de seguimiento.'],
              [Route, 'Viaja seguro', 'Seguí el recorrido en cada sucursal y en ruta.'],
              [PackageCheck, 'Se entrega', 'En domicilio o en mostrador, con comprobante firmado.'],
            ].map(([Icon, t, d]) => (
              <div key={t} className="card step-card">
                <span className="icon-chip" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text)' }}><Icon size={20} /></span>
                <h3 style={{ margin: '14px 0 6px' }}>{t}</h3>
                <p className="muted small" style={{ margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container">
        <div className="band">
          <div><div className="num">{branches?.length ?? '—'}<em>+</em></div><div className="lbl">Sucursales propias</div></div>
          <div><div className="num">{localities?.length ?? '—'}<em>+</em></div><div className="lbl">Localidades con cobertura</div></div>
          <div><div className="num">{services?.length ?? '—'}</div><div className="lbl">Servicios: estándar y express</div></div>
          <div><div className="num">100<em>%</em></div><div className="lbl">Envíos con seguimiento online</div></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta">
            <div>
              <h2>¿Tenés un comercio o tienda online?</h2>
              <p>Cuenta corriente, tarifas especiales, historial de envíos y conexión directa con tu sistema.</p>
            </div>
            <div className="row">
              <Link className="btn lg" href="/ingresar">Crear cuenta <ArrowRight size={18} /></Link>
              <Link className="btn lg ghost-light" href="/contacto?tipo=quote">Hablar con ventas</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TrackQuoteWidget() {
  const [tab, setTab] = useState('track');
  return (
    <div className="widget">
      <div className="widget-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'track'} className={`widget-tab ${tab === 'track' ? 'active' : ''}`} onClick={() => setTab('track')}>
          <Truck size={20} /> Seguí tu envío
        </button>
        <button role="tab" aria-selected={tab === 'quote'} className={`widget-tab ${tab === 'quote' ? 'active' : ''}`} onClick={() => setTab('quote')}>
          <Calculator size={20} /> Cotizá tu envío
        </button>
      </div>
      <div className="widget-body">{tab === 'track' ? <TrackForm /> : <QuickQuote />}</div>
    </div>
  );
}

function TrackForm() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/seguimiento/${code.trim().toUpperCase()}`); }}>
      <h2>Conocé el estado de tu envío</h2>
      <div className="widget-row">
        <div className="input-icon" style={{ flex: 1 }}>
          <Search size={18} />
          <input className="track-input" aria-label="Código de seguimiento" placeholder="Ingresá el número de seguimiento" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn lg">Rastrear <ArrowRight size={18} /></button>
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>El código empieza con 4B y figura en tu comprobante y en la etiqueta del paquete.</p>
    </form>
  );
}

function QuickQuote() {
  const [f, setF] = useState({ origin_locality_id: null, dest_locality_id: null, weight_kg: '', delivery_type: 'home' });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { setQuote(await api('/public/quotes', { method: 'POST', body: { ...f, weight_kg: Number(f.weight_kg) } })); } catch (err) { setError(err); setQuote(null); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <h2 style={{ margin: 0 }}>Calculá el costo de tu envío</h2>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <LocalitySelect required value={f.origin_locality_id} onChange={set('origin_locality_id')} placeholder="Origen" />
        <LocalitySelect required value={f.dest_locality_id} onChange={set('dest_locality_id')} placeholder="Destino" />
        <input type="number" min="0.1" step="0.1" required placeholder="Peso (kg)" value={f.weight_kg} onChange={set('weight_kg')} />
        <select value={f.delivery_type} onChange={set('delivery_type')}>
          <option value="home">A domicilio</option>
          <option value="branch">Retiro en sucursal</option>
        </select>
      </div>
      <ErrorBox error={error} />
      {quote ? (
        <div className="row between" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px' }}>
          <div>
            <div className="small muted">Precio estimado · llega aprox. {fmtDate(quote.estimated_delivery_at)}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.02em' }}>{fmtMoney(quote.total_cents)}</div>
          </div>
          <Link className="btn dark" href="/cotizar">Cotización detallada <ArrowRight size={16} /></Link>
        </div>
      ) : (
        <div><button className="btn lg" disabled={busy}>{busy ? 'Calculando…' : 'Cotizar'} <ArrowRight size={18} /></button></div>
      )}
    </form>
  );
}
