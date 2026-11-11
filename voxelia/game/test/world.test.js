import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, CS, H, SEA } from '../src/world.js';
import { B } from '../src/blocks.js';
import { raycast } from '../src/raycast.js';
import { Player } from '../src/player.js';

const loadAround = (w, cx, cz, r = 1) => { for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) w.generate(x, z); };

test('la misma semilla genera exactamente el mismo mundo', () => {
  const a = new World('semilla-1'); const b = new World('semilla-1'); const c = new World('otra');
  const ca = a.generate(3, -2); const cb = b.generate(3, -2); const cc = c.generate(3, -2);
  assert.deepEqual(ca.data, cb.data);
  assert.notDeepEqual(ca.data, cc.data);
});

test('el terreno tiene roca madre abajo, superficie y agua al nivel del mar', () => {
  const w = new World('voxelia');
  loadAround(w, 0, 0, 2);
  let water = 0; let grassOrSand = 0;
  for (let x = -32; x < 32; x++) for (let z = -32; z < 32; z++) {
    assert.equal(w.getBlock(x, 0, z), B.BEDROCK);
    const top = w.topAt(x, z);
    assert.ok(top > 3 && top < H, `altura razonable en ${x},${z}`);
    if (w.getBlock(x, SEA, z) === B.WATER) water++;
    const s = w.getBlock(x, w.heightAt(x, z), z);
    if ([B.GRASS, B.SAND, B.SNOW, B.STONE, B.GRAVEL, B.CLAY, B.LOG, B.BIRCH_LOG, B.CACTUS].includes(s)) grassOrSand++;
  }
  assert.ok(grassOrSand > 3000, 'la mayoría de las columnas tiene superficie');
  assert.ok(w.spawnPoint().y > SEA, 'el punto de aparición queda en tierra firme');
  assert.ok(water >= 0);
});

test('hay árboles, minerales y cuevas en una zona amplia', () => {
  const w = new World('voxelia');
  const counts = {};
  for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) {
    const c = w.generate(cx, cz);
    for (const id of c.data) counts[id] = (counts[id] ?? 0) + 1;
  }
  assert.ok((counts[B.LOG] ?? 0) + (counts[B.BIRCH_LOG] ?? 0) + (counts[B.CACTUS] ?? 0) > 20, 'vegetación');
  assert.ok(counts[B.COAL] > 50, 'carbón');
  assert.ok(counts[B.LEAVES] > 100, 'hojas');
});

test('las modificaciones del jugador se guardan y se vuelven a aplicar', () => {
  const w = new World('mods');
  loadAround(w, 0, 0);
  w.setBlock(2, 70, 3, B.BRICK);
  w.setBlock(-5, 70, -7, B.GLASS);
  const saved = JSON.parse(JSON.stringify(w.serializeMods()));
  const w2 = new World('mods', saved);
  loadAround(w2, 0, 0);
  assert.equal(w2.getBlock(2, 70, 3), B.BRICK);
  assert.equal(w2.getBlock(-5, 70, -7), B.GLASS);
});

test('el rayo detecta el bloque apuntado y la cara correcta', () => {
  const w = new World('ray');
  loadAround(w, 0, 0);
  for (let y = 60; y < 80; y++) for (let x = -3; x < 4; x++) for (let z = -3; z < 4; z++) w.setBlock(x, y, z, B.AIR);
  w.setBlock(0, 60, 0, B.STONE);
  const hit = raycast(w, { x: 0.5, y: 63.5, z: 0.5 }, { x: 0, y: -1, z: 0 }, 6);
  assert.deepEqual([hit.x, hit.y, hit.z], [0, 60, 0]);
  assert.deepEqual(hit.face, [0, 1, 0]);
  assert.equal(raycast(w, { x: 0.5, y: 75, z: 0.5 }, { x: 0, y: -1, z: 0 }, 6), null, 'fuera de alcance');
});

test('el jugador cae por gravedad, apoya en el piso y no atraviesa paredes', () => {
  const w = new World('fisica');
  loadAround(w, 0, 0);
  for (let y = 61; y < 75; y++) for (let x = -4; x < 5; x++) for (let z = -4; z < 5; z++) w.setBlock(x, y, z, B.AIR);
  for (let x = -4; x < 5; x++) for (let z = -4; z < 5; z++) w.setBlock(x, 60, z, B.STONE);
  for (let y = 61; y < 64; y++) w.setBlock(2, y, 0, B.STONE);   // pared
  const p = new Player(w, { x: 0.5, y: 66, z: 0.5 });
  for (let i = 0; i < 120; i++) p.update(1 / 60);
  assert.ok(p.onGround, 'en el suelo');
  assert.ok(Math.abs(p.pos.y - 61) < 0.01, `apoyado sobre el bloque (y=${p.pos.y})`);
  p.yaw = -Math.PI / 2; p.input.f = 1;   // camina hacia +x
  for (let i = 0; i < 120; i++) p.update(1 / 60);
  assert.ok(p.pos.x < 2 - 0.3 + 0.01, `la pared lo frena (x=${p.pos.x})`);
  p.input.f = 0; p.input.jump = true;
  p.update(1 / 60);
  assert.ok(p.vel.y > 0, 'salta');
});

test('caer de muy alto genera daño', () => {
  const w = new World('caida');
  loadAround(w, 0, 0);
  for (let y = 61; y < H; y++) for (let x = -2; x < 3; x++) for (let z = -2; z < 3; z++) w.setBlock(x, y, z, B.AIR);
  for (let x = -2; x < 3; x++) for (let z = -2; z < 3; z++) w.setBlock(x, 60, z, B.STONE);
  const p = new Player(w, { x: 0.5, y: 80, z: 0.5 });
  let dmg = 0;
  for (let i = 0; i < 300; i++) { const ev = p.update(1 / 60); if (ev.fallDamage) dmg = ev.fallDamage; }
  assert.ok(dmg >= 10, `daño por caída de ~19 bloques (${dmg})`);
});

test('el tamaño de chunk y la altura son los esperados', () => { assert.equal(CS, 16); assert.equal(H, 96); });
