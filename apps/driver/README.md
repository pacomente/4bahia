# apps/driver — App del transportista

React Native con **Expo SDK 57** (JavaScript). Android primero; también compila para iOS.
Proyecto independiente (no forma parte de los workspaces de npm de la raíz) para no mezclar
la versión de React de React Native con la de la web.

## Qué hace

| Función | Cómo |
|---|---|
| Login personal | Email y contraseña del transportista. La URL del servidor se puede cambiar en la pantalla de login |
| Viajes y paquetes asignados | Troncales (sucursal → sucursal) y repartos, con el orden de paradas |
| Navegación | "Cómo llegar" abre Google Maps / Waze con la dirección; en troncales, a la sucursal destino |
| Escaneo de etiquetas | Cámara (QR y código de barras 128) o tipeo manual si la etiqueta está dañada |
| Entregas | Nombre y DNI de quien recibe + firma en pantalla y/o foto. Confirmación del cobro de contrarreembolso |
| Visita fallida, rechazo, daño, demora | Con motivo obligatorio (lista estándar) y comentario |
| GPS en segundo plano | Solo con viaje en curso: se activa al iniciar el viaje y se detiene al finalizar el último. Android muestra una notificación fija mientras comparte ubicación |
| Sin señal | Todo se guarda en SQLite local y se envía solo al volver la conexión (`/driver/sync`, idempotente por `client_event_id`). Los viajes se muestran desde la última copia guardada |
| Llamar al destinatario | Botón "Llamar" |

Iniciar y finalizar un viaje **sí requieren conexión**, porque cambian el estado de todos los paquetes del viaje en el servidor.

## Correrlo

```bash
cd apps/driver
npm install
npx expo start          # escanear el QR con Expo Go (Android) o la cámara (iOS)
```

El GPS en segundo plano **no funciona en Expo Go**: requiere un *development build*:

```bash
npx expo run:android    # con Android Studio instalado, o:
npx eas build --profile development --platform android
```

### Servidor

Por defecto apunta a `http://10.0.2.2:3000/api` (la API local vista desde el emulador de Android).
Para usar la API publicada (Render), cambiá `extra.apiUrl` en `app.json` o tocá **Cambiar** en el login
y poné `https://<tu-api>.onrender.com/api`.

Usuarios demo: `chofer1@4bahia.test` / `chofer2@4bahia.test`, contraseña `Demo1234!`.

## Estructura

```
App.js                 navegación (pila simple) y ciclo de sincronización
index.js               registra la tarea de GPS antes de montar la app
src/
  syncEngine.js        cola offline → /driver/sync (JS puro, testeado)
  storage.js           SQLite: outbox, rechazados, caché de viajes
  sync.js              motor de sync + registro de acciones del chofer
  location.js          tarea de GPS en segundo plano y permisos
  session.js           token y servidor en SecureStore
  api.js / trips.js    acceso a la API con caché
  screens/             Login, Viajes, Viaje, Paquete, Entregar, Incidencia, Escáner, Foto, Rechazados
  components/          UI, barra de sincronización, firma
test/syncEngine.test.mjs
```

```bash
npm test                # tests del motor de sincronización
npm run export:android  # verifica que el bundle compila
```

## Privacidad y batería

- La ubicación se toma como máximo una vez por minuto o cada 150 m, con precisión "balanceada".
- Solo se comparte con un viaje en curso; el chofer ve un aviso en la app y en la notificación de Android.
- El historial se purga en el servidor según `GPS_RETENTION_DAYS`.
