import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS, LIGHT_BLOCKS } from '../src/blocks.js';
import { World } from '../src/world.js';
import { campsNear, campBlocks, lootTable } from '../src/camps.js';
import { villagesNear } from '../src/villages.js';

function scan(seed, r = 4) {
  const w = new World(seed); const at = {}; const ys = {};
  for (let cx = -r; cx < r; cx++) for (let cz = -r; cz < r; cz++) {
    const c = w.generate(cx, cz);
    c.data.forEach((id, i) => { at[id] = (at[id] ?? 0) + 1; const y = Math.floor(i / 256); (ys[id] ??= { min: 99, max: -1 }); ys[id].min = Math.min(ys[id].min, y); ys[id].max = Math.max(ys[id].max, y); });
  }
  return { w, at, ys };
}

test('cuevas: cavernas, lava solo en el fondo, hongos y musgo en el suelo, oro profundo', () => {
  const { at, ys } = scan('voxelia');
  assert.ok(at[B.LAVA] > 500, `lava: ${at[B.LAVA]}`);
  assert.ok(ys[B.LAVA].max <= 9, 'la lava queda abajo de la altura 9');
  assert.ok(at[B.GLOW_MUSHROOM] > 50, `hongos: ${at[B.GLOW_MUSHROOM]}`);
  assert.ok(ys[B.GLOW_MUSHROOM].min >= 11, 'los hongos crecen arriba de la lava');
  assert.ok(at[B.MOSS] > 300);
  assert.ok(at[B.GOLD_ORE] > 50 && ys[B.GOLD_ORE].max < 16, 'oro solo en lo profundo');
  assert.ok(LIGHT_BLOCKS.has(B.LAVA) && LIGHT_BLOCKS.has(B.GLOW_MUSHROOM) && LIGHT_BLOCKS.has(B.CAMPFIRE), 'lava, hongos y fogatas iluminan');
  assert.equal(BLOCKS[B.LAVA].solid, false);
});

test('cuevas: el mismo mundo sigue igual en la superficie (los ruidos nuevos no cambian el terreno)', () => {
  const a = new World('voxelia'); const b = new World('voxelia');
  for (const [x, z] of [[0, 0], [100, -50], [-300, 220]]) assert.equal(a.heightAt(x, z), b.heightAt(x, z));
});

test('campamentos: hay uno a una caminata del inicio, lejos de las aldeas buenas', () => {
  for (const seed of ['voxelia', 'mundo2', 'abc', '12345']) {
    const w = new World(seed);
    const c = campsNear(w, 0, 0, 400).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    assert.ok(c, `hay campamento (${seed})`);
    const d = Math.hypot(c.x, c.z);
    assert.ok(d > 100 && d < 420, `${seed}: a ${Math.round(d)} bloques`);
    assert.equal(villagesNear(w, c.x, c.z, 40).length, 0, 'no pisa una aldea');
    assert.equal(c.cages.length, 2);
  }
});

test('campamentos: empalizada, fogata, jaulas con barrotes, carpas, bandera y cofre', () => {
  const w = new World('voxelia');
  const c = campsNear(w, 0, 0, 400).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  for (let cx = Math.floor(c.x / 16) - 2; cx <= Math.floor(c.x / 16) + 2; cx++) for (let cz = Math.floor(c.z / 16) - 2; cz <= Math.floor(c.z / 16) + 2; cz++) w.generate(cx, cz);
  assert.equal(w.getBlock(c.x, c.y + 1, c.z), B.CAMPFIRE);
  assert.equal(w.getBlock(c.chest.x, c.y + 1, c.chest.z), B.LOOT_CHEST);
  for (const cage of c.cages) {
    assert.equal(w.getBlock(cage.x + 1, c.y + 1, cage.z), B.BARS);
    assert.equal(w.getBlock(cage.x, c.y + 1, cage.z), B.AIR, 'lugar para el prisionero');
  }
  const ids = new Set(campBlocks(w, c).map((b) => b.id));
  for (const id of [B.LOG, B.WOOL_BLACK, B.WOOL_RED, B.BARS, B.PLANKS, B.TORCH]) assert.ok(ids.has(id));
  // Los portones quedan abiertos.
  for (const g of c.gates) assert.equal(w.getBlock(g.x, c.y + 1, g.z), B.AIR);
});

test('botín: plata, oro y más', () => {
  const l = lootTable(() => 0.5);
  assert.ok(l[131] >= 25 && l[152] >= 1);
});
