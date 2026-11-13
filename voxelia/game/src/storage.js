// Guardado: en el launcher (Electron) usa archivos vía `window.voxelia`; en el navegador, localStorage.
const LS = 'voxelia_world_';
const bridge = () => (typeof window !== 'undefined' ? window.voxelia : null);

export async function loadWorld(id) {
  if (bridge()?.loadWorld) return bridge().loadWorld(id);
  try { return JSON.parse(localStorage.getItem(LS + id)); } catch { return null; }
}

export async function saveWorld(id, data) {
  if (bridge()?.saveWorld) return bridge().saveWorld(id, data);
  try { localStorage.setItem(LS + id, JSON.stringify(data)); } catch (e) { console.warn('No se pudo guardar', e); }
}

export async function loadSettings() {
  const defaults = { renderDistance: 6, fov: 75, sensitivity: 1, volume: 0.6, music: 0.5, minimap: true, showFps: false };
  if (bridge()?.getSettings) return { ...defaults, ...(await bridge().getSettings()) };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('voxelia_settings') ?? '{}') }; } catch { return defaults; }
}

export async function saveSettings(s) {
  if (bridge()?.saveSettings) return bridge().saveSettings(s);
  try { localStorage.setItem('voxelia_settings', JSON.stringify(s)); } catch {}
}

export function exitToLauncher() {
  if (bridge()?.exitGame) bridge().exitGame();
  // En el navegador: si vino del launcher web vuelve a él; si no, a la pantalla de título.
  else location.href = new URLSearchParams(location.search).get('from') === 'launcher' ? '../../launcher/index.html' : './index.html';
}
