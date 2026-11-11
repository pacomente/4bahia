import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/blocks.js';
import { I, mineSpeed, attackDamage } from '../src/items.js';
import { RECIPES, craft, canCraft } from '../src/recipes.js';
import { MISSIONS, emptyStats, missionStatus } from '../src/missions.js';
import { World } from '../src/world.js';
import { Shadows, nearLight } from '../src/mobs.js';
import { Player } from '../src/player.js';

const R = (id) => RECIPES.find((r) => r.id === id);

test('Taller: tronco → tablas → pico, consumiendo ingredientes', () => {
  const inv = { [B.BIRCH_LOG]: 1 };
  assert.ok(craft(R('planks'), inv), 'acepta tronco de abedul como alternativa');
  assert.equal(inv[B.PLANKS], 4);
  assert.equal(inv[B.BIRCH_LOG], undefined);
  assert.ok(craft(R('pick_wood'), inv));
  assert.equal(inv[I.PICK_WOOD], 1);
  assert.equal(inv[B.PLANKS], 1);
  assert.equal(craft(R('pick_wood'), inv), null, 'sin tablas suficientes no fabrica');
});

test('Taller: el planeador se fabrica una sola vez y el corazón tiene tope', () => {
  const inv = { [I.CRYSTAL]: 20, [I.ESSENCE]: 20, [B.PLANKS]: 20 };
  assert.ok(craft(R('glider'), inv));
  assert.equal(canCraft(R('glider'), inv), false);
  assert.equal(craft(R('heart'), inv, { maxHealth: 20 }).special, 'heart');
  assert.equal(canCraft(R('heart'), inv, { maxHealth: 30 }), false);
});

test('las herramientas aceleran solo el material que les corresponde', () => {
  assert.equal(mineSpeed(null, BLOCKS[B.STONE]), 1);
  assert.equal(mineSpeed(I.PICK_WOOD, BLOCKS[B.STONE]), 2);
  assert.equal(mineSpeed(I.PICK_IRON, BLOCKS[B.STONE]), 5.5);
  assert.equal(mineSpeed(I.PICK_IRON, BLOCKS[B.LOG]), 1, 'el pico no sirve para madera');
  assert.equal(mineSpeed(I.AXE_STONE, BLOCKS[B.LOG]), 3.5);
  assert.ok(attackDamage(I.AXE_IRON) > attackDamage(null));
  assert.equal(BLOCKS[B.IRON].drop, I.IRON, 'el hierro sale como lingote, sin horno');
  assert.equal(BLOCKS[B.CRYSTAL].drop, I.CRYSTAL);
});

test('misiones: avanzan en orden según las estadísticas', () => {
  const s = emptyStats();
  assert.equal(missionStatus(s).current.id, 'wood');
  s.collected[B.LOG] = 3; s.collected[B.BIRCH_LOG] = 2;
  assert.equal(missionStatus(s).current.id, 'pick');
  s.crafted.pick_wood = 1; s.collected[B.COBBLE] = 10; s.collected[I.COAL] = 3; s.placed[B.LAMP] = 1;
  assert.equal(missionStatus(s).current.id, 'night');
  s.nights = 1; s.collected[I.ESSENCE] = 2; s.collected[I.CRYSTAL] = 4; s.placed[B.FARO] = 1; s.crafted.glider = 1;
  const st = missionStatus(s);
  assert.equal(st.current, null);
  assert.equal(st.done, MISSIONS.length);
});

test('hay cristales luminosos en lo profundo', () => {
  const w = new World('cristales');
  let n = 0; let maxY = 0;
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const c = w.generate(cx, cz);
    c.data.forEach((id, i) => { if (id === B.CRYSTAL) { n++; maxY = Math.max(maxY, Math.floor(i / 256)); } });
  }
  assert.ok(n > 20, `cristales: ${n}`);
  assert.ok(maxY < 20, 'solo debajo de la altura 20');
});

test('Sombras: persiguen al jugador, se queman con la luz y sueltan esencia al morir', () => {
  const w = new World('sombras');
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.generate(cx, cz);
  for (let y = 61; y < 90; y++) for (let x = -12; x < 12; x++) for (let z = -12; z < 12; z++) w.setBlock(x, y, z, B.AIR);
  for (let x = -12; x < 12; x++) for (let z = -12; z < 12; z++) w.setBlock(x, 60, z, B.STONE);
  const scene = { add() {}, remove() {} };
  const sound = { tone() {} };
  const sh = new Shadows(scene, w, sound);
  const player = new Player(w, { x: 0.5, y: 61, z: 0.5 });
  let hits = 0; let killed = 0;
  const ctx = { player, daylight: 0.2, enabled: false, nights: 0, onHitPlayer: () => hits++, onKilled: (_p, by) => { if (by) killed++; } };
  const m = sh.spawnAt(8.5, 62.5, 0.5);
  for (let i = 0; i < 200; i++) sh.update(1 / 30, ctx);
  assert.ok(hits > 0, 'alcanza al jugador y le hace daño');
  // Golpes hasta derrotarla
  const eye = player.eye();
  const dir = m.mesh.position.clone().sub(eye).normalize();
  for (let i = 0; i < 3 && sh.list.length; i++) sh.hit(eye, dir.clone(), 4, 3, ctx);
  assert.equal(killed, 1);
  assert.equal(sh.list.length, 0);
  // Cerca de una lámpara se quema y huye de la luz.
  w.setBlock(-6, 61, 0, B.LAMP);
  assert.ok(nearLight(w, -5, 62, 0));
  const burnt = sh.spawnAt(-5.5, 62.5, 0.5);
  for (let i = 0; i < 60; i++) sh.update(1 / 30, { ...ctx, player: new Player(w, { x: 9.5, y: 61, z: 9.5 }) });
  assert.ok(burnt.hp < 6, 'la luz la daña');
  assert.equal(nearLight(w, burnt.mesh.position.x, burnt.mesh.position.y, burnt.mesh.position.z), null, 'se alejó de la lámpara');
  sh.clear();
  // De día se desvanecen
  sh.spawnAt(5.5, 62.5, 5.5);
  for (let i = 0; i < 80; i++) sh.update(1 / 30, { ...ctx, daylight: 1 });
  assert.equal(sh.list.length, 0);
});

test('planeador: sin daño por caída y energía que se gasta al correr', () => {
  const w = new World('planeo');
  for (let cx = -1; cx <= 5; cx++) for (let cz = -1; cz <= 1; cz++) w.generate(cx, cz);
  // Pasillo plano hacia +x por donde planea.
  for (let y = 61; y < 80; y++) for (let x = -4; x < 90; x++) for (let z = -4; z < 5; z++) w.setBlock(x, y, z, B.AIR);
  for (let x = -4; x < 90; x++) for (let z = -4; z < 5; z++) w.setBlock(x, 60, z, B.STONE);
  const p = new Player(w, { x: 0.5, y: 75, z: 0.5, yaw: -Math.PI / 2 });
  p.useStamina = true; p.hasGlider = true; p.input.jump = true;
  let dmg = 0; let glided = false;
  for (let i = 0; i < 1200 && !p.onGround; i++) { const ev = p.update(1 / 60); if (ev.fallDamage) dmg += ev.fallDamage; if (p.gliding) glided = true; }
  assert.ok(glided && p.onGround, 'planeó y aterrizó');
  assert.equal(dmg, 0, 'sin daño por caída');
  p.input.jump = false; p.input.f = 1; p.input.sprint = true;
  for (let i = 0; i < 120; i++) p.update(1 / 60);
  assert.ok(p.stamina < 90, `la energía baja al correr (${p.stamina.toFixed(0)})`);
  p.input.f = 0; p.input.sprint = false;
  const low = p.stamina;
  for (let i = 0; i < 120; i++) p.update(1 / 60);
  assert.ok(p.stamina > low, 'se recupera al descansar');
});
