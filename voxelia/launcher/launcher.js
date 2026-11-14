// Interfaz del launcher. En Electron usa window.voxelia (preload); en el navegador, una versión con localStorage.
const api = window.voxelia ?? browserApi();
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let worlds = [];
let settings = {};

const NEWS = [
  { date: '14/11/2026', title: 'Voxelia 0.17 — Presentación', items: ['Tutorial para quien juega por primera vez', '18 logros con aviso y lista en el diario (J)', 'Dificultad: pacífico, normal o difícil', 'Teclas configurables, tamaño de la interfaz y modo daltónico', 'Vista en tercera persona (F5), de atrás o de frente', 'Física: la arena y la grava caen, los árboles se vienen abajo al cortarles la base y el agua corre', 'El launcher avisa si hay una versión nueva y guarda copias de seguridad de tus mundos', 'Arreglo: ahora sí se guarda la foto de cada mundo para la lista'] },
  { date: '14/11/2026', title: 'Voxelia 0.16 — Combate y objetivos', items: ['Golpe cargado con espada (mantener y soltar) y desvío con el escudo', 'Saqueadores nuevos: escudero y lanzador de bombas', 'Amenaza creciente si no frenás a los campamentos', 'Señorío: cobrá impuestos, contratá guardias, acelerá obras y declarás fiestas', 'Tu propia casa en un pueblo', 'Mazmorras con el Rey Sombrío: un jefe con tres fases'] },
  { date: '14/11/2026', title: 'Voxelia 0.15 — Pueblos vivos', items: ['Panadero, médico, cartógrafo y bibliotecario', 'Encargos de cada vecino; te recuerdan por tu nombre', 'Chismes, aldeas aliadas y rivales, refuerzos en los ataques', 'Fiestas con baile y torneo de guardias, casamientos y sucesión del rey', 'Diario de viaje (J) y libros con historias del mundo'] },
  { date: '14/11/2026', title: 'Voxelia 0.14 — Exploración', items: ['Pantanos, selvas y cañones de roca roja', 'Ruinas: torres, templos y minas con botín y mapas del tesoro', 'Lobos que se domestican, loros, serpiente marina y dragón', 'Tormentas en alta mar que dan vuelta el bote'] },
  { date: '14/11/2026', title: 'Voxelia 0.13 — Supervivencia', items: ['Hambre, cocina (fogata, hogar y horno) y pesca con caña', 'Zanahorias, papas, calabazas, manzanos y colmenas con miel', 'El herrero refuerza tu equipo hasta +3'] },
  { date: '14/11/2026', title: 'Voxelia 0.11–0.12 — Base y sensaciones', items: ['El mundo se arma en segundo plano: muchos menos tirones', 'Los personajes buscan el camino (rodean casas y paredes)', 'Tormentas con rayos, nieve, auroras, luna con fases y estrellas fugaces', 'Sonido ambiente y música según la zona'] },
  { date: '14/11/2026', title: 'Voxelia 0.10 — Vida de pueblo', items: ['Iglesias con campanario, vitrales y bancos: a la tarde suena la campana y los vecinos van a misa', 'Escuelas con pupitres y pizarrón: los chicos van a clase a la mañana con la maestra', 'Corrales con lanudos, gallinas y caballos que los granjeros alimentan', 'Caballos: montalos (clic derecho) y corré el doble de rápido', 'Caminos de grava con faroles y puentes que unen los pueblos', 'Carretas de comercio que llevan comida, madera y piedra de un pueblo a otro y se pagan en plata', 'Los aldeanos tienen su bolsa de plata: cobran jornales, se compran cosas en el mercado y el rey cobra impuestos para el tesoro', 'Guardias con espada y escudo: dan la alarma, se reparten los enemigos, rodean al jefe, se cubren justo antes del golpe y contraatacan; si están muy heridos se repliegan a curarse', 'Las flechas de los saqueadores ahora también alcanzan a los vecinos (los guardias las frenan con el escudo)', 'Arreglo: los aldeanos ahora saben qué hora es (antes vivían siempre al mediodía)'] },
  { date: '14/11/2026', title: 'Voxelia 0.9 — Mares y vida', items: ['Océanos grandes con arrecifes de coral, algas, pastos marinos, peces y medusas que brillan de noche', 'Puertos: aldeas costeras con muelle, faro, pescadores y marineros', 'Barcos mercantes que llegan a los puertos y abaratan gemas, hierro y lana', 'Botes: fabricalos con 5 tablas y navegá (W/S reman, A/D giran, Shift para bajar)', 'Barcos hundidos con cofres llenos de perlas, oro y plata', 'Bosques con pinos, robles grandes, troncos caídos y arbustos de bayas; palmeras en las playas', 'Animales nuevos: ciervos, conejos y cangrejos; dejan carne para comer', 'Cada aldea tiene su propia economía: los precios cambian según el bioma, las reservas y los barcos', 'Nota: el terreno de los mundos viejos cambia (ahora hay mares)'] },
  { date: '14/11/2026', title: 'Voxelia 0.8 — Hogar', items: ['Herramientas, armas, armaduras, materiales y comida rediseñados en pixel-art de 32×32', 'Casas amuebladas: mesas, sillas, hogar a leña con chimenea, bibliotecas, alfombras, barriles, heno y yunque', 'Tres tipos de casa: familiar, taller y granja; flores en la entrada', 'De noche los aldeanos se sientan a cenar antes de ir a dormir', 'Trono en el castillo y mercadería en los puestos del mercado', 'Pestaña Muebles en el Taller para decorar tu propia casa'] },
  { date: '14/11/2026', title: 'Voxelia 0.7 — Profundidades y saqueadores', items: ['Cavernas enormes, grietas que abren la superficie y lagos de lava en el fondo', 'Hongos luminosos y musgo en las cuevas; oro en lo profundo', 'Campamentos de saqueadores con empalizada, carpas, jaulas con prisioneros y cofre del botín', 'Saqueadores con hacha, arqueros que te disparan y un jefe con barra de vida', 'De noche hacen incursiones a las aldeas: los guardias los enfrentan', 'Tu personaje en el inventario sigue el cursor; muchos errores corregidos'] },
  { date: '13/11/2026', title: 'Voxelia 0.6 — Reino', items: ['Rey o reina en un castillo (o jefe/a): encargos que se pagan en plata y rangos de Plebeyo a Héroe', 'Monedas de plata: comprá y vendé con cada oficio; mercado con puestos en la plaza', 'Armadura acolchada, de hierro y de cristal; escudo que se levanta con clic derecho o V', 'Comida: manzanas, trigo, pan y pastel. Campos que crecen y se cosechan', 'Camas para dormir hasta la mañana, puertas que se abren y ventanas', 'Aldeanos con hambre, sueño y ánimo: duermen en sus camas, almuerzan, forman parejas y tienen hijos'] },
  { date: '13/11/2026', title: 'Voxelia 0.5 — Aldeas vivas', items: ['Aldeas medievales (con torre de vigilancia), del bosque, del desierto y de la nieve', 'Aldeanos con nombre, oficio y personalidad: charlan, saludan y hacen trueques', 'De noche se esconden en sus casas; los guardias patrullan con antorchas', 'La población crece y el constructor levanta casas nuevas bloque por bloque', 'Zombis nocturnos que al amanecer se esconden en la sombra o se queman', 'Arco y flechas, escudo, y el herrero repara herramientas'] },
  { date: '11/11/2026', title: 'Voxelia 0.4 — Movimiento, mano y Mesa de trabajo', items: ['La cámara se balancea al caminar, se abre al correr y se hunde al aterrizar', 'Ves tu mano y lo que tenés agarrado, con animación al golpear', 'Agachate con Shift para no caerte de los bordes; salto más preciso', 'Mesa de trabajo y un Taller nuevo con categorías y "Fabricar todo"', 'Espadas y herramientas de cristal; las herramientas se gastan', 'Sombras con estela de humo y Lanudos que pastan, parpadean y mueven la cola'] },
  { date: '11/11/2026', title: 'Voxelia 0.3 — Luz, mapa y vida', items: ['Iluminación real: lámparas, antorchas, cristales y faros alumbran de noche y en las cuevas', 'Antorchas baratas (carbón + tablas)', 'Minimapa y mapa completo (M) con tus faros', 'Lanudos: animales que pastan de día y sueltan lana', 'Música ambiental generada, distinta de día, de noche y bajo tierra', 'El launcher muestra una foto de cada mundo'] },
  { date: '11/11/2026', title: 'Voxelia 0.2 — Supervivencia', items: ['Taller: fabricá con un clic, sin recetas para memorizar', 'Sombras nocturnas que le temen a la luz', 'Energía en lugar de hambre', 'Cristales en cuevas profundas, faro y planeador', 'Misiones guiadas, herramientas por nivel, corazones extra y lluvia'] },
  { date: '11/11/2026', title: 'Voxelia 0.1 — primera beta', items: ['Mundo infinito con biomas: llanuras, bosques, desierto, nieve y montañas', 'Cuevas con carbón y hierro', 'Modos Creativo y Supervivencia', 'Ciclo de día y noche con nubes y estrellas', '22 bloques para construir'] },
  { date: 'Próximamente', title: 'En desarrollo', items: ['Más animales y biomas', 'Cofres y mascotas', 'Multijugador en red local', 'Paquetes de texturas'] },
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
const safeThumb = (t) => typeof t === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(t);
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
      <div class="thumb ${w.mode}" ${safeThumb(w.thumb) ? `style="background-image:url('${w.thumb}')"` : ''}></div>
      <div class="body">
        <b>${esc(w.name)}</b>
        <span><span class="badge ${w.mode}">${modeLabel(w.mode)}</span></span>
        <small class="muted">Semilla ${esc(w.seed)} · jugado ${ago(w.savedAt)} · ${playTime(w.playTime ?? 0)}${w.mode === 'survival' ? ` · día ${(w.nights ?? 0) + 1}` : ''}</small>
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
  settings = { renderDistance: 6, fov: 75, sensitivity: 1, volume: 0.6, music: 0.5, minimap: true, showFps: false, fullscreen: false, ...(await api.getSettings()) };
  const bind = (id, out, key, fmt) => {
    $(id).value = settings[key]; $(out).textContent = fmt(settings[key]);
    $(id).addEventListener('input', (e) => { settings[key] = Number(e.target.value); $(out).textContent = fmt(settings[key]); api.saveSettings(settings); });
  };
  bind('#i-rd', '#o-rd', 'renderDistance', (v) => `${v} chunks`);
  bind('#i-fov', '#o-fov', 'fov', (v) => `${v}°`);
  bind('#i-sens', '#o-sens', 'sensitivity', (v) => `${Number(v).toFixed(1)}x`);
  bind('#i-vol', '#o-vol', 'volume', (v) => `${Math.round(v * 100)}%`);
  bind('#i-mus', '#o-mus', 'music', (v) => `${Math.round(v * 100)}%`);
  for (const [id, key] of [['#i-full', 'fullscreen'], ['#i-fps', 'showFps'], ['#i-mini', 'minimap']]) {
    $(id).checked = !!settings[key];
    $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; api.saveSettings(settings); });
  }
  const info = await api.info();
  $('#data-path').textContent = info.dataPath;
  $('#app-version').textContent = `Voxelia ${info.version} · ${info.platform}`;
  $('#hero-version').textContent = `Versión ${info.version} · Beta`;
  $('#open-data').addEventListener('click', () => api.openDataFolder());
  // Aviso de versión nueva (solo en la app de escritorio).
  api.checkUpdate?.().then((u) => {
    if (!u?.newer) return;
    const b = $('#update-banner'); b.hidden = false;
    b.innerHTML = `🎉 Hay una versión nueva: <b>Voxelia ${esc(u.latest)}</b> <button class="btn small" id="get-update">Descargar</button>`;
    $('#get-update').addEventListener('click', () => api.openRelease(u.url));
  }).catch(() => {});
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
    info: async () => ({ version: '0.17.0', dataPath: 'Navegador (localStorage)', platform: 'web' }),
    openDataFolder: async () => toast('Disponible en la app de escritorio'),
  };
}
