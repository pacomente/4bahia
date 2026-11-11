import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE } from './blocks.js';
import { World, CS, H } from './world.js';
import { meshChunk, createBlockMaterial } from './mesher.js';
import { buildAtlasCanvas, buildAtlasTexture, uvRect } from './textures.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { Sky } from './sky.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { saveWorld, saveSettings, exitToLauncher } from './storage.js';
import { I, ITEMS, isItem, mineSpeed, attackDamage } from './items.js';
import { craft } from './recipes.js';
import { emptyStats, missionStatus } from './missions.js';
import { Shadows } from './mobs.js';
import { Animals } from './animals.js';
import { MiniMap } from './minimap.js';

export const VERSION = '0.3.0';

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

    this.world = new World(seed, save?.mods ?? {});
    this.initRenderer();
    this.atlasCanvas = buildAtlasCanvas();
    this.atlasTex = buildAtlasTexture(this.atlasCanvas);
    this.matOpaque = createBlockMaterial(this.atlasTex);
    this.matWater = createBlockMaterial(this.atlasTex, { transparent: true });
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
    this.minimap = new MiniMap(this.atlasCanvas, this.world);
    for (const f of this.faros) this.addBeam(f);
    this.lastMission = missionStatus(this.stats).done;
    this.initHighlight();
    this.bindInput();
    this.ui.renderHotbar(this.hotbar, this.selected);
    this.ui.renderHearts(this.health, this.maxHealth);
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
      if (d2 > (r + 0.5) * (r + 0.5) || !c.dirty) continue;
      // Solo se arma la malla cuando los 4 vecinos existen (bordes correctos).
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => this.world.getChunk(cx + a, cz + b))) continue;
      this.buildMesh(c);
      work++;
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

  buildMesh(c) {
    this.disposeMesh(c);
    const { opaque, water } = meshChunk(this.world, c);
    c.meshes = [];
    if (opaque) { const m = new THREE.Mesh(opaque, this.matOpaque); this.scene.add(m); c.meshes.push(m); }
    if (water) { const m = new THREE.Mesh(water, this.matWater); m.renderOrder = 1; this.scene.add(m); c.meshes.push(m); }
    c.dirty = false;
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
      const meshed = [...this.world.chunks.values()].filter((c) => c.meshes || !c.dirty).length;
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
      if (e.code === 'KeyE' && this.started && !this.craftOpen) { this.toggleInventory(); return; }
      if (e.code === 'KeyC' && this.started && this.mode === 'survival' && !this.inventoryOpen) { this.toggleCraft(); return; }
      if (e.code === 'KeyM' && this.started && !this.inventoryOpen && !this.craftOpen && !this.dead) { this.toggleMap(); return; }
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
      if (e.code === 'ShiftLeft') this.player.input.down = true;
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
    });
    document.addEventListener('mousemove', (e) => {
      if (this.paused || document.pointerLockElement !== this.canvas) return;
      const s = 0.0022 * this.settings.sensitivity;
      this.player.yaw -= e.movementX * s;
      this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - e.movementY * s));
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.paused) return;
      if (document.pointerLockElement !== this.canvas) { this.lock(); return; }
      if (e.button === 0) {
        if (this.attackMob()) return;
        this.mouse.left = true;
        if (this.mode === 'creative') this.breakTarget();
      }
      if (e.button === 2) this.placeBlock();
      if (e.button === 1) this.pickBlock();
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) { this.mouse.left = false; this.breaking = null; this.ui.setBreakProgress(0); } });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (!this.paused) this.select((this.selected + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.started && !this.inventoryOpen && !this.craftOpen && !this.mapOpen && !this.dead) this.pause(true);
    });
  }

  lock() { this.canvas.requestPointerLock?.(); }
  select(i) { this.selected = i; this.ui.renderHotbar(this.hotbar, this.selected); this.sound.click(); }

  pause(on) {
    this.paused = on;
    for (const k of Object.keys(this.player.input)) this.player.input[k] = typeof this.player.input[k] === 'boolean' ? false : 0;
    this.ui.show('#pause', on);
    if (on) { this.save(); if (document.pointerLockElement) document.exitPointerLock(); } else this.lock();
  }

  toggleInventory() {
    this.inventoryOpen = !this.inventoryOpen;
    this.ui.show('#inventory', this.inventoryOpen);
    if (this.inventoryOpen) {
      this.paused = true;
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.renderInventory((id) => {
        // Pone el bloque elegido en la casilla seleccionada.
        // Si el ítem ya estaba en otra casilla, se mueve (no se duplica).
        this.hotbar = this.hotbar.map((s) => (s?.id === id ? null : s));
        this.hotbar[this.selected] = { id, count: this.mode === 'survival' ? this.inventory[id] : 1 };
        this.ui.renderHotbar(this.hotbar, this.selected);
        this.toggleInventory();
      }, this.inventory);
    } else { this.paused = false; this.lock(); }
  }

  toggleCraft() {
    this.craftOpen = !this.craftOpen;
    this.ui.show('#craft', this.craftOpen);
    if (this.craftOpen) {
      this.paused = true;
      if (document.pointerLockElement) document.exitPointerLock();
      this.renderCraft();
    } else { this.paused = false; this.lock(); }
  }

  // Mapa grande (M): muestra lo explorado alrededor, faros y punto de reaparición.
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.ui.show('#map-screen', this.mapOpen);
    if (this.mapOpen) {
      this.paused = true;
      if (document.pointerLockElement) document.exitPointerLock();
      this.minimap.timer = 0;
      this.minimap.update(0, this.mapCtx(), true);
    } else { this.paused = false; this.lock(); }
  }

  mapCtx() {
    return { player: this.player, spawn: this.spawn, faros: this.faros, radius: (this.settings.renderDistance + 1) * CS, showMini: this.settings.minimap !== false };
  }

  renderCraft() {
    this.ui.renderCraft(this.inventory, { maxHealth: this.maxHealth }, (recipe) => {
      const res = craft(recipe, this.inventory, { maxHealth: this.maxHealth });
      if (!res) return;
      this.stats.crafted[recipe.id] = (this.stats.crafted[recipe.id] ?? 0) + 1;
      if (res.special === 'heart') { this.maxHealth = Math.min(30, this.maxHealth + 2); this.health = Math.min(this.maxHealth, this.health + 2); this.ui.renderHearts(this.health, this.maxHealth); this.ui.toast('¡Corazón extra! Tu vida máxima aumentó.'); }
      for (const id of Object.keys(res.out).map(Number)) this.autoSlot(id);
      if (this.inventory[I.GLIDER]) this.player.hasGlider = true;
      this.sound.tone(660, 0.08, 0.15, 'sine'); setTimeout(() => this.sound.tone(880, 0.12, 0.15, 'sine'), 70);
      this.syncHotbar();
      this.checkMissions();
      this.renderCraft();
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
    this.ui.renderHotbar(this.hotbar, this.selected);
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

  // Golpe a una criatura (Sombra o Lanudo) delante del jugador. Devuelve true si le pegó a alguna.
  attackMob() {
    if (this.attackCooldown > 0) return false;
    const eye = this.player.eye(); const dir = this.player.look(); const dmg = attackDamage(this.held());
    const hit = (this.shadows.list.length && this.shadows.hit(eye, dir, 3.6, dmg, this.mobCtx()))
      || (this.animals.list.length && this.animals.hit(eye, dir, 3.6, dmg, { onKilled: () => { if (this.mode === 'survival') { this.addItem(B.WOOL_WHITE, 2); this.checkMissions(); } } }));
    if (hit) this.attackCooldown = 0.35;
    return !!hit;
  }
  attackShadow() { return this.attackMob(); }

  mobCtx() {
    return {
      player: this.player, daylight: this.sky.daylight, enabled: this.mode === 'survival' && !this.dead, nights: this.stats.nights,
      onHitPlayer: (dmg, dir) => { this.damage(dmg, 'Una Sombra te atrapó en la oscuridad'); this.player.vel.x += dir.x * 7; this.player.vel.z += dir.z * 7; this.player.vel.y = 4; },
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
    if (this.mode === 'survival') { this.addItem(t.block.drop); this.checkMissions(); }
  }

  placeBlock() {
    const slot = this.hotbar[this.selected];
    if (!slot?.id || isItem(slot.id)) return;   // herramientas y materiales no se colocan
    const t = this.target();
    if (!t) return;
    const x = t.x + t.face[0]; const y = t.y + t.face[1]; const z = t.z + t.face[2];
    const cur = this.world.getBlock(x, y, z);
    if (cur !== B.AIR && cur !== B.WATER) return;
    if (BLOCKS[slot.id].solid && this.player.intersectsBlock(x, y, z)) return;
    if (y < 0 || y >= H) return;
    this.world.setBlock(x, y, z, slot.id);
    this.sound.place(BLOCKS[slot.id].sound);
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
    this.ui.renderHotbar(this.hotbar, this.selected);
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
  damage(n, reason) {
    if (this.mode !== 'survival' || n <= 0 || this.dead) return;
    this.health = Math.max(0, this.health - n);
    this.sound.hurt();
    this.ui.renderHearts(this.health, this.maxHealth);
    document.querySelector('#hurt').classList.remove('flash'); void document.querySelector('#hurt').offsetWidth; document.querySelector('#hurt').classList.add('flash');
    if (this.health <= 0) this.die(reason);
  }

  die(reason) {
    this.dead = true;
    if (document.pointerLockElement) document.exitPointerLock();
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
      stats: this.stats, maxHealth: this.maxHealth, faros: this.faros,
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
      const ev = this.player.update(dt);
      if (ev.step) this.sound.step(BLOCKS[ev.step]?.sound);
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
      // Cada amanecer cuenta como una noche sobrevivida.
      if (this.prevTime !== undefined && this.prevTime > 0.9 && this.sky.time < 0.1 && this.mode === 'survival') {
        this.stats.nights += 1;
        this.ui.toast(`Amaneció · Día ${this.stats.nights + 1}`, 3000);
        this.checkMissions();
      }
      this.prevTime = this.sky.time;
      this.ui.renderStamina(this.player.stamina, this.mode === 'survival');
      document.querySelector('#glide-tag').style.display = this.player.gliding ? 'block' : 'none';
    }
    this.updateParticles(dt);
    this.minimap.update(dt, this.mapCtx(), this.mapOpen);
    // Música: más grave bajo tierra (techo opaco muy por encima y lejos del cielo).
    const ppx = Math.floor(this.player.pos.x); const ppz = Math.floor(this.player.pos.z);
    this.sound.updateMusic(this.paused ? 0 : dt, { night: this.sky.daylight < 0.4, underground: this.player.pos.y < this.world.topAt(ppx, ppz) - 4 && this.player.pos.y < 30 });

    // Cámara
    const eye = this.player.eye();
    this.camera.position.copy(eye);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');

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

    // FPS y depuración
    this.fpsFrames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsFrames = 0; this.fpsTime = 0; this.updateHud(); }
    if (performance.now() - this.lastSave > 30000 && !this.paused) this.save();
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
