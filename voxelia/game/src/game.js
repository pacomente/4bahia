import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE } from './blocks.js';
import { World, CS, H } from './world.js';
import { meshChunk, createBlockMaterial, toGeometry } from './mesher.js';
import MeshWorker from './meshWorker.js?worker&inline';
import { buildAtlasCanvas, buildAtlasTexture, uvRect } from './textures.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { Sky } from './sky.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { saveWorld, saveSettings, exitToLauncher } from './storage.js';
import { I, ITEMS, isItem, mineSpeed, attackDamage, maxUses, armorPoints, armorReduction, isFood, ARMOR_SLOTS } from './items.js';
import { rankFor } from './economy.js';
import { craft, craftableTimes } from './recipes.js';
import { Hand } from './hand.js';
import { emptyStats, missionStatus } from './missions.js';
import { Shadows, nearLight } from './mobs.js';
import { Animals } from './animals.js';
import { Sea } from './sea.js';
import { navFrame } from './pathfind.js';
import { wrecksNear, treasure } from './wrecks.js';
import { Caravans, tradeGoods, applyTrade, GOODS_NAME } from './caravans.js';
import { linksOf, routeOf } from './roads.js';
import { villagePlan } from './villages.js';
import { MiniMap } from './minimap.js';
import { Villages } from './villagers.js';
import { villagesNear } from './villages.js';
import { Zombies } from './zombies.js';
import { Arrows } from './projectiles.js';
import { PlayerPreview } from './preview.js';
import { Bandits } from './bandits.js';
import { campsNear, lootTable, CAMP_REGION, campPlan } from './camps.js';

export const VERSION = '0.10.0';

const DEFAULT_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP];

export class Game {
  constructor({ worldId, name, seed, mode = 'creative', playerName = 'Jugador', settings, save }) {
    this.worldId = worldId;
    this.worldName = name;
    this.mode = mode;
    this.playerName = playerName;
    this.settings = settings;
    this.saveData = save;
    this.paused = true;
    this.started = false;
    this.inventoryOpen = false;
    this.showDebug = false;
    this.sound = new Sound();
    this.sound.volume = settings.volume;
    this.sound.musicVolume = settings.music ?? 0.5;
    this.mapOpen = false;
    this.health = save?.health ?? 20;
    this.air = 10;
    this.inventory = save?.inventory ?? {};     // supervivencia: id -> cantidad
    this.selected = save?.selected ?? 0;
    this.hotbar = save?.hotbar ?? (mode === 'survival' ? Array(9).fill(null) : DEFAULT_HOTBAR.map((id) => ({ id, count: 1 })));
    this.breaking = null;
    this.mouse = { left: false, right: false };
    this.particles = [];
    this.lastSave = performance.now();
    this.fpsFrames = 0; this.fpsTime = 0; this.fps = 0;
    this.playTime = save?.playTime ?? 0;
    // Progreso de supervivencia propio de Voxelia.
    this.stats = { ...emptyStats(), ...(save?.stats ?? {}) };
    this.maxHealth = save?.maxHealth ?? 20;
    this.faros = save?.faros ?? [];
    this.beams = new Map();
    this.attackCooldown = 0;
    this.craftOpen = false;
    this.toolWear = save?.toolWear ?? {};   // herramienta -> usos gastados de la que está en uso
    this.craftCat = 'all'; this.craftSel = null; this.nearBench = false;
    // Cámara viva: balanceo al caminar, hundida al aterrizar, temblor al recibir daño y FOV al correr.
    this.bob = 0; this.bobAmt = 0; this.landDip = 0; this.shake = 0; this.fovCur = settings.fov;
    this.mouseD = { x: 0, y: 0 }; this.handLight = 1; this.handLightT = 0;

    this.world = new World(seed, save?.mods ?? {});
    this.initRenderer();
    this.atlasCanvas = buildAtlasCanvas();
    this.atlasTex = buildAtlasTexture(this.atlasCanvas);
    this.matOpaque = createBlockMaterial(this.atlasTex);
    this.matWater = createBlockMaterial(this.atlasTex, { transparent: true });
    this.startMeshWorkers();
    this.sky = new Sky(this.scene, save?.time ?? 0.3);
    const spawn = save?.player ?? this.world.spawnPoint();
    this.spawn = save?.spawn ?? this.world.spawnPoint();
    this.player = new Player(this.world, spawn);
    this.player.flying = save?.player?.flying ?? false;
    this.player.useStamina = mode === 'survival';
    this.player.hasGlider = (this.inventory[I.GLIDER] ?? 0) > 0;
    this.ui = new UI(this.atlasCanvas, mode);
    this.shadows = new Shadows(this.scene, this.world, this.sound);
    this.animals = new Animals(this.scene, this.world, this.sound);
    this.sea = new Sea(this.scene, this.world, this.sound);
    this.caravans = new Caravans(this.scene, this.world, this.animals);
    this.sea.load(save?.boats);
    this.minimap = new MiniMap(this.atlasCanvas, this.world);
    this.hand = new Hand(this.atlasTex);
    // Aldeas con sus aldeanos, zombis nocturnos y flechas.
    this.villages = new Villages(this.scene, this.world, this.sound, save?.villages);
    this.zombies = new Zombies(this.scene, this.world, this.sound);
    this.bandits = new Bandits(this.scene, this.world, this.sound, save?.bandits);
    this.lavaT = 0; this.campNow = null;
    this.arrows = new Arrows(this.scene, this.world, this.sound);
    this.lightCache = new Map(); this.lightClock = 0;
    this.villagerOpen = false; this.talkingTo = null; this.bowCooldown = 0; this.villageNow = null; this.villageCheck = 0;
    // Equipo (armadura y escudo), cultivos sembrados por el jugador, escudo levantado.
    this.equip = save?.equip ?? {}; this.armorWear = save?.armorWear ?? {};
    this.crops = save?.crops ?? []; this.cropT = 0;
    this.blocking = false; this.keyV = false; this.eatCooldown = 0; this.sleeping = false;
    for (const f of this.faros) this.addBeam(f);
    this.lastMission = missionStatus(this.stats).done;
    this.initHighlight();
    this.bindInput();
    this.renderHotbar();
    this.renderStatus();
    this.ui.renderMission(missionStatus(this.stats));
    document.querySelector('#world-title').textContent = name;
  }

  initRenderer() {
    this.canvas = document.querySelector('#game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.08, 1000);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initHighlight() {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
  }

  // ───────── Carga de chunks ─────────
  // Genera y arma mallas con un presupuesto de tiempo por cuadro para no trabar el juego.
  updateChunks(budgetMs = 8) {
    const r = this.settings.renderDistance;
    const pcx = Math.floor(this.player.pos.x / CS);
    const pcz = Math.floor(this.player.pos.z / CS);
    const t0 = performance.now();
    const wanted = [];
    for (let dx = -r - 1; dx <= r + 1; dx++) for (let dz = -r - 1; dz <= r + 1; dz++) {
      if (dx * dx + dz * dz > (r + 1.5) * (r + 1.5)) continue;
      wanted.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
    }
    wanted.sort((a, b) => a[2] - b[2]);
    let work = 0;
    for (const [cx, cz, d2] of wanted) {
      if (performance.now() - t0 > budgetMs && work > 0) break;
      let c = this.world.getChunk(cx, cz);
      if (!c) { c = this.world.generate(cx, cz); work++; continue; }
      if (d2 > (r + 0.5) * (r + 0.5) || !c.dirty || c.pending) continue;
      // Solo se arma la malla cuando los 4 vecinos existen (bordes correctos).
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => this.world.getChunk(cx + a, cz + b))) continue;
      // Lo que tocó el jugador (o una puerta) cerca se rehace al instante; lo demás, en el worker.
      if ((c.edited && d2 <= 2) || !this.meshWorkers?.length) { this.buildMesh(c); work++; }
      else if (this.inFlight < this.meshWorkers.length * 3) this.requestMesh(c);
    }
    // Descargar chunks lejanos (los cambios quedan guardados en world.mods).
    for (const [k, c] of this.world.chunks) {
      if (Math.abs(c.cx - pcx) > r + 3 || Math.abs(c.cz - pcz) > r + 3) {
        this.disposeMesh(c);
        this.world.chunks.delete(k);
      }
    }
    return work;
  }

  // ───────── Mallas en segundo plano ─────────
  startMeshWorkers() {
    this.meshWorkers = []; this.inFlight = 0; this.meshReq = 0;
    try {
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 2) - 1));
      for (let i = 0; i < n; i++) {
        const w = new MeshWorker();
        w.onmessage = (ev) => this.onMeshDone(ev.data);
        w.onerror = () => { this.meshWorkers = []; };   // si algo falla, vuelve al modo de un solo hilo
        this.meshWorkers.push(w);
      }
    } catch { this.meshWorkers = []; }
  }
  requestMesh(c) {
    const chunks = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.world.getChunk(c.cx + dx, c.cz + dz);
      if (n) chunks.push({ cx: n.cx, cz: n.cz, data: n.data, top: n.top });
    }
    c.pending = true; c.dirty = false; this.inFlight++;
    const w = this.meshWorkers[this.meshReq++ % this.meshWorkers.length];
    w.postMessage({ id: this.meshReq, cx: c.cx, cz: c.cz, chunks });
  }
  onMeshDone(m) {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const c = this.world.getChunk(m.cx, m.cz);
    if (!c) return;   // se descargó mientras tanto
    c.pending = false;
    this.disposeMesh(c);
    c.meshes = [];
    const o = toGeometry(m.opaque); const wt = toGeometry(m.water);
    if (o) { const mesh = new THREE.Mesh(o, this.matOpaque); this.scene.add(mesh); c.meshes.push(mesh); }
    if (wt) { const mesh = new THREE.Mesh(wt, this.matWater); mesh.renderOrder = 1; this.scene.add(mesh); c.meshes.push(mesh); }
  }

  buildMesh(c) {
    this.disposeMesh(c);
    const { opaque, water } = meshChunk(this.world, c);
    c.meshes = [];
    if (opaque) { const m = new THREE.Mesh(opaque, this.matOpaque); this.scene.add(m); c.meshes.push(m); }
    if (water) { const m = new THREE.Mesh(water, this.matWater); m.renderOrder = 1; this.scene.add(m); c.meshes.push(m); }
    c.dirty = false; c.edited = false; c.pending = false;
  }

  disposeMesh(c) {
    if (!c.meshes) return;
    for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    c.meshes = null;
  }

  // Carga inicial con pantalla de progreso.
  async preload(onProgress) {
    const r = this.settings.renderDistance;
    const total = (2 * r + 1) ** 2;
    let guard = 0;
    for (;;) {
      this.updateChunks(30);
      const meshed = [...this.world.chunks.values()].filter((c) => c.meshes || (!c.dirty && !c.pending)).length;
      onProgress(Math.min(1, meshed / (total * 0.75)));
      if (meshed >= total * 0.75 || guard++ > 400) break;
      await new Promise((res) => setTimeout(res, 0));
    }
    // Aparición segura: en un mundo nuevo (o si quedó dentro de un bloque) busca suelo firme a cielo abierto.
    const p = this.player.pos;
    if (!this.saveData?.player || this.player.collides(p.x, p.y, p.z)) {
      const safe = this.findSafeSpot(Math.floor(p.x), Math.floor(p.z));
      if (safe) { p.set(safe.x, safe.y, safe.z); if (!this.saveData?.spawn) this.spawn = { ...safe }; }
      if (!this.saveData?.player) this.faceOpenView();
      else while (this.player.collides(p.x, p.y, p.z) && p.y < H) p.y += 1;
    }
  }

  // Al entrar por primera vez, mira hacia la dirección con más vista libre (no contra una pared).
  faceOpenView() {
    const eye = this.player.eye();
    let best = { yaw: 0, dist: -1 };
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2;
      const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(-0.12), Math.sin(-0.12), -Math.cos(yaw) * Math.cos(-0.12));
      const hit = raycast(this.world, eye, dir, 48);
      const dist = hit ? Math.hypot(hit.x + 0.5 - eye.x, hit.z + 0.5 - eye.z) : 48;
      if (dist > best.dist) best = { yaw, dist };
    }
    this.player.yaw = best.yaw;
    this.player.pitch = -0.12;
  }

  // Columna cercana cuyo bloque más alto es suelo (no hojas, agua ni cactus) con dos bloques de aire encima.
  findSafeSpot(x0, z0) {
    const bad = new Set([B.LEAVES, B.BIRCH_LEAVES, B.WATER, B.CACTUS, B.LOG, B.BIRCH_LOG]);
    for (let r = 0; r <= 24; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = x0 + dx; const z = z0 + dz;
        const top = this.world.topAt(x, z);
        if (top < 1) continue;
        const ground = this.world.getBlock(x, top, z);
        if (bad.has(ground) || !BLOCKS[ground].solid) continue;
        if (this.world.getBlock(x, top + 1, z) !== B.AIR || this.world.getBlock(x, top + 2, z) !== B.AIR) continue;
        return { x: x + 0.5, y: top + 1, z: z + 0.5 };
      }
    }
    return null;
  }

  // ───────── Entrada ─────────
  bindInput() {
    const keymap = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r' };
    let lastSpace = 0;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') return;
      // Cada pantalla se cierra con su propia tecla; con otra abierta (o muerto, o en pausa) no se abre otra encima.
      const busy = this.dead || this.sleeping || this.villagerOpen || (this.paused && !this.inventoryOpen && !this.craftOpen && !this.mapOpen);
      if (e.code === 'KeyE' && this.started && !busy && !this.craftOpen && !this.mapOpen) { this.toggleInventory(); return; }
      if (e.code === 'KeyC' && this.started && !busy && this.mode === 'survival' && !this.inventoryOpen && !this.mapOpen) { this.toggleCraft(); return; }
      if (e.code === 'KeyM' && this.started && !busy && !this.inventoryOpen && !this.craftOpen) { this.toggleMap(); return; }
      if (e.code === 'KeyV') this.keyV = true;
      if (this.paused) return;
      if (keymap[e.code]) this.player.input[keymap[e.code]] = 1;
      if (e.code === 'Space') {
        this.player.input.jump = true;
        // Doble espacio: volar (solo en creativo).
        if (this.mode === 'creative' && !e.repeat) {
          if (performance.now() - lastSpace < 300) { this.player.flying = !this.player.flying; this.player.vel.y = 0; this.ui.toast(this.player.flying ? 'Vuelo activado' : 'Vuelo desactivado'); }
          lastSpace = performance.now();
        }
      }
      if (e.code === 'ShiftLeft') { this.player.input.down = true; if (this.sea.riding && !e.repeat) { this.sea.dismount(this.player); this.ui.toast('Te bajaste del bote', 1200); } if (this.horse && !e.repeat) this.dismountHorse(); }
      if (e.code === 'ControlLeft' || e.code === 'KeyR') this.player.input.sprint = true;
      if (e.code.startsWith('Digit')) { const n = Number(e.code.slice(5)); if (n >= 1 && n <= 9) this.select(n - 1); }
      if (e.code === 'F3') { e.preventDefault(); this.showDebug = !this.showDebug; document.querySelector('#debug').style.display = this.showDebug ? 'block' : 'none'; }
      if (e.code === 'KeyF' && this.mode === 'creative') { this.player.flying = !this.player.flying; this.ui.toast(this.player.flying ? 'Vuelo activado' : 'Vuelo desactivado'); }
    });
    document.addEventListener('keyup', (e) => {
      if (keymap[e.code]) this.player.input[keymap[e.code]] = 0;
      if (e.code === 'Space') this.player.input.jump = false;
      if (e.code === 'ShiftLeft') this.player.input.down = false;
      if (e.code === 'ControlLeft' || e.code === 'KeyR') this.player.input.sprint = false;
      if (e.code === 'KeyV') this.keyV = false;
    });
    // En el inventario, tu personaje sigue el cursor con la mirada.
    document.addEventListener('mousemove', (e) => { if (this.inventoryOpen) this.preview?.lookAtScreen(e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => {
      if (this.paused || document.pointerLockElement !== this.canvas) return;
      const s = 0.0022 * this.settings.sensitivity;
      this.mouseD.x += e.movementX; this.mouseD.y += e.movementY;
      this.player.yaw -= e.movementX * s;
      this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - e.movementY * s));
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.paused) return;
      if (document.pointerLockElement !== this.canvas) { this.lock(); return; }
      if (e.button === 0) {
        this.hand.swing();
        if (this.attackMob()) return;
        this.mouse.left = true;
        if (this.mode === 'creative') this.breakTarget();
      }
      if (e.button === 2) { this.mouse.right = true; if (!this.interact()) this.placeBlock(); }
      if (e.button === 1) this.pickBlock();
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) { this.mouse.left = false; this.breaking = null; this.ui.setBreakProgress(0); } if (e.button === 2) this.mouse.right = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (!this.paused) this.select((this.selected + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      // Si el mouse se capturó tarde (con una pantalla ya abierta), se suelta: si no, el cursor queda congelado.
      if (document.pointerLockElement === this.canvas && (this.paused || this.dead || this.sleeping)) { this.unlock(); return; }
      if (document.pointerLockElement !== this.canvas && this.started && !this.inventoryOpen && !this.craftOpen && !this.mapOpen && !this.villagerOpen && !this.dead && !this.sleeping && performance.now() - (this.selfUnlockAt ?? 0) > 500) this.pause(true);
    });
  }

  lock() { this.canvas.requestPointerLock?.(); }
  // Soltar el mouse a propósito (al abrir una pantalla): esa pérdida del puntero no debe pausar el juego.
  unlock() { this.selfUnlockAt = performance.now(); if (document.pointerLockElement) document.exitPointerLock(); }
  select(i) { this.selected = i; this.renderHotbar(); this.sound.click(); }
  renderHotbar() { this.ui.renderHotbar(this.hotbar, this.selected, (id) => this.wearOf(id)); }

  // Desgaste de la herramienta (0 = nueva, 1 = por romperse) o null si no se gasta.
  wearOf(id) { const max = maxUses(id); return max && this.mode === 'survival' ? (this.toolWear[id] ?? 0) / max : null; }

  // Gasta un uso de la herramienta en la mano; al llegar al máximo se rompe (se pierde una).
  useTool() {
    const id = this.held(); const max = maxUses(id);
    if (!max || this.mode !== 'survival') return;
    this.toolWear[id] = (this.toolWear[id] ?? 0) + 1;
    if (this.toolWear[id] >= max) {
      this.toolWear[id] = 0;
      this.inventory[id] = (this.inventory[id] ?? 1) - 1;
      if (this.inventory[id] <= 0) delete this.inventory[id];
      this.ui.toast(`Se rompió: ${ITEMS[id].name}`, 2200);
      this.sound.noise(0.3, { freq: 1800, q: 2, gain: 0.5 }); this.sound.tone(220, 0.2, 0.15, 'square');
      this.syncHotbar();
    } else if (this.toolWear[id] / max > 0.9 && (this.toolWear[id] - 1) / max <= 0.9) this.ui.toast(`${ITEMS[id].name}: está por romperse`, 2000);
    this.renderHotbar();
  }

  pause(on) {
    this.paused = on;
    for (const k of Object.keys(this.player.input)) this.player.input[k] = typeof this.player.input[k] === 'boolean' ? false : 0;
    this.ui.show('#pause', on);
    if (on) { this.save(); this.unlock(); } else this.lock();
  }

  toggleInventory() {
    this.inventoryOpen = !this.inventoryOpen;
    this.ui.show('#inventory', this.inventoryOpen);
    if (this.inventoryOpen) {
      this.paused = true;
      this.unlock();
      this.preview ??= new PlayerPreview(document.querySelector('#player-preview'), this.atlasCanvas);
      this.renderInventory();
      this.preview.start();
    } else { this.preview?.stop(); this.paused = false; this.lock(); }
  }

  renderInventory() {
    this.preview?.setEquip(this.mode === 'survival' ? this.equip : {}, this.held());
    this.ui.renderInventory((id) => {
      // Armadura y escudo se equipan; lo demás va a la casilla seleccionada de la barra rápida.
      const it = ITEMS[id];
      if (this.mode === 'survival' && (it?.kind === 'armor' || id === I.SHIELD)) { this.equipItem(id); this.renderInventory(); return; }
      this.hotbar = this.hotbar.map((s) => (s?.id === id ? null : s));
      this.hotbar[this.selected] = { id, count: this.mode === 'survival' ? this.inventory[id] : 1 };
      this.renderHotbar();
      this.preview?.setEquip(this.mode === 'survival' ? this.equip : {}, this.held());
      this.toggleInventory();
    }, this.inventory, this.mode === 'survival' ? { equip: this.equip, points: armorPoints(this.equip), wear: (slot) => this.equipWear(slot), unequip: (slot) => { this.unequip(slot); this.renderInventory(); } } : null);
  }

  // ───── Equipo: armadura (cabeza, torso, piernas, pies) y escudo en la mano izquierda ─────
  equipItem(id) {
    const slot = ITEMS[id].slot;
    if (this.equip[slot]) this.unequip(slot);
    this.inventory[id] -= 1; if (this.inventory[id] <= 0) delete this.inventory[id];
    this.equip[slot] = id; this.armorWear[slot] = 0;
    this.stats.equipped = (this.stats.equipped ?? 0) + 1; this.checkMissions();
    this.sound.noise(0.18, { freq: 1800, q: 2, gain: 0.3 });
    this.ui.toast(`Te pusiste: ${ITEMS[id].name}`, 1500);
    this.syncHotbar(); this.renderStatus();
  }

  unequip(slot) {
    const id = this.equip[slot]; if (!id) return;
    // Solo vuelve al inventario si está poco gastada (si no, se pierde el desgaste: se guarda igual).
    this.inventory[id] = (this.inventory[id] ?? 0) + 1;
    delete this.equip[slot]; delete this.armorWear[slot];
    this.syncHotbar(); this.renderStatus();
  }

  equipWear(slot) { const id = this.equip[slot]; const max = maxUses(id); return max ? (this.armorWear[slot] ?? 0) / max : 0; }

  // Desgasta una pieza de equipo; si se rompe, desaparece.
  wearEquip(slot, n = 1) {
    const id = this.equip[slot]; const max = maxUses(id); if (!max) return;
    this.armorWear[slot] = (this.armorWear[slot] ?? 0) + n;
    if (this.armorWear[slot] >= max) {
      delete this.equip[slot]; delete this.armorWear[slot];
      this.ui.toast(`Se rompió: ${ITEMS[id].name}`, 2200); this.sound.noise(0.3, { freq: 1500, q: 2, gain: 0.5 });
      this.renderStatus();
    }
  }

  // Corazones, armadura y plata en el HUD.
  renderStatus() {
    this.ui.renderHearts(this.health, this.maxHealth);
    this.ui.renderArmor(armorPoints(this.equip), this.mode === 'survival');
    this.ui.renderSilver(this.inventory[I.SILVER] ?? 0, this.mode === 'survival');
  }

  // ───── Comer, dormir, puertas y campo ─────
  eat(id) {
    if (this.eatCooldown > 0) return;
    const it = ITEMS[id];
    if (this.mode === 'survival') { this.inventory[id] -= 1; if (this.inventory[id] <= 0) delete this.inventory[id]; }
    this.health = Math.min(this.maxHealth, this.health + it.heal);
    this.player.stamina = Math.min(100, this.player.stamina + it.energy);
    this.eatCooldown = 0.8; this.hand.swing();
    for (let k = 0; k < 3; k++) setTimeout(() => this.sound.noise(0.09, { freq: 900 + Math.random() * 600, q: 1.5, gain: 0.35 }), k * 140);
    this.ui.toast(`${it.name}: +${it.heal / 2} ${it.heal === 2 ? 'corazón' : 'corazones'}`, 1400);
    this.syncHotbar(); this.renderStatus();
  }

  toggleDoor(t) {
    const open = t.id === B.DOOR;
    const to = open ? B.DOOR_OPEN : B.DOOR;
    // La puerta ocupa dos bloques: se mueven juntos.
    for (const dy of [-1, 0, 1]) { const id = this.world.getBlock(t.x, t.y + dy, t.z); if (id === B.DOOR || id === B.DOOR_OPEN) this.world.setBlock(t.x, t.y + dy, t.z, to); }
    this.sound.noise(0.25, { freq: open ? 300 : 220, q: 2, gain: 0.45 });
    this.hand.swing();
  }

  trySleep(t) {
    this.spawn = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
    if (this.sky.daylight > 0.35) { this.ui.toast('Solo se puede dormir de noche. Tu cama quedó como punto de reaparición.', 2800); return; }
    const near = this.zombies.list.some((z) => !z.dead && z.pos.distanceTo(this.player.pos) < 10) || this.shadows.list.some((s) => s.mesh.position.distanceTo(this.player.pos) < 10);
    if (near && this.mode === 'survival') { this.ui.toast('No podés dormir: hay monstruos cerca', 2200); return; }
    this.sleeping = true; this.paused = true;
    this.unlock();
    const fade = document.querySelector('#sleep-fade');
    fade.classList.add('on');
    setTimeout(() => {
      this.sky.time = 0.01; this.prevTime = 0.01;
      this.zombies.clear(); this.shadows.clear();
      this.health = Math.min(this.maxHealth, this.health + 6); this.player.stamina = 100;
      this.onDawn();
      this.renderStatus();
    }, 1400);
    setTimeout(() => { fade.classList.remove('on'); this.sleeping = false; this.paused = false; this.ui.show('#pause', false); this.lock(); this.ui.toast('Dormiste bien. ¡Buen día!', 2500); }, 2600);
  }

  // Amanecer (natural o después de dormir): aldeas que crecen y una noche más sobrevivida.
  onDawn() {
    this.bandits.dawn();
    // Lo que trajeron los barcos dura un par de días en los puertos.
    for (const rec of this.villages.records.values()) if (rec.importDays > 0) rec.importDays -= 1;
    // Comercio entre aldeas conocidas unidas por camino (aunque estén lejos).
    for (const [id, rec] of this.villages.records) {
      const [rx, rz] = id.slice(1).split('_').map(Number); const plan = villagePlan(this.world, rx, rz);
      if (!plan) continue;
      for (const o of linksOf(this.world, plan)) {
        const other = this.villages.records.get(o.id);
        if (!other || !(plan.id < o.id ? routeOf(this.world, plan, o) : routeOf(this.world, o, plan))) continue;
        const g = tradeGoods(rec, other); if (g) applyTrade(rec, other, g);
      }
    }
    for (const ev of this.villages.dawn()) {
      if (!ev.near) continue;
      if (ev.type === 'born') this.ui.toast(`¡Nació ${ev.name} en ${ev.village}${ev.parents?.length ? `, hij${ev.female ? 'a' : 'o'} de ${ev.parents.join(' y ')}` : ''}! Ya son ${ev.pop}.`, 4500);
      if (ev.type === 'grown') this.ui.toast(`${ev.name} ya es grande en ${ev.village}.`, 3000);
      if (ev.type === 'couple') this.ui.toast(`${ev.a} y ${ev.b} se pusieron de novios en ${ev.village}.`, 3500);
      if (ev.type === 'hungry') this.ui.toast(`En ${ev.village} pasan hambre: llevales comida.`, 3500);
      if (ev.type === 'taxes' && this.villageNow && ev.village === this.villages.villageAt(this.player.pos.x, this.player.pos.z)?.name) this.ui.toast(`👑 En ${ev.village} el rey cobró ${ev.n} de plata en impuestos (tesoro: ${ev.treasury})`, 3500);
      if (ev.type === 'royalBuy') this.ui.toast(`👑 El tesoro de ${ev.village} compró madera y piedra para las obras`, 3000);
      if (ev.type === 'newjob') this.ui.toast(`${ev.name} ahora es ${ev.prof === 'priest' ? 'quien atiende la iglesia' : 'docente de la escuela'} en ${ev.village}.`, 3500);
      if (ev.type === 'grown' && ev.studied) setTimeout(() => this.ui.toast(`${ev.name} terminó la escuela: ¡ya sabe leer y escribir!`, 3000), 1500);
    }
    if (this.mode === 'survival') {
      this.stats.nights += 1;
      setTimeout(() => this.ui.toast(`Amaneció · Día ${this.stats.nights + 1}`, 3000), 4600);
      this.checkMissions();
    }
  }

  // Trigo sembrado por el jugador: madura solo después de un rato.
  updateCrops(dt) {
    this.cropT -= dt; if (this.cropT > 0) return; this.cropT = 4;
    this.crops = this.crops.filter((c) => {
      const id = this.world.getBlock(c.x, c.y, c.z);
      if (!this.world.getChunk(Math.floor(c.x / 16), Math.floor(c.z / 16))) return true;
      if (id !== B.WHEAT_YOUNG) return false;
      if (this.playTime - c.t > 150) { this.world.setBlock(c.x, c.y, c.z, B.WHEAT_RIPE); return false; }
      return true;
    });
  }

  // ¿Hay una Mesa de trabajo a 4 bloques o menos?
  findBench() {
    const p = this.player.pos; const bx = Math.floor(p.x); const by = Math.floor(p.y); const bz = Math.floor(p.z);
    for (let dx = -4; dx <= 4; dx++) for (let dy = -3; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) if (this.world.getBlock(bx + dx, by + dy, bz + dz) === B.WORKBENCH) return true;
    return false;
  }

  toggleCraft() {
    this.craftOpen = !this.craftOpen;
    if (this.craftOpen) this.nearBench = this.findBench();
    this.ui.show('#craft', this.craftOpen);
    if (this.craftOpen) {
      this.paused = true;
      this.unlock();
      this.renderCraft();
    } else { this.paused = false; this.lock(); }
  }

  // Mapa grande (M): muestra lo explorado alrededor, faros y punto de reaparición.
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.ui.show('#map-screen', this.mapOpen);
    if (this.mapOpen) {
      this.paused = true;
      this.unlock();
      this.minimap.timer = 0;
      this.minimap.update(0, this.mapCtx(), true);
    } else { this.paused = false; this.lock(); }
  }

  mapCtx() {
    return { player: this.player, spawn: this.spawn, faros: this.faros, radius: (this.settings.renderDistance + 1) * CS, showMini: this.settings.minimap !== false, villages: this.villageMarkers ?? [], camps: this.campMarkers ?? [] };
  }

  renderCraft() {
    const state = { maxHealth: this.maxHealth, nearBench: this.nearBench };
    this.ui.renderCraft(this.inventory, state, {
      cat: this.craftCat, sel: this.craftSel,
      onCat: (c) => { this.craftCat = c; this.renderCraft(); },
      onSelect: (id) => { this.craftSel = id; this.renderCraft(); },
      onCraft: (recipe, times) => {
        let made = 0;
        for (let k = 0; k < times; k++) {
          const res = craft(recipe, this.inventory, state);
          if (!res) break;
          made++;
          this.stats.crafted[recipe.id] = (this.stats.crafted[recipe.id] ?? 0) + 1;
          if (res.special === 'heart') { this.maxHealth = Math.min(30, this.maxHealth + 2); this.health = Math.min(this.maxHealth, this.health + 2); this.ui.renderHearts(this.health, this.maxHealth); this.ui.toast('¡Corazón extra! Tu vida máxima aumentó.'); }
          for (const id of Object.keys(res.out).map(Number)) this.autoSlot(id);
        }
        if (!made) return;
        if (this.inventory[I.GLIDER]) this.player.hasGlider = true;
        this.sound.tone(660, 0.08, 0.15, 'sine'); setTimeout(() => this.sound.tone(880, 0.12, 0.15, 'sine'), 70);
        if (made > 1) this.ui.toast(`Fabricaste ${recipe.name} ×${made}`, 1500);
        this.syncHotbar();
        this.checkMissions();
        this.renderCraft();
      },
      maxTimes: (r) => craftableTimes(r, this.inventory, state),
    });
  }

  // Pone un ítem nuevo en una casilla libre de la barra rápida.
  autoSlot(id) {
    if (this.hotbar.some((s) => s?.id === id)) return;
    const free = this.hotbar.findIndex((s) => !s);
    if (free >= 0) this.hotbar[free] = { id, count: this.inventory[id] ?? 0 };
  }

  // La barra rápida refleja las cantidades del inventario.
  syncHotbar() {
    if (this.mode !== 'survival') return;
    this.hotbar = this.hotbar.map((s) => (s && (this.inventory[s.id] ?? 0) > 0 ? { id: s.id, count: this.inventory[s.id] } : null));
    this.renderHotbar();
    this.ui.renderSilver(this.inventory[I.SILVER] ?? 0, true);
  }

  checkMissions() {
    const st = missionStatus(this.stats);
    if (st.done > this.lastMission) {
      this.ui.toast('¡Misión cumplida!', 2500);
      this.sound.tone(523, 0.1, 0.15, 'sine'); setTimeout(() => this.sound.tone(659, 0.1, 0.15, 'sine'), 100); setTimeout(() => this.sound.tone(784, 0.2, 0.15, 'sine'), 200);
    }
    this.lastMission = st.done;
    this.ui.renderMission(st);
  }

  held() { return this.hotbar[this.selected]?.id ?? null; }

  // Golpe a una criatura (zombi, Sombra o Lanudo) delante del jugador. Devuelve true si le pegó a alguna.
  // A los aldeanos no se los puede lastimar: se enojan y salen corriendo.
  attackMob() {
    if (this.attackCooldown > 0) return false;
    const eye = this.player.eye(); const dir = this.player.look(); const dmg = attackDamage(this.held());
    const v = this.villages.hitTest(eye, dir, 3.6);
    if (v) { this.villages.annoy(v); this.attackCooldown = 0.35; return true; }
    const boat = !this.sea.riding && this.sea.boatHit(eye, dir, 4);
    if (boat) { this.sea.removeBoat(boat); if (this.mode === 'survival') this.addItem(I.BOAT); this.sound.dig('wood'); this.attackCooldown = 0.35; return true; }
    const hit = (this.bandits.list.length && this.bandits.hit(eye, dir, 3.6, dmg, this.banditCtx()))
      || (this.zombies.list.length && this.zombies.hit(eye, dir, 3.6, dmg, this.zombieCtx()))
      || (this.shadows.list.length && this.shadows.hit(eye, dir, 3.6, dmg, this.mobCtx()))
      || (this.animals.list.length && this.animals.hit(eye, dir, 3.6, dmg, { onKilled: (_p, sp) => { if (this.mode === 'survival') { this.animalDrops(sp); this.checkMissions(); } } }));
    if (hit) { this.attackCooldown = 0.35; this.useTool(); }
    return !!hit;
  }
  attackShadow() { return this.attackMob(); }
  // ───────── Caballo ─────────
  mountHorse(h) {
    this.horse = h; h.ridden = true; h.flee = 0;
    this.player.pos.set(h.mesh.position.x, h.mesh.position.y + 0.05, h.mesh.position.z); this.player.vel.set(0, 0, 0);
    this.player.flying = false; this.player.mount = 1.0;
    this.ui.toast('¡Arriba del caballo! Corre mucho más rápido. Shift para bajarte.', 3000);
    this.sound.tone(330, 0.12, 0.1, 'triangle'); setTimeout(() => this.sound.tone(262, 0.18, 0.1, 'triangle'), 110);
    this.stats.rode = 1; this.checkMissions();
  }
  dismountHorse() {
    const h = this.horse; if (!h) return;
    this.horse = null; h.ridden = false; h.walk = 0; h.timer = 3; this.player.mount = 0;
    // Se baja al costado del caballo.
    const yaw = this.player.yaw; const x = this.player.pos.x + Math.cos(yaw) * 1.1; const z = this.player.pos.z - Math.sin(yaw) * 1.1;
    const id = this.world.getBlock(Math.floor(x), Math.floor(this.player.pos.y + 0.5), Math.floor(z));
    if (!BLOCKS[id].solid) this.player.pos.set(x, this.player.pos.y, z);
    this.ui.toast('Te bajaste del caballo', 1200);
  }
  updateHorse(dt) {
    const h = this.horse; if (!h) return;
    if (!this.animals.list.includes(h)) { this.horse = null; this.player.mount = 0; return; }
    const p = this.player.pos;
    const v = Math.hypot(this.player.vel.x, this.player.vel.z);
    h.mesh.position.set(p.x, p.y, p.z);
    if (v > 0.5) h.heading = Math.atan2(this.player.vel.x, this.player.vel.z); else h.heading = this.player.yaw + Math.PI;
    h.walk = v > 0.5 ? 1 : 0; h.flee = v > 7 ? 1 : 0;
    // Trote: cada tanto un ruido de cascos.
    this.hoofT = (this.hoofT ?? 0) - dt * v;
    if (this.hoofT <= 0 && this.player.onGround && v > 0.5) { this.hoofT = 2.2; this.sound.noise(0.06, { freq: 700, q: 3, gain: 0.18 }); }
  }

  // Animales del corral de cada aldea cercana (lanudos, gallinas y un caballo para montar).
  fillPens() {
    const P = this.player.pos;
    for (const a of this.villages.active.values()) {
      const pen = a.plan.pen;
      if (!pen || Math.hypot(pen.x - P.x, pen.z - P.z) > 80) continue;
      if (!this.world.getChunk(Math.floor(pen.x / 16), Math.floor(pen.z / 16))) continue;
      if (this.animals.list.some((x) => x.penId === a.plan.id)) continue;
      const opts = { pen, penId: a.plan.id };
      const spots = [[0, 0], [1, 1], [-1, 1], [2, -1], [-2, 0], [0, -1]];
      ['lanudo', 'lanudo', 'chicken', 'chicken', 'chicken', a.plan.style === 'desert' ? 'chicken' : 'horse'].forEach((sp, k) => this.animals.spawnAt(pen.x + spots[k][0] + 0.5, pen.z + spots[k][1] + 0.5, sp, opts));
    }
  }

  // Lo que deja cada animal: el Lanudo lana y algo de carne; el ciervo carne; el conejo y el cangrejo un poco.
  animalDrops(species) {
    if (species === 'deer') this.addItem(I.MEAT, 2 + Math.floor(Math.random() * 2));
    else if (species === 'rabbit') this.addItem(I.MEAT, 1);
    else if (species === 'crab') { this.addItem(I.MEAT, 1); if (Math.random() < 0.15) this.addItem(I.PEARL); }
    else if (species === 'horse') this.addItem(I.MEAT, 2);
    else if (species === 'chicken') { this.addItem(I.MEAT, 1); if (Math.random() < 0.5) this.addItem(B.WOOL_WHITE, 1); }
    else { this.addItem(B.WOOL_WHITE, 2); if (Math.random() < 0.5) this.addItem(I.MEAT, 1); }
  }

  // Punto del agua (superficie) que mira el jugador, para poner un bote.
  waterTarget() {
    const eye = this.player.eye(); const dir = this.player.look();
    for (let t = 0.5; t < 6; t += 0.2) {
      const q = eye.clone().addScaledVector(dir, t); const x = Math.floor(q.x); const y = Math.floor(q.y); const z = Math.floor(q.z);
      const id = this.world.getBlock(x, y, z);
      if (BLOCKS[id].water) return BLOCKS[this.world.getBlock(x, y + 1, z)].water ? null : { x: q.x, z: q.z };
      if (BLOCKS[id].solid) return null;
    }
    return null;
  }

  // Clic derecho: hablar con un aldeano o disparar el arco. Devuelve true si hizo algo.
  interact() {
    const eye = this.player.eye(); const dir = this.player.look();
    const v = this.villages.hitTest(eye, dir, 4);
    const t = this.target();
    const held = this.held();
    if (v && (!t || Math.hypot(t.x + 0.5 - eye.x, t.y + 0.5 - eye.y, t.z + 0.5 - eye.z) > v.pos.distanceTo(eye) - 0.5)) { this.openVillager(v); return true; }
    const horse = !this.horse && !this.sea.riding && this.animals.pick(eye, dir, 4);
    if (horse?.species === 'horse' && !isFood(held)) { this.mountHorse(horse); return true; }
    const boat = !this.sea.riding && this.sea.boatHit(eye, dir, 4.5);
    if (boat && (!t || Math.hypot(t.x + 0.5 - eye.x, t.y + 0.5 - eye.y, t.z + 0.5 - eye.z) > boat.mesh.position.distanceTo(eye) - 0.8)) {
      this.sea.riding = boat; this.player.flying = false; this.ui.toast('W/S: remar · A/D: girar · Shift: bajarse', 2600); this.stats.boated = 1; this.checkMissions(); return true;
    }
    if (held === I.BOAT && !this.sea.riding) {
      const w = this.waterTarget();
      if (w) {
        this.sea.placeBoat(w.x, w.z, this.player.yaw); this.sound.splash();
        if (this.mode === 'survival') { this.inventory[I.BOAT] -= 1; if (this.inventory[I.BOAT] <= 0) delete this.inventory[I.BOAT]; this.syncHotbar(); }
        return true;
      }
      this.ui.toast('El bote se pone sobre el agua', 1400); return true;
    }
    if (t && (t.id === B.DOOR || t.id === B.DOOR_OPEN) && !this.player.sneaking) { this.toggleDoor(t); return true; }
    if (t && t.id === B.BED && !this.player.sneaking) { this.trySleep(t); return true; }
    if (isFood(held)) { if (this.health < this.maxHealth || this.player.stamina < 95 || this.mode === 'creative') this.eat(held); else this.ui.toast('No tenés hambre: estás con la vida llena', 1400); return true; }
    // Sembrar: semillas sobre tierra arada.
    if (held === I.SEEDS && t?.id === B.FARMLAND && t.face[1] === 1 && this.world.getBlock(t.x, t.y + 1, t.z) === B.AIR) {
      this.world.setBlock(t.x, t.y + 1, t.z, B.WHEAT_YOUNG);
      this.crops.push({ x: t.x, y: t.y + 1, z: t.z, t: this.playTime });
      if (this.mode === 'survival') { this.inventory[I.SEEDS] -= 1; if (this.inventory[I.SEEDS] <= 0) delete this.inventory[I.SEEDS]; this.syncHotbar(); }
      this.sound.place('grass'); this.hand.swing();
      return true;
    }
    // Arar: pala sobre pasto o tierra.
    if (ITEMS[held]?.tool === 'shovel' && t && (t.id === B.GRASS || t.id === B.DIRT) && t.face[1] === 1 && this.world.getBlock(t.x, t.y + 1, t.z) === B.AIR) {
      this.world.setBlock(t.x, t.y, t.z, B.FARMLAND); this.sound.dig('grass'); this.hand.swing(); this.useTool();
      return true;
    }
    if (held === I.BOW) { this.shootBow(); return true; }
    // Con el escudo equipado y nada para colocar en la mano, el clic derecho cubre (no coloca).
    if (this.equip.offhand === I.SHIELD && (!held || isItem(held))) return true;
    return false;
  }

  shootBow() {
    if (this.bowCooldown > 0) return;
    if (this.mode === 'survival') {
      if (!(this.inventory[I.ARROW] > 0)) { this.ui.toast('No tenés flechas (Taller: tablas + adoquín)', 1800); return; }
      this.inventory[I.ARROW] -= 1; if (!this.inventory[I.ARROW]) delete this.inventory[I.ARROW];
      this.syncHotbar();
    }
    this.arrows.shoot(this.player.eye(), this.player.look(), 32);
    this.hand.swing();
    this.bowCooldown = 0.55;
    this.useTool();
  }

  // Impacto de una flecha en el tramo p0→p1 (zombis, Sombras, Lanudos, aldeanos).
  arrowHit(p0, p1, arrow) {
    // Flechas de los arqueros saqueadores: le pegan al jugador (el escudo las frena).
    if (arrow?.enemy) {
      const c = this.player.pos.clone(); c.y += 0.9;
      const d0 = p1.clone().sub(p0); const t = Math.max(0, Math.min(1, c.clone().sub(p0).dot(d0) / d0.lengthSq()));
      if (p0.clone().addScaledVector(d0, t).distanceTo(c) < 0.6 && this.mode === 'survival' && !this.dead) return () => this.damage(3, 'Una flecha de un saqueador te alcanzó', d0.clone().normalize());
      // También a los aldeanos (los guardias las paran con el escudo).
      const dn = d0.clone().normalize();
      const hitV = this.villages.hitTest(p0, dn, d0.length() + 0.25);
      if (hitV) return () => { const from = { pos: arrow.shooter?.pos ?? p0 }; if (this.villages.hurt(hitV, 3, from, true)) this.ui.toast(`Una flecha alcanzó a ${hitV.data.name}`, 2500); };
      return null;
    }
    const d = p1.clone().sub(p0); const len = d.length() + 0.25; d.normalize();
    const v = this.villages.hitTest(p0, d, len);
    if (v) return () => this.villages.annoy(v);
    if (this.bandits.hit(p0, d, len, 6, this.banditCtx())) return () => {};
    if (this.zombies.hit(p0, d, len, 6, this.zombieCtx())) return () => {};
    if (this.shadows.hit(p0, d, len, 6, this.mobCtx())) return () => {};
    if (this.animals.hit(p0, d, len, 6, { onKilled: (_p, sp) => { if (this.mode === 'survival') this.animalDrops(sp); } })) return () => {};
    return null;
  }

  // Luz en un punto (cielo según lo tapado + lámparas/antorchas cerca). Con caché corta por bloque.
  lightAt(x, y, z) {
    const bx = Math.floor(x); const by = Math.floor(y); const bz = Math.floor(z);
    const key = `${bx},${by},${bz}`;
    const c = this.lightCache.get(key);
    if (c && this.lightClock - c.t < 0.5) return Math.max(c.block, this.sky.daylight * c.sky);
    const depth = this.world.topAt(bx, bz) - by;
    const sky = depth <= 0 ? 1 : depth <= 6 ? 0.6 : Math.max(0.12, 0.6 - (depth - 6) * 0.06);
    const lamp = nearLight(this.world, x, y, z, 4);
    const block = lamp ? Math.max(0.4, 1 - Math.hypot(lamp.x - x, lamp.y - y, lamp.z - z) / 10) : 0;
    if (this.lightCache.size > 4000) this.lightCache.clear();
    this.lightCache.set(key, { t: this.lightClock, sky, block });
    return Math.max(block, this.sky.daylight * sky);
  }

  zombieCtx() {
    return {
      player: this.player, daylight: this.sky.daylight, enabled: this.mode === 'survival' && !this.dead, nights: this.stats.nights,
      villagers: this.villages.entities, villages: villagesNear(this.world, this.player.pos.x, this.player.pos.z, 60), lightAt: (x, y, z) => this.lightAt(x, y, z),
      onHitPlayer: (dmg, dir) => { if (!this.damage(dmg, 'Un zombi te alcanzó', dir)) { this.player.vel.x += dir.x * 2; this.player.vel.z += dir.z * 2; return; } this.player.vel.x += dir.x * 6; this.player.vel.z += dir.z * 6; this.player.vel.y = 3.5; },
      onHitVillager: (e, dmg, att) => { const name = e.data.name; const village = e.a.plan.name; if (this.villages.hurt(e, dmg, att)) this.ui.toast(e.data.prof === 'guard' ? `Cayó ${name}, guardia de ${village}, defendiendo la aldea` : `Los zombis atraparon a ${name} en ${village}`, 3500); },
      onKilled: (pos, byPlayer) => {
        if (!byPlayer) return;
        this.stats.kills += 1;
        const v = this.villages.villageAt(pos.x, pos.z) ?? villagesNear(this.world, pos.x, pos.z, 25)[0];
        if (v) { const rec = this.villages.records.get(v.id); if (rec) rec.rep += 1; }
        if (this.sky.daylight < 0.45) this.villages.zombieKilled(pos.x, pos.z);
        if (this.mode === 'survival') { if (Math.random() < 0.4) this.addItem(I.ESSENCE); if (Math.random() < 0.15) this.addItem(I.IRON); if (Math.random() < 0.6) this.addItem(I.SILVER, 1 + Math.floor(Math.random() * 3)); this.renderStatus(); this.checkMissions(); }
      },
    };
  }

  // Carretas: al llegar a destino se hace el trato entre las dos aldeas.
  caravanCtx() {
    const pp = this.player.pos;
    return {
      player: this.player, daylight: this.sky.daylight,
      onDepart: (c) => {
        const from = this.villages.record(c.from); const to = this.villages.record(c.to);
        c.goods = tradeGoods(from, to);
      },
      onArrive: (c) => {
        const from = this.villages.record(c.from); const to = this.villages.record(c.to);
        const g = c.goods ?? tradeGoods(from, to);
        if (g) applyTrade(from, to, g);
        if (Math.hypot(c.mesh.position.x - pp.x, c.mesh.position.z - pp.z) < 90) {
          this.stats.caravans = (this.stats.caravans ?? 0) + 1; this.checkMissions();
          this.ui.toast(g ? `🐴 Llegó la carreta de ${c.from.name} a ${c.to.name}: ${g.n} de ${GOODS_NAME[g.kind]} por ${g.price} de plata` : `🐴 Llegó la carreta de ${c.from.name} a ${c.to.name} de visita`, 4000);
          this.coinSound();
        }
      },
    };
  }

  // Mar: puertos cargados cerca (para los barcos mercantes) y qué pasa cuando uno amarra.
  seaCtx() {
    const pp = this.player.pos;
    return {
      player: this.player, daylight: this.sky.daylight,
      ports: [...this.villages.active.values()].filter((a) => a.plan.port && Math.hypot(a.plan.x - pp.x, a.plan.z - pp.z) < 200),
      onDock: (plan, pos) => {
        const a = this.villages.active.get(plan.id); const rec = a?.rec ?? this.villages.records.get(plan.id);
        if (rec) { rec.importDays = 2; rec.stock.food += 6; rec.stock.wood += 4; rec.stock.stone += 2; rec.ships = (rec.ships ?? 0) + 1; }
        for (const e of a?.list ?? []) if (!e.hidden && (e.data.prof === 'sailor' || e.data.prof === 'fisher' || e.data.prof === 'merchant')) { e.state = 'cheer'; e.timer = 3; this.villages.say?.(e, '¡Llegó el barco!', 3); }
        const d = Math.hypot(pos.x - pp.x, pos.z - pp.z);
        if (d < 120) {
          this.ui.toast(`⚓ Llegó un barco mercante a ${plan.name}: hay gemas, hierro y lana más baratos`, 4500);
          const g = Math.max(0.05, 0.35 * (1 - d / 120));
          this.sound.tone(147, 1.1, g, 'sawtooth'); setTimeout(() => this.sound.tone(110, 1.4, g, 'sawtooth'), 900);
        }
      },
      onLeave: () => {},
    };
  }

  villagerCtx() {
    return {
      onBell: (bell, plan) => {
        const d = Math.hypot(bell.x - this.player.pos.x, bell.z - this.player.pos.z);
        if (d > 110) return;
        const g = Math.max(0.04, 0.3 * (1 - d / 110));
        [0, 1300, 2600].forEach((ms, k) => setTimeout(() => { this.sound.tone(k % 2 ? 330 : 392, 1.6, g, 'sine'); this.sound.tone(k % 2 ? 660 : 784, 0.9, g * 0.4, 'sine'); }, ms));
        if (d < 60) this.ui.toast(`🔔 Suenan las campanas de ${plan.name}: es hora de misa`, 3000);
      },
      onTrade: (pos) => { if (Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) < 10) this.coinSound(); },
      onFeed: (pen) => { if (Math.hypot(pen.x - this.player.pos.x, pen.z - this.player.pos.z) < 14) this.sound.tone(520, 0.08, 0.06, 'triangle'); },
      onSplash: (pos) => { if (Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) < 18) this.sound.noise(0.25, { freq: 900, q: 0.5, gain: 0.12, type: 'lowpass' }); },
      time: this.sky.time,
      player: this.player, daylight: this.sky.daylight, zombies: [...this.zombies.list, ...this.bandits.list.filter((b) => !b.camp || b.aggro)], lightAt: (x, y, z) => this.lightAt(x, y, z),
      canPlace: (b) => !(BLOCKS[b.id].solid && this.player.intersectsBlock(b.x, b.y, b.z)),
      onPlace: (b) => {
        const d = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z);
        if (d < 24) { if (b.id) { this.sound.place(BLOCKS[b.id].sound); if (d < 16 && Math.random() < 0.35) this.spawnParticles({ x: b.x, y: b.y, z: b.z, block: BLOCKS[b.id] }); } else this.sound.dig('grass'); }
      },
      onBuilt: (plan, rec) => { if (Math.hypot(plan.x - this.player.pos.x, plan.z - this.player.pos.z) < 120) { this.ui.toast(`¡${plan.name} tiene una casa nueva! Ya entran ${rec.villagers.length + 1} o más.`, 3500); this.sound.tone(523, 0.1, 0.12, 'sine'); setTimeout(() => this.sound.tone(784, 0.2, 0.12, 'sine'), 120); } },
      hitZombie: (z, dmg, _e, push) => (z.isBandit ? this.bandits.damage(z, dmg, this.banditCtx(), false, push) : this.zombies.damage(z, dmg, this.zombieCtx(), false, push)),
      onGuardHit: (g, z, heavy) => {
        const d = Math.hypot(g.pos.x - this.player.pos.x, g.pos.z - this.player.pos.z);
        if (d < 24) { const k = Math.max(0.05, 1 - d / 24); this.sound.noise(0.12, { freq: heavy ? 900 : 1500, q: 2, gain: 0.35 * k }); this.sound.tone(heavy ? 300 : 480, 0.08, 0.08 * k, 'square'); }
      },
      onAlarm: (plan) => {
        const d = Math.hypot(plan.x - this.player.pos.x, plan.z - this.player.pos.z);
        if (d > 90) return;
        this.ui.toast(`⚔ ¡Alarma en ${plan.name}! Los guardias salen a defender`, 3000);
        const g = Math.max(0.05, 0.25 * (1 - d / 90));
        [0, 350, 700].forEach((ms) => setTimeout(() => this.sound.tone(196, 0.3, g, 'sawtooth'), ms));
      },
      onVictory: (plan) => { if (Math.hypot(plan.x - this.player.pos.x, plan.z - this.player.pos.z) < 70) this.ui.toast(`🛡 Los guardias de ${plan.name} defendieron la aldea`, 3000); },
    };
  }

  // ───── Diálogo y trueques con aldeanos ─────
  openVillager(e) {
    this.villagerOpen = true; this.talkingTo = e;
    this.paused = true;
    this.unlock();
    e.state = 'idle'; e.timer = 6;
    e.heading = Math.atan2(this.player.pos.x - e.pos.x, this.player.pos.z - e.pos.z);
    this.stats.met = (this.stats.met ?? 0) + 1;
    this.renderVillager();
    this.ui.show('#villager-screen', true);
    this.sound.tone(440 + Math.random() * 200, 0.08, 0.1, 'triangle');
  }

  closeVillager() {
    this.villagerOpen = false; this.talkingTo = null;
    this.ui.show('#villager-screen', false);
    this.paused = false; this.lock();
  }

  renderVillager() {
    const e = this.talkingTo; if (!e) return;
    if (e.data.prof === 'king') this.villages.ensureQuest(e);
    this.ui.renderVillager(this.villages.info(e, { honor: this.stats.honor ?? 0 }), this.inventory, this.mode, {
      trade: (tr) => this.trade(e, tr),
      buy: (it) => this.buy(e, it),
      sell: (id, all) => this.sell(e, id, all),
      quest: () => this.deliverQuest(e),
      food: () => { const n = this.villages.giveFood(e, this.inventory, [[I.BREAD, 3], [I.APPLE, 1], [I.WHEAT, 1], [I.CAKE, 8]]); if (n) { this.ui.toast(`Donaste ${n} de comida a la aldea`, 2000); this.syncHotbar(); } else this.ui.toast('No tenés comida para donar', 1600); this.renderVillager(); },
      donate: () => { const n = this.villages.donate(e, this.inventory); if (n) { this.ui.toast(`Donaste ${n} materiales al constructor`, 2000); this.syncHotbar(); } else this.ui.toast('Necesitás tablas, troncos o adoquines', 2000); this.renderVillager(); },
      close: () => this.closeVillager(),
    });
  }

  // ───── Comercio con plata ─────
  buy(e, it) {
    const silver = this.inventory[I.SILVER] ?? 0;
    if (it.locked) { this.ui.toast(`Se vende cuando la aldea sea ${it.needs}`, 2000); return; }
    if (this.mode === 'survival' && silver < it.price) { this.ui.toast(`Te faltan ${it.price - silver} monedas de plata`, 1800); return; }
    if (this.mode === 'survival') { this.inventory[I.SILVER] = silver - it.price; if (!this.inventory[I.SILVER]) delete this.inventory[I.SILVER]; }
    this.addItem(it.id, it.n);
    this.coinSound(); e.a.rec.stock && (e.a.rec.stock.food += 0);
    this.villages.say(e, ['¡Gracias por su compra!', '¡Que lo disfrute!', '¡Buena elección!'][Math.floor(Math.random() * 3)], 2);
    this.stats.trades = (this.stats.trades ?? 0) + 1; this.checkMissions();
    this.syncHotbar(); this.renderStatus(); this.renderVillager();
  }

  sell(e, id, all) {
    const have = this.inventory[id] ?? 0;
    if (!have) { this.ui.toast('No tenés eso para vender', 1400); return; }
    const n = all ? have : 1;
    const price = this.villages.info(e).shop?.buys.find((b) => b.id === id)?.price ?? 1;
    this.inventory[id] -= n; if (this.inventory[id] <= 0) delete this.inventory[id];
    this.addItem(I.SILVER, price * n);
    this.coinSound();
    this.stats.trades = (this.stats.trades ?? 0) + 1; this.checkMissions();
    this.syncHotbar(); this.renderStatus(); this.renderVillager();
  }

  coinSound() { this.sound.tone(1320, 0.06, 0.12, 'square'); setTimeout(() => this.sound.tone(1760, 0.1, 0.1, 'square'), 60); }

  deliverQuest(e) {
    const reward = this.villages.completeQuest(e, this.inventory);
    if (!reward) { this.ui.toast('Todavía no cumpliste el encargo', 1800); return; }
    const before = rankFor(this.stats.honor ?? 0).name;
    this.stats.honor = (this.stats.honor ?? 0) + 1;
    this.addItem(I.SILVER, reward);
    const after = rankFor(this.stats.honor).name;
    this.ui.toast(after !== before ? `¡Encargo cumplido! +${reward} de plata. Ahora sos ${after}.` : `¡Encargo cumplido! +${reward} monedas de plata.`, 3500);
    this.coinSound(); this.sound.tone(784, 0.25, 0.15, 'sine');
    this.syncHotbar(); this.renderStatus(); this.checkMissions(); this.renderVillager();
  }

  trade(e, tr) {
    const has = Object.entries(tr.give).every(([id, n]) => (this.inventory[id] ?? 0) >= n);
    if (this.mode === 'survival' && !has) { this.ui.toast('Te faltan materiales para el trueque', 1600); return; }
    if (tr.repair) {
      const id = this.held();
      if (!maxUses(id) || !(this.toolWear[id] > 0)) { this.ui.toast('Agarrá en la mano una herramienta gastada', 2000); return; }
      this.toolWear[id] = 0;
      this.ui.toast(`${ITEMS[id].name}: ¡como nueva!`, 2000);
    }
    if (this.mode === 'survival') for (const [id, n] of Object.entries(tr.give)) { this.inventory[id] -= n; if (this.inventory[id] <= 0) delete this.inventory[id]; }
    for (const [id, n] of Object.entries(tr.get)) this.addItem(Number(id), n);
    e.a.rec.rep += 1;
    this.stats.trades = (this.stats.trades ?? 0) + 1;
    this.sound.tone(660, 0.08, 0.15, 'sine'); setTimeout(() => this.sound.tone(990, 0.12, 0.12, 'sine'), 80);
    this.villages.say(e, ['¡Trato hecho!', '¡Un placer!', 'Volvé cuando quieras.'][Math.floor(Math.random() * 3)], 2.5);
    this.syncHotbar(); this.renderHotbar(); this.checkMissions();
    this.renderVillager();
  }

  mobCtx() {
    return {
      player: this.player, daylight: this.sky.daylight, enabled: this.mode === 'survival' && !this.dead, nights: this.stats.nights,
      onHitPlayer: (dmg, dir) => { if (!this.damage(dmg, 'Una Sombra te atrapó en la oscuridad', dir)) return; this.player.vel.x += dir.x * 7; this.player.vel.z += dir.z * 7; this.player.vel.y = 4; },
      onKilled: (_pos, byPlayer) => { if (byPlayer) { this.stats.kills += 1; this.addItem(I.ESSENCE); this.checkMissions(); } },
    };
  }

  // Faro: rayo de luz visible desde lejos y punto de reaparición.
  addBeam(f) {
    const key = `${f.x},${f.y},${f.z}`;
    if (this.beams.has(key)) return;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 90, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ff2e6, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(f.x + 0.5, f.y + 46, f.z + 0.5);
    this.scene.add(beam);
    this.beams.set(key, beam);
  }

  removeBeam(x, y, z) {
    const key = `${x},${y},${z}`;
    const beam = this.beams.get(key);
    if (beam) { this.scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); this.beams.delete(key); }
    this.faros = this.faros.filter((f) => `${f.x},${f.y},${f.z}` !== key);
  }

  // ───────── Bloques ─────────
  target() { return raycast(this.world, this.player.eye(), this.player.look(), 6); }

  breakTarget() {
    const t = this.target();
    if (!t || !t.block.breakable) return;
    this.world.setBlock(t.x, t.y, t.z, B.AIR);
    this.sound.dig(t.block.sound);
    this.spawnParticles(t);
    if (t.id === B.FARO) this.removeBeam(t.x, t.y, t.z);
    // Cofre del botín: todo lo que había adentro, y el campamento se enoja si sigue en pie.
    const wreck = t.id === B.LOOT_CHEST && t.y < 40 ? wrecksNear(this.world, t.x, t.z)[0] : null;
    if (wreck) {
      if (this.mode === 'survival') for (const [id, n] of Object.entries(treasure())) this.addItem(Number(id), n);
      this.ui.toast(`¡El tesoro de «${wreck.name}»! Perlas, oro y plata`, 3500);
      this.stats.wrecks = (this.stats.wrecks ?? 0) + 1;
      this.sound.tone(660, 0.12, 0.12, 'sine'); setTimeout(() => this.sound.tone(880, 0.12, 0.12, 'sine'), 120); setTimeout(() => this.sound.tone(1320, 0.3, 0.12, 'sine'), 240);
      this.renderStatus();
    } else if (t.id === B.LOOT_CHEST) {
      const loot = lootTable();
      if (this.mode === 'survival') for (const [id, n] of Object.entries(loot)) if (n > 0) this.addItem(Number(id), n);
      this.ui.toast('¡Botín! Plata, oro, hierro y más', 3000);
      this.stats.loot = (this.stats.loot ?? 0) + 1;
      for (const b of this.bandits.list) if (b.camp && Math.hypot(b.pos.x - t.x, b.pos.z - t.z) < 30) b.aggro = true;
      this.renderStatus();
    }
    // La puerta son dos bloques: se va entera.
    if (t.id === B.DOOR || t.id === B.DOOR_OPEN) for (const dy of [-1, 1]) { const id = this.world.getBlock(t.x, t.y + dy, t.z); if (id === B.DOOR || id === B.DOOR_OPEN) this.world.setBlock(t.x, t.y + dy, t.z, B.AIR); }
    // Si se rompe lo de abajo, el trigo de arriba se cae.
    const above = this.world.getBlock(t.x, t.y + 1, t.z);
    if (above === B.WHEAT_YOUNG || above === B.WHEAT_RIPE || above === B.TORCH) { this.world.setBlock(t.x, t.y + 1, t.z, B.AIR); if (this.mode === 'survival') this.addItem(BLOCKS[above].drop); }
    if (this.mode === 'survival') {
      this.addItem(t.block.drop); this.useTool();
      // Extras: semillas del pasto y del trigo, manzanas de las hojas.
      if ((t.id === B.GRASS && Math.random() < 0.12) || (t.id === B.TALL_GRASS && Math.random() < 0.25)) this.addItem(I.SEEDS);
      if (t.id === B.WHEAT_RIPE) this.addItem(I.SEEDS, 1 + Math.floor(Math.random() * 2));
      if ((t.id === B.LEAVES || t.id === B.BIRCH_LEAVES) && Math.random() < 0.08) { this.addItem(I.APPLE); this.ui.toast('¡Una manzana!', 1200); }
      this.checkMissions();
    }
  }

  placeBlock() {
    const slot = this.hotbar[this.selected];
    const t = this.target();
    if (!t) return;
    // Clic derecho sobre una Mesa de trabajo: abre el Taller con todas las recetas (agachado, coloca).
    if (t.id === B.WORKBENCH && this.mode === 'survival' && !this.player.sneaking) { this.toggleCraft(); return; }
    if (!slot?.id || isItem(slot.id)) return;   // herramientas y materiales no se colocan
    const x = t.x + t.face[0]; const y = t.y + t.face[1]; const z = t.z + t.face[2];
    const cur = this.world.getBlock(x, y, z);
    if (cur !== B.AIR && cur !== B.WATER) return;
    if (BLOCKS[slot.id].solid && this.player.intersectsBlock(x, y, z)) return;
    if (y < 0 || y >= H) return;
    // La puerta necesita dos bloques de alto.
    if (slot.id === B.DOOR) { if (this.world.getBlock(x, y + 1, z) !== B.AIR) return; this.world.setBlock(x, y + 1, z, B.DOOR); }
    this.world.setBlock(x, y, z, slot.id);
    this.sound.place(BLOCKS[slot.id].sound);
    this.hand.swing();
    if (slot.id === B.FARO) {
      this.faros.push({ x, y, z });
      this.addBeam({ x, y, z });
      this.spawn = { x: x + 0.5, y: y + 1, z: z + 0.5 };
      this.ui.toast('Faro encendido: vas a reaparecer acá');
    }
    if (this.mode === 'survival') {
      this.inventory[slot.id] = (this.inventory[slot.id] ?? 1) - 1;
      if (this.inventory[slot.id] <= 0) delete this.inventory[slot.id];
      this.stats.placed[slot.id] = (this.stats.placed[slot.id] ?? 0) + 1;
      this.syncHotbar();
      this.checkMissions();
    }
  }

  pickBlock() {
    const t = this.target();
    if (!t || this.mode !== 'creative' || !PLACEABLE.includes(t.id)) return;
    this.hotbar[this.selected] = { id: t.id, count: 1 };
    this.renderHotbar();
  }

  addItem(id, n = 1) {
    if (!PLACEABLE.includes(id) && !ITEMS[id]) return;
    this.inventory[id] = (this.inventory[id] ?? 0) + n;
    this.stats.collected[id] = (this.stats.collected[id] ?? 0) + n;
    this.autoSlot(id);
    this.syncHotbar();
  }

  // Supervivencia: romper lleva tiempo según la dureza del bloque.
  updateBreaking(dt) {
    if (this.mode !== 'survival' || !this.mouse.left || this.paused) return;
    const t = this.target();
    if (!t || !t.block.breakable) { this.breaking = null; this.ui.setBreakProgress(0); return; }
    const key = `${t.x},${t.y},${t.z}`;
    if (!this.breaking || this.breaking.key !== key) this.breaking = { key, progress: 0, tick: 0 };
    const time = Math.max(0.12, (t.block.hardness * 0.75) / mineSpeed(this.held(), t.block));
    this.breaking.progress += dt / time;
    this.breaking.tick += dt;
    if (this.breaking.tick > 0.25) { this.breaking.tick = 0; this.sound.step(t.block.sound); }
    this.ui.setBreakProgress(Math.min(1, this.breaking.progress));
    if (this.breaking.progress >= 1) { this.breakTarget(); this.breaking = null; this.ui.setBreakProgress(0); }
  }

  spawnParticles(t) {
    const [u0, v0, u1, v1] = uvRect(t.block.tex[1]);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const uv = g.attributes.uv;
      const su = u0 + Math.random() * (u1 - u0) * 0.75; const sv = v0 + Math.random() * (v1 - v0) * 0.75;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, su + uv.getX(k) * (u1 - u0) * 0.2, sv + uv.getY(k) * (v1 - v0) * 0.2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.atlasTex, color: new THREE.Color().setScalar(this.sky.daylight) }));
      m.position.set(t.x + 0.2 + Math.random() * 0.6, t.y + 0.2 + Math.random() * 0.6, t.z + 0.2 + Math.random() * 0.6);
      m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0.5 + Math.random() * 0.4 };
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  updateParticles(dt) {
    this.particles = this.particles.filter((m) => {
      m.userData.life -= dt;
      m.userData.v.y -= 18 * dt;
      m.position.addScaledVector(m.userData.v, dt);
      if (m.userData.life <= 0) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
      return true;
    });
  }

  // ───────── Vida (supervivencia) ─────────
  // dir: de dónde viene el golpe (solo golpes de criaturas: el escudo y la armadura no sirven contra caídas).
  damage(n, reason, dir) {
    if (this.mode !== 'survival' || n <= 0 || this.dead) return false;
    if (dir) {
      // Escudo levantado y golpe de frente: lo frena del todo.
      const look = this.player.look(); const lx = look.x; const lz = look.z; const ll = Math.hypot(lx, lz) || 1;
      const front = -(dir.x * lx + dir.z * lz) / ((Math.hypot(dir.x, dir.z) || 1) * ll);
      if (this.blocking && front > -0.15) {
        this.sound.noise(0.18, { freq: 2600, q: 3, gain: 0.55 }); this.sound.tone(520, 0.08, 0.12, 'square');
        this.wearEquip('offhand', n); this.shake = 0.12;
        return false;
      }
      // Armadura: cada punto frena 4% del daño y las piezas se gastan.
      const red = armorReduction(armorPoints(this.equip));
      if (red > 0) {
        const raw = n * (1 - red);
        n = Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0);
        for (const s of ARMOR_SLOTS) if (this.equip[s]) this.wearEquip(s, 1);
        if (n <= 0) { this.sound.noise(0.1, { freq: 2000, q: 2, gain: 0.3 }); return false; }
      }
    }
    this.health = Math.max(0, this.health - n);
    this.sound.hurt();
    this.shake = 0.35;
    this.ui.renderHearts(this.health, this.maxHealth);
    document.querySelector('#hurt').classList.remove('flash'); void document.querySelector('#hurt').offsetWidth; document.querySelector('#hurt').classList.add('flash');
    if (this.health <= 0) this.die(reason);
    return true;
  }

  die(reason) {
    this.dead = true;
    this.unlock();
    document.querySelector('#death-reason').textContent = reason;
    this.ui.show('#death', true);
  }

  respawn() {
    this.dead = false;
    this.health = this.maxHealth; this.air = 10; this.player.stamina = 100;
    this.player.pos.set(this.spawn.x, this.spawn.y, this.spawn.z);
    this.player.vel.set(0, 0, 0);
    this.ui.renderHearts(this.health, this.maxHealth);
    this.ui.show('#death', false);
    this.lock();
  }

  // ───────── Guardado ─────────
  snapshot() {
    return {
      version: 1, id: this.worldId, name: this.worldName, seed: this.world.seedText, mode: this.mode,
      player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw, pitch: this.player.pitch, flying: this.player.flying },
      spawn: this.spawn, time: this.sky.time, health: this.health, inventory: this.inventory, hotbar: this.hotbar, selected: this.selected,
      playTime: this.playTime, mods: this.world.serializeMods(), savedAt: new Date().toISOString(),
      stats: this.stats, maxHealth: this.maxHealth, faros: this.faros, toolWear: this.toolWear, villages: this.villages.serialize(), bandits: this.bandits.serialize(), equip: this.equip, armorWear: this.armorWear, crops: this.crops, boats: this.sea.serialize(),
    };
  }
  async save() {
    this.lastSave = performance.now();
    const snap = this.snapshot();
    const thumb = this.captureThumb();
    if (thumb) snap.thumb = thumb; else if (this.saveData?.thumb) snap.thumb = this.saveData.thumb;
    await saveWorld(this.worldId, snap);
  }

  // Foto chica del mundo para la lista del launcher (se toma justo después de dibujar el cuadro).
  captureThumb() {
    if (!this.started || this.dead || this.player.headInWater) return null;
    try {
      this.renderer.render(this.scene, this.camera);
    this.updateHand(dt, hSpeed);
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const src = this.renderer.domElement;
      const ratio = src.width / src.height; const sw = ratio > 16 / 9 ? src.height * 16 / 9 : src.width; const sh = ratio > 16 / 9 ? src.height : src.width * 9 / 16;
      c.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 320, 180);
      const url = c.toDataURL('image/jpeg', 0.72);
      this.saveData = { ...(this.saveData ?? {}), thumb: url };
      return url;
    } catch { return null; }
  }
  async saveAndExit() { await this.save(); await saveSettings(this.settings); exitToLauncher(); }

  applySettings(s) {
    this.settings = s;
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.sound.volume = s.volume;
    this.sound.musicVolume = s.music ?? 0.5;
    document.querySelector('#minimap').style.display = s.minimap === false ? 'none' : '';
  }

  // ───────── Bucle principal ─────────
  start() {
    this.started = true;
    this.paused = false;
    this.lock();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    this.updateChunks(this.paused ? 4 : 6);
    if (!this.paused && !this.dead) {
      this.playTime += dt;
      const ev = this.sea.riding ? (this.sea.ride(dt, this.player.input, this.player), {}) : this.player.update(dt);
      if (ev.step) this.sound.step(BLOCKS[ev.step]?.sound);
      if (ev.landed) { this.landDip = Math.min(0.3, ev.landed * 0.016); if (ev.landed > 6) this.sound.step(BLOCKS[this.world.getBlock(Math.floor(this.player.pos.x), Math.floor(this.player.pos.y - 0.5), Math.floor(this.player.pos.z))]?.sound); }
      if (ev.fallDamage) this.damage(ev.fallDamage, 'Te caíste desde muy alto');
      if (ev.void) { if (this.mode === 'survival') this.damage(20, 'Caíste al vacío'); else { this.player.pos.set(this.spawn.x, this.spawn.y + 10, this.spawn.z); this.player.vel.set(0, 0, 0); } }
      if (this.player.headInWater !== this.wasUnder) { if (this.player.headInWater) this.sound.splash(); this.wasUnder = this.player.headInWater; }
      // Aire bajo el agua (supervivencia).
      if (this.mode === 'survival') {
        if (this.player.headInWater) { this.air -= dt / 1.5; if (this.air <= 0) { this.air = 1; this.damage(2, 'Te ahogaste'); } }
        else this.air = Math.min(10, this.air + dt * 4);
        this.ui.renderAir(this.air, this.player.headInWater || this.air < 10);
        // Regeneración lenta.
        this.regen = (this.regen ?? 0) + dt;
        if (this.regen > 6 && this.health < this.maxHealth && this.health > 0) { this.regen = 0; this.health += 1; this.ui.renderHearts(this.health, this.maxHealth); }
      }
      this.updateBreaking(dt);
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.shadows.update(dt, this.mobCtx());
      this.animals.update(dt, { player: this.player, daylight: this.sky.daylight });
      this.sea.update(dt, this.seaCtx());
      this.updateHorse(dt);
      this.caravans.update(dt, this.caravanCtx());
      this.lightClock += dt;
      navFrame();
      this.villages.update(dt, this.villagerCtx());
      this.zombies.update(dt, this.zombieCtx());
      this.bandits.update(dt, this.banditCtx());
      this.updateHazards(dt);
      this.bowCooldown = Math.max(0, this.bowCooldown - dt);
      this.arrows.update(dt, {
        hitTest: (p0, p1, a) => this.arrowHit(p0, p1, a),
        pickup: (pos) => { if (pos.distanceTo(this.player.pos.clone().setY(this.player.pos.y + 0.9)) > 1.6) return false; if (this.mode === 'survival') { this.addItem(I.ARROW); this.sound.click(); } return true; },
        light: Math.max(0.3, this.sky.daylight),
      });
      this.updateVillageHud(dt);
      // Amanecer: aldeas (nacimientos, parejas, obras) y una noche más sobrevivida.
      if (this.prevTime !== undefined && this.prevTime > 0.9 && this.sky.time < 0.1) this.onDawn();
      this.updateCrops(dt);
      this.eatCooldown = Math.max(0, this.eatCooldown - dt);
      // Escudo: clic derecho sostenido (sin un bloque en la mano) o la tecla V.
      const heldNow = this.held();
      this.blocking = this.mode === 'survival' && this.equip.offhand === I.SHIELD && (this.keyV || (this.mouse.right && (!heldNow || (isItem(heldNow) && !isFood(heldNow) && heldNow !== I.BOW && heldNow !== I.SEEDS))));
      this.player.slow = this.blocking ? 0.45 : this.horse ? 2.1 : 1;
      this.prevTime = this.sky.time;
      this.ui.renderStamina(this.player.stamina, this.mode === 'survival');
      document.querySelector('#glide-tag').style.display = this.player.gliding ? 'block' : 'none';
    }
    this.updateParticles(dt);
    this.minimap.update(dt, this.mapCtx(), this.mapOpen);
    // Música: más grave bajo tierra (techo opaco muy por encima y lejos del cielo).
    const ppx = Math.floor(this.player.pos.x); const ppz = Math.floor(this.player.pos.z);
    this.sound.updateMusic(this.paused ? 0 : dt, { night: this.sky.daylight < 0.4, underground: this.player.pos.y < this.world.topAt(ppx, ppz) - 4 && this.player.pos.y < 30 });

    // Cámara: balanceo al caminar, hundida al aterrizar, temblor al recibir daño y FOV más abierto al correr o planear.
    const eye = this.player.eye();
    const pl = this.player;
    const hSpeed = Math.hypot(pl.vel.x, pl.vel.z);
    const walking = pl.onGround && !pl.flying && hSpeed > 0.6 && !this.paused;
    const bobOn = this.settings.viewBob !== false;
    this.bobAmt += ((walking && bobOn ? Math.min(1.3, hSpeed / 4.3) : 0) - this.bobAmt) * Math.min(1, dt * 7);
    if (walking) this.bob += dt * hSpeed * 1.75;
    this.landDip *= Math.exp(-dt * 7);
    this.shake = Math.max(0, this.shake - dt);
    const sx = Math.sin(this.bob) * 0.04 * this.bobAmt; const sy = Math.abs(Math.cos(this.bob)) * 0.055 * this.bobAmt;
    const sh = this.shake * 0.25;
    this.camera.position.set(
      eye.x + Math.cos(pl.yaw) * sx + (Math.random() - 0.5) * sh,
      eye.y + sy - 0.03 * this.bobAmt - this.landDip + (Math.random() - 0.5) * sh,
      eye.z - Math.sin(pl.yaw) * sx + (Math.random() - 0.5) * sh,
    );
    this.camera.rotation.set(pl.pitch - this.landDip * 0.25, pl.yaw, Math.sin(this.bob) * 0.012 * this.bobAmt + (Math.random() - 0.5) * sh * 0.2, 'YXZ');
    const fovTarget = this.settings.fov + (pl.sprinting && hSpeed > 4 ? 8 : 0) + (pl.gliding ? 12 : 0) + (pl.flying && pl.input.sprint ? 10 : 0);
    this.fovCur += (fovTarget - this.fovCur) * Math.min(1, dt * 8);
    if (Math.abs(this.camera.fov - this.fovCur) > 0.05) { this.camera.fov = this.fovCur; this.camera.updateProjectionMatrix(); }

    // Cielo, luz y niebla
    const skyColor = this.sky.update(this.paused ? 0 : dt, this.camera, this.player.headInWater);
    this.renderer.setClearColor(skyColor);
    const far = this.settings.renderDistance * CS;
    for (const m of [this.matOpaque, this.matWater]) {
      m.uniforms.daylight.value = this.sky.daylight;
      m.uniforms.fogColor.value.copy(skyColor);
      m.uniforms.fogNear.value = this.player.headInWater ? 2 : far * 0.55;
      m.uniforms.fogFar.value = this.player.headInWater ? 22 : far * 0.95;
    }
    document.querySelector('#underwater').style.opacity = this.player.headInWater ? 1 : 0;

    // Bloque apuntado
    const t = !this.paused ? this.target() : null;
    this.highlight.visible = !!t;
    if (t) this.highlight.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);

    this.renderer.render(this.scene, this.camera);
    this.updateHand(dt, hSpeed);

    // FPS y depuración
    this.fpsFrames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsFrames = 0; this.fpsTime = 0; this.updateHud(); }
    if (performance.now() - this.lastSave > 30000 && !this.paused) this.save();
  }

  // Cartel al entrar a una aldea y marcadores para el mapa.
  updateVillageHud(dt) {
    this.villageCheck -= dt;
    if (this.villageCheck > 0) return;
    this.villageCheck = 1;
    const p = this.player.pos;
    const v = this.villages.villageAt(p.x, p.z);
    if (v && v.id !== this.villageNow) {
      const rec = this.villages.records.get(v.id);
      this.ui.toast(`${v.port ? '⚓ ' : 'Aldea '}${v.name}${rec ? ` · ${rec.villagers.length} habitantes` : ''}`, 3500);
      this.stats.visited = (this.stats.visited ?? 0) + 1;
      if (v.port) this.stats.ports = (this.stats.ports ?? 0) + 1;
      this.checkMissions();
    }
    this.villageNow = v?.id ?? null;
    this.villageMarkers = this.villages.mapMarkers(p.x, p.z, 400);
    this.fillPens();
    // Campamentos de saqueadores: cartel al acercarse y marcadores rojos en el mapa.
    const camp = campsNear(this.world, p.x, p.z, 0)[0] ?? null;
    if (camp && camp.id !== this.campNow) {
      const rec = this.bandits.records.get(camp.id);
      this.ui.toast(rec?.defeated ? `Campamento abandonado de ${camp.name}` : `⚠ Campamento de ${camp.name}: ¡cuidado!`, 3500);
      this.stats.campsFound = (this.stats.campsFound ?? 0) + 1;
    }
    this.campNow = camp?.id ?? null;
    this.campMarkers = [];
    for (let rx = Math.floor((p.x - 400) / CAMP_REGION); rx <= Math.floor((p.x + 400) / CAMP_REGION); rx++) for (let rz = Math.floor((p.z - 400) / CAMP_REGION); rz <= Math.floor((p.z + 400) / CAMP_REGION); rz++) {
      const c = campPlan(this.world, rx, rz);
      if (c) this.campMarkers.push({ x: c.x, z: c.z, name: c.name, defeated: !!this.bandits.records.get(c.id)?.defeated });
    }
  }

  // Lava (quema y te hace nadar lento) y la barra de vida del jefe saqueador.
  updateHazards(dt) {
    this.lavaT -= dt;
    if (this.player.inLava && this.lavaT <= 0 && this.mode === 'survival') {
      this.lavaT = 0.5;
      this.damage(3, 'Te quemaste en la lava');
      for (let k = 0; k < 3; k++) this.sound.noise(0.2, { freq: 400 + Math.random() * 300, q: 1, gain: 0.3 });
    }
    document.querySelector('#lava-overlay').style.opacity = this.player.inLava ? 1 : 0;
    const boss = this.bandits.boss(this.player);
    const bar = document.querySelector('#boss');
    bar.style.display = boss ? 'block' : 'none';
    if (boss) { bar.querySelector('b').textContent = `${boss.name} · jefe de ${boss.camp?.plan.name ?? 'los saqueadores'}`; bar.querySelector('i').style.width = `${Math.max(0, boss.hp / boss.max) * 100}%`; }
  }

  banditCtx() {
    const pp = this.player.pos;
    return {
      player: this.player, daylight: this.sky.daylight, enabled: this.mode === 'survival' && !this.dead,
      villagers: this.villages.entities, villages: [...this.villages.active.values()].filter((a) => Math.hypot(a.plan.x - pp.x, a.plan.z - pp.z) < 90),
      lightAt: (x, y, z) => this.lightAt(x, y, z),
      onHitPlayer: (dmg, dir, b) => { if (!this.damage(dmg, b.kind === 'leader' ? `${b.name} te derrotó` : 'Un saqueador te derrotó', dir)) { this.player.vel.x += dir.x * 2; this.player.vel.z += dir.z * 2; return; } this.player.vel.x += dir.x * 6; this.player.vel.z += dir.z * 6; this.player.vel.y = 3.5; },
      onHitVillager: (e, dmg, att) => { const name = e.data.name; const village = e.a.plan.name; if (this.villages.hurt(e, dmg, att)) this.ui.toast(e.data.prof === 'guard' ? `Cayó ${name}, guardia de ${village}, defendiendo la aldea` : `Los saqueadores atacaron a ${name} en ${village}`, 3500); },
      onShoot: (from, dir, b) => this.arrows.shoot(from, dir, 26, { enemy: true, shooter: b }),
      onRaid: (plan, campName) => {
        this.ui.toast(`⚔ ¡Saqueadores de ${campName} atacan ${plan.name}!`, 4500);
        this.sound.tone(196, 0.5, 0.2, 'sawtooth'); setTimeout(() => this.sound.tone(147, 0.7, 0.2, 'sawtooth'), 450);
      },
      onSteal: (plan, n) => { const rec = this.villages.records.get(plan.id); if (rec?.stock) rec.stock.food = Math.max(0, rec.stock.food - n); if (Math.random() < 0.3) this.ui.toast(`¡Se están robando la comida de ${plan.name}!`, 2500); },
      onFreed: (c, campPlanRef) => {
        // Se muda a la aldea buena más cercana al campamento.
        const v = this.villages.mapMarkers(campPlanRef.x, campPlanRef.z, 600).sort((a, b) => Math.hypot(a.x - campPlanRef.x, a.z - campPlanRef.z) - Math.hypot(b.x - campPlanRef.x, b.z - campPlanRef.z))[0];
        const plan = v && this.villages.villageAt(v.x, v.z);
        const villager = plan ? this.villages.addRefugee(plan) : null;
        this.stats.freed = (this.stats.freed ?? 0) + 1;
        this.ui.toast(villager ? `¡Liberaste a ${villager.name}! Se va a vivir a ${plan.name}.` : '¡Liberaste a un prisionero!', 4000);
        this.sound.tone(523, 0.1, 0.15, 'sine'); setTimeout(() => this.sound.tone(784, 0.2, 0.15, 'sine'), 120);
        this.checkMissions();
      },
      onKilled: (b, byPlayer) => {
        if (!byPlayer || this.mode !== 'survival') return;
        if (b.kind === 'leader') {
          this.stats.leaders = (this.stats.leaders ?? 0) + 1;
          this.addItem(I.SILVER, 30); this.addItem(I.GOLD, 2); this.addItem(I.ESSENCE, 2);
          this.ui.toast(`¡Derrotaste a ${b.name}! El campamento ${b.camp?.plan.name ?? ''} quedó libre.`, 5000);
          this.sound.tone(523, 0.15, 0.15, 'square'); setTimeout(() => this.sound.tone(659, 0.15, 0.15, 'square'), 150); setTimeout(() => this.sound.tone(1046, 0.4, 0.15, 'square'), 300);
          // Reputación con las aldeas cercanas.
          for (const p of this.villages.mapMarkers(b.pos.x, b.pos.z, 450)) { const plan = this.villages.villageAt(p.x, p.z); const rec = plan && this.villages.records.get(plan.id); if (rec) rec.rep += 5; }
        } else {
          this.addItem(I.SILVER, 2 + Math.floor(Math.random() * 4));
          if (b.kind === 'archer') this.addItem(I.ARROW, 4 + Math.floor(Math.random() * 5));
          else if (Math.random() < 0.3) this.addItem(I.IRON);
        }
        this.stats.banditKills = (this.stats.banditKills ?? 0) + 1;
        this.renderStatus(); this.checkMissions();
      },
    };
  }

  // Mano en primera persona: ítem actual, animación y luz del lugar donde estás.
  updateHand(dt, hSpeed) {
    if (this.dead) return;
    this.hand.setItem(this.held());
    this.handLightT -= dt;
    if (this.handLightT <= 0) {
      this.handLightT = 0.25;
      const e = this.player.eye(); const ex = Math.floor(e.x); const ez = Math.floor(e.z);
      const depth = this.world.topAt(ex, ez) - Math.floor(e.y);
      const sky = depth <= 0 ? 1 : depth <= 6 ? 0.6 : Math.max(0.12, 0.6 - (depth - 6) * 0.06);
      const lamp = nearLight(this.world, e.x, e.y, e.z, 5);
      const block = lamp ? Math.max(0.35, 1 - Math.hypot(lamp.x - e.x, lamp.y - e.y, lamp.z - e.z) / 12) : 0;
      this.handLight = Math.max(this.sky.daylight * sky, block);
    }
    this.hand.update({
      dt, moveSpeed: this.player.onGround && !this.player.flying ? hSpeed : 0, onGround: this.player.onGround, sprinting: this.player.sprinting,
      light: this.handLight, mouseDX: this.mouseD.x, mouseDY: this.mouseD.y, aspect: window.innerWidth / window.innerHeight,
      breaking: !!this.breaking && this.mouse.left && !this.paused,
    });
    this.mouseD.x = 0; this.mouseD.y = 0;
    this.hand.setShield(this.mode === 'survival' && this.equip.offhand === I.SHIELD);
    this.hand.updateShield(dt, this.blocking, this.handLight);
    if (this.settings.showHand !== false) this.hand.render(this.renderer);
  }

  updateHud() {
    const p = this.player.pos;
    document.querySelector('#fps').textContent = this.settings.showFps ? `${this.fps} FPS` : '';
    document.querySelector('#clock').textContent = this.sky.clock;
    document.querySelector('#day').textContent = this.mode === 'survival' ? ` · Día ${this.stats.nights + 1}` : '';
    if (this.showDebug) {
      this.ui.debug([
        `Voxelia ${VERSION} · ${this.fps} FPS`,
        `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`,
        `Chunk: ${Math.floor(p.x / CS)}, ${Math.floor(p.z / CS)} · cargados ${this.world.chunks.size}`,
        `Bioma: ${this.world.biome(Math.floor(p.x), Math.floor(p.z))}`,
        `Semilla: ${this.world.seedText}`,
        `Hora: ${this.sky.clock} · Modo: ${this.mode === 'creative' ? 'creativo' : 'supervivencia'}${this.player.flying ? ' (volando)' : ''}`,
      ].join('\n'));
    }
  }
}
