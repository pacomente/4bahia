import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { enqueue } from './storage';
import { toPosition } from './syncEngine';
import { engine } from './sync';
import { getSession, loadSession } from './session';

export const LOCATION_TASK = '4bahia-location';

// Debe definirse a nivel global (se importa desde index.js antes de registrar la app),
// porque el sistema puede despertar la app solo para ejecutar esta tarea.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  for (const loc of data.locations) enqueue('position', toPosition(loc));
  // Con la app cerrada el sistema ejecuta solo esta tarea: la sesión puede no estar cargada.
  if (!getSession().token) await loadSession();
  if (getSession().token) await engine.flush();
});

export async function requestPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, message: 'Sin permiso de ubicación no se puede informar la posición del vehículo.' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { ok: true, background: bg.status === 'granted' };
}

// Seguimiento en segundo plano mientras haya un viaje en curso.
export async function startTracking() {
  const perm = await requestPermissions();
  if (!perm.ok) return perm;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return { ok: true, background: perm.background };
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,        // como máximo una lectura por minuto
    distanceInterval: 150,       // o cada 150 m recorridos
    deferredUpdatesInterval: 120_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Expreso 4 Bahía · viaje en curso',
      notificationBody: 'Se está compartiendo la ubicación del vehículo con la central.',
      notificationColor: '#e2591f',
    },
  });
  return { ok: true, background: perm.background };
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

// Posición actual para adjuntar a entregas e incidencias (sin bloquear si tarda).
export async function currentCoords() {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (last) return last.coords;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((r) => setTimeout(() => r(null), 5000)),
    ]);
    return pos?.coords ?? null;
  } catch {
    return null;
  }
}
