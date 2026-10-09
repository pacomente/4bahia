# Roadmap — qué entra en el MVP y qué después

Leyenda: ✅ hecho (backend en etapa 1; pantallas web en etapa 2) · 🖥️ falta la pantalla de la app móvil (etapa 3) · 🔜 fase posterior

> En la etapa 2 se completaron todas las pantallas web marcadas antes con 🖥️ (panel, mapa, tarifas, sucursal, cliente). Quedan 🖥️ solo las de la app del transportista.

## Etapas

| Etapa | Contenido | Estado |
|---|---|---|
| **1. Estructura + backend** | Monorepo, modelo de datos, API completa del circuito, tests | ✅ **esta entrega** |
| **2. Web y panel** (`apps/web`) | Web pública (seguimiento, cotizador, contacto, área cliente) + panel superadmin + panel sucursal | ✅ hecho |
| **3. App transportista** (`apps/driver`) | React Native/Expo: login, viajes, escaneo, entregas con firma/foto, GPS en segundo plano, offline | siguiente |
| **4. Producción** | PostgreSQL, almacenamiento de archivos, emails reales, despliegue, datos reales de 4 Bahía | |
| **5. Extensiones** | Facturación ARCA, plugin WooCommerce, Shopify/Tiendanube, desvíos de ruta, PDF | presupuestar |

## Las 9 áreas funcionales

### 1. Superadmin — control total
| Funcionalidad | MVP |
|---|---|
| Panel de control: paquetes, entregas, facturación | ✅ `GET /api/admin/dashboard` · 🖥️ |
| Mapa general: sucursales, vehículos, GPS | ✅ `GET /api/fleet/live` · 🖥️ |
| Usuarios, roles y permisos | ✅ 5 roles fijos + alcance por sucursal · 🔜 permisos granulares configurables |
| Tarifas, zonas, servicios, sucursales | ✅ `/api/catalog/*` · 🖥️ |
| Historial de actividad y auditoría | ✅ `GET /api/admin/audit` |
| Reportes exportables Excel / PDF | ✅ CSV (abre en Excel) · 🔜 .xlsx nativo y PDF |

### 2. Gestión de paquetes y encomiendas
| Funcionalidad | MVP |
|---|---|
| Alta con código único y etiqueta QR | ✅ código `4B` + 10 dígitos con verificador, etiqueta 10×15 imprimible con QR · 🔜 código de barras 1D |
| Remitente y destinatario | ✅ |
| Ciudad, provincia, origen, destino, sucursal | ✅ |
| Peso, dimensiones, bultos, valor declarado | ✅ (una etiqueta por bulto) |
| Recepción, clasificación, despacho, entrega | ✅ |
| Dañados, extraviados, demorados, rechazados | ✅ con motivo obligatorio |
| Historial completo | ✅ `shipment_events` |

### 3. Seguimiento GPS de camiones
| Funcionalidad | MVP |
|---|---|
| Ubicación en mapa | ✅ API · 🖥️ mapa |
| Recorridos, viajes y paradas | ✅ viajes y recorrido histórico · 🔜 detección automática de paradas |
| Asignación de paquetes a camiones/viajes | ✅ |
| Estado de conexión y última posición | ✅ |
| Alertas por demoras | ✅ · 🔜 desvíos (requiere rutas planificadas + PostGIS) |
| Historial sujeto a privacidad | ✅ retención configurable |
| Estimación de llegada | ✅ básica (distancia/velocidad) · 🔜 con motor de ruteo |

### 4. Aplicación del transportista
| Funcionalidad | MVP |
|---|---|
| Login personal | ✅ API · 🖥️ app |
| Viajes y paquetes asignados | ✅ |
| Navegación hacia destinos | ✅ link Google Maps por parada |
| Escaneo de etiquetas | ✅ `GET /api/driver/scan/:code` · 🖥️ cámara |
| Actualización de estados | ✅ |
| Entregas, incidencias, motivos de visita fallida | ✅ lista de motivos estándar |
| Firma, foto o comprobante | ✅ almacenamiento · 🖥️ captura |
| GPS en segundo plano con permisos | ✅ recepción en lote · 🖥️ app |
| Sincronización offline | ✅ idempotente por `client_event_id` |

### 5. Panel de sucursales
| Funcionalidad | MVP |
|---|---|
| Ingreso y recepción | ✅ |
| Escaneo masivo | ✅ resultados por código |
| Clasificación por destino | ✅ |
| Despachos y transferencias | ✅ |
| Recepción confirmada en destino | ✅ |
| Entrega en mostrador | ✅ con comprobante |
| Pendientes y demorados | ✅ `GET /api/branches/:id/ops/pending` |
| Usuarios y permisos por sucursal | ✅ |

### 6. Web de clientes y seguimiento público
| Funcionalidad | MVP |
|---|---|
| Consulta por código | ✅ |
| Línea de tiempo, estado actual, última actualización | ✅ |
| Origen, destino, fechas | ✅ |
| Historial para clientes registrados | ✅ |
| Cotizaciones y nuevos envíos | ✅ |
| Contacto y reclamos | ✅ |
| Notificaciones por email | ✅ cola · 🔜 envío real (SMTP) |
| Protección de datos privados | ✅ enmascarado |

### 7. Cotizador inteligente
✅ Todo el núcleo: zona/provincia/localidad, peso real y volumétrico, bultos, servicio, domicilio/sucursal,
seguro, contrarreembolso, tarifa comercial, IVA, estimado vs. definitivo.
🔜 reglas de descuentos/recargos por fecha o volumen, impuestos provinciales (IIBB).

### 8. Administración comercial y financiera
| Funcionalidad | MVP |
|---|---|
| Cobros y cargos por envío | ✅ |
| Cuentas corrientes | ✅ |
| Facturación fiscal | 🔜 requiere integración con ARCA u otro proveedor autorizado |
| Contrarreembolsos | ✅ pendiente → cobrado → rendido |
| Liquidaciones pendientes de rendir | ✅ |
| Informes de ingresos | ✅ · 🔜 costos |
| Exportaciones contables | ✅ CSV |

### 9. Integraciones y API
| Funcionalidad | MVP |
|---|---|
| API para sistemas externos | ✅ `/api/v1` con API key |
| Envíos y etiquetas desde tiendas | ✅ idempotente por `external_ref` |
| Sincronización de códigos de seguimiento | ✅ |
| Webhooks de cambio de estado | ✅ firmados HMAC |
| Plugin WooCommerce | 🔜 la API ya está lista para consumirse |
| Shopify / Tiendanube | 🔜 presupuestar según requisitos |

## Datos que necesitamos de Expreso 4 Bahía

- Sucursales reales: dirección, teléfono, horario, coordenadas.
- Localidades que cubren y con qué sucursal; dónde hay reparto a domicilio.
- Esquema de zonas y tarifas vigentes (tramos de peso, $/kg, adicionales, seguro, contrarreembolso).
- Servicios que ofrecen (estándar, express, otros) y plazos.
- Flota: vehículos y choferes.
- Logo, colores y textos para la web.
