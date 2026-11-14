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
