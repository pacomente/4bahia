import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { B, BLOCKS, LIGHT_BLOCKS } from '../src/blocks.js';
import { I } from '../src/items.js';
import { RECIPES, craft } from '../src/recipes.js';
import { MISSIONS, emptyStats, missionStatus } from '../src/missions.js';
import { World, CS } from '../src/world.js';
import { computeChunkLight } from '../src/light.js';
import { meshChunk } from '../src/mesher.js';
import { Animals } from '../src/animals.js';

function worldAround(seed = 'luz', r = 2) {
  const w = new World(seed);
  for (let cx = -r; cx <= r; cx++) for (let cz = -r; cz <= r; cz++) w.generate(cx, cz);
  return w;
}
// Cuarto cerrado de piedra con aire adentro, en y 60..66 (sobre el terreno no hay nada que moleste).
function room(w, x0, z0, size = 7, y0 = 60) {
  for (let x = x0 - 1; x <= x0 + size; x++) for (let z = z0 - 1; z <= z0 + size; z++) for (let y = y0 - 1; y <= y0 + 5; y++) {
    const wall = x === x0 - 1 || z === z0 - 1 || x === x0 + size || z === z0 + size || y === y0 - 1 || y === y0 + 5;
    w.setBlock(x, y, z, wall ? B.STONE : B.AIR);
  }
}

test('luz: una lámpara ilumina su cuarto, baja con la distancia y no atraviesa paredes', () => {
  const w = worldAround();
  room(w, 2, 2);
  w.setBlock(5, 61, 5, B.LAMP);
  const light = computeChunkLight(w, w.getChunk(0, 0));
  assert.ok(light, 'hay fuentes de luz en el chunk');
  assert.equal(light(5, 61, 5), 14);
  assert.equal(light(6, 61, 5), 13);
  assert.equal(light(8, 61, 5), 11);
  assert.ok(light(2, 60, 2) > 0, 'llega a la esquina del cuarto');
  assert.equal(light(5, 61, 11), 0, 'del otro lado de la pared no llega');
});

test('luz: cruza el borde del chunk y un chunk sin fuentes no la calcula', () => {
  const w = worldAround();
  room(w, 12, 3);                      // el cuarto ocupa x 12..18, cruza al chunk (1,0)
  w.setBlock(14, 61, 5, B.TORCH);
  const right = computeChunkLight(w, w.getChunk(1, 0));
  assert.equal(right(16, 61, 5), 11, 'la antorcha (13) ilumina 2 bloques adentro del chunk vecino');
  // Sin fuentes (se sacan los cristales naturales alrededor) no se calcula nada.
  for (let cx = -2; cx <= -1; cx++) for (let cz = -2; cz <= -1; cz++) { const d = w.getChunk(cx, cz).data; for (let i = 0; i < d.length; i++) if (LIGHT_BLOCKS.has(d[i])) d[i] = B.STONE; }
  assert.equal(computeChunkLight(w, w.getChunk(-2, -2)), null);
});

test('mesher: la luz de bloques llega a las caras como atributo por vértice', () => {
  const w = worldAround();
  room(w, 2, 2);
  w.setBlock(5, 60, 5, B.TORCH);
  const { opaque } = meshChunk(w, w.getChunk(0, 0));
  const em = opaque.getAttribute('emissive').array;
  const partial = [...em].filter((v) => v > 0.05 && v < 0.99).length;
  assert.ok(partial > 20, `caras con luz parcial: ${partial}`);
});

test('antorcha: barata, emite luz, no es sólida y repele Sombras', () => {
  const inv = { [I.COAL]: 1, [B.PLANKS]: 1 };
  assert.ok(craft(RECIPES.find((r) => r.id === 'torch'), inv));
  assert.equal(inv[B.TORCH], 4);
  assert.equal(BLOCKS[B.TORCH].solid, false);
  assert.ok(LIGHT_BLOCKS.has(B.TORCH) && LIGHT_BLOCKS.has(B.LAMP) && LIGHT_BLOCKS.has(B.FARO));
});

test('misiones: el número mostrado es el de la misión actual aunque se cumplan fuera de orden', () => {
  const s = emptyStats();
  s.collected[I.COAL] = 3;             // misión 4 cumplida antes que la 1
  const st = missionStatus(s);
  assert.equal(st.done, 1);
  assert.equal(st.number, 1);
  assert.equal(st.current.id, MISSIONS[0].id);
  s.placed[B.TORCH] = 1;
  assert.equal(MISSIONS.find((m) => m.id === 'lamp').progress(s), 1, 'una antorcha cuenta para iluminar el refugio');
});

test('Lanudos: aparecen sobre el suelo, caminan sin meterse al agua y al morir avisan', () => {
  const w = worldAround('lanudos', 2);
  // Pradera plana de pasto rodeada de agua.
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
    const edge = Math.max(Math.abs(x), Math.abs(z)) >= 5;
    for (let y = 40; y <= 95; y++) w.setBlock(x, y, z, y < 50 ? B.STONE : y === 50 ? (edge ? B.STONE : B.GRASS) : y === 51 && edge ? B.WATER : B.AIR);
  }
  const scene = new THREE.Scene();
  const a = new Animals(scene, w, { tone() {} });
  const lan = a.spawnAt(0.5, 0.5);
  assert.equal(lan.mesh.position.y, 51);
  const player = { pos: new THREE.Vector3(30, 60, 30) };
  a.spawnTimer = 1e9;
  for (let i = 0; i < 1200; i++) a.update(1 / 30, { player, daylight: 1 });
  const p = lan.mesh.position;
  assert.ok(Math.abs(p.x) < 5 && Math.abs(p.z) < 5, `sigue en la pradera: ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  assert.equal(p.y, 51);
  let killed = 0;
  const origin = new THREE.Vector3(p.x, p.y + 0.75, p.z - 2);
  for (let k = 0; k < 3 && a.list.length; k++) {
    const q = a.list[0].mesh.position; const dir = new THREE.Vector3(q.x, q.y + 0.75, q.z).sub(origin).normalize();
    assert.ok(a.hit(origin, dir, 4, 2, { onKilled: () => { killed++; } }));
  }
  assert.equal(killed, 1);
  assert.equal(a.list.length, 0);
});
