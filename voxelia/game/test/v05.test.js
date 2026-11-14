import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/blocks.js';
import { I } from '../src/items.js';
import { World } from '../src/world.js';
import { villagePlan, villagesNear, houseBlueprint, REGION } from '../src/villages.js';
import { initialRecord, villageDawn, planBuild, buildStep, capacity, allHouses, isChild, TRADES } from '../src/villagers.js';
import { standY, stepToward, settle } from '../src/walk.js';
import { RECIPES } from '../src/recipes.js';

// Aldea más cercana al inicio (siempre hay una).
function homeVillage(seed = 'voxelia') {
  const w = new World(seed);
  const p = villagesNear(w, 0, 0, 200).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  return { w, p };
}
function loadAround(w, x, z, r = 3) { for (let cx = Math.floor(x / 16) - r; cx <= Math.floor(x / 16) + r; cx++) for (let cz = Math.floor(z / 16) - r; cz <= Math.floor(z / 16) + r; cz++) if (!w.getChunk(cx, cz)) w.generate(cx, cz); }

test('aldeas: hay una cerca del inicio, misma semilla = misma aldea, estilo según bioma', () => {
  for (const seed of ['voxelia', 'mundo2', 'abc', '12345']) {
    const { p } = homeVillage(seed);
    assert.ok(p, `hay aldea cerca del inicio (${seed})`);
    assert.ok(Math.hypot(p.x, p.z) < 260, `${seed}: a ${Math.round(Math.hypot(p.x, p.z))} bloques`);
    assert.ok(['medieval', 'rustic', 'desert', 'snow'].includes(p.style));
    assert.ok(p.houses.length >= 3 && p.slots.length > 0);
  }
  const a = homeVillage('voxelia').p; const b = homeVillage('voxelia').p;
  assert.deepEqual([a.x, a.z, a.name, a.houses.length], [b.x, b.z, b.name, b.houses.length]);
});

test('aldeas: las casas se generan con piso, paredes, puerta abierta, ventana y techo', () => {
  const { w, p } = homeVillage();
  loadAround(w, p.x, p.z, 3);
  for (const h of p.houses) {
    assert.equal(w.getBlock(h.door.x, h.y + 1, h.door.z), B.DOOR, 'puerta de dos bloques');
    assert.equal(w.getBlock(h.door.x, h.y + 2, h.door.z), B.DOOR);
    for (const b of h.beds) assert.equal(w.getBlock(b.x, h.y + 1, b.z), B.BED, 'dos camas');
    assert.ok(BLOCKS[w.getBlock(h.door.x, h.y + 3, h.door.z)].solid, 'dintel');
    assert.ok(BLOCKS[w.getBlock(h.x, h.y, h.z)].solid, 'piso');
    assert.equal(BLOCKS[w.getBlock(h.x, h.y + 1, h.z)].solid, false, 'adentro hay lugar (a lo sumo una alfombra)');
  }
  const h = p.houses[0];
  const roof = p.style === 'desert' ? w.getBlock(h.x, h.y + 4, h.z) : w.getBlock(h.x, h.y + 8, h.z);
  assert.ok(BLOCKS[roof].solid, 'tiene techo');
});

test('aldeanos: población inicial con constructor y guardia; los chicos crecen y nace gente si hay lugar', () => {
  const { w, p } = homeVillage();
  const rec = initialRecord(w, p);
  assert.ok(rec.villagers.length >= 5);
  assert.ok(rec.villagers.some((v) => v.prof === 'builder'));
  assert.ok(rec.villagers.some((v) => v.prof === 'guard'));
  assert.ok(rec.villagers.every((v) => v.name && v.trait && v.look.skin));
  assert.ok(rec.villagers.length < capacity(p, rec), 'empieza con lugar para uno más');
  const before = rec.villagers.length;
  let events = [];
  rec.stock.food = 200;
  for (let d = 0; d < 3; d++) events.push(...villageDawn(p, rec, () => 0.1));
  assert.ok(rec.villagers.length > before, 'nació alguien');
  assert.ok(events.some((e) => e.type === 'born'));
  assert.ok(rec.villagers.length <= capacity(p, rec), 'nunca más que la capacidad');
  const baby = rec.villagers.find((v) => isChild(v));
  if (baby) { villageDawn(p, rec, () => 0.9); villageDawn(p, rec, () => 0.9); assert.ok(!isChild(baby) && baby.prof, 'creció y tiene oficio'); }
  assert.ok(rec.build, 'con la aldea llena se planea una casa nueva');
});

test('constructor: levanta la casa nueva bloque por bloque y suma lugar', () => {
  const { w, p } = homeVillage();
  const rec = initialRecord(w, p);
  rec.stock.food = 500; rec.stock.wood = 500; rec.stock.stone = 500;
  for (let d = 0; d < 40 && rec.villagers.length < capacity(p, rec); d++) villageDawn(p, rec, () => 0.1);
  planBuild(p, rec);
  const slot = p.slots[rec.build.slot];
  loadAround(w, slot.x, slot.z, 1);
  const cap0 = capacity(p, rec);
  let placed = 0; let res;
  for (let k = 0; k < 5000 && res !== 'done'; k++) { res = buildStep(w, p, rec); if (res && res !== 'done' && res !== 'nomat') placed++; }
  assert.equal(res, 'done');
  assert.ok(placed > 60, `bloques colocados: ${placed}`);
  assert.equal(capacity(p, rec), cap0 + 2, 'una casa más = dos lugares más');
  assert.equal(allHouses(p, rec).length, p.houses.length + 1);
  assert.equal(w.getBlock(slot.door.x, slot.y + 1, slot.door.z), B.DOOR, 'la casa nueva tiene puerta');
  // Los bloques quedan como cambios del mundo (se guardan).
  assert.ok(w.mods.size > 0);
  // El plano es reproducible.
  assert.equal(houseBlueprint(w, p, slot).length, houseBlueprint(w, p, slot).length);
});

test('caminata: un aldeano entra a su casa por la puerta (afuera → puerta → adentro)', () => {
  const { w, p } = homeVillage();
  loadAround(w, p.x, p.z, 3);
  const h = p.houses[0];
  assert.equal(standY(w, h.doorCell.x, h.y + 1, h.doorCell.z, 0, 0), null, 'la puerta cerrada no deja pasar');
  w.setBlock(h.door.x, h.y + 1, h.door.z, B.DOOR_OPEN); w.setBlock(h.door.x, h.y + 2, h.door.z, B.DOOR_OPEN);   // la abre
  const y0 = standY(w, h.outside.x, h.y + 2, h.outside.z, 3, 6);
  assert.notEqual(y0, null, 'se puede parar afuera');
  const e = { pos: { x: h.outside.x, y: y0, z: h.outside.z }, vy: 0, stuck: 0, side: 1, heading: 0 };
  e.pos.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; };
  let i = 0;
  for (const wp of [h.doorCell, h.inside]) {
    for (let k = 0; k < 600; k++) { const r = stepToward(w, e, wp.x, wp.z, 1.6, 1 / 30); settle(w, e, 1 / 30); if (r.arrived) break; i++; }
  }
  assert.ok(Math.hypot(e.pos.x - h.inside.x, e.pos.z - h.inside.z) < 0.6, `llegó adentro (${e.pos.x.toFixed(1)}, ${e.pos.z.toFixed(1)})`);
  assert.equal(Math.round(e.pos.y), h.y + 1, 'parado sobre el piso de la casa');
});

test('trueques y armas nuevas: arco, flechas y escudo', () => {
  for (const id of ['bow', 'arrows', 'shield']) assert.ok(RECIPES.find((r) => r.id === id), id);
  assert.ok(TRADES.smith.some((t) => t.repair), 'el herrero repara');
  for (const list of Object.values(TRADES)) for (const t of list) assert.ok(t.upgrade || (Object.keys(t.give).length && (t.repair || Object.keys(t.get).length)));
  assert.ok(I.BOW && I.ARROW && I.SHIELD);
});
