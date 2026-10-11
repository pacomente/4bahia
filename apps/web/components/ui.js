'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Inbox, AlertCircle } from 'lucide-react';
import { STATUS_LABELS, statusTone } from '@/lib/format';

export function StatusBadge({ status, label }) {
  return <span className={`badge ${statusTone(status)}`}>{label ?? STATUS_LABELS[status] ?? status}</span>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="alert error" role="alert"><AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{error.message ?? String(error)}</span></div> : null);
export const Loading = () => <div className="empty">Cargando…</div>;
export const Empty = ({ children, icon: Icon = Inbox }) => <div className="empty"><Icon size={28} /><span>{children}</span></div>;

// Carga datos de la API; devuelve { data, error, loading, reload, setData }.
export function useApi(path, { interval } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!!path);
  const pathRef = useRef(path);
  pathRef.current = path;

  const reload = useCallback(async () => {
    if (!pathRef.current) return;
    try {
      const d = await api(pathRef.current);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(!!path);
    reload();
    if (!interval) return;
    const id = setInterval(reload, interval);
    return () => clearInterval(id);
  }, [path, interval, reload]);

  return { data, error, loading, reload, setData };
}

// Envía un formulario a la API manejando estado de envío y error.
export function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (...args) => {
    setBusy(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [fn]);
  return { run, busy, error, setError };
}

export function Kpi({ label, value, hint, icon: Icon }) {
  return (
    <div className="card kpi">
      {Icon && <span className="kpi-icon"><Icon size={20} /></span>}
      <div className="kpi-body">
        <span className="label">{label}</span>
        <span className="value">{value}</span>
        {hint && <span className="hint">{hint}</span>}
      </div>
    </div>
  );
}
