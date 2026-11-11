// Proceso principal de Electron: ventana del launcher, ventana del juego y guardado en disco.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DATA = () => app.getPath('userData');
const WORLDS = () => path.join(DATA(), 'worlds');
const SAFE_ID = /^[a-z0-9_-]{1,40}$/i;
let launcher = null;
let gameWin = null;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file); // escritura atómica: un corte no deja el mundo corrupto
}
const worldFile = (id) => {
  if (!SAFE_ID.test(String(id))) throw new Error('Identificador de mundo inválido');
  return path.join(WORLDS(), `${id}.json`);
};

function createLauncher() {
  launcher = new BrowserWindow({
    width: 1180, height: 720, minWidth: 940, minHeight: 600, backgroundColor: '#141414', title: 'Voxelia Launcher', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  launcher.loadFile(path.join(__dirname, 'index.html'));
  launcher.once('ready-to-show', () => launcher.show());
  launcher.on('closed', () => { launcher = null; if (!gameWin) app.quit(); });
}

async function openGame(world) {
  if (gameWin) { gameWin.focus(); return; }
  const settings = await readJson(path.join(DATA(), 'settings.json'), {});
  const profile = await readJson(path.join(DATA(), 'profile.json'), { name: 'Jugador' });
  gameWin = new BrowserWindow({
    width: 1280, height: 760, backgroundColor: '#000000', title: `Voxelia — ${world.name}`, show: false, fullscreen: !!settings.fullscreen,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  gameWin.setMenuBarVisibility(false);
  gameWin.loadFile(path.join(__dirname, '..', 'dist', 'game', 'index.html'), {
    query: { world: world.id, name: world.name, seed: world.seed, mode: world.mode, player: profile.name },
  });
  gameWin.once('ready-to-show', () => { gameWin.show(); if (!settings.fullscreen) gameWin.maximize(); });
  launcher?.hide();
  gameWin.on('closed', () => {
    gameWin = null;
    if (launcher) { launcher.show(); launcher.webContents.send('worlds-changed'); } else app.quit();
  });
}

// ───────── API para las páginas (vía preload) ─────────
ipcMain.handle('profile:get', () => readJson(path.join(DATA(), 'profile.json'), { name: 'Jugador', skin: 'grass' }));
ipcMain.handle('profile:save', (_e, p) => writeJson(path.join(DATA(), 'profile.json'), { name: String(p.name ?? 'Jugador').slice(0, 16), skin: p.skin ?? 'grass' }));
ipcMain.handle('settings:get', () => readJson(path.join(DATA(), 'settings.json'), {}));
ipcMain.handle('settings:save', async (_e, s) => writeJson(path.join(DATA(), 'settings.json'), { ...(await readJson(path.join(DATA(), 'settings.json'), {})), ...s }));

ipcMain.handle('worlds:list', async () => {
  await fs.mkdir(WORLDS(), { recursive: true });
  const files = (await fs.readdir(WORLDS())).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const full = path.join(WORLDS(), f);
    const w = await readJson(full, null);
    if (!w) continue;
    const stat = await fs.stat(full);
    // Foto del mundo (la guarda el juego): solo se acepta una imagen JPEG/PNG embebida.
    const thumb = typeof w.thumb === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(w.thumb) ? w.thumb : null;
    out.push({ id: w.id, name: w.name, seed: w.seed, mode: w.mode, savedAt: w.savedAt, playTime: w.playTime ?? 0, size: stat.size, thumb, nights: w.stats?.nights ?? 0 });
  }
  return out.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
});
ipcMain.handle('worlds:create', async (_e, w) => {
  const id = `w${Date.now().toString(36)}`;
  const world = { version: 1, id, name: String(w.name || 'Mundo nuevo').slice(0, 40), seed: String(w.seed || Math.floor(Math.random() * 1e9)), mode: w.mode === 'survival' ? 'survival' : 'creative', savedAt: new Date().toISOString(), playTime: 0 };
  await writeJson(worldFile(id), world);
  return world;
});
ipcMain.handle('worlds:delete', async (_e, id) => { await fs.rm(worldFile(id), { force: true }); return true; });
ipcMain.handle('worlds:load', (_e, id) => readJson(worldFile(id), null));
ipcMain.handle('worlds:save', (_e, id, data) => writeJson(worldFile(id), data));
ipcMain.handle('game:play', async (_e, id) => {
  const w = await readJson(worldFile(id), null);
  if (!w) throw new Error('El mundo no existe');
  await openGame(w);
});
ipcMain.handle('game:exit', () => { gameWin?.close(); });
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: DATA(), platform: process.platform }));
ipcMain.handle('app:open-data', () => shell.openPath(DATA()));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createLauncher();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createLauncher(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
