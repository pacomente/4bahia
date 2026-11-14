// Puente seguro entre las páginas y el proceso principal (sin acceso directo a Node).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxelia', {
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (p) => ipcRenderer.invoke('profile:save', p),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  listWorlds: () => ipcRenderer.invoke('worlds:list'),
  createWorld: (w) => ipcRenderer.invoke('worlds:create', w),
  deleteWorld: (id) => ipcRenderer.invoke('worlds:delete', id),
  loadWorld: (id) => ipcRenderer.invoke('worlds:load', id),
  saveWorld: (id, data) => ipcRenderer.invoke('worlds:save', id, data),
  play: (id) => ipcRenderer.invoke('game:play', id),
  exitGame: () => ipcRenderer.invoke('game:exit'),
  info: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  openRelease: (url) => ipcRenderer.invoke('app:open-release', url),
  onWorldsChanged: (fn) => ipcRenderer.on('worlds-changed', fn),
});
