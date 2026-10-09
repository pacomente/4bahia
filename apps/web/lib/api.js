// Cliente HTTP de la API. El token se guarda en localStorage (prototipo).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = '4bahia_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  }
  if (res.status === 401 && token) {
    setToken(null);
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/ingresar')) location.href = '/ingresar';
  }
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, 'Error al descargar');
    return res;
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}`, data?.details);
  return data;
}

// Descarga un archivo autenticado (CSV) disparando el guardado en el navegador.
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Abre la etiqueta (HTML autenticado) en una pestaña nueva lista para imprimir.
export async function openLabel(codeOrPath) {
  const win = window.open('', '_blank');
  const path = codeOrPath.startsWith('/') ? codeOrPath : `/shipments/${codeOrPath}/label`;
  try {
    const res = await api(path, { raw: true });
    const html = await res.text();
    win.document.open();
    win.document.write(html.replace('</body>', '<script>window.onload=()=>window.print()</script></body>'));
    win.document.close();
  } catch (e) {
    win?.close();
    alert(e.message);
  }
}
