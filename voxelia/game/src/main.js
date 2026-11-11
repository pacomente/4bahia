import { Game } from './game.js';
import { loadWorld, loadSettings, saveSettings, exitToLauncher } from './storage.js';

const $ = (s) => document.querySelector(s);
const TIPS = [
  'Doble espacio en creativo para volar.',
  'Clic de rueda copia el bloque que estás mirando.',
  'Las lámparas brillan aunque sea de noche.',
  'En supervivencia, romper un bloque lleva tiempo según su dureza.',
  'Cuidado con las caídas largas en supervivencia.',
  'F3 muestra tu posición, bioma y semilla.',
  'Debajo de las montañas hay cuevas con carbón y hierro.',
];

async function startGame({ id, name, seed, mode, player }) {
  $('#title').classList.remove('open');
  $('#loading').classList.add('open');
  $('#tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const settings = await loadSettings();
  const save = await loadWorld(id);
  const game = new Game({ worldId: id, name: save?.name ?? name, seed: save?.seed ?? seed, mode: save?.mode ?? mode, playerName: player, settings, save });
  window.__game = game; // útil para depurar
  await game.preload((p) => { $('#loading-bar').style.width = `${Math.round(p * 100)}%`; });
  await game.save();
  $('#loading').classList.remove('open');
  bindMenus(game, settings);
  game.start();
  game.ui.toast(`¡Bienvenido a ${game.worldName}, ${player}!`, 3000);
}

function bindMenus(game, settings) {
  $('#btn-resume').onclick = () => game.pause(false);
  $('#btn-quit').onclick = () => game.saveAndExit();
  $('#btn-death-quit').onclick = () => game.saveAndExit();
  $('#btn-respawn').onclick = () => game.respawn();
  $('#btn-settings').onclick = () => { $('#settings-box').hidden = !$('#settings-box').hidden; $('#controls-box').hidden = true; };
  $('#btn-controls').onclick = () => { $('#controls-box').hidden = !$('#controls-box').hidden; $('#settings-box').hidden = true; };
  const bind = (inp, out, key, fmt) => {
    $(inp).value = settings[key];
    $(out).textContent = fmt(settings[key]);
    $(inp).oninput = (e) => { settings[key] = Number(e.target.value); $(out).textContent = fmt(settings[key]); game.applySettings(settings); saveSettings(settings); };
  };
  bind('#s-rd', '#v-rd', 'renderDistance', (v) => `${v} chunks`);
  bind('#s-fov', '#v-fov', 'fov', (v) => `${v}°`);
  bind('#s-sens', '#v-sens', 'sensitivity', (v) => `${Number(v).toFixed(1)}x`);
  bind('#s-vol', '#v-vol', 'volume', (v) => `${Math.round(v * 100)}%`);
  $('#s-fps').checked = settings.showFps;
  $('#s-fps').onchange = (e) => { settings.showFps = e.target.checked; saveSettings(settings); };
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (game.inventoryOpen) { game.toggleInventory(); return; }
    if (game.craftOpen) { game.toggleCraft(); return; }
    if (!game.dead) game.pause(!game.paused);
  });
}

// Pantalla de título para jugar desde el navegador (sin launcher).
function titleScreen() {
  $('#loading').classList.remove('open');
  $('#title').classList.add('open');
  const list = Object.keys(localStorage).filter((k) => k.startsWith('voxelia_world_')).map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }).filter(Boolean)
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  $('#title-worlds').innerHTML = list.map((w) => `
    <div class="world-item" data-id="${w.id}"><div class="grow"><b>${escapeHtml(w.name)}</b><div class="muted">${w.mode === 'survival' ? 'Supervivencia' : 'Creativo'} · semilla ${escapeHtml(w.seed)}</div></div><span>▶</span></div>`).join('');
  $('#title-worlds').querySelectorAll('.world-item').forEach((el) => el.addEventListener('click', () => {
    const w = list.find((x) => x.id === el.dataset.id);
    startGame({ id: w.id, name: w.name, seed: w.seed, mode: w.mode, player: 'Jugador' });
  }));
  $('#new-world').onsubmit = (e) => {
    e.preventDefault();
    const seed = $('#nw-seed').value.trim() || String(Math.floor(Math.random() * 1e9));
    startGame({ id: `w${Date.now().toString(36)}`, name: $('#nw-name').value.trim() || 'Mi mundo', seed, mode: $('#nw-mode').value, player: 'Jugador' });
  };
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

const p = new URLSearchParams(location.search);
if (p.get('world')) {
  startGame({ id: p.get('world'), name: p.get('name') ?? 'Mundo', seed: p.get('seed') ?? 'voxelia', mode: p.get('mode') ?? 'creative', player: p.get('player') ?? 'Jugador' })
    .catch((e) => { console.error(e); alert(`No se pudo abrir el mundo: ${e.message}`); exitToLauncher(); });
} else {
  titleScreen();
}
