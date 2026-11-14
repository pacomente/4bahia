import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { B } from '../src/blocks.js';
import { I } from '../src/items.js';
import { World, SEA } from '../src/world.js';
import { ruinPlan, ruinBlocks, ruinLoot, treasureSpot, buriedTreasure } from '../src/ruins.js';
import { lairPlan, Creatures } from '../src/creatures.js';
import { SPECIES } from '../src/animals.js';

test('biomas nuevos: pantano, selva y cañones existen', () => {
  const found = new Set();
  for (const seed of ['voxelia', 'mares', 'isla']) {
    const w = new World(seed);
    for (let x = -1500; x <= 1500; x += 30) for (let z = -1500; z <= 1500; z += 30) found.add(w.biome(x, z));
  }
  for (const b of ['swamp', 'jungle', 'canyon', 'plains', 'forest', 'desert', 'snow', 'mountains']) assert.ok(found.has(b), b);
});

test('ruinas: torres, templos y minas con cofre; el mapa lleva a un tesoro en tierra', () => {
  const kinds = new Set(); let checked = 0;
  for (const seed of ['voxelia', 'mares', 'isla']) {
    const w = new World(seed);
    for (let rx = -4; rx <= 4; rx++) for (let rz = -4; rz <= 4; rz++) {
      const p = ruinPlan(w, rx, rz); if (!p) continue;
      kinds.add(p.kind);
      if (checked < 6) {
        const blocks = ruinBlocks(w, p);
        assert.ok(blocks.some((b) => b.id === B.LOOT_CHEST), `${p.name} tiene cofre`);
        assert.ok(p.chest, 'sabe dónde está el cofre');
        const spot = treasureSpot(w, p);
        assert.ok(w.heightAt(spot.x, spot.z) > SEA + 1, 'el tesoro está en tierra firme');
        checked++;
      }
    }
  }
  for (const k of ['tower', 'temple', 'mine']) assert.ok(kinds.has(k), k);
  assert.equal(ruinLoot({ kind: 'temple', map: true }, () => 0.5)[I.TREASURE_MAP], 1);
  assert.ok(buriedTreasure(() => 0.5)[I.GOLD] >= 4);
});

test('guaridas del dragón en las montañas', () => {
  let lair = null;
  for (const seed of ['voxelia', 'mares', 'isla']) { const w = new World(seed); for (let rx = -2; rx <= 2 && !lair; rx++) for (let rz = -2; rz <= 2 && !lair; rz++) { const l = lairPlan(w, rx, rz); if (l) lair = { w, l }; } if (lair) break; }
  assert.ok(lair, 'hay alguna guarida');
  assert.equal(lair.w.biome(lair.l.x, lair.l.z), 'mountains');
});

test('dragón y serpiente: se pueden vencer y sueltan su trofeo', () => {
  const w = { getBlock: () => 0, heightAt: () => 40, biome: () => 'plains', seed: 1 };
  const sound = { tone() {}, noise() {} };
  const c = new Creatures(new THREE.Scene(), w, sound);
  c.dragon = { mesh: c.buildDragon(), lair: { id: 'd0', x: 0, y: 60, z: 0 }, hp: 10, max: 180, ang: 0, t: 0, state: 'circle', attackT: 3, aggro: false, flash: 0 };
  c.dragon.mesh.position.set(0, 50, 10);
  const killed = [];
  const hit = c.hit(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, 0, 1), 20, 12, { onKilled: (k) => killed.push(k) });
  assert.ok(hit && killed.includes('dragon') && !c.dragon);
  c.spawnSerpent(new THREE.Vector3(0, 32, 0));
  c.serpent.hp = 3;
  const seg = c.serpent.segs[0].position;
  c.hit(new THREE.Vector3(seg.x, seg.y, seg.z - 3), new THREE.Vector3(0, 0, 1), 6, 6, { onKilled: (k) => killed.push(k) });
  assert.ok(killed.includes('serpent') && !c.serpent);
});

test('lobos salvajes y loros', () => {
  assert.ok(SPECIES.wolf.hostile && SPECIES.wolf.hp >= 6);
  assert.ok(SPECIES.parrot.hop);
});
