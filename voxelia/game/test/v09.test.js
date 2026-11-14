import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { B, BLOCKS } from '../src/blocks.js';
import { I, ITEMS } from '../src/items.js';
import { World, CS, SEA } from '../src/world.js';
import { villagePlan } from '../src/villages.js';
import { initialRecord } from '../src/villagers.js';
import { WRECK_REGION, wreckPlan, treasure } from '../src/wrecks.js';
import { localPrice, economySummary } from '../src/economy.js';
import { SPECIES } from '../src/animals.js';
import { Sea } from '../src/sea.js';
import { RECIPES } from '../src/recipes.js';

const gen = (w, x, z, r = 1) => { for (let cx = Math.floor(x / CS) - r; cx <= Math.floor(x / CS) + r; cx++) for (let cz = Math.floor(z / CS) - r; cz <= Math.floor(z / CS) + r; cz++) if (!w.getChunk(cx, cz)) w.generate(cx, cz); };

test('océanos: una buena parte del mapa es mar', () => {
  for (const seed of ['voxelia', 'mares', 'isla']) {
    const w = new World(seed); let sea = 0; let n = 0;
    for (let x = -600; x <= 600; x += 12) for (let z = -600; z <= 600; z += 12) { n++; if (w.heightAt(x, z) < SEA - 2) sea++; }
    const f = sea / n;
    assert.ok(f > 0.12 && f < 0.7, `${seed}: ${Math.round(f * 100)}% de mar`);
  }
});

test('el fondo del mar tiene vida: algas, pastos marinos y corales', () => {
  const w = new World('voxelia');
  // Busca una zona de mar profundo.
  let spot = null;
  for (let r = 0; r < 700 && !spot; r += 16) for (let a = 0; a < 16 && !spot; a++) { const x = Math.round(Math.cos(a) * r); const z = Math.round(Math.sin(a) * r); if (w.heightAt(x, z) < SEA - 6) spot = { x, z }; }
  assert.ok(spot, 'hay mar profundo');
  gen(w, spot.x, spot.z, 3);
  const count = {};
  for (const c of w.chunks.values()) for (const id of c.data) count[id] = (count[id] ?? 0) + 1;
  assert.ok((count[B.KELP] ?? 0) + (count[B.SEAGRASS] ?? 0) > 20, 'algas y pastos');
  assert.ok(BLOCKS[B.SEAGRASS].water && BLOCKS[B.CORAL_FAN].water, 'las plantas de agua cuentan como agua');
});

test('árboles nuevos: pinos y palmeras', () => {
  const w = new World('voxelia');
  let pine = 0; let palm = 0;
  for (let cx = -8; cx < 8; cx += 2) for (let cz = -8; cz < 8; cz += 2) { const c = w.generate(cx, cz); for (const id of c.data) { if (id === B.PINE_LEAVES) pine++; if (id === B.PALM_LOG) palm++; } }
  assert.ok(pine + palm > 0, `pinos ${pine}, palmeras ${palm}`);
});

test('barcos hundidos: casco bajo el agua y un cofre con tesoro', () => {
  const w = new World('voxelia');
  let p = null;
  for (let rx = -4; rx <= 4 && !p; rx++) for (let rz = -4; rz <= 4 && !p; rz++) p = wreckPlan(w, rx, rz);
  assert.ok(p, 'hay al menos un naufragio cerca');
  assert.ok(p.y < SEA - 6);
  gen(w, p.x, p.z, 1);
  let chest = false;
  for (let x = p.x - 8; x <= p.x + 8; x++) for (let z = p.z - 8; z <= p.z + 8; z++) for (let y = p.y; y < SEA; y++) if (w.getBlock(x, y, z) === B.LOOT_CHEST) chest = true;
  assert.ok(chest, 'el cofre está en el fondo');
  const t = treasure(() => 0.5);
  assert.ok(t[I.PEARL] >= 2 && t[I.GOLD] >= 2 && t[I.SILVER] >= 20);
  assert.ok(WRECK_REGION > 0);
});

test('puertos: muelle, faro, pescadores y marineros', () => {
  let found = null;
  for (const seed of ['voxelia', 'mares', 'isla', 'costa', 'bahia', 'puerto']) {
    const w = new World(seed);
    for (let rx = -3; rx <= 3 && !found; rx++) for (let rz = -3; rz <= 3 && !found; rz++) { const p = villagePlan(w, rx, rz); if (p?.port) found = { w, p }; }
    if (found) break;
  }
  assert.ok(found, 'alguna semilla tiene puerto');
  const { w, p } = found;
  assert.ok(p.name.startsWith('Puerto '));
  const port = p.port;
  gen(w, port.end.x, port.end.z, 1); gen(w, port.start.x, port.start.z, 1);
  // El muelle: tablas a la altura de la cubierta en el medio del recorrido.
  const mx = Math.round((port.start.x + port.end.x) / 2); const mz = Math.round((port.start.z + port.end.z) / 2);
  let deck = false;
  for (let k = -1; k <= 1; k++) for (let y = port.deckY - 1; y <= port.deckY + 1; y++) if (BLOCKS[w.getBlock(mx + port.perp[0] * k, y, mz + port.perp[1] * k)].solid) deck = true;
  assert.ok(deck, 'hay muelle sobre el agua');
  const rec = initialRecord(w, p);
  const profs = rec.villagers.map((v) => v.prof);
  assert.ok(profs.includes('fisher') || profs.includes('sailor') || rec.villagers.length < 6, `oficios: ${profs.join(', ')}`);
});

test('economía local: cada aldea tiene sus precios', () => {
  const rec = { stock: { food: 20, wood: 12, stone: 12 } };
  const desert = { style: 'desert' }; const rustic = { style: 'rustic' };
  assert.ok(localPrice(B.PLANKS, desert, rec) > localPrice(B.PLANKS, rustic, rec), 'la madera es cara en el desierto');
  assert.ok(localPrice(I.BREAD, { style: 'medieval' }, { stock: { food: 3, wood: 12, stone: 12 } }) > localPrice(I.BREAD, { style: 'medieval' }, rec), 'con hambre la comida sube');
  const port = { style: 'medieval', port: {} };
  assert.ok(localPrice(I.PEARL, port, { ...rec, importDays: 2 }) < localPrice(I.PEARL, port, rec), 'el barco abarata las gemas');
  assert.ok(economySummary(desert, rec).dear.includes('madera'));
  assert.equal(economySummary(port, { ...rec, importDays: 1 }).imports, true);
});

test('animales: varias especies con su comportamiento', () => {
  for (const k of ['lanudo', 'deer', 'rabbit', 'crab']) assert.ok(SPECIES[k].hp > 0 && SPECIES[k].flee > SPECIES[k].speed, k);
  assert.ok(SPECIES.crab.sideways && SPECIES.rabbit.hop);
  for (const id of [I.MEAT, I.FISH, I.BERRIES]) assert.ok(ITEMS[id].heal > 0, `${ITEMS[id].name} se come`);
});

test('bote: se pone en el agua, se rema y no sube a tierra; se guarda', () => {
  const w = new World('voxelia');
  let spot = null;
  for (let r = 0; r < 700 && !spot; r += 16) for (let a = 0; a < 16 && !spot; a++) { const x = Math.round(Math.cos(a) * r); const z = Math.round(Math.sin(a) * r); if (w.heightAt(x, z) < SEA - 6) spot = { x, z }; }
  gen(w, spot.x, spot.z, 4);
  const sea = new Sea(new THREE.Scene(), w, null);
  const b = sea.placeBoat(spot.x + 0.5, spot.z + 0.5, 0);
  sea.riding = b;
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  for (let k = 0; k < 400; k++) sea.ride(0.05, { f: 1, b: 0, l: k % 3 === 0 ? 1 : 0, r: 0 }, player);
  const id = w.getBlock(Math.floor(b.mesh.position.x), SEA - 1, Math.floor(b.mesh.position.z));
  assert.ok(BLOCKS[id].water, 'sigue sobre el agua');
  assert.ok(Math.abs(player.pos.x - b.mesh.position.x) < 0.01, 'el jugador va arriba');
  const saved = sea.serialize();
  assert.equal(saved.length, 1);
  const other = new Sea(new THREE.Scene(), w, null); other.load(saved);
  assert.equal(other.boats.length, 1);
  assert.ok(RECIPES.some((r) => r.out[I.BOAT]), 'el bote se fabrica');
});
