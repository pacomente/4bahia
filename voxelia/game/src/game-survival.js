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
import { I, ITEMS, isItem, mineSpeed, attackDamage, maxUses, armorPoints, armorReduction, isFood, ARMOR_SLOTS, COOKS, MAX_UPGRADE, upgradeCost } from './items.js';
import { GROW, RIPE, PLANT, CROP_BLOCKS, harvest } from './crops.js';
import { rankFor } from './economy.js';
import { craft, craftableTimes } from './recipes.js';
import { Hand } from './hand.js';
import { emptyStats, missionStatus } from './missions.js';
import { Shadows, nearLight } from './mobs.js';
import { Animals } from './animals.js';
import { Sea } from './sea.js';
import { navFrame } from './pathfind.js';
import { Creatures, lairsNear } from './creatures.js';
import { dungeonsNear, dungeonBlocks, dungeonLoot } from './dungeons.js';
import { BOOKS, relation, isFestival } from './society.js';
import { TUTORIAL, ACHIEVEMENTS } from './progress.js';
import { settleFalling, fellTree, orphanLeaves, flowWater } from './physics.js';
import { PLAYER_LOOK } from './preview.js';
import { createHumanoid, animateHumanoid, lightHumanoid } from './humanoid.js';
import { wrecksNear, treasure } from './wrecks.js';
import { Caravans, tradeGoods, applyTrade, GOODS_NAME } from './caravans.js';
import { linksOf, routeOf } from './roads.js';
import { ruinsNear, ruinLoot, treasureSpot, buriedTreasure, RUIN_REGION, ruinPlan } from './ruins.js';
import { villagePlan } from './villages.js';
import { MiniMap } from './minimap.js';
import { Villages, newVillager } from './villagers.js';
import { villagesNear } from './villages.js';
import { Zombies } from './zombies.js';
import { Arrows } from './projectiles.js';
import { PlayerPreview } from './preview.js';
import { Bandits } from './bandits.js';
import { campsNear, lootTable, CAMP_REGION, campPlan } from './camps.js';

// Supervivencia y combate del jugador: hambre, cocina, pesca, física de bloques, mapas del tesoro,
// colmenas, golpe cargado, caballos, mascotas y animales.
// (Métodos del juego: se copian a Game.prototype en game.js.)
export class SurvivalMixin {
  // ───── Hambre ─────
  // La panza se vacía de a poco (más rápido corriendo o peleando). Llena: te curás rápido; con hambre
  // no te curás y vas más lento; vacía: perdés vida de a poco (hasta medio corazón).
  updateHunger(dt) {
    const p = this.player;
    const busy = (p.sprinting ? 3 : 1) + (this.attackCooldown > 0 ? 1.5 : 0) + (p.inWater ? 0.5 : 0);
    const hungerRate = { peaceful: 0.4, normal: 1, hard: 1.4 }[this.settings.difficulty ?? 'normal'] ?? 1;
    this.food = Math.max(0, this.food - dt * 0.018 * busy * hungerRate);
    this.regen = (this.regen ?? 0) + dt;
    const every = this.food >= 18 ? 3 : this.food >= 6 ? 7 : Infinity;
    if (this.regen > every && this.health < this.maxHealth && this.health > 0) { this.regen = 0; this.health += 1; this.food = Math.max(0, this.food - 0.4); this.ui.renderHearts(this.health, this.maxHealth); }
    if (this.food <= 0) {
      this.starveT = (this.starveT ?? 0) + dt;
      if (this.starveT > 8) { this.starveT = 0; if (this.health > 1) this.damage(1, 'Te moriste de hambre'); if (!this.hungerWarned) { this.ui.toast('¡Tenés mucha hambre! Comé algo.', 2500); this.hungerWarned = true; } }
    } else this.hungerWarned = false;
    if (Math.floor(this.food) !== this.lastFoodShown) { this.lastFoodShown = Math.floor(this.food); this.ui.renderFood?.(this.food, true); }
  }

  // ───── Cocinar ─────
  // Con algo crudo en la mano, clic derecho sobre una fogata, un hogar o un horno: se cocina en unos segundos.
  startCooking(t, held) {
    if (this.cooking) return;
    this.cooking = { raw: held, out: COOKS[held], t: 0, x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5, oven: t.id === B.OVEN };
    this.ui.toast(`Cocinando ${ITEMS[held].name.toLowerCase()}…`, 1500);
    this.hand.swing();
  }
  updateCooking(dt) {
    const c = this.cooking; if (!c) return;
    c.t += dt;
    if (Math.random() < dt * 6) this.sound.noise(0.08, { freq: 3000 + Math.random() * 2000, q: 0.6, gain: 0.08, type: 'highpass' });   // chisporroteo
    if (Math.random() < dt * 4) this.spawnPuff?.(c.x, c.y + 0.3, c.z);
    if (c.t < (c.oven ? 1.6 : 2.6)) return;
    this.cooking = null;
    if (this.mode === 'survival') { if (!(this.inventory[c.raw] > 0)) return; this.inventory[c.raw] -= 1; if (this.inventory[c.raw] <= 0) delete this.inventory[c.raw]; }
    this.addItem(c.out); this.syncHotbar();
    this.sound.tone(660, 0.08, 0.08, 'triangle');
    this.ui.toast(`¡Listo! ${ITEMS[c.out].name}`, 1500);
    this.stats.cooked = (this.stats.cooked ?? 0) + 1; this.checkMissions();
  }

  // ───── Pesca ─────
  // Clic derecho con la caña: tira el corcho al agua. Cuando pica (se hunde y salpica), clic derecho para sacar.
  castOrReel() {
    if (this.bobber) { this.reel(); return true; }
    const eye = this.player.eye(); const dir = this.player.look();
    let hit = null;
    for (let t = 1; t < 14 && !hit; t += 0.25) {
      const q = eye.clone().addScaledVector(dir, t); const id = this.world.getBlock(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z));
      if (BLOCKS[id].water) hit = q; else if (BLOCKS[id].solid) break;
    }
    if (!hit) { this.ui.toast('Apuntá al agua para tirar la caña', 1400); return true; }
    let y = Math.floor(hit.y); while (BLOCKS[this.world.getBlock(Math.floor(hit.x), y + 1, Math.floor(hit.z))].water) y++;
    const mesh = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), new THREE.MeshBasicMaterial({ color: 0xd8352b }));
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })); white.position.y = 0.09;
    mesh.add(red, white); mesh.position.set(hit.x, y + 0.92, hit.z); this.scene.add(mesh);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye, mesh.position]), new THREE.LineBasicMaterial({ color: 0xe8e4d8 }));
    line.frustumCulled = false; this.scene.add(line);
    // Pica antes de noche, con lluvia y en mar abierto.
    const open = this.world.topAt(Math.floor(hit.x), Math.floor(hit.z)) < 24;
    const wait = (6 + Math.random() * 12) * (this.sky.daylight < 0.4 ? 0.7 : 1) * (this.sky.rain > 0.3 ? 0.75 : 1) * (open ? 0.85 : 1);
    this.bobber = { mesh, line, t: 0, biteAt: wait, biteT: 0, y: y + 0.92, open };
    this.sound.splash(); this.hand.swing();
    return true;
  }
  reel() {
    const b = this.bobber; this.bobber = null;
    this.scene.remove(b.mesh); this.scene.remove(b.line); b.line.geometry.dispose();
    this.hand.swing();
    if (b.biteT <= 0) { this.ui.toast('Nada… Esperá a que se hunda el corcho.', 1400); return; }
    // ¿Qué salió? Más peces raros de noche y en mar abierto.
    const night = this.sky.daylight < 0.4; const cold = this.world.biome(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z)) === 'snow';
    const table = [[I.RAW_FISH, 55], [I.SALMON, cold || b.open ? 30 : 12], [I.OLD_BOOT, 8], [I.PEARL, b.open ? 4 : 1], [I.GOLDEN_FISH, (night ? 4 : 1) + (b.open ? 3 : 0)]];
    let roll = Math.random() * table.reduce((n, [, w]) => n + w, 0); let got = table[0][0];
    for (const [id, w] of table) { roll -= w; if (roll <= 0) { got = id; break; } }
    this.addItem(got); this.syncHotbar(); this.useTool();
    this.sound.splash(); this.coinSound();
    this.ui.toast(got === I.GOLDEN_FISH ? '¡¡Un pez dorado!! Vale una fortuna en los puertos.' : got === I.OLD_BOOT ? 'Una bota vieja… mala suerte.' : `¡Sacaste: ${ITEMS[got].name}!`, 2200);
    this.stats.fished = (this.stats.fished ?? 0) + 1; this.checkMissions();
  }
  updateFishing(dt) {
    const b = this.bobber; if (!b) return;
    if (this.held() !== I.ROD || b.mesh.position.distanceTo(this.player.pos) > 24) { this.scene.remove(b.mesh); this.scene.remove(b.line); this.bobber = null; return; }
    b.t += dt;
    const pos = b.line.geometry.attributes.position; const eye = this.player.eye(); const dir = this.player.look();
    pos.setXYZ(0, eye.x + dir.x * 0.8 + Math.cos(this.player.yaw) * 0.3, eye.y + dir.y * 0.8 - 0.2, eye.z + dir.z * 0.8 - Math.sin(this.player.yaw) * 0.3);
    pos.setXYZ(1, b.mesh.position.x, b.mesh.position.y + 0.1, b.mesh.position.z); pos.needsUpdate = true;
    if (b.biteT > 0) {
      b.biteT -= dt; b.mesh.position.y = b.y - 0.35;
      if (b.biteT <= 0) { b.biteAt = b.t + 5 + Math.random() * 10; b.mesh.position.y = b.y; }   // se escapó
    } else {
      b.mesh.position.y = b.y + Math.sin(b.t * 2.5) * 0.04;
      if (b.t >= b.biteAt) { b.biteT = 1.1; this.sound.splash(); this.spawnPuff?.(b.mesh.position.x, b.y, b.mesh.position.z, 0xbfe0ff); }
    }
  }

  // ───── Física de bloques ─────
  blockPhysics(t) {
    const fell = fellTree(this.world, t.x, t.y, t.z, t.id);
    if (fell) {
      if (this.mode === 'survival') for (const [id, n] of Object.entries(fell.logs)) this.addItem(Number(id), n);
      this.sound.noise(0.25, { freq: 500, q: 2, gain: 0.4 }); setTimeout(() => this.sound.noise(0.6, { freq: 120, q: 0.6, gain: 0.5, type: 'lowpass' }), 450);
      this.ui.toast(`¡Árbol va! +${Object.values(fell.logs).reduce((a, n) => a + n, 0)} troncos`, 1500);
      for (let k = 0; k < 8; k++) this.spawnPuff(fell.top.x + 0.5, fell.top.y, fell.top.z + 0.5, 0x6fb043);
      this.leafDecay = [...(this.leafDecay ?? []), ...orphanLeaves(this.world, [fell.top, ...fell.removed.filter((_, i) => i % 3 === 0)])];
    }
    const moved = settleFalling(this.world, t.x, t.y + 1, t.z);
    if (moved.length) this.sound.noise(0.2, { freq: 1800, q: 0.5, gain: 0.25 });
    flowWater(this.world, t.x, t.y, t.z);
  }
  updateLeafDecay(dt) {
    if (!this.leafDecay?.length) return;
    this.leafT = (this.leafT ?? 0) - dt; if (this.leafT > 0) return; this.leafT = 0.08;
    for (let k = 0; k < 3 && this.leafDecay.length; k++) {
      const b = this.leafDecay.splice(Math.floor(Math.random() * this.leafDecay.length), 1)[0];
      const id = this.world.getBlock(b.x, b.y, b.z);
      if (![B.LEAVES, B.BIRCH_LEAVES, B.PINE_LEAVES, B.PALM_LEAVES, B.FRUIT_LEAVES, B.JUNGLE_LEAVES].includes(id)) continue;
      this.world.setBlock(b.x, b.y, b.z, B.AIR);
      if (Math.random() < 0.3) this.spawnPuff(b.x + 0.5, b.y + 0.5, b.z + 0.5, 0x4f8a2c);
      if (this.mode === 'survival' && Math.random() < (id === B.FRUIT_LEAVES ? 0.3 : 0.04)) this.addItem(I.APPLE);
    }
  }

  // ───── Mapas del tesoro ─────
  readMap() {
    const p = this.player.pos;
    let tr = this.treasures.find((x) => !x.found);
    if (!tr) {
      // Un mapa nuevo: el tesoro de la ruina más cercana (o de alguna de la zona).
      let best = null;
      for (let rx = Math.floor((p.x - 600) / RUIN_REGION); rx <= Math.floor((p.x + 600) / RUIN_REGION); rx++) for (let rz = Math.floor((p.z - 600) / RUIN_REGION); rz <= Math.floor((p.z + 600) / RUIN_REGION); rz++) {
        const r = ruinPlan(this.world, rx, rz); if (r && (!best || Math.hypot(r.x - p.x, r.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z))) best = r;
      }
      const spot = treasureSpot(this.world, best ?? { x: Math.round(p.x), z: Math.round(p.z), seed: Math.floor(p.x * 31 + p.z), name: 'un viejo explorador' });
      tr = { ...spot, found: false };
      this.treasures.push(tr);
      if (this.mode === 'survival') { this.inventory[I.TREASURE_MAP] -= 1; if (this.inventory[I.TREASURE_MAP] <= 0) delete this.inventory[I.TREASURE_MAP]; this.syncHotbar(); }
    }
    const dx = tr.x - p.x; const dz = tr.z - p.z; const d = Math.round(Math.hypot(dx, dz));
    const dirs = ['este', 'sudeste', 'sur', 'sudoeste', 'oeste', 'noroeste', 'norte', 'noreste'];
    const dir = dirs[(Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) + 8) % 8];
    this.ui.toast(d < 3 ? '¡La X está acá mismo! Cavá para abajo.' : `🗺 La X del mapa está a ${d} bloques hacia el ${dir}. Está marcada en el mapa (M).`, 4500);
    this.sound.noise(0.3, { freq: 2600, q: 0.6, gain: 0.15, type: 'highpass' });
  }

  // ───── Colmenas ─────
  harvestHive(t) {
    const k = `${t.x},${t.y},${t.z}`;
    if (this.playTime - (this.hives[k] ?? -9999) < 240) { this.ui.toast('La colmena todavía no tiene miel. Volvé más tarde.', 1800); return; }
    this.hives[k] = this.playTime;
    // Con humo cerca (una fogata abajo o al lado) las abejas se calman; si no, pican.
    let smoke = false;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -4; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) if (this.world.getBlock(t.x + dx, t.y + dy, t.z + dz) === B.CAMPFIRE) smoke = true;
    this.addItem(I.HONEY, 2); this.syncHotbar();
    this.sound.noise(0.6, { freq: 240, q: 4, gain: 0.25 });
    if (!smoke && this.mode === 'survival' && Math.random() < 0.6) { this.damage(2, 'Las abejas te picaron'); this.ui.toast('¡Auch! Las abejas pican. Con una fogata cerca se calman.', 2500); }
    else this.ui.toast('¡Miel! Las abejas están tranquilas.', 1800);
    this.hand.swing();
  }

  // ───── Golpe cargado ─────
  // Barrido fuerte: pega a todos los enemigos al frente (hasta 3,5 bloques), los empuja lejos
  // y rompe la guardia de los escuderos.
  updateCharge(dt) {
    if (this.charge === null || this.charge === undefined) return;
    if (!this.mouse.left || ITEMS[this.held()]?.tool !== 'sword') { this.charge = null; document.querySelector('#charge')?.classList.remove('on'); return; }
    this.charge = Math.min(1, this.charge + dt / 0.8);
    const el = document.querySelector('#charge');
    if (el) { el.classList.toggle('on', this.charge > 0.15); el.firstElementChild.style.width = `${this.charge * 100}%`; el.classList.toggle('full', this.charge >= 0.6); }
    this.breaking = null; this.ui.setBreakProgress(0);   // cargando no se rompen bloques
  }
  heavyAttack() {
    const eye = this.player.eye(); const look = this.player.look(); const fwd = new THREE.Vector3(look.x, 0, look.z).normalize();
    const dmg = attackDamage(this.held(), this.upgrades[this.held()] ?? 0) * 2.2;
    let hits = 0;
    const inFront = (pos) => { const d = new THREE.Vector3(pos.x - eye.x, 0, pos.z - eye.z); const len = d.length(); return len < 3.6 && len > 0.01 && d.normalize().dot(fwd) > 0.35; };
    const push = (pos) => { const d = new THREE.Vector3(pos.x - eye.x, 0, pos.z - eye.z).normalize(); return { x: d.x * 2.2, z: d.z * 2.2 }; };
    for (const z of [...this.zombies.list]) if (!z.dead && inFront(z.pos)) { this.zombies.damage(z, dmg, this.zombieCtx(), true, push(z.pos)); hits++; }
    for (const b of [...this.bandits.list]) if (!b.dead && inFront(b.pos)) { this.bandits.damage(b, dmg, this.banditCtx(), true, push(b.pos)); hits++; }
    for (const s of [...this.shadows.list]) if (inFront(s.pos ?? s.mesh?.position ?? eye)) { this.shadows.hit(eye, look, 4, dmg, this.mobCtx()); hits++; break; }
    if (this.creatures.hit(eye, look, 5, dmg, this.creatureCtx())) hits++;
    for (const a of [...this.animals.list]) if (!a.tamed && inFront(a.mesh.position) && a.species === 'wolf') { this.animals.hit(eye, new THREE.Vector3(a.mesh.position.x - eye.x, a.mesh.position.y + 0.5 - eye.y, a.mesh.position.z - eye.z).normalize(), 5, dmg, { onKilled: (_p, sp) => { if (this.mode === 'survival') this.animalDrops(sp); } }); hits++; }
    this.hand.swing(); this.shake = 0.15;
    this.sound.noise(0.3, { freq: 900, q: 0.7, gain: 0.4 });   // fiuuu
    if (hits) { this.sound.tone(180, 0.12, 0.2, 'square'); this.useTool(); this.stats.heavy = (this.stats.heavy ?? 0) + 1; }
    this.attackCooldown = 0.5;
  }
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
    if (species === 'deer') this.addItem(I.RAW_MEAT, 2 + Math.floor(Math.random() * 2));
    else if (species === 'rabbit') this.addItem(I.RAW_MEAT, 1);
    else if (species === 'crab') { this.addItem(I.RAW_MEAT, 1); if (Math.random() < 0.15) this.addItem(I.PEARL); }
    else if (species === 'horse') this.addItem(I.RAW_MEAT, 2);
    else if (species === 'chicken') { this.addItem(I.RAW_MEAT, 1); if (Math.random() < 0.5) this.addItem(B.WOOL_WHITE, 1); }
    else { this.addItem(B.WOOL_WHITE, 2); if (Math.random() < 0.5) this.addItem(I.RAW_MEAT, 1); }
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
}
