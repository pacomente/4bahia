import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/blocks.js';
import { I, ITEMS, armorPoints, armorReduction, isFood, maxUses } from '../src/items.js';
import { RECIPES, craft } from '../src/recipes.js';
import { SHOPS, PRICE, sellPrice, makeQuest, rankFor, villageLevel } from '../src/economy.js';
import { World } from '../src/world.js';
import { villagesNear } from '../src/villages.js';
import { initialRecord, villageDawn, capacity, homeOf, isChild } from '../src/villagers.js';
import { standY } from '../src/walk.js';

test('armadura: puntos por pieza, reducción con tope y desgaste', () => {
  const iron = { head: I.HELMET_IRON, chest: I.CHEST_IRON, legs: I.LEGS_IRON, feet: I.BOOTS_IRON };
  const crystal = { head: I.HELMET_CRYSTAL, chest: I.CHEST_CRYSTAL, legs: I.LEGS_CRYSTAL, feet: I.BOOTS_CRYSTAL };
  assert.equal(armorPoints({}), 0);
  assert.ok(armorPoints(crystal) > armorPoints(iron) && armorPoints(iron) > armorPoints({ chest: I.CHEST_CLOTH }));
  assert.ok(armorReduction(armorPoints(crystal)) <= 0.8);
  assert.equal(ITEMS[I.SHIELD].slot, 'offhand');
  assert.ok(maxUses(I.CHEST_IRON) > maxUses(I.CHEST_CLOTH));
  const inv = { [B.WOOL_WHITE]: 8 };
  assert.ok(craft(RECIPES.find((r) => r.id === 'armor_cloth_1'), inv, { nearBench: true }));
  assert.equal(inv[I.CHEST_CLOTH], 1);
});

test('comida y campo: pan con trigo, la comida cura, el trigo es planta', () => {
  assert.ok(isFood(I.BREAD) && isFood(I.APPLE) && !isFood(I.WHEAT));
  assert.ok(ITEMS[I.CAKE].heal > ITEMS[I.BREAD].heal);
  const inv = { [I.WHEAT]: 6 };
  assert.ok(craft(RECIPES.find((r) => r.id === 'bread'), inv));
  assert.equal(inv[I.BREAD], 1);
  assert.equal(BLOCKS[B.WHEAT_RIPE].solid, false);
  assert.equal(BLOCKS[B.WHEAT_RIPE].drop, I.WHEAT);
  assert.equal(BLOCKS[B.DOOR_OPEN].solid, false);
  assert.equal(BLOCKS[B.DOOR].solid, true);
});

test('economía: todo lo que se vende tiene precio, vender paga menos, rangos y encargos', () => {
  for (const shop of Object.values(SHOPS)) {
    for (const it of shop.sells) assert.ok(PRICE[it.id] > 0, `precio de ${it.id}`);
    for (const id of shop.buys) assert.ok(sellPrice(id) >= 1 && sellPrice(id) <= (PRICE[id] ?? 1));
  }
  assert.equal(rankFor(0).name, 'Plebeyo');
  assert.equal(rankFor(5).name, 'Caballero');
  const q = makeQuest(() => 0.1, 2);
  assert.ok(q.text && q.n > 0 && q.reward > 0 && typeof q.text === 'string');
  assert.equal(villageLevel(4, false), 1);
  assert.equal(villageLevel(7, false), 2);
  assert.equal(villageLevel(9, true), 3);
});

test('aldea: rey en el castillo (medieval), mercado, campos, reservas y crecimiento con comida', () => {
  const w = new World('voxelia');
  const p = villagesNear(w, 0, 0, 200).find((v) => v.style === 'medieval');
  assert.ok(p.castle, 'la aldea medieval tiene castillo');
  assert.ok(p.stalls.length >= 2, 'mercado con puestos');
  assert.ok(p.fields.length >= 1 && p.fields[0].cells.length > 10, 'campos de trigo');
  const rec = initialRecord(w, p);
  const king = rec.villagers.find((v) => v.prof === 'king');
  assert.ok(king && king.home === -1, 'el rey vive en el castillo');
  assert.equal(homeOf(p, rec, king), p.castle);
  assert.ok(rec.villagers.some((v) => v.partner), 'hay parejas');
  // Sin comida no nacen chicos.
  rec.stock.food = 0;
  const pop = rec.villagers.length;
  const ev = villageDawn(p, rec, () => 0.1);
  assert.ok(ev.some((e) => e.type === 'hungry'));
  // Con comida (y lugar) nace un bebé con padres.
  rec.stock.food = 100;
  if (rec.villagers.length < capacity(p, rec)) {
    const ev2 = villageDawn(p, rec, () => 0.1);
    const born = ev2.find((e) => e.type === 'born');
    assert.ok(born && born.parents?.length === 2, 'nace con padres');
    assert.ok(rec.villagers.length > pop);
    assert.ok(rec.villagers.some((v) => isChild(v)));
  }
});

test('casas: puertas cerradas frenan a los zombis; abiertas dejan pasar', () => {
  const w = new World('voxelia');
  const p = villagesNear(w, 0, 0, 200).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  for (let cx = Math.floor(p.x / 16) - 3; cx <= Math.floor(p.x / 16) + 3; cx++) for (let cz = Math.floor(p.z / 16) - 3; cz <= Math.floor(p.z / 16) + 3; cz++) w.generate(cx, cz);
  const h = p.houses[0];
  assert.equal(standY(w, h.doorCell.x, h.y + 1, h.doorCell.z, 0, 0), null);
  w.setBlock(h.door.x, h.y + 1, h.door.z, B.DOOR_OPEN); w.setBlock(h.door.x, h.y + 2, h.door.z, B.DOOR_OPEN);
  assert.equal(standY(w, h.doorCell.x, h.y + 1, h.doorCell.z, 0, 0), h.y + 1);
});
