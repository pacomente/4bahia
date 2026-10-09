'use client';
import { useState } from 'react';
import { PageHead } from '@/components/AppShell';
import { api, API_URL } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Field, ErrorBox, useApi, useSubmit } from '@/components/ui';

export default function Integraciones() {
  const keys = useApi('/integrations/api-keys');
  const hooks = useApi('/integrations/webhooks');
  const [newKey, setNewKey] = useState(null);
  const [newHook, setNewHook] = useState(null);
  const [keyName, setKeyName] = useState('');
  const [url, setUrl] = useState('');

  const createKey = useSubmit(async () => {
    setNewKey(await api('/integrations/api-keys', { method: 'POST', body: { name: keyName || 'API key' } }));
    setKeyName('');
    keys.reload();
  });
  const createHook = useSubmit(async () => {
    setNewHook(await api('/integrations/webhooks', { method: 'POST', body: { url } }));
    setUrl('');
    hooks.reload();
  });
  const revoke = async (id) => { if (confirm('¿Revocar esta clave? Las integraciones que la usen dejarán de funcionar.')) { await api(`/integrations/api-keys/${id}`, { method: 'DELETE' }); keys.reload(); } };

  return (
    <>
      <PageHead title="Integraciones" />
      <div className="stack">
        <div className="card">
          <h3>API para tu tienda o sistema</h3>
          <p className="small muted">Creá envíos, obtené etiquetas y consultá estados desde tu sistema. Base: <span className="mono">{API_URL}/v1</span>, autenticación con el header <span className="mono">X-Api-Key</span>. Documentación en <span className="mono">docs/API.md</span>.</p>
          {newKey && <div className="alert warn" style={{ marginBottom: 12 }}>Copiá tu clave ahora, no se vuelve a mostrar:<div className="mono" style={{ overflowWrap: 'anywhere' }}>{newKey.key}</div></div>}
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead><tr><th>Nombre</th><th>Clave</th><th>Estado</th><th>Último uso</th><th /></tr></thead>
              <tbody>
                {keys.data?.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td><td className="mono">{k.prefix}…</td>
                    <td><span className={`badge ${k.active ? 'good' : ''}`}>{k.active ? 'Activa' : 'Revocada'}</span></td>
                    <td className="small">{fmtDateTime(k.last_used_at)}</td>
                    <td>{k.active ? <button className="btn ghost sm" onClick={() => revoke(k.id)}>Revocar</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); createKey.run(); }}>
            <input style={{ maxWidth: 280 }} placeholder="Nombre (ej. WooCommerce)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <button className="btn" disabled={createKey.busy}>Crear API key</button>
          </form>
          <ErrorBox error={createKey.error} />
        </div>

        <div className="card">
          <h3>Webhooks</h3>
          <p className="small muted">Te avisamos por POST a tu URL cada vez que cambia el estado de un envío (evento <span className="mono">shipment.status_changed</span>). Verificá la firma <span className="mono">X-4Bahia-Signature</span> (HMAC-SHA256 del cuerpo con tu secreto).</p>
          {newHook && <div className="alert warn" style={{ marginBottom: 12 }}>Secreto del webhook (guardalo):<div className="mono" style={{ overflowWrap: 'anywhere' }}>{newHook.secret}</div></div>}
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead><tr><th>URL</th><th>Eventos</th><th>Alta</th></tr></thead>
              <tbody>{hooks.data?.map((h) => <tr key={h.id}><td className="mono small">{h.url}</td><td className="small">{h.events}</td><td className="small">{fmtDateTime(h.created_at)}</td></tr>)}</tbody>
            </table>
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); createHook.run(); }}>
            <Field label="URL"><input type="url" required style={{ minWidth: 280 }} placeholder="https://mitienda.com/webhooks/4bahia" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
            <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={createHook.busy}>Agregar webhook</button>
          </form>
          <ErrorBox error={createHook.error} />
        </div>
      </div>
    </>
  );
}
