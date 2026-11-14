import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS, LIGHT_BLOCKS } from '../src/blocks.js';
import { I, ITEMS } from '../src/items.js';
import { drawItem, drawFurniture, N } from '../src/icons.js';
import { RECIPES, CATEGORIES } from '../src/recipes.js';
import { World } from '../src/world.js';
import { villagesNear, furnish, chimneyTop } from '../src/villages.js';

test('íconos: todos los ítems tienen pixel-art de 32×32 con contorno', () => {
  for (const id of Object.keys(ITEMS).map(Number)) {
    const g = drawItem(id, ITEMS[id], I);
    assert.equal(g.length, N * N);
    const filled = g.filter(Boolean).length;
    assert.ok(filled > 60, `${ITEMS[id].name}: ${filled} píxeles`);
    assert.ok(g.includes('#1b1512'), `${ITEMS[id].name} tiene contorno`);
  }
  for (const id of [B.TABLE, B.CHAIR, B.ANVIL, B.THRONE, B.CARPET, B.FIREPLACE]) assert.ok(drawFurniture(id, B), BLOCKS[id].name);
  assert.equal(drawFurniture(B.STONE, B), null);
});

test('casas amuebladas: tres tipos, pasillo libre hasta las camas, hogar con chimenea', () => {
  const w = new World('voxelia');
  const p = villagesNear(w, 0, 0, 200).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  for (let cx = Math.floor(p.x / 16) - 3; cx <= Math.floor(p.x / 16) + 3; cx++) for (let cz = Math.floor(p.z / 16) - 3; cz <= Math.floor(p.z / 16) + 3; cz++) w.generate(cx, cz);
  const kinds = new Set();
  for (const h of p.houses) {
    const fu = furnish(h); kinds.add(fu.kind);
    // Pasillo central (de la puerta al fondo) sin nada sólido.
    for (let v = -1; v <= 2; v++) { const x = h.x + h.face[0] * v; const z = h.z + h.face[1] * v; assert.equal(BLOCKS[w.getBlock(x, h.y + 1, z)].solid, false, `pasillo libre en v=${v}`); }
    for (const it of fu.items) assert.equal(w.getBlock(it.x, h.y + 1, it.z), it.id, `${BLOCKS[it.id].name} en su lugar`);
    if (p.style !== 'desert') {
      assert.equal(w.getBlock(fu.fireplace.x, h.y + 1, fu.fireplace.z), B.FIREPLACE);
      const top = chimneyTop(p, h);
      assert.equal(w.getBlock(Math.floor(top.x), h.y + 9, Math.floor(top.z)), B.COBBLE, 'la chimenea sale arriba del hogar');
    }
    for (const c of fu.chairs) assert.equal(w.getBlock(c.x, h.y + 1, c.z), B.CHAIR);
  }
  assert.ok(kinds.size >= 2, `tipos de casa: ${[...kinds]}`);
  assert.ok(LIGHT_BLOCKS.has(B.FIREPLACE), 'el hogar ilumina');
});

test('muebles: se fabrican en el Taller (pestaña Muebles) y las sillas/mesa no tapan el paso de más', () => {
  assert.ok(CATEGORIES.some((c) => c.id === 'furniture'));
  for (const id of ['table', 'chair', 'bookshelf', 'fireplace', 'carpet', 'barrel', 'hay', 'anvil', 'throne']) assert.ok(RECIPES.find((r) => r.id === id && r.cat === 'furniture'), id);
  assert.equal(BLOCKS[B.CARPET].solid, false, 'la alfombra se pisa');
  assert.equal(BLOCKS[B.FLOWER_RED].solid, false);
});

test('flores silvestres en las llanuras', () => {
  const w = new World('voxelia'); let n = 0;
  for (let cx = -3; cx < 3; cx++) for (let cz = -3; cz < 3; cz++) for (const id of w.generate(cx, cz).data) if (id === B.FLOWER_RED || id === B.FLOWER_YELLOW) n++;
  assert.ok(n > 20, `flores: ${n}`);
});
