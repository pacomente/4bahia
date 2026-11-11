// Interfaz del launcher. En Electron usa window.voxelia (preload); en el navegador, una versión con localStorage.
const api = window.voxelia ?? browserApi();
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let worlds = [];
let settings = {};

const NEWS = [
  { date: '11/11/2026', title: 'Voxelia 0.2 — Supervivencia', items: ['Taller: fabricá con un clic, sin recetas para memorizar', 'Sombras nocturnas que le temen a la luz', 'Energía en lugar de hambre', 'Cristales en cuevas profundas, faro y planeador', 'Misiones guiadas, herramientas por nivel, corazones extra y lluvia'] },
  { date: '11/11/2026', title: 'Voxelia 0.1 — primera beta', items: ['Mundo infinito con biomas: llanuras, bosques, desierto, nieve y montañas', 'Cuevas con carbón y hierro', 'Modos Creativo y Supervivencia', 'Ciclo de día y noche con nubes y estrellas', '22 bloques para construir'] },
  { date: 'Próximamente', title: 'En desarrollo', items: ['Animales', 'Multijugador en red local', 'Paquetes de texturas'] },
  { date: 'Consejo', title: 'Cómo empezar', items: ['Creá un mundo en Creativo para explorar volando (doble espacio)', 'Usá E para elegir bloques y la rueda del mouse para cambiar', 'En Supervivencia, C abre el Taller y la luz te protege de las Sombras', 'F3 muestra tu posición, bioma y semilla'] },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const modeLabel = (m) => (m === 'survival' ? 'Supervivencia' : 'Creativo');
const ago = (iso) => {
  if (!iso) return 'nunca';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
};
const playTime = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200); }

// Navegación
$$('.nav').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
function showView(v) {
  $$('.nav').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach((s) => s.classList.toggle('active', s.id === `view-${v}`));
}

async function refreshWorlds() {
  worlds = await api.listWorlds();
  const sel = $('#world-select');
  const prev = sel.value;
  sel.innerHTML = worlds.length
    ? worlds.map((w) => `<option value="${esc(w.id)}">${esc(w.name)} · ${modeLabel(w.mode)}</option>`).join('')
    : '<option value="">Todavía no tenés mundos</option>';
  if (worlds.some((w) => w.id === prev)) sel.value = prev;
  $('#play-btn').textContent = worlds.length ? 'JUGAR' : 'CREAR MUNDO';
  $('#world-list').innerHTML = worlds.length ? worlds.map((w) => `
    <div class="world-card">
      <div class="thumb ${w.mode}"></div>
      <div class="body">
        <b>${esc(w.name)}</b>
        <span><span class="badge ${w.mode}">${modeLabel(w.mode)}</span></span>
        <small class="muted">Semilla ${esc(w.seed)} · jugado ${ago(w.savedAt)} · ${playTime(w.playTime ?? 0)}</small>
        <div class="row"><button class="play small" data-play="${esc(w.id)}">Jugar</button><button class="danger" data-del="${esc(w.id)}">Eliminar</button></div>
      </div>
    </div>`).join('') : '<p class="empty">No hay mundos todavía. Creá el primero con “Nuevo mundo”.</p>';
  $$('[data-play]').forEach((b) => b.addEventListener('click', () => play(b.dataset.play)));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const w = worlds.find((x) => x.id === b.dataset.del);
    if (!confirm(`¿Eliminar "${w.name}"? No se puede deshacer.`)) return;
    await api.deleteWorld(w.id);
    toast('Mundo eliminado');
    refreshWorlds();
  }));
}

async function play(id) {
  if (!id) { openNewWorld(); return; }
  $('#play-btn').disabled = true;
  try { await api.play(id); } catch (e) { toast(e.message); } finally { setTimeout(() => { $('#play-btn').disabled = false; }, 1500); }
}

function openNewWorld() { $('#w-name').value = `Mundo ${worlds.length + 1}`; $('#w-seed').value = ''; $('#dlg-world').showModal(); }
$('#play-btn').addEventListener('click', () => play($('#world-select').value));
$('#new-world-btn').addEventListener('click', openNewWorld);
$('#new-world-btn2').addEventListener('click', openNewWorld);
$('#dlg-world').addEventListener('close', async () => {
  if ($('#dlg-world').returnValue !== 'ok') return;
  const w = await api.createWorld({ name: $('#w-name').value.trim(), seed: $('#w-seed').value.trim(), mode: document.querySelector('input[name=mode]:checked').value });
  await refreshWorlds();
  $('#world-select').value = w.id;
  play(w.id);
});

// Perfil
async function loadProfile() { const p = await api.getProfile(); $('#profile-name').textContent = p.name; return p; }
$('#edit-profile').addEventListener('click', async () => { $('#p-name').value = (await api.getProfile()).name; $('#dlg-profile').showModal(); });
$('#dlg-profile').addEventListener('close', async () => {
  if ($('#dlg-profile').returnValue !== 'ok') return;
  await api.saveProfile({ name: $('#p-name').value.trim() });
  loadProfile();
  toast('Perfil actualizado');
});

// Ajustes
async function loadSettings() {
  settings = { renderDistance: 6, fov: 75, sensitivity: 1, volume: 0.6, showFps: false, fullscreen: false, ...(await api.getSettings()) };
  const bind = (id, out, key, fmt) => {
    $(id).value = settings[key]; $(out).textContent = fmt(settings[key]);
    $(id).addEventListener('input', (e) => { settings[key] = Number(e.target.value); $(out).textContent = fmt(settings[key]); api.saveSettings(settings); });
  };
  bind('#i-rd', '#o-rd', 'renderDistance', (v) => `${v} chunks`);
  bind('#i-fov', '#o-fov', 'fov', (v) => `${v}°`);
  bind('#i-sens', '#o-sens', 'sensitivity', (v) => `${Number(v).toFixed(1)}x`);
  bind('#i-vol', '#o-vol', 'volume', (v) => `${Math.round(v * 100)}%`);
  for (const [id, key] of [['#i-full', 'fullscreen'], ['#i-fps', 'showFps']]) {
    $(id).checked = !!settings[key];
    $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; api.saveSettings(settings); });
  }
  const info = await api.info();
  $('#data-path').textContent = info.dataPath;
  $('#app-version').textContent = `Voxelia ${info.version} · ${info.platform}`;
  $('#open-data').addEventListener('click', () => api.openDataFolder());
}

function renderNews() {
  $('#news-strip').innerHTML = NEWS.map((n) => `<div class="news-card"><small>${n.date}</small><b>${esc(n.title)}</b><small>${esc(n.items[0])}</small></div>`).join('');
  $('#news-list').innerHTML = NEWS.map((n) => `<article><small class="muted">${n.date}</small><h3>${esc(n.title)}</h3><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></article>`).join('');
}

api.onWorldsChanged?.(() => refreshWorlds());
renderNews();
loadProfile();
loadSettings();
refreshWorlds();

// ───────── Modo navegador (sin Electron): mismos datos que usa el juego en localStorage ─────────
function browserApi() {
  const KEY = 'voxelia_world_';
  const all = () => Object.keys(localStorage).filter((k) => k.startsWith(KEY)).map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }).filter(Boolean);
  return {
    getProfile: async () => JSON.parse(localStorage.getItem('voxelia_profile') ?? '{"name":"Jugador"}'),
    saveProfile: async (p) => localStorage.setItem('voxelia_profile', JSON.stringify(p)),
    getSettings: async () => JSON.parse(localStorage.getItem('voxelia_settings') ?? '{}'),
    saveSettings: async (s) => localStorage.setItem('voxelia_settings', JSON.stringify(s)),
    listWorlds: async () => all().map((w) => ({ ...w, size: JSON.stringify(w).length })).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))),
    createWorld: async (w) => {
      const world = { version: 1, id: `w${Date.now().toString(36)}`, name: w.name || 'Mundo nuevo', seed: w.seed || String(Math.floor(Math.random() * 1e9)), mode: w.mode, savedAt: new Date().toISOString(), playTime: 0 };
      localStorage.setItem(KEY + world.id, JSON.stringify(world));
      return world;
    },
    deleteWorld: async (id) => localStorage.removeItem(KEY + id),
    play: async (id) => {
      const w = JSON.parse(localStorage.getItem(KEY + id));
      const p = JSON.parse(localStorage.getItem('voxelia_profile') ?? '{"name":"Jugador"}');
      location.href = `../dist/game/index.html?${new URLSearchParams({ world: w.id, name: w.name, seed: w.seed, mode: w.mode, player: p.name, from: 'launcher' })}`;
    },
    info: async () => ({ version: '0.2.0', dataPath: 'Navegador (localStorage)', platform: 'web' }),
    openDataFolder: async () => toast('Disponible en la app de escritorio'),
  };
}
