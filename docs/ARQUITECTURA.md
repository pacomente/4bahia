# Arquitectura

## Visión general

```
                ┌──────────────────────┐
  Web pública ──┤                      │
  (seguimiento, │                      │      ┌────────────┐
  cotizador)    │                      ├──────┤  Base de   │
                │      API REST        │      │   datos    │
  Panel admin ──┤   (apps/api)         │      └────────────┘
  y sucursales  │                      │
                │  /api/public  (libre)│──► Emails (cola notifications)
  App chofer ───┤  /api/...     (JWT)  │──► Webhooks a tiendas (HMAC)
  (GPS, offline)│  /api/v1   (API key) │
                │                      │
  Tiendas  ─────┤                      │
  (Woo, etc.)   └──────────────────────┘
```

Un único backend sirve a todos los canales. Cada canal tiene su prefijo y su forma de autenticación:

| Prefijo | Quién lo usa | Autenticación |
|---|---|---|
| `/api/public/*` | Web pública (seguimiento, cotizador, contacto) | ninguna |
| `/api/auth/*` | Todos | — (devuelve JWT) |
| `/api/shipments`, `/api/branches/:id/ops`, `/api/fleet`, `/api/admin`, `/api/finance`, `/api/catalog`, `/api/users` | Panel superadmin y sucursales | JWT |
| `/api/driver/*` | App del transportista | JWT rol `driver` |
| `/api/v1/*` | Tiendas y sistemas externos | `X-Api-Key` |

## Stack del prototipo y por qué

| Pieza | MVP | Producción (recomendado) |
|---|---|---|
| API | Node.js 22 + Express 5, JavaScript ESM | Igual, migrar a TypeScript |
| Base de datos | SQLite integrado (`node:sqlite`) — cero instalación | PostgreSQL + PostGIS (consultas geográficas, desvíos de ruta) |
| Auth | JWT + bcrypt, roles | Igual + refresh tokens, 2FA para superadmin |
| Archivos (firmas, fotos) | Base64 en la base | S3 / Cloudflare R2 |
| Emails | Cola en tabla `notifications` | Worker + proveedor SMTP/transaccional |
| Tiempo real del mapa | Polling a `/api/fleet/live` | WebSocket / SSE |
| Web y panel | — | Next.js (React) |
| App transportista | — | React Native (Expo), GPS en segundo plano, SQLite local para offline |

El esquema (`apps/api/src/db/schema.sql`) está escrito para portarse a PostgreSQL sin cambios de modelo:
montos en **centavos**, pesos en **gramos**, fechas ISO-8601 UTC.

## Roles

| Rol | Alcance |
|---|---|
| `superadmin` | Todo: usuarios, tarifas, zonas, sucursales, auditoría, liquidaciones |
| `branch_admin` | Su sucursal: operadores, transportistas, vehículos, operaciones |
| `operator` | Operaciones de su sucursal: ingreso, clasificación, despacho, entregas en mostrador |
| `driver` | Sus viajes y paquetes asignados, GPS, entregas e incidencias |
| `customer` | Sus envíos, cuenta corriente, API keys y webhooks |
| `api` | (por API key) crear y consultar envíos del cliente dueño de la clave |

## Ciclo de vida de un envío

```
created ──► received ──► sorted ──► in_transit ──► at_destination_branch ──► out_for_delivery ──► delivered
 (web/API)  (sucursal     (clasif.)  (troncal)      (escaneo en destino)       (reparto)    │
             origen)                     │                     │                          ├─► failed_attempt ─► (reintento / retiro / devolución)
                                         └─► received          └──► ready_for_pickup ─────┘─► rejected ──────► returned
                                            (escala intermedia)     (retiro en mostrador)

Incidencias en cualquier momento: delayed · damaged · lost   (requieren motivo)
Finales: delivered · returned · cancelled
```

Las transiciones válidas están en `apps/api/src/lib/statuses.js`. Cada cambio:

1. Valida la transición (409 si no corresponde) y exige motivo en incidencias.
2. Graba un evento en `shipment_events` (historial completo, con usuario, sucursal, viaje, GPS).
3. Encola emails a remitente y destinatario.
4. Dispara webhooks del cliente (`shipment.status_changed`, firmados con HMAC-SHA256).
5. Al entregar: registra comprobante (firma/foto/DNI) y marca el contrarreembolso como cobrado.

## Viajes y GPS

- **Viaje troncal (`transfer`)**: sucursal → sucursal. Al iniciarlo, los paquetes pasan a `in_transit`.
  La sucursal destino confirma la recepción **escaneando**; lo no escaneado queda como pendiente.
- **Reparto (`delivery`)**: última milla desde una sucursal. Al iniciarlo, `out_for_delivery`.
- La app envía posiciones en lotes (`/api/driver/positions` o dentro de `/api/driver/sync`).
  Se guarda historial (`gps_positions`) y última posición en el vehículo.
- **Estado de conexión**: `online` / `offline` según `GPS_OFFLINE_MINUTES`.
- **Alertas**: viaje que supera `expected_minutes`; vehículo en viaje sin señal.
- **ETA**: distancia al destino × factor de ruta / velocidad. Se informa solo si hay posición y coordenadas de destino.
- **Privacidad**: el historial se purga según `GPS_RETENTION_DAYS`. El GPS depende de la app del
  conductor, sus permisos, la conectividad y el dispositivo.

## Sincronización offline (app del transportista)

La app guarda localmente cada acción con un `client_event_id` único (ej. `deviceId-secuencia`) y la
hora real (`occurred_at`). Al recuperar conexión envía todo a `POST /api/driver/sync`:

- Los eventos se procesan ordenados por `occurred_at`.
- Reenviar el mismo `client_event_id` no duplica nada (`duplicate: true`).
- Cada evento devuelve su resultado individual, para que la app sepa cuáles reintentar o mostrar como error.

## Cotizador

`apps/api/src/lib/pricing.js`:

1. Peso facturable = máx(peso real, peso volumétrico). Volumétrico = L×A×H / divisor (5000) × bultos.
2. Tarifa base por **par de zonas** origen→destino con tramos de peso + $/kg excedente.
3. Multiplicador del servicio (Estándar / Express).
4. Adicionales: bultos extra, entrega a domicilio, seguro (% del valor declarado, con mínimo),
   gestión de contrarreembolso, recargo combustible.
5. Descuento de cliente comercial.
6. IVA.

Todos los parámetros son editables (`/api/catalog/pricing-settings`, tarifas y servicios).
La cotización es **estimada** en la web y **definitiva** cuando la sucursal pesa/mide el paquete al recibirlo.

## Seguridad y datos personales

- Seguimiento público: no expone direcciones, teléfonos, emails, documentos ni datos del transportista;
  el nombre del destinatario se enmascara (`M**** D***`).
- Contraseñas con bcrypt. API keys guardadas solo como hash SHA-256 (se muestran una vez).
- Staff de sucursal solo opera sobre su sucursal; clientes solo ven sus envíos.
- Auditoría (`audit_logs`) de logins, altas, cambios de estado, pagos, tarifas, usuarios, API keys.
