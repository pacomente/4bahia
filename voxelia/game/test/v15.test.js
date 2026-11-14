import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { villagePlan } from '../src/villages.js';
import { initialRecord, villageDawn, neededProfession, PROFESSIONS, TRADES } from '../src/villagers.js';
import { makeRequest, relation, isFestival, successor, gossipLine, BOOKS } from '../src/society.js';
import { linksOf } from '../src/roads.js';
import { SHOPS } from '../src/economy.js';

const plans = (seed) => { const w = new World(seed); const out = []; for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) { const p = villagePlan(w, rx, rz); if (p) out.push(p); } return { w, out }; };

test('oficios nuevos: panadero, médico, cartógrafo y bibliotecario', () => {
  for (const p of ['baker', 'doctor', 'cartographer', 'librarian']) { assert.ok(PROFESSIONS[p], p); assert.ok(SHOPS[p] || TRADES[p], `${p} comercia`); }
  const { w, out } = plans('isla');
  const p = out.find((x) => x.school) ?? out[0];
  const rec = initialRecord(w, p);
  while (rec.villagers.length < 11) rec.villagers.push({ ...rec.villagers[1], id: 500 + rec.villagers.length, name: `X${rec.villagers.length}`, prof: 'farmer' });
  assert.ok(['baker', 'doctor', 'librarian', 'cartographer', 'priest', 'teacher', 'woodcutter', 'fisher', 'sailor', 'farmer', 'guard'].includes(neededProfession(p, rec)));
});

test('encargos de cada vecino y memoria', () => {
  const q = makeRequest('baker', () => 0.1);
  assert.ok(q.text && q.n > 0 && q.reward > 0);
  assert.equal(makeRequest('king'), null, 'el rey tiene su propio encargo');
});

test('relaciones entre aldeas, fiestas y sucesión', () => {
  const { w, out } = plans('voxelia');
  const p = out[0]; const links = linksOf(w, p);
  for (const o of links) { const r = relation(w, p, o); assert.ok(['ally', 'rival', 'neutral'].includes(r)); assert.equal(r, relation(w, o, p), 'la relación es la misma de los dos lados'); }
  let fests = 0; for (let d = 0; d < 12; d++) if (isFestival(p, d)) fests++;
  assert.equal(fests, 2, 'una fiesta cada 6 días');
  const rec = initialRecord(w, p);
  rec.villagers = rec.villagers.filter((v) => v.prof !== 'king');
  const heir = successor(rec);
  assert.ok(heir && heir.age >= 2);
  const ev = villageDawn(p, rec, () => 0.99);
  assert.ok(ev.some((e) => e.type === 'king'), 'se corona un sucesor');
  assert.ok(rec.villagers.some((v) => v.prof === 'king'));
});

test('casamientos: una pareja nueva se casa al día siguiente', () => {
  const { w, out } = plans('mares');
  const p = out[0]; const rec = initialRecord(w, p);
  for (const v of rec.villagers) v.partner = null;
  villageDawn(p, rec, () => 0.1);
  assert.ok(rec.wedding && rec.wedding.day === rec.day + 1, 'hay casamiento programado');
});

test('chismes y libros', () => {
  assert.ok(gossipLine({ type: 'dragon' }).includes('dragón'));
  assert.ok(gossipLine({ type: 'wedding', a: 'Ana', b: 'Leo', village: 'X' }).includes('Ana'));
  assert.ok(BOOKS.length >= 5 && BOOKS.every(([t, body]) => t && body.length > 40));
});
