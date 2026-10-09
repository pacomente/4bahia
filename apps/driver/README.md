# apps/driver — App del transportista (etapa 3)

Pendiente. Propuesta: **React Native con Expo** (Android primero).

- Login, viajes asignados, paradas con navegación (Google Maps / Waze).
- Escaneo de QR con la cámara (`/api/driver/scan/:code`).
- Entrega con firma en pantalla, foto y DNI; visita fallida con motivo.
- GPS en segundo plano (`expo-location` + `expo-task-manager`) con permiso explícito y aviso visible.
- Cola local (SQLite) de eventos y posiciones con `client_event_id`; sincroniza con `/api/driver/sync` al volver la señal.
