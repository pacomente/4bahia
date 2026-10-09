'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Field, ErrorBox, useSubmit } from '@/components/ui';

function ContactForm() {
  const params = useSearchParams();
  const [f, setF] = useState({ type: params.get('tipo') ?? 'contact', name: '', email: '', phone: '', tracking_code: params.get('codigo') ?? '', message: '' });
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const { run, busy, error } = useSubmit(async () => {
    const r = await api('/public/contact', { method: 'POST', body: { ...f, tracking_code: f.tracking_code || undefined } });
    setDone(r.message);
  });
  if (done) return <div className="alert ok">{done}</div>;
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
      <div className="form-grid">
        <Field label="Motivo">
          <select value={f.type} onChange={set('type')}>
            <option value="contact">Consulta</option>
            <option value="claim">Reclamo</option>
            <option value="quote">Cotización especial / cliente comercial</option>
          </select>
        </Field>
        <Field label="Código de seguimiento (opcional)"><input value={f.tracking_code} onChange={set('tracking_code')} /></Field>
        <Field label="Nombre"><input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Teléfono"><input value={f.phone} onChange={set('phone')} /></Field>
      </div>
      <Field label="Mensaje"><textarea required value={f.message} onChange={set('message')} /></Field>
      <ErrorBox error={error} />
      <div><button className="btn accent" disabled={busy}>Enviar</button></div>
    </form>
  );
}

export default function Contacto() {
  return (
    <div className="container" style={{ marginTop: 28, maxWidth: 760 }}>
      <h1>Contacto y reclamos</h1>
      <p className="muted">Respondemos por email. Si es sobre un envío, incluí el código de seguimiento.</p>
      <Suspense><ContactForm /></Suspense>
    </div>
  );
}
