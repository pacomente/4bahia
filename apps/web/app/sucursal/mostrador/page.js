'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { BranchPicker, useBranch } from '@/components/BranchContext';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Field, ErrorBox, StatusBadge, useSubmit } from '@/components/ui';

export default function Mostrador() {
  const { branchId } = useBranch();
  const [code, setCode] = useState('');
  const [s, setS] = useState(null);
  const [receiver, setReceiver] = useState({ receiver_name: '', receiver_doc: '' });
  const [done, setDone] = useState(null);

  const search = useSubmit(async () => {
    setDone(null);
    const r = await api(`/shipments/${code.trim().toUpperCase()}`);
    setS(r);
    setReceiver({ receiver_name: r.recipient_name, receiver_doc: '' });
  });
  const deliver = useSubmit(async () => {
    await api(`/branches/${branchId}/ops/counter-delivery`, { method: 'POST', body: { code: s.tracking_code, ...receiver } });
    setDone(s.tracking_code);
    setS(null);
    setCode('');
  });
  const here = s && s.current_branch_id === branchId;

  return (
    <>
      <PageHead title="Entrega en mostrador"><BranchPicker /></PageHead>
      <div className="stack" style={{ maxWidth: 720 }}>
        <form className="row" onSubmit={(e) => { e.preventDefault(); search.run(); }}>
          <input className="scan-input" style={{ flex: 1 }} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de seguimiento" />
          <button className="btn lg" disabled={search.busy}>Buscar</button>
        </form>
        <ErrorBox error={search.error} />
        {done && <div className="alert ok">Envío <strong className="mono">{done}</strong> entregado.</div>}
        {s && (
          <div className="card stack">
            <div className="row between"><strong className="mono">{s.tracking_code}</strong><StatusBadge status={s.status} label={s.status_label} /></div>
            <dl className="dl">
              <dt>Destinatario</dt><dd>{s.recipient_name}{s.recipient_tax_id ? ` · ${s.recipient_tax_id}` : ''}</dd>
              <dt>Bultos</dt><dd>{s.packages_count}</dd>
              <dt>Remitente</dt><dd>{s.sender_name}</dd>
              {s.cod_amount_cents > 0 && <><dt>Cobrar</dt><dd><strong>{fmtMoney(s.cod_amount_cents)}</strong> (contrarreembolso)</dd></>}
              {s.payment_mode === 'destination' && <><dt>Flete a cobrar</dt><dd><strong>{fmtMoney(s.price_cents)}</strong></dd></>}
            </dl>
            {!here && <div className="alert warn">Este paquete no figura en esta sucursal. Recibilo primero con el escáner.</div>}
            {here && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); deliver.run(); }}>
                <div className="form-grid">
                  <Field label="Recibe (nombre y apellido)"><input required value={receiver.receiver_name} onChange={(e) => setReceiver({ ...receiver, receiver_name: e.target.value })} /></Field>
                  <Field label="DNI de quien recibe"><input required value={receiver.receiver_doc} onChange={(e) => setReceiver({ ...receiver, receiver_doc: e.target.value })} /></Field>
                </div>
                <ErrorBox error={deliver.error} />
                <div><button className="btn accent lg" disabled={deliver.busy}>Confirmar entrega</button></div>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}
