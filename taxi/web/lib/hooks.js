import { useCallback, useEffect, useRef, useState } from 'react';

// Consulta periódica a la API (la app se mantiene "en vivo" con polling).
export function usePoll(fn, ms, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const refresh = useCallback(async () => {
    try { setData(await fnRef.current()); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => {
    if (!ms) return undefined;
    refresh();
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [ms, refresh, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, refresh, setData };
}

export function useAsync(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (...args) => {
    setBusy(true); setError(null);
    try { return await fn(...args); } catch (e) { setError(e); return undefined; } finally { setBusy(false); }
  }, [fn]);
  return { run, busy, error, setError };
}

export function useConfig() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { fetch('/api/public/config').then((r) => r.json()).then(setCfg).catch(() => {}); }, []);
  return cfg;
}

// Cuenta regresiva en segundos hasta `iso`.
export function useCountdown(iso) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!iso) return undefined;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [iso]);
  return left;
}
