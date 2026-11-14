import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/blocks.js';
import { World, CS } from '../src/world.js';
import { villagePlan, villageBlocks, furnish } from '../src/villages.js';
import { initialRecord, villageDawn, neededProfession, PROFESSIONS } from '../src/villagers.js';
import { routesNear, routePoints, linksOf } from '../src/roads.js';
import { tradeGoods, applyTrade } from '../src/caravans.js';
import { SPECIES } from '../src/animals.js';
import { RECIPES } from '../src/recipes.js';

const plans = (seed) => { const w = new World(seed); const out = []; for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) { const p = villagePlan(w, rx, rz); if (p) out.push(p); } return { w, out }; };

test('aldeas con iglesia, escuela y corral', () => {
  let church = 0; let school = 0; let pen = 0; let total = 0;
  for (const seed of ['voxelia', 'mares', 'isla']) {
    const { w, out } = plans(seed);
    for (const p of out) {
      total++;
      if (p.church) {
        church++;
        assert.equal(p.church.seats.length, 12, 'doce lugares en los bancos');
        const ids = villageBlocks(w, p).map((b) => b.id);
        for (const id of [B.ALTAR, B.PEW, B.BELL, B.STAINED_GLASS]) assert.ok(ids.includes(id), `la iglesia tiene ${BLOCKS[id].name}`);
      }
      if (p.school) {
        school++;
        const fu = furnish(p.school);
        assert.equal(fu.kind, 'school');
        assert.ok(fu.chairs.length >= 3 && fu.items.some((i) => i.id === B.BLACKBOARD), 'pupitres y pizarrón');
        assert.equal(p.school.beds.length, 0, 'en la escuela no se duerme');
      }
      if (p.pen) { pen++; assert.ok(villageBlocks(w, p).some((b) => b.id === B.FENCE), 'el corral tiene cerca'); }
      // Ningún edificio se pisa con otro.
      const bs = [...p.houses, ...p.slots, p.castle, p.church, p.school].filter(Boolean);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) assert.ok(Math.abs(bs[i].x - bs[j].x) >= 7 || Math.abs(bs[i].z - bs[j].z) >= 7, 'edificios separados');
    }
  }
  assert.ok(church > total * 0.6 && school > total * 0.6 && pen > total * 0.4, `iglesias ${church}, escuelas ${school}, corrales ${pen} de ${total}`);
});

test('oficios nuevos: sacerdote y maestra; los chicos tienen escuela', () => {
  const { w, out } = plans('isla');
  const p = out.find((x) => x.church && x.school && x.houses.length >= 5) ?? out.find((x) => x.church);
  const rec = initialRecord(w, p);
  assert.ok(PROFESSIONS.priest && PROFESSIONS.teacher);
  const profs = rec.villagers.map((v) => v.prof);
  if (rec.villagers.length >= 7) assert.ok(profs.includes('priest'), profs.join(','));
  assert.ok(rec.villagers.every((v) => v.silver > 0), 'todos tienen plata');
  // Si falta quien atienda, un granjero cambia de oficio al amanecer.
  const r2 = { ...rec, villagers: rec.villagers.map((v) => ({ ...v, prof: v.prof === 'priest' || v.prof === 'teacher' ? 'farmer' : v.prof })) };
  r2.villagers.push({ ...r2.villagers[1], id: 99, prof: 'farmer', name: 'Extra' }, { ...r2.villagers[1], id: 98, prof: 'farmer', name: 'Extra2' });
  const ev = villageDawn(p, r2, () => 0.99);
  assert.ok(ev.some((e) => e.type === 'newjob'));
  assert.ok(neededProfession(p, { villagers: [] }) === 'builder');
});

test('plata: jornales, impuestos del rey y tesoro', () => {
  const { w, out } = plans('voxelia');
  const p = out[0]; const rec = initialRecord(w, p);
  const before = rec.villagers.reduce((s, v) => s + v.silver, 0) + rec.treasury;
  const ev = villageDawn(p, rec, () => 0.99);
  const tax = ev.find((e) => e.type === 'taxes');
  assert.ok(tax && tax.n > 0, 'el rey cobra impuestos');
  assert.ok(rec.treasury > 0);
  const after = rec.villagers.reduce((s, v) => s + v.silver, 0) + rec.treasury;
  assert.ok(after >= before, 'los jornales agregan plata a la aldea');
});

test('caminos entre aldeas con puntos transitables', () => {
  let found = null;
  for (const seed of ['voxelia', 'mares', 'isla']) {
    const w = new World(seed);
    const r = routesNear(w, 0, 0, 500);
    if (r.length) { found = { w, r: r[0] }; break; }
  }
  assert.ok(found, 'hay al menos un camino');
  const { w, r } = found;
  assert.ok(linksOf(w, r.a).length > 0);
  const pts = routePoints(w, r);
  assert.ok(pts.length > 20);
  for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) < 1.5);
  // En el medio del camino hay grava (o un puente de tablas).
  const mid = pts[Math.floor(pts.length / 2)];
  const cx = Math.floor(mid.x / CS); const cz = Math.floor(mid.z / CS);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) w.generate(cx + dx, cz + dz);
  let road = 0;
  for (const p of pts.slice(Math.floor(pts.length * 0.4), Math.floor(pts.length * 0.6))) {
    if (!w.getChunk(Math.floor(p.x / CS), Math.floor(p.z / CS))) continue;
    const id = w.getBlock(Math.floor(p.x), p.y - 1, Math.floor(p.z));
    if (id === B.GRAVEL || id === B.COBBLE || id === B.PLANKS) road++;
  }
  assert.ok(road > 0, 'bloques de camino');
});

test('carretas: llevan lo que sobra a donde falta y se paga en plata', () => {
  const a = { stock: { food: 30, wood: 10, stone: 10 }, treasury: 20 };
  const b = { stock: { food: 4, wood: 10, stone: 10 }, treasury: 20 };
  const g = tradeGoods(a, b);
  assert.equal(g.kind, 'food');
  applyTrade(a, b, g);
  assert.ok(b.stock.food > 4 && a.stock.food < 30);
  assert.ok(a.treasury > 20 && b.treasury < 20);
  assert.equal(tradeGoods({ stock: { food: 5, wood: 5, stone: 5 } }, { stock: { food: 5, wood: 5, stone: 5 } }), null, 'sin sobrantes no viaja nada');
});

test('caballos, gallinas, bloques y recetas nuevas', () => {
  assert.ok(SPECIES.horse.ride && SPECIES.chicken.hop);
  for (const id of [B.FENCE, B.BELL, B.PEW, B.ALTAR, B.BLACKBOARD, B.STAINED_GLASS, B.TROUGH]) {
    assert.ok(BLOCKS[id]?.name, `bloque ${id}`);
    assert.ok(RECIPES.some((r) => r.out[id]), `receta de ${BLOCKS[id].name}`);
  }
});
