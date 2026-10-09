# apps/web — Web pública + panel superadmin + panel de sucursal

Next.js 16 (App Router, React 19), JavaScript, CSS propio con modo claro/oscuro y Leaflet + OpenStreetMap para el mapa.
Consume exclusivamente la API de `apps/api` (ver `docs/API.md`).

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:3000/api
npm run dev                     # http://localhost:3001
```

## Áreas

| Ruta | Quién | Contenido |
|---|---|---|
| `/` `/seguimiento/[código]` `/cotizar` `/sucursales` `/contacto` | Público | Seguimiento con línea de tiempo (datos privados ocultos), cotizador, sucursales, contacto y reclamos |
| `/ingresar` | Todos | Login y alta de clientes; redirige según el rol |
| `/cliente` | Cliente | Mis envíos, nuevo envío con su tarifa, etiqueta, cuenta corriente, API keys y webhooks |
| `/admin` | Superadmin | Panel de control, mapa en vivo, envíos, flota y viajes, reclamos, finanzas (cuentas, contrarreembolsos, ingresos), tarifas y parámetros del cotizador, sucursales/localidades/clientes, usuarios, auditoría |
| `/sucursal` | Admin de sucursal, operador (y superadmin eligiendo sucursal) | Pendientes, escáner masivo (recibir / clasificar / listo para retirar, compatible con lector USB), alta en mostrador con impresión de etiqueta, despachos y repartos, entrega en mostrador, búsqueda |
| `/chofer` | Transportista | Vista mínima de viajes; la operación va en la app móvil (etapa 3) |

## Notas

- La sesión (JWT) se guarda en `localStorage`. Para producción conviene cookie httpOnly.
- Las etiquetas se abren en una pestaña nueva y lanzan la impresión (formato 10×15 cm, una por bulto).
- El mapa se actualiza cada 15 s por polling; en producción, WebSocket/SSE.
- Los links de seguimiento en etiquetas y emails usan `PUBLIC_BASE_URL` de la API (por defecto `http://localhost:3001`).
