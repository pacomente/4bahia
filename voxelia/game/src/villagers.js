import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { I } from './items.js';
import { villagesNear, villagePlan, houseBlueprint, chimneyTop, STYLES, REGION } from './villages.js';
import { createHumanoid, animateHumanoid, lightHumanoid, makeProp } from './humanoid.js';
import { standY, stepToward, settle, turnTo } from './walk.js';
import { hash3 } from './world.js';

// ───────── Aldeanos ─────────
// Cada aldeano tiene nombre, oficio y personalidad. De día pasean, charlan y trabajan;
// al atardecer (o si ven zombis) se esconden en sus casas; los guardias patrullan de noche.
// Cada mañana puede nacer alguien si hay lugar, y cuando la aldea se llena el constructor
// levanta una casa nueva bloque por bloque.

export const PROFESSIONS = {
  builder: { name: 'Constructor', fem: 'Constructora', prop: 'hammer', apron: '#7a5230' },
  guard: { name: 'Guardia', fem: 'Guardia', prop: 'spear', hat: 'helmet', cape: '#8f2b26' },
  farmer: { name: 'Granjero', fem: 'Granjera', prop: 'basket', hat: 'cap', hatColor: '#d8b45a' },
  smith: { name: 'Herrero', fem: 'Herrera', prop: 'hammer', apron: '#2f2f33' },
  merchant: { name: 'Mercader', fem: 'Mercadera', prop: null, cape: '#3c2f7a' },
};

// Personalidades: cambian cuándo se esconden, cuánto hablan, a qué velocidad trabajan y qué dicen.
export const TRAITS = {
  brave: { name: 'Valiente', homeAt: 0.22, chat: 0.5, work: 1, speed: 1.05, wave: 0.5 },
  shy: { name: 'Tímido', fem: 'Tímida', homeAt: 0.55, chat: 0.15, work: 1, speed: 1, wave: 0.1 },
  chatty: { name: 'Charlatán', fem: 'Charlatana', homeAt: 0.4, chat: 0.95, work: 0.85, speed: 1, wave: 1 },
  grumpy: { name: 'Gruñón', fem: 'Gruñona', homeAt: 0.4, chat: 0.3, work: 1.1, speed: 0.9, wave: 0 },
  cheerful: { name: 'Alegre', homeAt: 0.4, chat: 0.7, work: 1, speed: 1.1, wave: 0.9 },
  hardworking: { name: 'Trabajador', fem: 'Trabajadora', homeAt: 0.38, chat: 0.3, work: 1.7, speed: 1.05, wave: 0.3 },
};

const LINES = {
  greet: {
    brave: ['¡Buenas, viajero!', 'Si ves zombis, avisame.', 'Acá estamos seguros.'],
    shy: ['Ho… hola.', '…', 'Perdón, no te vi.'],
    chatty: ['¡Hola! ¿Viste el pozo? ¡Lo hicimos nosotros!', '¡Qué lindo día para charlar!', '¿Sabías que las Sombras odian la luz?', '¡Contame todo! ¿De dónde venís?'],
    grumpy: ['Hmpf.', 'No pises el camino.', '¿Y vos qué mirás?', 'Mucho ruido…'],
    cheerful: ['¡Hola hola!', '¡Bienvenido a la aldea!', '¡Qué alegría verte!'],
    hardworking: ['Hay mucho que hacer.', 'Buen día. Sigo con lo mío.', 'El trabajo no espera.'],
  },
  night: ['¡A casa, que ya oscurece!', 'Buenas noches…', 'Cerrá bien la puerta.'],
  zombie: ['¡Zombis! ¡A las casas!', '¡Socorro!', '¡Corran!'],
  build: ['¡Una casa nueva!', 'Un bloque más…', '¡Esto va a quedar hermoso!'],
  baby: ['¡Nació alguien en la aldea!', '¡Bienvenida, pequeña!'],
  hurt: ['¡Ey! ¡Eso duele!', '¡¿Qué te pasa?!', '¡Guardias!'],
  guard: ['Yo vigilo. Dormí tranquilo.', 'Ningún zombi pasa por acá.', 'Atento a la noche.'],
  talk: ['¿Viste lo que construyeron?', 'Dicen que en las cuevas brillan cristales.', 'Mañana llueve, seguro.', 'Necesitamos más casas.', '¡Ja, ja!', '¿Y tu familia?', 'El herrero arregla herramientas.'],
};

const NAMES = {
  medieval: { m: ['Tomás', 'Rodrigo', 'Gonzalo', 'Ramiro', 'Mateo', 'Bruno', 'Álvaro', 'Fermín', 'Sancho', 'Lope'], f: ['Elena', 'Inés', 'Jimena', 'Beatriz', 'Clara', 'Urraca', 'Leonor', 'Teresa', 'Elvira', 'Mencía'] },
  rustic: { m: ['Bosco', 'Leandro', 'Ciro', 'Fausto', 'Nilo', 'Silvano'], f: ['Flora', 'Hiedra', 'Olivia', 'Rocío', 'Selva', 'Vera'] },
  desert: { m: ['Samir', 'Karim', 'Omar', 'Tarik', 'Yusuf', 'Hakim'], f: ['Yasmina', 'Leila', 'Nadia', 'Zaida', 'Amira', 'Salma'] },
  snow: { m: ['Ivar', 'Erik', 'Nils', 'Bjorn', 'Arvid', 'Leif'], f: ['Sigrid', 'Astrid', 'Freya', 'Ingrid', 'Solveig', 'Liv'] },
};

const LOOKS = {
  medieval: { shirts: ['#6b4a2b', '#4f6b3a', '#7a2f2a', '#5a5a7a', '#8a6d3b'], pants: ['#3b3024', '#3a3a3a', '#4a3a2a'], hat: 'hood', hatColors: ['#5b3d22', '#3f5a2c', '#6a2d2a'] },
  rustic: { shirts: ['#3f6b2c', '#6b4a2b', '#5a7a3a', '#7a5a3a'], pants: ['#4a3a2a', '#3b3024'], hat: 'cap', hatColors: ['#3f5a2c', '#7a5230'] },
  desert: { shirts: ['#e8dcc0', '#d9b48a', '#f2efe6', '#c9774a'], pants: ['#bfa27a', '#e8dcc0'], hat: 'wrap', hatColors: ['#f2efe6', '#c9774a', '#3c6ba8'] },
  snow: { shirts: ['#5a6f8a', '#7a7f88', '#8a4a3a', '#3f5a7a'], pants: ['#3a3a44', '#4a4038'], hat: 'fur', hatColors: ['#d8cfc0', '#8a6d4b', '#efefef'] },
};
const SKINS = ['#f0c8a0', '#d9a77c', '#b8835a', '#8d5a3b', '#f5d6b8'];
const HAIRS = ['#2b1d12', '#5b3d22', '#a8743a', '#d8c08a', '#1a1a1a', '#8a8a8a'];

// Trueques por oficio. `repair`: deja como nueva la herramienta que tengas en la mano.
export const TRADES = {
  builder: [{ give: { [B.COBBLE]: 10 }, get: { [B.ROOF]: 8 } }, { give: { [B.PLANKS]: 6 }, get: { [B.THATCH]: 8 } }, { give: { [B.SAND]: 8 }, get: { [B.ADOBE]: 8 } }],
  guard: [{ give: { [I.IRON]: 2 }, get: { [I.ARROW]: 16 } }, { give: { [I.ESSENCE]: 3 }, get: { [I.SHIELD]: 1 } }, { give: { [I.ESSENCE]: 2, [B.PLANKS]: 3 }, get: { [I.BOW]: 1 } }],
  farmer: [{ give: { [B.WOOL_WHITE]: 4 }, get: { [B.WOOL_RED]: 2, [B.WOOL_BLUE]: 2 } }, { give: { [B.DIRT]: 16 }, get: { [I.COAL]: 2 } }, { give: { [B.LOG]: 4 }, get: { [B.TORCH]: 8 } }],
  smith: [{ give: { [I.IRON]: 1 }, get: {}, repair: true }, { give: { [I.COAL]: 4, [I.IRON]: 2 }, get: { [I.SHIELD]: 1 } }, { give: { [B.COBBLE]: 20 }, get: { [I.IRON]: 2 } }],
  merchant: [{ give: { [I.ESSENCE]: 3 }, get: { [I.CRYSTAL]: 4 } }, { give: { [B.SAND]: 8 }, get: { [B.GLASS]: 6 } }, { give: { [I.CRYSTAL]: 2 }, get: { [B.LAMP]: 4 } }],
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// ───────── Lógica pura de la aldea (sin gráficos: se puede probar) ─────────
export const allHouses = (plan, rec) => [...plan.houses, ...rec.built.map((i) => plan.slots[i])];
export const capacity = (plan, rec) => allHouses(plan, rec).length * 2;
export const isChild = (v) => v.age < 2;

export function newVillager(plan, rec, r, { child = false, prof = null } = {}) {
  const female = r() < 0.5;
  const traitIds = Object.keys(TRAITS);
  const used = new Set(rec.villagers.map((v) => v.name));
  let name = pick(r, NAMES[plan.style][female ? 'f' : 'm']);
  for (let k = 0; k < 6 && used.has(name); k++) name = pick(r, NAMES[plan.style][female ? 'f' : 'm']);
  const homes = allHouses(plan, rec);
  const count = (i) => rec.villagers.filter((v) => v.home === i).length;
  let home = 0; for (let i = 0; i < homes.length; i++) if (count(i) < count(home)) home = i;
  const look = LOOKS[plan.style];
  return {
    id: rec.nextId++, name, female, prof: child ? null : prof ?? 'farmer', trait: pick(r, traitIds), age: child ? 0 : 2 + Math.floor(r() * 12), home,
    look: { skin: pick(r, SKINS), hair: pick(r, HAIRS), shirt: pick(r, look.shirts), pants: pick(r, look.pants), hatColor: pick(r, look.hatColors), beard: !female && r() < 0.35 ? pick(r, HAIRS) : null, hood: r() < 0.6 },
  };
}

// Oficio que más le falta a la aldea (primero constructor y guardia).
export function neededProfession(plan, rec) {
  const has = (p) => rec.villagers.some((v) => v.prof === p);
  if (!has('builder')) return 'builder';
  if (!has('guard')) return 'guard';
  if (!has('smith') && plan.style !== 'desert') return 'smith';
  if (!has('merchant') && plan.style === 'desert') return 'merchant';
  const n = rec.villagers.filter((v) => v.prof === 'guard').length;
  if (n < 2 && rec.villagers.length >= 7) return 'guard';
  return plan.style === 'desert' && Math.random() < 0.3 ? 'merchant' : 'farmer';
}

// Registro inicial de una aldea (población y oficios), determinista por semilla.
export function initialRecord(world, plan) {
  const r = rng(Math.floor(hash3(world.seed, plan.rx, 4242, plan.rz) * 4294967296));
  const rec = { id: plan.id, villagers: [], built: [], build: null, rep: 0, nextId: 1, born: 0 };
  const n = Math.min(10, plan.houses.length * 2 - 1);
  for (let k = 0; k < n; k++) rec.villagers.push(newVillager(plan, rec, r, { child: k === n - 1 && n > 4, prof: neededProfession(plan, rec) }));
  return rec;
}

// Un nuevo día en la aldea: crecen los niños, puede nacer alguien y se decide si hace falta construir.
// Devuelve los eventos para mostrar al jugador.
export function villageDawn(plan, rec, r = Math.random) {
  const events = [];
  for (const v of rec.villagers) {
    v.age += 1;
    if (v.age === 2) { v.prof = neededProfession(plan, rec); events.push({ type: 'grown', name: v.name }); }
  }
  const adults = rec.villagers.filter((v) => !isChild(v)).length;
  if (adults >= 2 && rec.villagers.length < capacity(plan, rec) && r() < 0.75) {
    const baby = newVillager(plan, rec, r, { child: true });
    rec.villagers.push(baby); rec.born += 1;
    events.push({ type: 'born', name: baby.name, female: baby.female });
  }
  planBuild(plan, rec);
  return events;
}

// Si la aldea está llena (o casi) y queda lugar, empieza una casa nueva.
export function planBuild(plan, rec) {
  if (rec.build) return rec.build;
  const free = plan.slots.findIndex((_, i) => !rec.built.includes(i));
  if (free < 0 || !rec.villagers.some((v) => v.prof === 'builder')) return null;
  if (rec.villagers.length >= capacity(plan, rec) - 1) rec.build = { slot: free, step: 0 };
  return rec.build;
}

// Avanza la obra: coloca el siguiente bloque que no esté ya puesto. Devuelve el bloque colocado,
// 'done' al terminar, o null si no hizo nada (por ejemplo, el jugador está parado ahí).
export function buildStep(world, plan, rec, canPlace = () => true) {
  if (!rec.build) return null;
  const h = plan.slots[rec.build.slot];
  const cache = plan._bp ?? (plan._bp = {});
  const bp = cache[rec.build.slot] ?? (cache[rec.build.slot] = houseBlueprint(world, plan, h));
  let skipped = 0;
  while (rec.build.step < bp.length && skipped < 400) {
    const b = bp[rec.build.step];
    if (world.getBlock(b.x, b.y, b.z) === b.id) { rec.build.step++; skipped++; continue; }
    if (!world.getChunk(Math.floor(b.x / 16), Math.floor(b.z / 16)) || !canPlace(b)) return null;
    world.setBlock(b.x, b.y, b.z, b.id);
    rec.build.step++;
    return b;
  }
  if (rec.build.step >= bp.length) { rec.built.push(rec.build.slot); rec.build = null; return 'done'; }
  return null;
}

// ───────── Gráficos y comportamiento ─────────
function bubbleSprite(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = 'bold 26px Trebuchet MS, sans-serif';
  const w = Math.min(560, Math.ceil(g.measureText(text).width) + 28);
  c.width = w; c.height = 50;
  g.font = 'bold 26px Trebuchet MS, sans-serif';
  g.fillStyle = 'rgba(0,0,0,0.65)'; g.beginPath(); g.roundRect(0, 0, w, 42, 10); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 8, 42); g.lineTo(w / 2, 50); g.lineTo(w / 2 + 8, 42); g.fill();
  g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(text, 14, 22, w - 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(w / 100, 0.5, 1);
  return s;
}

export class Villages {
  constructor(scene, world, sound, saved = {}) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.records = new Map(Object.entries(saved ?? {}));
    this.active = new Map();       // id → { plan, rec, list: [aldeanos en escena] }
    this.t = 0;
    this.smoke = [];
    this.scanTimer = 0;
  }

  record(plan) {
    if (!this.records.has(plan.id)) this.records.set(plan.id, initialRecord(this.world, plan));
    return this.records.get(plan.id);
  }

  serialize() {
    for (const a of this.active.values()) for (const e of a.list) Object.assign(e.data, { x: e.pos.x, y: e.pos.y, z: e.pos.z });
    return Object.fromEntries(this.records);
  }

  // ───── Entrar y salir del alcance ─────
  scan(player) {
    const near = villagesNear(this.world, player.pos.x, player.pos.z, 70);
    for (const plan of near) {
      if (this.active.has(plan.id)) continue;
      if (!this.world.getChunk(Math.floor(plan.x / 16), Math.floor(plan.z / 16))) continue;
      const rec = this.record(plan);
      planBuild(plan, rec);
      const a = { plan, rec, list: [], smokeT: 0 };
      this.active.set(plan.id, a);
      for (const v of rec.villagers) this.spawn(a, v);
    }
    for (const [id, a] of this.active) {
      if (Math.hypot(a.plan.x - player.pos.x, a.plan.z - player.pos.z) > a.plan.radius + 110) this.deactivate(id);
    }
  }

  deactivate(id) {
    const a = this.active.get(id);
    for (const e of a.list) { Object.assign(e.data, { x: e.pos.x, y: e.pos.y, z: e.pos.z }); this.removeMesh(e); }
    this.active.delete(id);
  }

  spawn(a, v) {
    const { plan, rec } = a;
    const homes = allHouses(plan, rec);
    const home = homes[v.home] ?? homes[0];
    const child = isChild(v);
    const prof = PROFESSIONS[v.prof] ?? {};
    const look = LOOKS[plan.style];
    const parts = createHumanoid({
      skin: v.look.skin, shirt: v.look.shirt, pants: v.look.pants, hair: v.look.hair, beard: v.look.beard,
      hat: prof.hat ?? (v.look.hood && !child ? look.hat : null), hatColor: prof.hatColor ?? v.look.hatColor,
      apron: prof.apron, cape: prof.cape, scale: child ? 0.62 : 1,
    });
    const r = Math.random;
    let pos;
    const nightNow = (this.lastDaylight ?? 1) < 0.4;
    if (Number.isFinite(v.x)) pos = new THREE.Vector3(v.x, v.y, v.z);
    else if (nightNow && v.prof !== 'guard') pos = new THREE.Vector3(home.inside.x, home.y + 1, home.inside.z);   // de noche ya están en casa
    else { const ang = r() * Math.PI * 2; const rad = 3.6 + r() * 2.4; pos = new THREE.Vector3(plan.x + 0.5 + Math.cos(ang) * rad, plan.y + 1, plan.z + 0.5 + Math.sin(ang) * rad); }   // alrededor del pozo, no arriba
    const fy = standY(this.world, pos.x, pos.y, pos.z, 1, 8);
    if (fy !== null) pos.y = fy;
    const e = {
      data: v, a, home, parts, pos, heading: r() * Math.PI * 2, vy: 0, stuck: 0, side: 1,
      state: 'idle', timer: r() * 3, target: null, path: [], action: 'idle', phase: r() * 6, walk: 0,
      lookYaw: 0, hp: 10, flash: 0, bubble: null, bubbleT: 0, greetT: 0, talkWith: null, hidden: false, child,
      trait: TRAITS[v.trait] ?? TRAITS.cheerful,
    };
    if (prof.prop && !child) { e.prop = makeProp(prof.prop); parts.tool.add(e.prop); }
    parts.root.position.copy(pos);
    this.scene.add(parts.root);
    a.list.push(e);
    return e;
  }

  removeMesh(e) {
    this.scene.remove(e.parts.root);
    e.parts.root.traverse((o) => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    if (e.bubble) this.scene.remove(e.bubble);
  }

  say(e, text, secs = 3) {
    if (e.bubble) { this.scene.remove(e.bubble); e.bubble.material.map.dispose(); e.bubble.material.dispose(); }
    e.bubble = bubbleSprite(text); e.bubbleT = secs;
    this.scene.add(e.bubble);
  }

  // Lista de aldeanos visibles en la escena (para zombis, flechas y diálogos).
  get entities() { const out = []; for (const a of this.active.values()) out.push(...a.list); return out; }

  // ───── Comportamiento ─────
  // ctx: { player, daylight, zombies (lista), lightAt(x,y,z), onBuilt(plan), onPlace(b), canPlace(b), onDeath(e), dt }
  update(dt, ctx) {
    this.t += dt;
    this.lastDaylight = ctx.daylight;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) { this.scanTimer = 1; this.scan(ctx.player); }
    for (const a of this.active.values()) {
      for (const e of [...a.list]) this.think(e, a, dt, ctx);
      this.updateSmoke(a, dt, ctx);
    }
    this.smoke = this.smoke.filter((s) => {
      s.life -= dt; s.mesh.position.y += dt * 0.9; s.mesh.position.x += dt * 0.3; s.mesh.scale.multiplyScalar(1 + dt * 0.35);
      s.mesh.material.opacity = Math.max(0, s.life / s.max) * 0.45;
      if (s.life <= 0) { this.scene.remove(s.mesh); s.mesh.material.dispose(); return false; }
      return true;
    });
  }

  // Humo de chimeneas (más al atardecer, cuando todos cocinan).
  updateSmoke(a, dt, ctx) {
    a.smokeT -= dt;
    if (a.smokeT > 0 || this.smoke.length > 60) return;
    a.smokeT = ctx.daylight < 0.6 ? 0.5 : 1.1;
    if (Math.hypot(a.plan.x - ctx.player.pos.x, a.plan.z - ctx.player.pos.z) > 90) return;
    const homes = allHouses(a.plan, a.rec);
    const h = homes[Math.floor(Math.random() * homes.length)];
    const top = chimneyTop(a.plan, h);
    if (!top || this.world.getBlock(Math.floor(top.x), Math.floor(top.y - 1.5), Math.floor(top.z)) !== B.COBBLE) return;
    const g = this.smokeGeo ?? (this.smokeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xb8b8b8, transparent: true, opacity: 0.45, depthWrite: false }));
    m.position.set(top.x + (Math.random() - 0.5) * 0.3, top.y, top.z + (Math.random() - 0.5) * 0.3);
    this.scene.add(m);
    this.smoke.push({ mesh: m, life: 4, max: 4 });
  }

  think(e, a, dt, ctx) {
    const { player } = ctx;
    const w = this.world;
    if (!w.getChunk(Math.floor(e.pos.x / 16), Math.floor(e.pos.z / 16))) return;
    const night = ctx.daylight < e.trait.homeAt;
    const prof = e.data.prof;
    const distPlayer = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    const zombie = (ctx.zombies ?? []).find((z) => !z.dead && Math.hypot(z.pos.x - e.pos.x, z.pos.z - e.pos.z) < (prof === 'guard' ? 14 : 9));
    e.timer -= dt; e.greetT -= dt; e.flash = Math.max(0, e.flash - dt);
    let speed = 1.5 * e.trait.speed * (e.child ? 1.35 : 1);
    let goal = null;
    e.action = 'idle';

    // 1. Peligro o noche: a casa (los guardias, en cambio, salen a pelear y patrullar).
    if (prof === 'guard' && !e.child) {
      if (zombie) { goal = { x: zombie.pos.x, z: zombie.pos.z, near: 1.2 }; speed = 3; e.state = 'fight'; }
      else if (night) {
        if (e.state !== 'patrol' || !e.target) { const posts = a.plan.posts; const p = posts[Math.floor(Math.random() * posts.length)]; e.target = { x: p.x + 1.5, z: p.z + 0.5 }; e.state = 'patrol'; }
        goal = e.target;
      }
      if (!night && !zombie && (e.state === 'patrol' || e.state === 'fight')) { e.state = 'idle'; e.target = null; }
      if (e.prop && e.propKind !== (night ? 'torch' : 'spear')) {   // de noche patrulla con antorcha
        e.parts.tool.remove(e.prop); e.prop = makeProp(night ? 'torch' : 'spear'); e.propKind = night ? 'torch' : 'spear'; e.parts.tool.add(e.prop);
      }
    } else if (night || zombie || e.scaredT > 0) {
      e.scaredT = Math.max(0, (e.scaredT ?? 0) - dt);
      if (e.state !== 'home' && e.state !== 'inside') {
        e.state = 'home'; e.path = [e.home.outside, e.home.doorCell, e.home.inside]; e.homeT = 0;
        if (zombie) this.say(e, pick(Math.random, LINES.zombie), 2.5);
        else if (Math.random() < e.trait.chat) this.say(e, pick(Math.random, LINES.night), 2.5);
      }
      if (zombie) speed = 3.3;
    } else if (e.state === 'home' || e.state === 'inside') {
      // Amaneció: salen de la casa.
      e.state = 'leave'; e.path = [e.home.doorCell, e.home.outside]; e.hidden = false;
    }

    // 2. Caminos por etapas (afuera → puerta → adentro).
    if (e.state === 'home' || e.state === 'leave') {
      const wp = e.path[0];
      if (!wp) { e.state = e.state === 'home' ? 'inside' : 'idle'; e.timer = 1; }
      else {
        goal = { x: wp.x, z: wp.z, near: 0.4 };
        e.homeT = (e.homeT ?? 0) + dt;
        // Si se traba mucho rato intentando entrar, "entra" igual (abrió la puerta).
        if (e.state === 'home' && (e.homeT > 18 || e.stuck > 6)) { e.pos.set(e.home.inside.x, e.home.y + 1, e.home.inside.z); e.path = []; }
      }
    }
    if (e.state === 'inside') { e.hidden = true; e.action = 'idle'; goal = null; }

    // 3. Día: trabajar, charlar, saludar o pasear.
    if (!goal && !['home', 'inside', 'leave', 'patrol', 'fight'].includes(e.state)) {
      if (prof === 'builder' && a.rec.build && !e.child) {
        const h = a.plan.slots[a.rec.build.slot];
        goal = { x: h.outside.x, z: h.outside.z, near: 2.5 };
        e.state = 'build';
      } else if (e.state === 'build') e.state = 'idle';
      if (e.state === 'talk' && e.talkWith) {
        e.action = 'talk';
        e.lookYaw = Math.atan2(e.talkWith.pos.x - e.pos.x, e.talkWith.pos.z - e.pos.z) - e.heading;
        if (e.timer <= 0) { e.state = 'idle'; e.timer = 2 + Math.random() * 3; e.talkWith = null; }
      } else if (e.state === 'wander' && e.target) goal = e.target;
      else if (e.state === 'work') { e.action = prof === 'farmer' ? 'farm' : 'build'; if (e.timer <= 0) { e.state = 'idle'; e.timer = 1 + Math.random() * 2; } }
      else if (e.state === 'cheer') { e.action = 'cheer'; if (e.timer <= 0) e.state = 'idle'; }
      else if (e.state === 'idle' && e.timer <= 0) this.chooseActivity(e, a);
    }

    // Saludo al jugador (según la personalidad).
    if (distPlayer < 5 && e.greetT <= 0 && !e.hidden && !night && !zombie) {
      e.greetT = 25 + Math.random() * 20;
      const lines = prof === 'guard' ? LINES.guard : LINES.greet[e.data.trait] ?? LINES.greet.cheerful;
      this.say(e, pick(Math.random, lines));
      if (Math.random() < e.trait.wave) { e.state = 'wave'; e.timer = 1.6; }
    }
    if (e.state === 'wave') { e.action = 'wave'; if (e.timer <= 0) e.state = 'idle'; }

    // 4. Moverse.
    let moving = false;
    if (goal) {
      const d = Math.hypot(goal.x - e.pos.x, goal.z - e.pos.z);
      if (d > (goal.near ?? 0.4)) { moving = stepToward(w, e, goal.x, goal.z, speed, dt).moved; }
      else {
        if (e.state === 'home' || e.state === 'leave') e.path.shift();
        else if (e.state === 'wander') { e.state = 'idle'; e.timer = 2 + Math.random() * 4; }
        else if (e.state === 'patrol') e.target = null;
      }
      if (e.stuck > 4 && e.state === 'wander') { e.state = 'idle'; e.timer = 1; }
    }
    settle(w, e, dt);

    // 5. Acciones en el lugar: construir, pelear.
    if (e.state === 'build' && !moving && a.rec.build) {
      e.action = 'build';
      e.buildT = (e.buildT ?? 0) - dt * e.trait.work * (a.rec.boost > 0 ? 2.2 : 1);
      if (e.buildT <= 0) {
        e.buildT = 0.45;
        const res = buildStep(w, a.plan, a.rec, ctx.canPlace);
        if (res === 'done') { this.say(e, '¡Casa terminada!', 3); ctx.onBuilt?.(a.plan, a.rec); for (const o of a.list) if (!o.hidden && Math.random() < 0.7) { o.state = 'cheer'; o.timer = 2.5; } planBuild(a.plan, a.rec); }
        else if (res) {
          ctx.onPlace?.(res);
          e.lookYaw = Math.atan2(res.x + 0.5 - e.pos.x, res.z + 0.5 - e.pos.z) - e.heading;
          if (Math.random() < 0.02) this.say(e, pick(Math.random, LINES.build), 2);
        }
      }
    }
    if (a.rec.boost > 0) a.rec.boost -= dt;
    if (e.state === 'fight' && zombie && Math.hypot(zombie.pos.x - e.pos.x, zombie.pos.z - e.pos.z) < 1.8) {
      e.action = 'attack';
      e.attackT = (e.attackT ?? 0) - dt;
      if (e.attackT <= 0) { e.attackT = 0.9; ctx.hitZombie?.(zombie, 3, e); }
      e.heading = Math.atan2(zombie.pos.x - e.pos.x, zombie.pos.z - e.pos.z);
    } else if (e.state === 'fight' && !zombie) e.state = 'idle';
    if (prof === 'guard' && night && !zombie && !moving) e.action = 'guard';

    // 6. Animación y luz.
    e.walk += ((moving ? 1 : 0) - e.walk) * Math.min(1, dt * 8);
    if (moving) e.phase += dt * speed * 4.2;
    if (moving) e.action = e.state === 'home' && zombie ? 'scared' : e.action === 'build' ? 'walk' : e.action;
    // Mira al jugador si está cerca (los tímidos no lo miran a los ojos).
    if (distPlayer < 6 && !moving && e.state !== 'talk' && e.state !== 'build') {
      const want = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z) - e.heading;
      const wrap = ((want + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      e.lookYaw += ((e.data.trait === 'shy' ? wrap * 0.3 : wrap) - e.lookYaw) * Math.min(1, dt * 5);
      if (Math.abs(wrap) > 1.3) e.heading = turnTo(e.heading, e.heading + wrap, dt, 2);
    } else if (e.state !== 'talk' && e.state !== 'build') e.lookYaw *= Math.max(0, 1 - dt * 3);
    const root = e.parts.root;
    root.position.copy(e.pos);
    root.rotation.y = turnTo(root.rotation.y, e.heading, dt, 10);
    animateHumanoid(e.parts, { t: this.t + e.phase, phase: e.phase, walk: e.walk, action: e.hidden ? 'idle' : e.action, lookYaw: e.lookYaw, lookPitch: e.hidden ? 0.25 : 0 });
    const light = ctx.lightAt(e.pos.x, e.pos.y + 1.5, e.pos.z);
    lightHumanoid(e.parts, light, e.flash);
    if (e.prop?.userData.flame) e.prop.userData.flame.scale.setScalar(0.85 + Math.sin(this.t * 20 + e.phase) * 0.15);
    // Globo de diálogo sobre la cabeza.
    if (e.bubble) {
      e.bubbleT -= dt;
      e.bubble.position.set(e.pos.x, e.pos.y + (e.child ? 1.6 : 2.35), e.pos.z);
      e.bubble.material.opacity = Math.min(1, e.bubbleT * 2);
      if (e.bubbleT <= 0) { this.scene.remove(e.bubble); e.bubble.material.map.dispose(); e.bubble.material.dispose(); e.bubble = null; }
    }
  }

  chooseActivity(e, a) {
    const r = Math.random();
    const others = a.list.filter((o) => o !== e && !o.hidden && o.state === 'idle' && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 9);
    if (others.length && r < e.trait.chat * 0.6) {
      const o = others[0];
      e.state = 'talk'; o.state = 'talk'; e.talkWith = o; o.talkWith = e; e.timer = o.timer = 4 + Math.random() * 3;
      this.say(e, pick(Math.random, LINES.talk), 3);
      setTimeout(() => { if (o.state === 'talk') this.say(o, pick(Math.random, LINES.talk), 2.5); }, 1600);
      return;
    }
    if (!e.child && ['farmer', 'smith'].includes(e.data.prof) && r < 0.6) { e.state = 'work'; e.timer = 4 + Math.random() * 5; return; }
    // Pasear: cerca de la plaza o de su casa (los chicos corren más lejos).
    const center = Math.random() < 0.5 ? { x: a.plan.x, z: a.plan.z } : e.home.outside;
    const rad = e.child ? 12 : 7;
    e.target = { x: center.x + (Math.random() - 0.5) * rad * 2, z: center.z + (Math.random() - 0.5) * rad * 2, near: 0.6 };
    e.state = 'wander';
  }

  // Aldeano que está en la línea de mira (para hablarle o si le pegan).
  hitTest(origin, dir, range = 4) {
    let best = null; let bestT = range;
    for (const e of this.entities) {
      const c = new THREE.Vector3(e.pos.x, e.pos.y + (e.child ? 0.6 : 1.1), e.pos.z);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < (e.child ? 0.45 : 0.6)) { best = e; bestT = t; }
    }
    return best;
  }

  // El jugador le pegó a un aldeano: se enoja y huye a su casa (no se lo puede matar).
  annoy(e) {
    e.flash = 0.25; e.scaredT = 6; e.a.rec.rep -= 3;
    this.say(e, pick(Math.random, LINES.hurt), 2.5);
    this.sound.tone(330, 0.12, 0.12, 'triangle');
  }

  // Un zombi lo lastimó. Devuelve true si murió.
  hurt(e, dmg) {
    e.hp -= dmg; e.flash = 0.25; e.scaredT = 8;
    this.sound.tone(280, 0.15, 0.12, 'sawtooth');
    if (e.hp > 0) { if (Math.random() < 0.5) this.say(e, '¡Ay! ¡Ayuda!', 2); return false; }
    const a = e.a;
    a.rec.villagers = a.rec.villagers.filter((v) => v !== e.data);
    a.list = a.list.filter((x) => x !== e);
    this.removeMesh(e);
    planBuild(a.plan, a.rec);
    return true;
  }

  // Un nuevo día para todas las aldeas conocidas. Los aldeanos nuevos aparecen si la aldea está cerca.
  dawn() {
    const out = [];
    for (const [id, rec] of this.records) {
      const [rx, rz] = id.slice(1).split('_').map(Number);
      const plan = villagePlan(this.world, rx, rz);
      if (!plan) continue;
      const events = villageDawn(plan, rec);
      const a = this.active.get(id);
      for (const ev of events) {
        out.push({ ...ev, village: plan.name, pop: rec.villagers.length, near: !!a });
        if (a && ev.type === 'born') { const v = rec.villagers[rec.villagers.length - 1]; const e = this.spawn(a, v); e.state = 'cheer'; e.timer = 3; this.say(e, '¡Hola mundo!', 3); }
        if (a && ev.type === 'grown') {
          // Al crecer cambia de tamaño y recibe su herramienta de oficio.
          const e = a.list.find((x) => x.data.name === ev.name && x.child);
          if (e) { a.list = a.list.filter((x) => x !== e); this.removeMesh(e); delete e.data.x; const n = this.spawn(a, e.data); n.pos.copy(e.pos); }
        }
      }
    }
    return out;
  }

  // Datos para la ventana de diálogo.
  info(e) {
    const { plan, rec } = e.a;
    const v = e.data;
    const prof = PROFESSIONS[v.prof];
    const trait = TRAITS[v.trait];
    const homes = allHouses(plan, rec).length;
    let line;
    if (isChild(v)) line = pick(Math.random, ['¡Jugamos a las escondidas?', '¡Cuando sea grande voy a ser constructora!', '¿Me mostrás tu espada?', '¡Ji, ji!']);
    else if (rec.rep < -5) line = 'No queremos problemas con vos. Andate.';
    else if (v.prof === 'builder' && rec.build) line = `Estoy levantando una casa nueva. Si me traés tablas o adoquines, termino más rápido.`;
    else if (v.prof === 'builder' && rec.villagers.length >= capacity(plan, rec)) line = 'No queda lugar para nadie más: no hay más terreno para construir.';
    else if (v.prof === 'smith') line = 'Si tu herramienta está gastada, con un lingote de hierro te la dejo como nueva.';
    else if (v.prof === 'guard') line = pick(Math.random, LINES.guard);
    else line = pick(Math.random, LINES.greet[v.trait] ?? LINES.greet.cheerful);
    const mood = rec.rep >= 8 ? 'Te adoran' : rec.rep >= 3 ? 'Te aprecian' : rec.rep <= -5 ? 'Desconfían de vos' : 'Te conocen poco';
    return {
      name: v.name, child: isChild(v), profession: isChild(v) ? (v.female ? 'Niña' : 'Niño') : prof ? (v.female ? prof.fem : prof.name) : 'Aldeano',
      trait: trait ? (v.female && trait.fem ? trait.fem : trait.name) : '', line, village: plan.name, style: STYLES[plan.style].label,
      pop: rec.villagers.length, cap: capacity(plan, rec), homes, building: !!rec.build, mood, rep: rec.rep,
      trades: isChild(v) || rec.rep < -5 ? [] : TRADES[v.prof] ?? [], look: v.look, canDonate: v.prof === 'builder' && !!rec.build,
    };
  }

  // Donar materiales al constructor: acelera la obra y mejora la reputación.
  donate(e, inventory) {
    const want = [B.PLANKS, B.COBBLE, B.LOG];
    let given = 0;
    for (const id of want) { const n = Math.min(inventory[id] ?? 0, 16 - given); if (n > 0) { inventory[id] -= n; if (!inventory[id]) delete inventory[id]; given += n; } }
    if (!given) return 0;
    e.a.rec.boost = (e.a.rec.boost ?? 0) + given * 6;
    e.a.rec.rep += given >= 8 ? 2 : 1;
    this.say(e, '¡Gracias! ¡Con esto vuela la obra!', 3);
    e.state = 'cheer'; e.timer = 2;
    return given;
  }

  // Aldea en la que está parado el jugador (para el cartel de bienvenida y el mapa).
  villageAt(x, z) { return villagesNear(this.world, x, z, 0)[0] ?? null; }
  // Aldeas en un radio (para el mapa), con su población si ya se conocen.
  mapMarkers(x, z, radius) {
    const out = [];
    for (let rx = Math.floor((x - radius) / REGION); rx <= Math.floor((x + radius) / REGION); rx++) {
      for (let rz = Math.floor((z - radius) / REGION); rz <= Math.floor((z + radius) / REGION); rz++) {
        const p = villagePlan(this.world, rx, rz);
        if (p) out.push({ x: p.x, z: p.z, name: p.name, pop: this.records.get(p.id)?.villagers.length });
      }
    }
    return out;
  }
}
