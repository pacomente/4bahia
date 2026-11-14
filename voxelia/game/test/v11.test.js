import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threats, assign, fight, blocks, GUARD_HP } from '../src/guards.js';

const P = (x, z) => ({ x, y: 40, z });
const plan = { x: 0, z: 0, radius: 30 };
const zombie = (x, z, extra = {}) => ({ pos: P(x, z), hp: 12, cooldown: 1, dead: false, ...extra });
const guard = (x, z) => ({ pos: P(x, z), heading: 0, phase: 0, swing: -1, block: 0, hp: GUARD_HP, maxHp: GUARD_HP });

test('amenazas: lo más urgente es el enemigo pegado a un vecino', () => {
  const near = zombie(5, 5); const far = zombie(25, 0);
  const civ = [{ pos: P(6, 5), hidden: false }];
  const list = threats(plan, [near, far, zombie(200, 0)], civ, null);
  assert.equal(list.length, 2, 'los de muy lejos no cuentan');
  const top = list.sort((a, b) => b.score - a.score)[0];
  assert.equal(top.z, near);
  // Un jefe saqueador es más peligroso que un zombi a la misma distancia.
  const boss = { ...zombie(10, 0), isBandit: true, kind: 'leader', max: 40, hp: 40 };
  const l2 = threats(plan, [zombie(10, 1), boss], [], null).sort((a, b) => b.score - a.score);
  assert.equal(l2[0].z, boss);
});

test('reparto: no se amontonan todos sobre el mismo enemigo; al jefe van varios', () => {
  const z1 = zombie(5, 0); const z2 = zombie(-5, 0);
  const gs = [guard(4, 0), guard(3, 0), guard(-3, 0)];
  assign(gs, threats(plan, [z1, z2], [], null));
  assert.ok(gs.some((g) => g.foe === z1) && gs.some((g) => g.foe === z2), 'cubren a los dos');
  const boss = { ...zombie(5, 0), isBandit: true, kind: 'leader', hp: 40, max: 40 };
  const gs2 = [guard(4, 0), guard(6, 0), guard(5, 2)];
  assign(gs2, threats(plan, [boss], [], null));
  assert.equal(gs2.filter((g) => g.foe === boss).length, 3, 'tres guardias rodean al jefe');
  assert.deepEqual(new Set(gs2.map((g) => g.slot)), new Set([0, 1, 2]), 'cada uno toma un lado distinto');
});

test('pelea: levanta el escudo cuando el enemigo va a pegar y después contraataca fuerte', () => {
  const z = zombie(1.5, 0, { cooldown: 0.2 });
  const g = guard(0, 0); g.foe = z; g.foeKind = 'zombie';
  for (let k = 0; k < 10; k++) fight(g, plan, 0.02, {}, k * 0.02);
  assert.ok(g.block > 0.8, 'escudo arriba');
  assert.ok(blocks(g, z.pos), 'frena el golpe de frente');
  assert.ok(!blocks(g, P(-2, 0)), 'por la espalda no');
  // El enemigo pegó: su enfriamiento sube. El guardia aprovecha con un contraataque.
  z.cooldown = 1.0;
  let hits = []; const ctx = { hitZombie: (zz, dmg, e, push) => hits.push({ dmg, push }) };
  for (let k = 0; k < 40; k++) fight(g, plan, 0.02, ctx, k * 0.02);
  assert.ok(hits.length >= 1, 'pegó');
  assert.ok(hits[0].dmg >= 6, `contraataque fuerte (${hits[0].dmg})`);
  assert.ok(Math.hypot(hits[0].push.x, hits[0].push.z) > 1, 'empuja');
});

test('pelea: contra un arquero carga con el escudo en alto', () => {
  const archer = { ...zombie(12, 0), isBandit: true, kind: 'archer' };
  const g = guard(0, 0); g.foe = archer; g.foeKind = 'archer';
  let r = null;
  for (let k = 0; k < 15; k++) r = fight(g, plan, 0.03, {}, k * 0.03);
  assert.ok(g.block > 0.8, 'cubierto');
  assert.ok(r && r.speed > 3, 'corre hacia el arquero');
});

test('combo: cada tercer tajo es pesado', () => {
  const z = zombie(1.5, 0, { cooldown: 5 });
  const g = guard(0, 0); g.foe = z; g.foeKind = 'zombie';
  const dmgs = []; const ctx = { hitZombie: (zz, dmg) => dmgs.push(dmg) };
  for (let k = 0; k < 400 && dmgs.length < 3; k++) { z.cooldown = 5; fight(g, plan, 0.02, ctx, k * 0.02); }
  assert.deepEqual(dmgs, [4, 4, 6]);
});

// ───────── Caminos (A*) ─────────
import { findPath, navigate, navFrame } from '../src/pathfind.js';
import { B } from '../src/blocks.js';
import * as THREE from 'three';

// Mundo de prueba: piso en y=9, pared de x=5 de z=-10 a z=10 con un hueco en z=8; agua en x=-3.
function testWorld(extra = {}) {
  return {
    getBlock(x, y, z) {
      const k = `${x},${y},${z}`;
      if (k in extra) return extra[k];
      if (y <= 9) return x === -3 && y === 9 ? B.WATER : B.STONE;
      if (x === 5 && z >= -10 && z <= 10 && z !== 8 && y <= 12) return B.STONE;
      return B.AIR;
    },
  };
}

test('caminos: rodea una pared por el hueco', () => {
  const w = testWorld();
  const r = findPath(w, { x: 2.5, y: 10, z: 0.5 }, { x: 8.5, y: 10, z: 0.5 });
  assert.ok(r.complete, 'llega');
  assert.ok(r.pts.some((p) => Math.abs(p.z - 8.5) < 1.5), 'pasa por el hueco');
  for (const p of r.pts) assert.ok(!(Math.floor(p.x) === 5 && Math.floor(p.z) !== 8), 'no atraviesa la pared');
});

test('caminos: las puertas cerradas solo se cruzan si son el destino; no se mete al agua', () => {
  const extra = { '5,10,8': B.DOOR, '5,11,8': B.DOOR };
  const w = testWorld(extra);
  const r = findPath(w, { x: 2.5, y: 10, z: 0.5 }, { x: 8.5, y: 10, z: 0.5 }, { maxNodes: 400 });
  assert.ok(!r.pts.some((p) => Math.floor(p.x) === 5 && Math.floor(p.z) === 8), 'no cruza la puerta cerrada (da la vuelta)');
  const r2 = findPath(w, { x: 2.5, y: 10, z: 0.5 }, { x: 5.5, y: 10, z: 8.5 });
  assert.ok(r2.complete, 'pero puede llegar a la puerta para abrirla');
  const r3 = findPath(testWorld(), { x: -1.5, y: 10, z: 0.5 }, { x: -5.5, y: 10, z: 0.5 }, { maxNodes: 300 });
  for (const p of r3.pts) assert.notEqual(Math.floor(p.x), -3, 'no pisa el agua');
});

test('caminos: un aldeano llega al otro lado de la pared caminando', () => {
  const w = testWorld();
  const e = { pos: new THREE.Vector3(2.5, 10, 0.5), heading: 0, vy: 0, stuck: 0, side: 1 };
  for (let k = 0; k < 900; k++) { navFrame(); navigate(w, e, { x: 8.5, z: 0.5 }, 3, 0.05); if (Math.hypot(e.pos.x - 8.5, e.pos.z - 0.5) < 0.5) break; }
  assert.ok(Math.hypot(e.pos.x - 8.5, e.pos.z - 0.5) < 1, `llegó (${e.pos.x.toFixed(1)}, ${e.pos.z.toFixed(1)})`);
});
