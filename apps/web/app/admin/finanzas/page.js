'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { api, download } from '@/lib/api';
import { fmtMoney, fmtDateTime } from '@/lib/format';
import { Field, ErrorBox, useApi, useSubmit, Empty } from '@/components/ui';

const COD_STATUS = { pending: ['', 'Pendiente de cobro'], collected: ['warning', 'Cobrado, a rendir'], settled: ['good', 'Rendido'] };

export default function Finanzas() {
  const [tab, setTab] = useState('accounts');
  return (
    <>
      <PageHead title="Finanzas" sub="Cuentas corrientes, contrarreembolsos e ingresos">
        <button className="btn ghost" onClick={() => download('/finance/reports/revenue?format=csv', 'ingresos.csv')}>Exportar ingresos (CSV)</button>
      </PageHead>
      <div className="tabs">
        {[['accounts', 'Cuentas corrientes'], ['cod', 'Contrarreembolsos'], ['revenue', 'Ingresos']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'accounts' && <Accounts />}
      {tab === 'cod' && <Cod />}
      {tab === 'revenue' && <Revenue />}
    </>
  );
}

function Accounts() {
  const { data, reload } = useApi('/finance/accounts');
  const [selected, setSelected] = useState(null);
  return (
    <div className="stack">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>CUIT</th><th className="num">Límite</th><th className="num">Saldo</th><th /></tr></thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.tax_id ?? '—'}</td><td className="num">{fmtMoney(c.credit_limit_cents)}</td>
                <td className="num" style={{ color: c.credit_limit_cents && c.balance_cents > c.credit_limit_cents ? 'var(--critical-text)' : undefined }}>{fmtMoney(c.balance_cents)}</td>
                <td><button className="btn ghost sm" onClick={() => setSelected(c.id)}>Ver movimientos</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <AccountDetail id={selected} onChange={reload} />}
    </div>
  );
}

function AccountDetail({ id, onChange }) {
  const { data, reload } = useApi(`/finance/accounts/${id}`);
  const [f, setF] = useState({ amount: '', method: 'transferencia', note: '' });
  const { run, busy, error } = useSubmit(async () => {
    await api('/finance/payments', { method: 'POST', body: { customer_id: id, amount: Number(f.amount), method: f.method, note: f.note || undefined } });
    setF({ amount: '', method: 'transferencia', note: '' });
    reload(); onChange();
  });
  if (!data) return null;
  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>{data.customer.name} · saldo {fmtMoney(data.balance_cents)}</h3>
        <div className="table-wrap" style={{ maxHeight: 360 }}>
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th></tr></thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="small nowrap">{fmtDateTime(e.created_at)}</td>
                  <td>{e.type === 'payment' ? `Pago (${e.method})` : e.note}{e.tracking_code ? <span className="mono small"> {e.tracking_code}</span> : ''}</td>
                  <td className="num">{e.type === 'payment' ? '−' : ''}{fmtMoney(e.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <h3 style={{ margin: 0 }}>Registrar pago</h3>
        <Field label="Importe ($)"><input type="number" step="0.01" min="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Medio">
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {['transferencia', 'efectivo', 'cheque', 'tarjeta', 'mercadopago'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Nota"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <ErrorBox error={error} />
        <div><button className="btn" disabled={busy}>Registrar</button></div>
      </form>
    </div>
  );
}

function Cod() {
  const [status, setStatus] = useState('collected');
  const { data, reload } = useApi(`/finance/cod${status ? `?status=${status}` : ''}`);
  const [msg, setMsg] = useState(null);
  const byCustomer = (data ?? []).filter((c) => c.status === 'collected' && c.customer_id).reduce((acc, c) => {
    (acc[c.customer_id] ??= { name: c.customer_name, total: 0, n: 0 }); acc[c.customer_id].total += c.amount_cents; acc[c.customer_id].n++; return acc;
  }, {});
  async function settle(customerId) {
    const r = await api('/finance/cod/settle', { method: 'POST', body: { customer_id: Number(customerId) } });
    setMsg(`Rendidos ${r.settled} contrarreembolsos por ${fmtMoney(r.total_cents)}`);
    reload();
  }
  return (
    <div className="stack">
      <div className="row">
        <select style={{ maxWidth: 240 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(COD_STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {msg && <div className="alert ok">{msg}</div>}
      {Object.keys(byCustomer).length > 0 && (
        <div className="card">
          <h3>Liquidaciones pendientes de rendir</h3>
          {Object.entries(byCustomer).map(([id, c]) => (
            <div key={id} className="row between" style={{ padding: '6px 0' }}>
              <span>{c.name} · {c.n} envíos · <strong>{fmtMoney(c.total)}</strong></span>
              <button className="btn sm" onClick={() => settle(id)}>Marcar rendido</button>
            </div>
          ))}
        </div>
      )}
      {!data?.length ? <Empty>No hay contrarreembolsos en este estado.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Envío</th><th>Cliente</th><th>Estado</th><th className="num">Importe</th><th>Cobrado por</th><th>Cobrado</th><th>Rendido</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.tracking_code}</td><td>{c.customer_name ?? 'Particular'}</td>
                  <td><span className={`badge ${COD_STATUS[c.status][0]}`}>{COD_STATUS[c.status][1]}</span></td>
                  <td className="num">{fmtMoney(c.amount_cents)}</td><td>{c.collected_by_name ?? '—'}</td>
                  <td className="small">{fmtDateTime(c.collected_at)}</td><td className="small">{fmtDateTime(c.settled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Revenue() {
  const { data } = useApi('/finance/reports/revenue');
  if (!data) return null;
  if (!data.rows.length) return <Empty>Sin movimientos en el período.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Día</th><th>Sucursal</th><th className="num">Cargado</th><th className="num">Cobrado</th></tr></thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}><td>{r.day}</td><td>{r.branch ?? '—'}</td><td className="num">{fmtMoney(r.charged * 100)}</td><td className="num">{fmtMoney(r.collected * 100)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
