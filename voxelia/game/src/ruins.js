import { B } from './blocks.js';
import { I } from './items.js';
import { CS, SEA, hash3 } from './world.js';
import { villagesNear } from './villages.js';

// ───────── Ruinas para explorar ─────────
// Una por región (como mucho): torre abandonada (praderas, bosques, nieve), templo de arenisca
// (desierto y cañones) o mina abandonada con rieles (montañas y bosques). Todas guardan un cofre
// con botín y, a veces, un mapa del tesoro.
export const RUIN_REGION = 160;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const KIND_BY_BIOME = { plains: 'tower', forest: 'tower', snow: 'tower', swamp: 'tower', jungle: 'temple', desert: 'temple', canyon: 'temple', mountains: 'mine' };
const NAMES = { tower: ['Torre del Vigía', 'Torre Caída', 'Atalaya Olvidada'], temple: ['Templo del Sol', 'Templo de las Arenas', 'Santuario del Ojo'], mine: ['Mina Vieja', 'Socavón del Enano', 'Mina de los Lamentos'] };

export function ruinPlan(world, rx, rz) {
  const cache = world._ruins ?? (world._ruins = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  const r = rng(Math.floor(hash3(world.seed, rx, 6161, rz) * 4294967296));
  if (r() < 0.7) {
    for (let t = 0; t < 12 && !plan; t++) {
      const x = rx * RUIN_REGION + 20 + Math.floor(r() * (RUIN_REGION - 40));
      const z = rz * RUIN_REGION + 20 + Math.floor(r() * (RUIN_REGION - 40));
      const y = world.heightAt(x, z);
      if (y <= SEA + 1) continue;
      const kind = KIND_BY_BIOME[world.biome(x, z)];
      if (!kind) continue;
      // Terreno: la torre y el templo necesitan algo de llano; la mina, una ladera.
      let lo = Infinity; let hi = -Infinity;
      for (let dx = -5; dx <= 5; dx += 5) for (let dz = -5; dz <= 5; dz += 5) { const h = world.heightAt(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (kind !== 'mine' && hi - lo > 4) continue;
      if (lo <= SEA) continue;
      if (villagesNear(world, x, z, 30).length) continue;
      const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
      plan = { id: `r${rx}_${rz}`, kind, x, z, y, dir, name: NAMES[kind][Math.floor(r() * 3)], map: r() < 0.6, seed: Math.floor(r() * 1e9) };
    }
  }
  cache.set(key, plan);
  return plan;
}

export function ruinsNear(world, x, z, dist = 0) {
  const out = [];
  for (let rx = Math.floor((x - 30 - dist) / RUIN_REGION); rx <= Math.floor((x + 30 + dist) / RUIN_REGION); rx++) {
    for (let rz = Math.floor((z - 30 - dist) / RUIN_REGION); rz <= Math.floor((z + 30 + dist) / RUIN_REGION); rz++) {
      const p = ruinPlan(world, rx, rz);
      if (p && Math.hypot(p.x - x, p.z - z) <= 24 + dist) out.push(p);
    }
  }
  return out;
}

// Bloques de cada ruina (de abajo hacia arriba). `chest`: dónde queda el cofre del botín.
export function ruinBlocks(world, p) {
  if (p._blocks) return p._blocks;
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const r = rng(p.seed);
  if (p.kind === 'tower') {
    // Torre redonda de piedra con musgo, medio derrumbada, con escalera de bloques adentro.
    const y0 = p.y; const H = 12;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 3.4) continue;
      const g = world.heightAt(p.x + dx, p.z + dz);
      for (let y = g + 1; y < y0; y++) put(p.x + dx, y, p.z + dz, B.COBBLE);
      put(p.x + dx, y0, p.z + dz, B.COBBLE);
      for (let y = y0 + 1; y <= y0 + H; y++) put(p.x + dx, y, p.z + dz, B.AIR);
      if (d >= 2.4) {
        // Pared: más baja de un lado (derrumbe), con ventanas.
        const top = y0 + H - Math.floor((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2) * 6) - (r() < 0.3 ? 2 : 0);
        for (let y = y0 + 1; y <= top; y++) {
          const window = (y - y0) % 4 === 2 && (dx === 0 || dz === 0);
          put(p.x + dx, y, p.z + dz, window ? B.AIR : r() < 0.45 ? B.MOSSY_COBBLE : B.COBBLE);
        }
      }
    }
    // Puerta y escalera en espiral.
    for (let y = y0 + 1; y <= y0 + 2; y++) put(p.x + p.dir[0] * 3, y, p.z + p.dir[1] * 3, B.AIR);
    const spiral = [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
    for (let k = 0; k < 8; k++) { const [sx, sz] = spiral[k]; put(p.x + sx, y0 + 1 + k, p.z + sz, B.PLANKS); }
    // Piso de arriba (con agujero) y el cofre.
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dx, dz) <= 2.3 && !(dx === 0 && dz === -1)) put(p.x + dx, y0 + 9, p.z + dz, B.PLANKS);
    put(p.x, y0 + 10, p.z, B.LOOT_CHEST); put(p.x + 1, y0 + 10, p.z, B.TORCH);
    p.chest = { x: p.x, y: y0 + 10, z: p.z };
    for (let k = 0; k < 6; k++) { const a = r() * 6.28; const d = 4 + r() * 3; const x = Math.round(p.x + Math.cos(a) * d); const z = Math.round(p.z + Math.sin(a) * d); put(x, world.heightAt(x, z) + 1, z, r() < 0.5 ? B.MOSSY_COBBLE : B.COBBLE); }
  } else if (p.kind === 'temple') {
    // Pirámide escalonada de arenisca con una sala escondida abajo.
    const y0 = p.y;
    for (let lvl = 0; lvl < 6; lvl++) {
      const rad = 7 - lvl;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (lvl === 0) { const g = world.heightAt(p.x + dx, p.z + dz); for (let y = g + 1; y < y0; y++) put(p.x + dx, y, p.z + dz, B.SANDSTONE); }
        const edge = Math.abs(dx) === rad || Math.abs(dz) === rad;
        put(p.x + dx, y0 + lvl, p.z + dz, edge && (dx + dz) % 4 === 0 ? B.CHISELED_SANDSTONE : B.SANDSTONE);
      }
    }
    // Entrada: pasillo desde el frente hasta el centro, y la sala de abajo.
    const [fx, fz] = p.dir;
    for (let k = 0; k <= 7; k++) for (let y = y0 + 1; y <= y0 + 2; y++) put(p.x + fx * k, y, p.z + fz * k, B.AIR);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = y0 - 4; y <= y0 - 1; y++) put(p.x + dx, y, p.z + dz, Math.abs(dx) === 2 || Math.abs(dz) === 2 || y === y0 - 4 ? B.CHISELED_SANDSTONE : B.AIR);
    put(p.x, y0, p.z, B.AIR); put(p.x, y0 - 1, p.z, B.AIR);   // agujero al tesoro
    put(p.x + 1, y0 - 3, p.z + 1, B.LOOT_CHEST); put(p.x - 1, y0 - 3, p.z - 1, B.TORCH); put(p.x + 1, y0 - 3, p.z - 1, B.TORCH);
    p.chest = { x: p.x + 1, y: y0 - 3, z: p.z + 1 };
    put(p.x, y0 + 6, p.z, B.LAMP);
  } else {
    // Mina: entrada con vigas de madera en la ladera y un túnel con rieles que baja hasta un cofre.
    const [fx, fz] = p.dir; const px = -fz; const pz = fx;
    let y = p.y;
    for (let k = 0; k < 26; k++) {
      const cx = p.x + fx * k; const cz = p.z + fz * k;
      if (k > 2 && k % 2 === 0 && y > 14) y--;   // baja de a poco
      for (let w = -1; w <= 1; w++) {
        const x = cx + px * w; const z = cz + pz * w;
        put(x, y, z, k % 5 === 0 ? B.PLANKS : B.GRAVEL);
        for (let h = 1; h <= 3; h++) put(x, y + h, z, B.AIR);
        if (k % 5 === 0) { if (w !== 0) { put(x, y + 1, z, B.LOG); put(x, y + 2, z, B.LOG); } put(x, y + 3, z, B.PLANKS); }
      }
      put(cx, y + 1, cz, B.RAIL);
      if (k % 10 === 5) put(cx + px, y + 2, cz + pz, B.TORCH);
    }
    const ex = p.x + fx * 26; const ez = p.z + fz * 26;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { put(ex + dx, y, ez + dz, B.GRAVEL); for (let h = 1; h <= 3; h++) put(ex + dx, y + h, ez + dz, B.AIR); }
    put(ex, y + 1, ez, B.LOOT_CHEST); put(ex + 1, y + 1, ez, B.BARREL); put(ex - 1, y + 1, ez, B.TORCH);
    for (let k = 0; k < 6; k++) put(ex + Math.floor(r() * 5) - 2, y + 3, ez + Math.floor(r() * 5) - 2, r() < 0.5 ? B.IRON : B.GOLD_ORE);
    p.chest = { x: ex, y: y + 1, z: ez };
  }
  p._blocks = out;
  return out;
}

export function placeRuins(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const p of ruinsNear(world, x0 + CS / 2, z0 + CS / 2, CS + 20)) {
    for (const b of ruinBlocks(world, p)) {
      const lx = b.x - x0; const lz = b.z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || b.y < 1 || b.y >= 96) continue;
      chunk.set(lx, b.y, lz, b.id);
    }
  }
}

// Botín de una ruina (y si trae mapa del tesoro).
export function ruinLoot(p, r = Math.random) {
  const loot = { [I.SILVER]: 10 + Math.floor(r() * 20), [I.IRON]: 1 + Math.floor(r() * 4), [I.COAL]: 2 + Math.floor(r() * 5) };
  if (p.kind === 'temple') { loot[I.GOLD] = 2 + Math.floor(r() * 3); loot[I.CRYSTAL] = 1 + Math.floor(r() * 2); }
  if (p.kind === 'mine') { loot[I.IRON] += 3; loot[I.GOLD] = 1 + Math.floor(r() * 2); }
  if (p.kind === 'tower') { loot[I.ARROW] = 8; loot[I.BREAD] = 2; }
  if (p.map) loot[I.TREASURE_MAP] = 1;
  return loot;
}

// Tesoro enterrado de un mapa: un lugar en tierra firme a unos cientos de bloques de la ruina.
export function treasureSpot(world, p) {
  const r = rng(p.seed + 77);
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2; const d = 120 + r() * 220;
    const x = Math.round(p.x + Math.cos(a) * d); const z = Math.round(p.z + Math.sin(a) * d);
    if (world.heightAt(x, z) > SEA + 1 && !villagesNear(world, x, z, 10).length) return { x, z, from: p.name };
  }
  return { x: p.x + 100, z: p.z, from: p.name };
}
export function buriedTreasure(r = Math.random) {
  return { [I.GOLD]: 4 + Math.floor(r() * 4), [I.SILVER]: 40 + Math.floor(r() * 40), [I.PEARL]: 2 + Math.floor(r() * 3), [I.CRYSTAL]: 2 + Math.floor(r() * 3) };
}
