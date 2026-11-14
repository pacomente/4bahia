import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { B } from '../src/blocks.js';
import { World } from '../src/world.js';
import { dungeonPlan, dungeonBlocks, dungeonLoot } from '../src/dungeons.js';
import { Creatures } from '../src/creatures.js';
import { villagePlan } from '../src/villages.js';
import { initialRecord, allHouses, planBuild } from '../src/villagers.js';
import { isFestival } from '../src/society.js';
import { I } from '../src/items.js';

test('mazmorras: escalera, sala de botín, foso de lava y sala del trono', () => {
  let p = null; let w = null;
  for (const seed of ['voxelia', 'mares', 'isla']) { w = new World(seed); for (let rx = -2; rx <= 2 && !p; rx++) for (let rz = -2; rz <= 2 && !p; rz++) p = dungeonPlan(w, rx, rz); if (p) break; }
  assert.ok(p, 'hay mazmorras');
  const ids = new Set(dungeonBlocks(w, p).map((b) => b.id));
  for (const id of [B.LOOT_CHEST, B.THRONE, B.LAVA, B.BARS, B.MOSSY_COBBLE, B.LAMP]) assert.ok(ids.has(id), `bloque ${id}`);
  assert.ok(p.boss && p.chest && p.hall, 'sabe dónde están el jefe, el cofre y el pasillo');
  assert.ok(dungeonLoot(() => 0.5)[I.TREASURE_MAP] === 1);
});

// El modelo de las personas dibuja la cara en un canvas: en las pruebas alcanza con uno de mentira.
const fakeCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => fakeCtx), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx, style: {} }) };

test('Rey Sombrío: tres fases y se lo puede vencer', () => {
  const w = { getBlock: () => 0, heightAt: () => 40, biome: () => 'plains', seed: 1 };
  const c = new Creatures(new THREE.Scene(), w, { tone() {}, noise() {} });
  const dungeon = { id: 'm0', name: 'Cripta', boss: { x: 0, y: 18, z: 0, r: 6 } };
  c.spawnShadowKing({ x: 0, y: 18, z: 0 }, dungeon);
  const player = { pos: new THREE.Vector3(1.5, 18, 0), onGround: true, look: () => new THREE.Vector3(-1, 0, 0) };
  const warns = []; const hits = []; let summons = 0; let killed = null;
  const ctx = { player, daylight: 1, warn: (t) => warns.push(t), onHit: (d) => hits.push(d), summon: () => summons++, puff() {}, setAttacker() {}, onKilled: (k) => { killed = k; } };
  for (let i = 0; i < 40; i++) c.update(0.1, ctx);
  assert.ok(hits.length > 0, 'pega');
  c.king.hp = 150; for (let i = 0; i < 140; i++) c.update(0.1, ctx);
  assert.equal(c.king.phase, 2); assert.ok(summons > 0, 'llama esbirros');
  c.king.hp = 60; for (let i = 0; i < 90; i++) c.update(0.1, ctx);
  assert.equal(c.king.phase, 3);
  c.king.hp = 5;
  const kp = c.king.pos;
  c.hit(new THREE.Vector3(kp.x - 3, kp.y + 1.8, kp.z), new THREE.Vector3(1, 0, 0), 6, 10, ctx);
  assert.equal(killed, 'king'); assert.equal(c.king, null);
});

test('casa propia y fiestas pedidas por el señor', () => {
  const w = new World('voxelia'); let plan = null;
  for (let rx = -2; rx <= 2 && !plan; rx++) for (let rz = -2; rz <= 2 && !plan; rz++) { const p = villagePlan(w, rx, rz); if (p && p.slots.length > 1) plan = p; }
  const rec = initialRecord(w, plan);
  const before = allHouses(plan, rec).length;
  rec.playerSlot = 0; rec.built.push(0);
  assert.equal(allHouses(plan, rec).length, before, 'la casa del jugador no la ocupan los aldeanos');
  rec.built = []; rec.build = null;
  planBuild(plan, rec);
  assert.equal(rec.build?.slot, 0, 'primero construyen la casa del jugador');
  rec.forceFestival = 7;
  assert.ok(isFestival(plan, 7, rec));
});
