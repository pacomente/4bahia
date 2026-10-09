# Expreso 4 Bahía — Plataforma logística integral

Prototipo (MVP) de la plataforma logística: superadmin, sucursales, app del transportista con GPS,
web de clientes con seguimiento público, cotizador, administración comercial e integraciones.

**Etapa actual: estructura + backend.** La API y el modelo de datos ya cubren el circuito completo
de un envío. Las interfaces (web/panel y app móvil) son la próxima etapa — ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estructura

```
4bahia/
├── apps/
│   ├── api/        ← Backend (Node.js + Express + SQLite). FUNCIONAL.
│   ├── web/        ← Web pública + panel superadmin/sucursales (próxima etapa)
│   └── driver/     ← App del transportista, Android/iOS (próxima etapa)
└── docs/
    ├── ARQUITECTURA.md   ← decisiones técnicas, modelo de datos, flujo de estados
    ├── ROADMAP.md        ← las 9 áreas funcionales: qué entra en el MVP y qué después
    └── API.md            ← referencia de endpoints
```

## Cómo correrlo

Requiere Node.js 22.13 o superior (usa el SQLite integrado de Node, sin instalar base de datos).

```bash
npm install
npm run seed     # crea apps/api/data/4bahia.db con datos de demostración
npm run dev      # API en http://localhost:3000/api
npm test         # tests de punta a punta
```

### Usuarios de demostración (contraseña `Demo1234!`)

| Rol | Email |
|---|---|
| Superadmin | `admin@4bahia.test` |
| Admin sucursal Bahía Blanca | `bhi.admin@4bahia.test` |
| Operador Bahía Blanca / Tres Arroyos / Buenos Aires | `bhi.operador@…`, `tar.operador@…`, `bue.operador@4bahia.test` |
| Transportistas | `chofer1@4bahia.test`, `chofer2@4bahia.test` |
| Cliente comercial (Tienda Demo SRL) | `cliente@tiendademo.test` |

> ⚠️ Sucursales, localidades, zonas y tarifas cargadas son **ilustrativas**. Hay que reemplazarlas
> por las reales de Expreso 4 Bahía antes de cualquier demo con el cliente.

### Prueba rápida

```bash
# Login
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@4bahia.test","password":"Demo1234!"}' | jq -r .token)

# Panel de control
curl -s localhost:3000/api/admin/dashboard -H "authorization: Bearer $TOKEN" | jq

# Mapa en vivo (vehículos, posición GPS, ETA, alertas)
curl -s localhost:3000/api/fleet/live -H "authorization: Bearer $TOKEN" | jq

# Cotizar (público)
curl -s localhost:3000/api/public/quotes -H 'content-type: application/json' \
  -d '{"origin_locality_id":1,"dest_locality_id":9,"weight_kg":7,"length_cm":50,"width_cm":40,"height_cm":30,"delivery_type":"home","declared_value":100000}' | jq

# Seguimiento público (reemplazar por un código real del listado /api/shipments)
curl -s localhost:3000/api/public/tracking/4B123456789X | jq
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DB_PATH` | `data/4bahia.db` | Archivo SQLite |
| `JWT_SECRET` | *(dev)* | **Cambiar en producción** |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Base de los links de seguimiento en etiquetas y emails |
| `GPS_OFFLINE_MINUTES` | `10` | Minutos sin señal para marcar un vehículo como desconectado |
| `GPS_RETENTION_DAYS` | `90` | Retención del historial GPS (privacidad) |
| `WEBHOOKS_ENABLED` | `true` | Envío real de webhooks a tiendas |
