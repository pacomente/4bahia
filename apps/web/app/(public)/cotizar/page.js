'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import LocalitySelect from '@/components/LocalitySelect';
import QuoteBreakdown from '@/components/QuoteBreakdown';
import { Field, ErrorBox, useSubmit } from '@/components/ui';

export default function Cotizar() {
  const [f, setF] = useState({ origin_locality_id: null, dest_locality_id: null, weight_kg: '', length_cm: '', width_cm: '', height_cm: '',
    packages_count: 1, service_code: 'standard', delivery_type: 'home', declared_value: '', cod_amount: '' });
  const [quote, setQuote] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const { run, busy, error } = useSubmit(async () => {
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, typeof v === 'string' && /^[\d.]+$/.test(v) ? Number(v) : v]));
    setQuote(await api('/public/quotes', { method: 'POST', body }));
  });

  return (
    <div className="container" style={{ marginTop: 28 }}>
      <h1>Cotizá tu envío</h1>
      <div className="form-layout">
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <div className="form-grid">
            <Field label="Origen"><LocalitySelect required value={f.origin_locality_id} onChange={set('origin_locality_id')} /></Field>
            <Field label="Destino"><LocalitySelect required value={f.dest_locality_id} onChange={set('dest_locality_id')} /></Field>
            <Field label="Servicio">
              <select value={f.service_code} onChange={set('service_code')}><option value="standard">Estándar</option><option value="express">Express</option></select>
            </Field>
            <Field label="Entrega">
              <select value={f.delivery_type} onChange={set('delivery_type')}><option value="home">A domicilio</option><option value="branch">Retiro en sucursal</option></select>
            </Field>
            <Field label="Peso total (kg)"><input type="number" step="0.01" min="0.01" required value={f.weight_kg} onChange={set('weight_kg')} /></Field>
            <Field label="Bultos"><input type="number" min="1" value={f.packages_count} onChange={set('packages_count')} /></Field>
            <Field label="Largo (cm)"><input type="number" min="0" value={f.length_cm} onChange={set('length_cm')} /></Field>
            <Field label="Ancho (cm)"><input type="number" min="0" value={f.width_cm} onChange={set('width_cm')} /></Field>
            <Field label="Alto (cm)"><input type="number" min="0" value={f.height_cm} onChange={set('height_cm')} /></Field>
            <Field label="Valor declarado ($)"><input type="number" min="0" value={f.declared_value} onChange={set('declared_value')} /></Field>
            <Field label="Contrarreembolso ($)"><input type="number" min="0" value={f.cod_amount} onChange={set('cod_amount')} /></Field>
          </div>
          <ErrorBox error={error} />
          <div><button className="btn accent lg" disabled={busy}>Cotizar</button></div>
        </form>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Resultado</h3>
          {quote ? (
            <>
              <QuoteBreakdown quote={quote} />
              <Link className="btn" href="/ingresar">Generar el envío</Link>
            </>
          ) : <p className="small muted">Completá los datos para ver el precio. Si cargás medidas, calculamos el peso volumétrico.</p>}
        </div>
      </div>
    </div>
  );
}
