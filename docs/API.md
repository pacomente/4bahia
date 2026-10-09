# Referencia de la API

Base: `/api`. JSON en request y response. Errores: `{ "error": "mensaje", "details": ... }` con
400 (validación), 401 (no autenticado), 403 (sin permiso), 404, 409 (transición/duplicado).

Montos de entrada en **pesos** (`declared_value`, `cod_amount`, `amount`); de salida en **centavos** (`*_cents`).
Pesos de entrada en **kg** (`weight_kg`); de salida en **gramos** (`*_g`).

## Públicos (sin auth)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado |
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/auth/register` | Alta de cliente → `{token, user}` |
| GET | `/public/tracking/:code` | Seguimiento público (datos enmascarados) |
| POST | `/public/quotes` | Cotizar |
| POST | `/public/contact` | `{type: contact|claim|quote, name, email, message, tracking_code?}` |
| GET | `/public/localities?q=` · `/public/services` · `/public/branches` | Catálogo |

## Envíos (staff y clientes)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/shipments?status=&q=&branch_id=&incidents=true&from=&to=&limit=&offset=` | Listado |
| GET | `/shipments/export.csv` | Exportación (mismos filtros) |
| POST | `/shipments` | Alta. Staff: queda `received` en su sucursal (`receive_now:false` para no recibir). Cliente: queda `created` |
| GET | `/shipments/:idOrCode` | Detalle + eventos + comprobante + viajes |
| GET | `/shipments/:idOrCode/label` | Etiqueta HTML 10×15 con QR (una por bulto) |
| POST | `/shipments/:idOrCode/status` | `{status, reason?, note?, internal_note?}` (staff) |
| GET | `/shipments/statuses` | Estados y etiquetas |

Campos de alta: `sender_name*, sender_phone, sender_email, sender_tax_id, sender_address, recipient_name*,
recipient_phone, recipient_email, recipient_tax_id, recipient_address (obligatorio si home), origin_locality_id*,
dest_locality_id*, weight_kg*, length_cm, width_cm, height_cm, packages_count, declared_value, cod_amount,
service_code (standard|express), delivery_type (home|branch), payment_mode, description, external_ref`.

## Operaciones de sucursal — `/branches/:branchId/ops`
| Método | Ruta | Body |
|---|---|---|
| POST | `/receive` | `{codes: [...]}` ingreso / recepción de troncal / devolución de reparto |
| POST | `/sort` | `{codes}` |
| POST | `/dispatch` | `{codes, vehicle_id, driver_id, dest_branch_id, expected_minutes}` crea viaje troncal |
| POST | `/ready-for-pickup` | `{codes}` |
| POST | `/counter-delivery` | `{code, receiver_name, receiver_doc?, signature_data?}` |
| GET | `/pending?stale_hours=48` | En sucursal, demorados, entrantes |

## Flota y GPS — `/fleet`
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/vehicles` | Vehículos con estado de conexión |
| GET | `/live` | Mapa: vehículos, viaje activo, ETA, sucursales, alertas |
| GET | `/vehicles/:id/track?from=&to=` | Recorrido histórico |
| GET | `/alerts` | Demoras y vehículos sin señal |
| GET/POST | `/trips` | Viajes (`type: transfer|delivery`, `codes`) |
| GET | `/trips/:id` · POST `/trips/:id/shipments` · `/start` · `/finish` | |
| POST | `/gps/purge` | Purga por retención (superadmin) |

## App del transportista — `/driver`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/trips` · `/trips/:id` | Viajes asignados, paradas con link de navegación |
| POST | `/trips/:id/start` · `/trips/:id/finish` | |
| GET | `/scan/:code` | Datos del paquete escaneado |
| POST | `/positions` | `{positions: [{lat, lng, speed_kmh, heading, accuracy_m, recorded_at}]}` |
| POST | `/events` | `{code, status, reason?, lat, lng, proof?: {receiver_name, receiver_doc, signature_data, photo_data}}` |
| POST | `/sync` | `{events: [{client_event_id, occurred_at, ...evento}], positions: [...]}` |
| GET | `/failed-reasons` | Motivos estándar de visita fallida |

Estados permitidos desde la app: `delivered, failed_attempt, rejected, damaged, delayed`.

## Administración
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/dashboard?from=&branch_id=` | Estadísticas |
| GET | `/admin/audit?entity=&entity_id=&user_id=&format=csv` | Auditoría (superadmin) |
| GET/PATCH | `/admin/requests` | Contacto y reclamos |
| GET | `/admin/notifications` | Cola de emails |
| GET/POST/PATCH | `/users` | Usuarios |
| GET/POST/PATCH | `/catalog/{branches,zones,localities,services,tariffs,customers}` | Catálogo |
| GET/PUT | `/catalog/pricing-settings` | Parámetros del cotizador |

## Finanzas — `/finance`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/accounts` · `/accounts/:customerId` | Saldos y movimientos |
| POST | `/payments` | `{amount, customer_id?, shipment_id?, method}` |
| GET | `/cod?status=pending|collected|settled` | Contrarreembolsos |
| POST | `/cod/settle` | `{customer_id}` rinde lo cobrado |
| GET | `/reports/revenue?from=&to=&format=csv` | Ingresos por día y sucursal |

## Integraciones
Gestión (superadmin o el propio cliente): `GET/POST /integrations/api-keys`, `DELETE /integrations/api-keys/:id`,
`GET/POST /integrations/webhooks`, `GET /integrations/webhooks/:id/deliveries`.

API externa (header `X-Api-Key`):
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/v1/quotes` | Cotizar con tarifa del cliente |
| POST | `/v1/shipments` | Crear envío (idempotente por `external_ref`) |
| GET | `/v1/shipments/:code` | Estado + eventos |
| GET | `/v1/shipments/:code/label` | Etiqueta |

Webhook `shipment.status_changed`:
```json
{ "event": "shipment.status_changed", "sent_at": "...",
  "data": { "tracking_code": "4B...", "status": "delivered", "status_label": "Entregado",
            "previous_status": "out_for_delivery", "external_ref": "WC-1001", "occurred_at": "..." } }
```
Header `X-4Bahia-Signature` = HMAC-SHA256(secret, body crudo) en hex.
