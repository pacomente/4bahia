# Despliegue de prueba en Render

Despliegue **de demostración** en el plan gratuito de Render: la API y la web como dos servicios.

> ⚠️ **Plan gratuito = solo para mostrar.**
> - Los servicios se duermen tras 15 min sin uso; el primer acceso después tarda ~1 minuto.
> - El disco no es persistente: **la base se borra en cada reinicio o deploy** y se vuelve a cargar
>   sola con los datos de demostración. Lo que cargues en la demo no queda guardado.

## Opción A — Blueprint (recomendada)

El archivo [`render.yaml`](../render.yaml) crea todo de una vez.

1. Hacé merge del PR a `main` (Render despliega desde `main`).
2. En Render: **New → Blueprint** → conectá GitHub y elegí `pacomente/4bahia`.
3. Render muestra los dos servicios (`expreso4bahia-api` y `expreso4bahia-web`) y pide
   **`DEMO_PASSWORD`**: es la contraseña de todos los usuarios de demostración. Elegí una propia
   (no uses `Demo1234!`, que figura en el repositorio).
4. **Apply**. El primer build tarda unos minutos.
5. Verificá las URLs que asignó Render. Si son exactamente
   `https://expreso4bahia-api.onrender.com` y `https://expreso4bahia-web.onrender.com`, listo.
   Si Render agregó un sufijo porque el nombre estaba tomado:
   - En **expreso4bahia-api → Environment**: `PUBLIC_BASE_URL` = URL real de la web.
   - En **expreso4bahia-web → Environment**: `NEXT_PUBLIC_API_URL` = URL real de la API + `/api`.
   - En la web hacé **Manual Deploy → Deploy latest commit** (esa variable se incorpora al compilar).
6. Probá:
   - `https://<api>/api/health` → `{"ok":true,...}`
   - `https://<web>/ingresar` → entrar con `admin@4bahia.test` y tu `DEMO_PASSWORD`.

## Opción B — Si ya creaste los servicios a mano

Revisá que cada servicio tenga esta configuración (Settings / Environment):

| | API | Web |
|---|---|---|
| Runtime | Node | Node |
| Root Directory | *(vacío: raíz del repo)* | *(vacío)* |
| Build Command | `npm ci` | `npm ci && npm run build -w apps/web` |
| Start Command | `npm start -w apps/api` | `npm start -w apps/web` |
| Health Check Path | `/api/health` | — |
| `NODE_VERSION` | `22` | `22` |
| Otras variables | `JWT_SECRET` (valor largo al azar), `DEMO_PASSWORD`, `PUBLIC_BASE_URL=https://<web>` | `NEXT_PUBLIC_API_URL=https://<api>/api` |

Errores típicos:

| Síntoma | Causa | Solución |
|---|---|---|
| `No such built-in module: node:sqlite` | Node viejo | `NODE_VERSION=22` |
| La web despliega pero queda "no open ports detected" | Arrancaba fijo en el puerto 3001 | Ya corregido: `next start -p $PORT` |
| La web carga pero el login dice "No se pudo conectar con el servidor" | `NEXT_PUBLIC_API_URL` mal o cambiada sin redeploy | Corregir y volver a desplegar la web |
| Los QR de las etiquetas llevan a `localhost` | Falta `PUBLIC_BASE_URL` en la API | Poner la URL de la web |

## App del transportista contra Render

`apps/driver/app.json` ya apunta a `https://expreso4bahia-api.onrender.com/api`. Si tu URL es otra,
cambiala ahí o desde **Cambiar** en la pantalla de login de la app. Usuarios: `chofer1@4bahia.test` /
`chofer2@4bahia.test` con tu `DEMO_PASSWORD`.

## Para pasar a producción real (después)

- **Datos persistentes**: plan pago con *Persistent Disk* montado en `/var/data` y `DB_PATH=/var/data/4bahia.db`,
  o migrar a PostgreSQL (Render Postgres) — recomendado.
- Dominio propio (ej. `seguimiento.expresodea4bahia.com`) en Settings → Custom Domains.
- Emails reales (SMTP / proveedor transaccional) para las notificaciones encoladas.
- Fotos y firmas en almacenamiento de archivos (S3 / R2) en lugar de la base.
- Restringir CORS a los dominios propios.
