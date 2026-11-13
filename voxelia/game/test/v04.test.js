import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/blocks.js';
import { I, ITEMS, maxUses, mineSpeed, attackDamage } from '../src/items.js';
import { RECIPES, canCraft, craft, craftableTimes, CATEGORIES } from '../src/recipes.js';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';

const R = (id) => RECIPES.find((r) => r.id === id);

test('Mesa de trabajo: lo básico se hace a mano, lo demás necesita una mesa cerca', () => {
  const inv = { [B.LOG]: 2 };
  assert.ok(craft(R('planks'), inv, { nearBench: false }));
  assert.ok(craft(R('planks'), inv, { nearBench: false }));
  assert.ok(craft(R('bench'), inv, { nearBench: false }), 'la mesa misma se hace a mano');
  assert.equal(inv[B.WORKBENCH], 1);
  assert.equal(canCraft(R('pick_wood'), inv, { nearBench: false }), false, 'el pico necesita la mesa');
  assert.ok(craft(R('pick_wood'), inv, { nearBench: true }));
  for (const r of RECIPES) assert.ok(CATEGORIES.some((c) => c.id === r.cat), `categoría válida: ${r.id}`);
});

test('Fabricar todo: calcula cuántas veces alcanza', () => {
  const inv = { [I.COAL]: 5, [B.PLANKS]: 3 };
  assert.equal(craftableTimes(R('torch'), inv), 3);
  assert.equal(craftableTimes(R('glider'), { [I.CRYSTAL]: 99, [I.ESSENCE]: 99, [B.PLANKS]: 99 }, { nearBench: true }), 1, 'el planeador es uno solo');
});

test('herramientas: espadas pegan más, el cristal es el mejor nivel y todas se gastan', () => {
  assert.ok(attackDamage(I.SWORD_WOOD) > attackDamage(I.PICK_WOOD));
  assert.ok(attackDamage(I.SWORD_CRYSTAL) > attackDamage(I.SWORD_IRON));
  assert.ok(mineSpeed(I.PICK_CRYSTAL, { tool: 'pick' }) > mineSpeed(I.PICK_IRON, { tool: 'pick' }));
  assert.equal(mineSpeed(I.SWORD_IRON, { tool: 'pick' }), 1, 'la espada no sirve para minar');
  assert.ok(maxUses(I.PICK_WOOD) < maxUses(I.PICK_STONE) && maxUses(I.PICK_STONE) < maxUses(I.PICK_IRON) && maxUses(I.PICK_IRON) < maxUses(I.PICK_CRYSTAL));
  assert.equal(maxUses(I.COAL), null);
  assert.ok(ITEMS[I.AXE_CRYSTAL].glow);
});

// Plataforma de piedra en el aire (y=60) para probar el movimiento sin terreno alrededor.
function platform() {
  const w = new World('mov');
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.generate(cx, cz);
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) for (let y = 55; y < 90; y++) w.setBlock(x, y, z, y === 60 && Math.abs(x) <= 2 && Math.abs(z) <= 2 ? B.STONE : B.AIR);
  return w;
}

test('agachado no se cae del borde; caminando normal sí', () => {
  const w = platform();
  const p = new Player(w, { x: 0.5, y: 61, z: 0.5 });
  for (let i = 0; i < 10; i++) p.update(1 / 60);
  p.input.down = true; p.input.r = 1; p.yaw = 0;    // derecha = +x
  for (let i = 0; i < 240; i++) p.update(1 / 60);
  assert.ok(p.onGround && p.pos.y >= 61, `sigue arriba: ${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}`);
  assert.ok(p.pos.x > 2.5 && p.pos.x < 3.4, `llegó al borde sin caerse: ${p.pos.x.toFixed(2)}`);
  p.input.down = false;
  for (let i = 0; i < 120; i++) p.update(1 / 60);
  assert.ok(p.pos.y < 60, 'sin agacharse se cae');
});

test('salto con margen: se puede saltar apenas después de salir del borde', () => {
  const w = platform();
  const p = new Player(w, { x: 2.6, y: 61, z: 0.5 });
  for (let i = 0; i < 10; i++) p.update(1 / 60);
  p.input.r = 1; p.yaw = 0;
  let jumped = false;
  for (let i = 0; i < 60 && !jumped; i++) {
    const was = p.onGround;
    p.update(1 / 60);
    if (was && !p.onGround) { p.input.jump = true; p.update(1 / 60); p.update(1 / 60); jumped = p.vel.y > 5; }
  }
  assert.ok(jumped, 'saltó aunque ya no pisaba la plataforma');
});
