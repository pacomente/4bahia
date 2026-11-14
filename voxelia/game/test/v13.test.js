import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/blocks.js';
import { I, ITEMS, COOKS, attackDamage, mineSpeed, upgradeCost, MAX_UPGRADE } from '../src/items.js';
import { GROW, RIPE, REPLANT, PLANT, harvest, FIELD_CROPS } from '../src/crops.js';
import { RECIPES } from '../src/recipes.js';
import { World } from '../src/world.js';
import { drawItem, N } from '../src/icons.js';
import { SHOPS, PRICE, categoryOf } from '../src/economy.js';

test('comida: todo llena la panza; lo crudo menos que lo cocido', () => {
  for (const id of Object.keys(ITEMS).map(Number)) if (ITEMS[id].kind === 'food') assert.ok(ITEMS[id].food > 0, `${ITEMS[id].name} llena`);
  for (const [raw, cooked] of Object.entries(COOKS)) {
    assert.ok(ITEMS[raw].raw, `${ITEMS[raw].name} es crudo`);
    assert.ok(ITEMS[cooked].food > ITEMS[raw].food, `${ITEMS[cooked].name} llena más`);
  }
  assert.ok(ITEMS[I.STEW].food >= 10, 'el guiso es lo que más llena');
});

test('cultivos: se plantan, crecen, se cosechan y se vuelven a sembrar', () => {
  for (const [item, block] of Object.entries(PLANT)) assert.ok(BLOCKS[block].shape === 'crop', `${ITEMS[item].name} se planta`);
  for (const [young, ripe] of Object.entries(GROW)) { assert.ok(RIPE.has(ripe)); assert.equal(REPLANT[ripe], Number(young)); }
  assert.ok(harvest(B.CARROT_RIPE, () => 0.5)[I.CARROT] >= 1);
  assert.ok(harvest(B.POTATO_RIPE, () => 0.5)[I.POTATO] >= 1);
  assert.equal(FIELD_CROPS.length, 3, 'los campos de las aldeas tienen trigo, zanahoria o papa');
});

test('mejoras del herrero: más daño y velocidad por nivel, cada vez más caras', () => {
  assert.ok(attackDamage(I.SWORD_IRON, 3) > attackDamage(I.SWORD_IRON, 0) * 1.5);
  assert.ok(mineSpeed(I.PICK_IRON, BLOCKS[B.STONE], 2) > mineSpeed(I.PICK_IRON, BLOCKS[B.STONE], 0));
  for (let l = 1; l < MAX_UPGRADE; l++) assert.ok(upgradeCost(l).silver > upgradeCost(l - 1).silver);
});

test('recetas, precios e íconos de lo nuevo', () => {
  for (const id of [B.OVEN, I.ROD, I.STEW, I.PUMPKIN_PIE, I.PUMPKIN_SEEDS]) assert.ok(RECIPES.some((r) => r.out[id]), `receta de ${id}`);
  for (const id of [I.CARROT, I.POTATO, I.HONEY, I.ROD]) assert.ok(SHOPS.farmer.sells.some((s) => s.id === id) || SHOPS.fisher.sells.some((s) => s.id === id), `se vende ${ITEMS[id].name}`);
  assert.ok(PRICE[I.GOLDEN_FISH] >= 30 && categoryOf(I.GOLDEN_FISH) === 'gems');
  for (const id of [I.RAW_MEAT, I.RAW_FISH, I.SALMON, I.CARROT, I.POTATO, I.BAKED_POTATO, I.PUMPKIN_PIE, I.STEW, I.HONEY, I.ROD, I.GOLDEN_FISH, I.OLD_BOOT, I.PUMPKIN_SEEDS]) {
    const g = drawItem(id, ITEMS[id], I);
    assert.ok(g.filter(Boolean).length > 60 && g.length === N * N, `ícono de ${ITEMS[id].name}`);
  }
});

test('el mundo tiene manzanos, colmenas, calabazas y huertas silvestres', () => {
  const w = new World('voxelia'); const count = {};
  for (let cx = -10; cx < 10; cx++) for (let cz = -10; cz < 10; cz++) { const c = w.generate(cx, cz); for (const id of c.data) count[id] = (count[id] ?? 0) + 1; }
  assert.ok((count[B.FRUIT_LEAVES] ?? 0) > 0, 'manzanos');
  assert.ok((count[B.BEEHIVE] ?? 0) > 0, 'colmenas');
  assert.ok((count[B.PUMPKIN] ?? 0) > 0, 'calabazas');
  assert.ok((count[B.CARROT_RIPE] ?? 0) + (count[B.POTATO_RIPE] ?? 0) + (count[B.CARROT_YOUNG] ?? 0) + (count[B.POTATO_YOUNG] ?? 0) > 0, 'zanahorias o papas');
});
