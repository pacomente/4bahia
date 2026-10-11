# Movi — demo de plataforma de viajes para empresas de taxi

Demo tipo Uber pensada para presentarle a una empresa de taxis o radio taxi. Tiene tres partes que funcionan juntas y en tiempo real:

| Parte | Ruta | Para quién |
|---|---|---|
| **App del pasajero** | `/pasajero` | Pide un viaje, compara precios, sigue al conductor en el mapa, chatea, comparte el viaje, paga y califica con propina |
| **App del conductor** | `/conductor` | Se conecta, recibe ofertas con cuenta regresiva, navega con Google Maps, marca llegada, inicio y fin, cobra y ve sus ganancias |
| **Panel de administración** | `/admin` | Mapa de la flota en vivo, **central telefónica**, viajes, conductores, pasajeros, liquidaciones, tarifas, promociones y configuración |
| Seguimiento compartido | `/viaje/:token` | Link que el pasajero comparte con un familiar |

Las dos apps son **web móviles**: se abren desde el celular con un link o escaneando el QR de la portada, sin pasar por las tiendas. En la compu se muestran dentro de un marco de teléfono, ideal para presentar.

## Correrlo

Requiere Node.js 22.13 o superior.

```bash
cd taxi
npm install
npm run build        # compila las pantallas
npm start            # http://localhost:4000
```

Para desarrollo con recarga automática: `npm run dev` (frontend en http://localhost:5173). Tests: `npm test`.

### Cuentas demo

Cada pantalla de ingreso tiene un botón **"Entrar con la cuenta demo"**. También se puede entrar a mano con la contraseña `DEMO_PASSWORD` (por defecto `demo1234`):

| Rol | Email |
|---|---|
| Pasajero | `pasajero@demo.com` |
| Conductor | `conductor@demo.com` |
| Administrador | `admin@demo.com` |
| Operador de central | `central@demo.com` |

## Cómo funciona la simulación

- Hay **12 conductores simulados** con sus autos (taxis, ejecutivos y XL) que circulan por la ciudad y aceptan viajes solos. Así la demo funciona aunque estés presentando solo.
- Si la **app del conductor está abierta y conectada**, los pedidos le llegan **primero a ella**. Si no responde en el tiempo configurado (20 s), el viaje pasa al siguiente conductor.
- En la app del conductor, el modo **Simulado** mueve el auto solo por la ruta; el modo **GPS real** usa la ubicación del celular.
- La velocidad de la simulación se ajusta en *Configuración* (x3 por defecto: un viaje de 5 km dura unos 4 minutos).
- Hay **14 días de historial** precargado para que el panel tenga gráficos y liquidaciones.
- Las rutas por calles usan OSRM y la búsqueda de direcciones usa OpenStreetMap (Nominatim), ambos servidores públicos de demostración. Si no responden, se usa un recorrido aproximado y la lista de lugares populares.

## Guion sugerido para la presentación (10 minutos)

1. **Portada:** mostrá las tres partes y pedile al cliente que escanee el QR del pasajero con su celular.
2. **Pasajero (su celular):** elige "Plaza Serrano", ve los precios de Taxi, Ejecutivo y XL, paga en efectivo y pide.
3. **Conductor (tu celular o pestaña):** llega la oferta con cuenta regresiva, la aceptás y el pasajero ve el auto acercarse en el mapa. Mandale un mensaje por el chat.
4. **Panel:** mapa en vivo con toda la flota, el viaje activo y su línea de tiempo.
5. **Central telefónica:** cargá un pedido de "Doña Rosa", que llamó por teléfono, y asignáselo a un móvil cercano. Esto suele ser lo que más le importa a una empresa de radio taxi.
6. **Cierre del viaje:** Llegué → Iniciar → Finalizar. El pasajero califica y deja propina.
7. **Negocio:** liquidaciones por conductor (efectivo vs. digital y comisión), tarifas editables y tarifa dinámica en *Configuración*.

## Configuración (variables de entorno)

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `4000` | Puerto |
| `BRAND_NAME` | `Movi` | Nombre visible de la marca |
| `CITY_NAME`, `CITY_LAT`, `CITY_LNG` | Buenos Aires | Ciudad de la demo. Buenos Aires trae lugares populares precargados; en otras ciudades se generan puntos alrededor del centro |
| `DEMO_PASSWORD` | `demo1234` | Contraseña de las cuentas demo (cambiarla al publicar) |
| `DEMO_QUICK_LOGIN` | `true` | Botones de ingreso rápido |
| `ROUTING` | activo | `off` desactiva OSRM y usa recorridos aproximados |
| `DB_PATH` | `data/taxi.db` | Base SQLite (se crea sola con datos demo) |

## Publicar en Render

`render.yaml` crea un servicio gratuito: **New → Blueprint**, elegí el repo e indicá `taxi/render.yaml` como *Blueprint path*. Render pide `DEMO_PASSWORD`.

A mano (*New → Web Service*): Root Directory `taxi`, Build `npm ci --include=dev && npm run build`, Start `npm start`, variable `NODE_VERSION=22`.

> En el plan gratuito el servicio se duerme tras 15 minutos sin uso: entrá unos minutos antes de la reunión. La base vuelve a los datos demo en cada reinicio.

## Qué falta para un producto real

- Apps nativas publicadas en Google Play y App Store (React Native), con GPS y notificaciones push en segundo plano.
- Cobro real con tarjeta o Mercado Pago, facturación electrónica y retenciones.
- Servidor de mapas y ruteo propio o pago (Google Maps / Mapbox), y PostgreSQL.
- Verificación de identidad y documentación de conductores, botón de pánico y soporte.
