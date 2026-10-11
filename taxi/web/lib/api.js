// Una sesión independiente por app (pasajero / conductor / admin) para poder
// tener las tres abiertas en el mismo navegador durante la demo.
const key = (app) => `movi_token_${app}`;
export const getToken = (app) => { try { return localStorage.getItem(key(app)); } catch { return null; } };
export const setToken = (app, t) => { try { t ? localStorage.setItem(key(app), t) : localStorage.removeItem(key(app)); } catch {} };

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createApi(app) {
  return async function api(path, { method = 'GET', body } = {}) {
    const token = getToken(app);
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Sin conexión con el servidor');
    }
    if (res.status === 401 && token) setToken(app, null);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}`);
    return data;
  };
}

export const publicApi = createApi('public');
