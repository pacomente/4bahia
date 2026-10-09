'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { StatusBadge, ErrorBox } from './ui';

/**
 * Estación de escaneo masivo. Funciona con lector de códigos USB (envía el código + Enter)
 * o tipeando a mano. Acumula códigos y los procesa en lote, o de a uno en modo inmediato.
 */
export default function ScanStation({ endpoint, actionLabel, immediate = true }) {
  const [code, setCode] = useState('');
  const [queue, setQueue] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [endpoint]);

  async function send(codes) {
    if (!codes.length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api(endpoint, { method: 'POST', body: { codes } });
      setResults((prev) => [...r.results.map((x) => ({ ...x, at: new Date() })), ...prev].slice(0, 200));
      setQueue([]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCode('');
    if (immediate) send([c]);
    else setQueue((q) => (q.includes(c) ? q : [...q, c]));
  }

  const ok = results.filter((r) => r.ok).length;
  return (
    <div className="stack">
      <form onSubmit={onSubmit} className="row">
        <input ref={inputRef} className="scan-input" style={{ flex: 1, minWidth: 220 }} value={code}
          onChange={(e) => setCode(e.target.value)} placeholder="Escaneá o escribí el código (4B…)" autoComplete="off" />
        <button className="btn lg" disabled={busy}>{immediate ? actionLabel : 'Agregar'}</button>
      </form>
      {!immediate && (
        <div className="card">
          <div className="row between">
            <strong>{queue.length} códigos en lote</strong>
            <div className="row">
              <button className="btn ghost sm" onClick={() => setQueue([])} disabled={!queue.length}>Vaciar</button>
              <button className="btn accent" onClick={() => send(queue)} disabled={busy || !queue.length}>{actionLabel} ({queue.length})</button>
            </div>
          </div>
          {queue.length > 0 && <p className="mono small" style={{ margin: '10px 0 0' }}>{queue.join('  ·  ')}</p>}
        </div>
      )}
      <ErrorBox error={error} />
      {results.length > 0 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Resultados</strong>
            <span className="small muted">{ok} correctos · {results.length - ok} con error</span>
          </div>
          <div className="table-wrap scan-results">
            <table>
              <thead><tr><th>Hora</th><th>Código</th><th>Resultado</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="small nowrap">{r.at.toLocaleTimeString('es-AR')}</td>
                    <td className="mono">{r.code}</td>
                    <td>{r.ok ? <StatusBadge status={r.status} label={r.status_label} /> : <span className="badge critical">{r.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
