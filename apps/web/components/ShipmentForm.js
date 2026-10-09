'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LocalitySelect from './LocalitySelect';
import QuoteBreakdown from './QuoteBreakdown';
import { Field, ErrorBox, useSubmit } from './ui';

const EMPTY = {
  sender_name: '', sender_phone: '', sender_email: '', sender_tax_id: '', sender_address: '',
  recipient_name: '', recipient_phone: '', recipient_email: '', recipient_tax_id: '', recipient_address: '',
  origin_locality_id: null, dest_locality_id: null, service_code: 'standard', delivery_type: 'home',
  weight_kg: '', length_cm: '', width_cm: '', height_cm: '', packages_count: 1, declared_value: '', cod_amount: '', description: '',
};

/**
 * Formulario de alta de envío con cotización en vivo.
 * quotePath: '/public/quotes' (anónimo/mostrador) o '/v1/quotes' (cliente, aplica su tarifa).
 */
export default function ShipmentForm({ initial, quotePath = '/public/quotes', submitLabel = 'Generar envío', onSubmit, extra }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const { run, busy, error } = useSubmit(onSubmit);

  // Cotización en vivo (debounce) cuando hay datos mínimos.
  useEffect(() => {
    if (!f.origin_locality_id || !f.dest_locality_id || !(Number(f.weight_kg) > 0)) { setQuote(null); return; }
    const id = setTimeout(() => {
      api(quotePath, { method: 'POST', body: payload(f) })
        .then((q) => { setQuote(q); setQuoteError(null); })
        .catch((e) => { setQuote(null); setQuoteError(e); });
    }, 350);
    return () => clearTimeout(id);
  }, [f, quotePath]);

  return (
    <form className="form-layout"
      onSubmit={(e) => { e.preventDefault(); run(payload(f)); }}>
      <div className="stack">
        <fieldset>
          <legend>Remitente</legend>
          <div className="form-grid">
            <Field label="Nombre o razón social *"><input required value={f.sender_name} onChange={set('sender_name')} /></Field>
            <Field label="CUIT / DNI"><input value={f.sender_tax_id} onChange={set('sender_tax_id')} /></Field>
            <Field label="Teléfono"><input value={f.sender_phone} onChange={set('sender_phone')} /></Field>
            <Field label="Email (avisos)"><input type="email" value={f.sender_email} onChange={set('sender_email')} /></Field>
            <Field label="Localidad de origen *"><LocalitySelect required value={f.origin_locality_id} onChange={set('origin_locality_id')} /></Field>
            <Field label="Dirección"><input value={f.sender_address} onChange={set('sender_address')} /></Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Destinatario</legend>
          <div className="form-grid">
            <Field label="Nombre *"><input required value={f.recipient_name} onChange={set('recipient_name')} /></Field>
            <Field label="CUIT / DNI"><input value={f.recipient_tax_id} onChange={set('recipient_tax_id')} /></Field>
            <Field label="Teléfono"><input value={f.recipient_phone} onChange={set('recipient_phone')} /></Field>
            <Field label="Email (avisos)"><input type="email" value={f.recipient_email} onChange={set('recipient_email')} /></Field>
            <Field label="Localidad de destino *"><LocalitySelect required value={f.dest_locality_id} onChange={set('dest_locality_id')} /></Field>
            <Field label={f.delivery_type === 'home' ? 'Dirección de entrega *' : 'Dirección'}>
              <input required={f.delivery_type === 'home'} value={f.recipient_address} onChange={set('recipient_address')} />
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Paquete y servicio</legend>
          <div className="form-grid">
            <Field label="Servicio">
              <select value={f.service_code} onChange={set('service_code')}>
                <option value="standard">Estándar</option>
                <option value="express">Express</option>
              </select>
            </Field>
            <Field label="Entrega">
              <select value={f.delivery_type} onChange={set('delivery_type')}>
                <option value="home">A domicilio</option>
                <option value="branch">Retira en sucursal</option>
              </select>
            </Field>
            <Field label="Bultos"><input type="number" min="1" value={f.packages_count} onChange={set('packages_count')} /></Field>
            <Field label="Peso total (kg) *"><input type="number" step="0.01" min="0.01" required value={f.weight_kg} onChange={set('weight_kg')} /></Field>
            <Field label="Largo (cm)"><input type="number" min="0" value={f.length_cm} onChange={set('length_cm')} /></Field>
            <Field label="Ancho (cm)"><input type="number" min="0" value={f.width_cm} onChange={set('width_cm')} /></Field>
            <Field label="Alto (cm)"><input type="number" min="0" value={f.height_cm} onChange={set('height_cm')} /></Field>
            <Field label="Valor declarado ($)" hint="Para el seguro"><input type="number" min="0" value={f.declared_value} onChange={set('declared_value')} /></Field>
            <Field label="Contrarreembolso ($)" hint="Monto a cobrar al destinatario"><input type="number" min="0" value={f.cod_amount} onChange={set('cod_amount')} /></Field>
            <Field label="Contenido"><input value={f.description} onChange={set('description')} /></Field>
          </div>
        </fieldset>
        {extra}
      </div>
      <div className="card stack" style={{ position: 'sticky', top: 16 }}>
        <h3 style={{ margin: 0 }}>Cotización</h3>
        {quote ? <QuoteBreakdown quote={quote} /> : <p className="small muted" style={{ margin: 0 }}>Completá origen, destino y peso para ver el precio.</p>}
        <ErrorBox error={quoteError} />
        <ErrorBox error={error} />
        <button className="btn accent lg" disabled={busy || !quote}>{busy ? 'Guardando…' : submitLabel}</button>
      </div>
    </form>
  );
}

function payload(f) {
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const out = {};
  for (const [k, v] of Object.entries(f)) if (v !== '' && v != null) out[k] = v;
  for (const k of ['weight_kg', 'length_cm', 'width_cm', 'height_cm', 'packages_count', 'declared_value', 'cod_amount']) out[k] = num(f[k]);
  return out;
}
