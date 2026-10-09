'use client';
import { useState } from 'react';
import { api, openLabel } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtMoney, fmtKg, fmtDate, fmtDateTime, STATUS_LABELS, INCIDENT_REASONS } from '@/lib/format';
import Timeline from './Timeline';
import QuoteBreakdown from './QuoteBreakdown';
import { StatusBadge, ErrorBox, Loading, useApi, useSubmit, Field } from './ui';

const STAFF = ['superadmin', 'branch_admin', 'operator'];

// Estados que el staff puede asignar manualmente desde el detalle.
const MANUAL_STATUSES = ['received', 'sorted', 'at_destination_branch', 'ready_for_pickup', 'out_for_delivery',
  'delayed', 'damaged', 'lost', 'rejected', 'returned', 'cancelled'];

export default function ShipmentDetail({ code }) {
  const { user } = useAuth();
  const { data: s, error, loading, reload } = useApi(`/shipments/${encodeURIComponent(code)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const staff = STAFF.includes(user?.role);

  return (
    <div className="stack">
      <div className="row between">
        <div className="row">
          <h2 className="mono" style={{ margin: 0 }}>{s.tracking_code}</h2>
          <StatusBadge status={s.status} />
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => openLabel(s.tracking_code)}>Imprimir etiqueta</button>
          <a className="btn ghost" href={`/seguimiento/${s.tracking_code}`} target="_blank" rel="noreferrer">Ver seguimiento público</a>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Remitente</h3>
          <dl className="dl">
            <dt>Nombre</dt><dd>{s.sender_name}</dd>
            <dt>Teléfono</dt><dd>{s.sender_phone ?? '—'}</dd>
            <dt>Email</dt><dd>{s.sender_email ?? '—'}</dd>
            <dt>Dirección</dt><dd>{s.sender_address ?? '—'}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Destinatario</h3>
          <dl className="dl">
            <dt>Nombre</dt><dd>{s.recipient_name}</dd>
            <dt>Teléfono</dt><dd>{s.recipient_phone ?? '—'}</dd>
            <dt>Email</dt><dd>{s.recipient_email ?? '—'}</dd>
            <dt>Entrega</dt><dd>{s.delivery_type === 'home' ? `A domicilio: ${s.recipient_address ?? ''}` : 'Retira en sucursal'}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Paquete</h3>
          <dl className="dl">
            <dt>Bultos</dt><dd>{s.packages_count}</dd>
            <dt>Peso real</dt><dd>{fmtKg(s.weight_g)}</dd>
            <dt>Peso facturable</dt><dd>{fmtKg(s.chargeable_weight_g)}</dd>
            <dt>Medidas</dt><dd>{s.length_cm ? `${s.length_cm} × ${s.width_cm} × ${s.height_cm} cm` : '—'}</dd>
            <dt>Valor declarado</dt><dd>{fmtMoney(s.declared_value_cents)}</dd>
            <dt>Contrarreembolso</dt><dd>{s.cod_amount_cents ? fmtMoney(s.cod_amount_cents) : '—'}</dd>
            <dt>Contenido</dt><dd>{s.description ?? '—'}</dd>
            <dt>Ref. externa</dt><dd>{s.external_ref ?? '—'}</dd>
            <dt>Creado</dt><dd>{fmtDateTime(s.created_at)}</dd>
            <dt>Entrega estimada</dt><dd>{fmtDate(s.estimated_delivery_at)}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Precio</h3>
          <QuoteBreakdown quote={s.price_breakdown} />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Historial</h3>
          <Timeline events={s.events.map((e) => ({
            id: e.id, label: e.status_label, note: e.note, reason: e.reason, at: e.occurred_at,
            place: e.branch_name, user: staff ? e.user_name : null, internal: e.internal_note,
          }))} />
        </div>
        <div className="stack">
          {s.delivery_proof && (
            <div className="card">
              <h3>Comprobante de entrega</h3>
              <dl className="dl">
                <dt>Recibió</dt><dd>{s.delivery_proof.receiver_name}</dd>
                <dt>Documento</dt><dd>{s.delivery_proof.receiver_doc ?? '—'}</dd>
                <dt>Firma / foto</dt><dd>{s.delivery_proof.has_signature ? 'Firma ✓' : 'Sin firma'} · {s.delivery_proof.has_photo ? 'Foto ✓' : 'Sin foto'}</dd>
                <dt>Fecha</dt><dd>{fmtDateTime(s.delivery_proof.created_at)}</dd>
              </dl>
            </div>
          )}
          {s.trips?.length > 0 && (
            <div className="card">
              <h3>Viajes</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {s.trips.map((t) => <li key={t.id}>{t.code} · {t.type === 'transfer' ? 'Troncal' : 'Reparto'} · {t.plate} · {{ planned: 'Planificado', in_progress: 'En curso', completed: 'Finalizado', cancelled: 'Cancelado' }[t.status]}</li>)}
              </ul>
            </div>
          )}
          {staff && <StatusChanger shipment={s} onDone={reload} />}
        </div>
      </div>
    </div>
  );
}

function StatusChanger({ shipment, onDone }) {
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState('');
  const { run, busy, error } = useSubmit(async () => {
    await api(`/shipments/${shipment.tracking_code}/status`, {
      method: 'POST',
      body: { status, reason: reason || undefined, note: note || undefined, internal_note: internal || undefined },
    });
    setStatus(''); setReason(''); setNote(''); setInternal('');
    onDone();
  });
  const reasons = INCIDENT_REASONS[status];
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
      <h3 style={{ margin: 0 }}>Cambiar estado / registrar incidencia</h3>
      <Field label="Nuevo estado">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setReason(''); }} required>
          <option value="">Elegí…</option>
          {MANUAL_STATUSES.filter((x) => x !== shipment.status).map((x) => <option key={x} value={x}>{STATUS_LABELS[x]}</option>)}
        </select>
      </Field>
      {reasons && (
        <Field label="Motivo *">
          <select value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">Elegí…</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
      )}
      <Field label="Nota visible para el cliente"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="Nota interna"><input value={internal} onChange={(e) => setInternal(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <button className="btn" disabled={busy || !status}>Guardar</button>
    </form>
  );
}
