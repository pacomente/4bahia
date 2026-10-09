# apps/web — Web pública + panel (etapa 2)

Pendiente. Propuesta: **Next.js (React)** en una sola app con tres áreas:

- `/` web pública: seguimiento por código, cotizador, contacto/reclamos, alta de envíos y área de cliente.
- `/admin` superadmin: dashboard, mapa (Leaflet + OpenStreetMap), usuarios, tarifas, auditoría, finanzas.
- `/sucursal` panel de sucursal: escaneo masivo (lector USB o cámara), recepción, despacho, mostrador, pendientes.

Consume exclusivamente la API de `apps/api` (ver `docs/API.md`).
