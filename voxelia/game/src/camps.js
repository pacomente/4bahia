import { B } from './blocks.js';
import { CS, SEA, hash3 } from './world.js';
import { villagesNear } from './villages.js';

// ───────── Campamentos de saqueadores ─────────
// Las "aldeas malas": empalizada de troncos, carpas negras y rojas, fogata, torre de vigilancia,
// jaulas con prisioneros y el cofre del botín. Se ubican en su propia grilla de regiones,
// lejos de las aldeas buenas.
export const CAMP_REGION = 176;
const CAMP_R = 12;          // radio de la empalizada

const NAMES = ['Los Lobos Negros', 'La Garra Roja', 'Los Cuervos', 'Colmillo de Hierro', 'La Hiena', 'Los Sin Bandera', 'Sombra Roja'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function campPlan(world, rx, rz) {
  const cache = world._camps ?? (world._camps = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  const r = rng(Math.floor(hash3(world.seed, rx, 9191, rz) * 4294967296));
  // Cerca del inicio siempre hay uno (a una caminata, no encima).
  const home = (rx === 0 || rx === -1) && (rz === 0 || rz === -1);
  const tries = home ? 60 : r() < 0.6 ? 12 : 0;
  for (let t = 0; t < tries && !plan; t++) {
    const x = rx * CAMP_REGION + 30 + Math.floor(r() * (CAMP_REGION - 60));
    const z = rz * CAMP_REGION + 30 + Math.floor(r() * (CAMP_REGION - 60));
    if (home && Math.hypot(x, z) < 110) continue;
    const y = world.heightAt(x, z);
    if (y <= SEA + 1 || y > SEA + 32) continue;
    let lo = Infinity; let hi = -Infinity;
    for (let dx = -CAMP_R; dx <= CAMP_R; dx += 3) for (let dz = -CAMP_R; dz <= CAMP_R; dz += 3) { const h = world.heightAt(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (hi - lo > 9 || lo <= SEA) continue;
    if (villagesNear(world, x, z, 40).length) continue;      // lejos de las aldeas buenas
    const a0 = r() * Math.PI * 2;
    const tents = [0, 1, 2, 3].map((k) => { const a = a0 + k * Math.PI / 2; return { x: Math.round(x + Math.cos(a) * 6.5), z: Math.round(z + Math.sin(a) * 6.5), along: Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'z' : 'x' }; });
    const between = (k, rad) => { const a = a0 + Math.PI / 4 + k * Math.PI / 2; return { x: Math.round(x + Math.cos(a) * rad), z: Math.round(z + Math.sin(a) * rad) }; };
    plan = {
      id: `c${rx}_${rz}`, rx, rz, x, z, y, name: NAMES[Math.floor(r() * NAMES.length)], radius: CAMP_R + 2,
      tents, tower: between(0, 8), cages: [between(1, 8), between(2, 8)], chest: between(3, 4), banner: between(3, 8),
      gates: [{ x, z: z - CAMP_R }, { x, z: z + CAMP_R }],
    };
  }
  cache.set(key, plan);
  return plan;
}

export function campsNear(world, x, z, dist = 0) {
  const out = [];
  const reach = CAMP_R + 4 + dist;
  for (let rx = Math.floor((x - reach) / CAMP_REGION); rx <= Math.floor((x + reach) / CAMP_REGION); rx++) {
    for (let rz = Math.floor((z - reach) / CAMP_REGION); rz <= Math.floor((z + reach) / CAMP_REGION); rz++) {
      const p = campPlan(world, rx, rz);
      if (p && Math.hypot(p.x - x, p.z - z) <= p.radius + dist) out.push(p);
    }
  }
  return out;
}

export const insideCamp = (world, x, z) => campsNear(world, x, z, 0).length > 0;

export function campBlocks(world, p) {
  if (p._blocks) return p._blocks;
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const y = p.y;
  // Terreno parejo: se despeja y se rellena dentro de la empalizada.
  for (let dx = -CAMP_R - 1; dx <= CAMP_R + 1; dx++) for (let dz = -CAMP_R - 1; dz <= CAMP_R + 1; dz++) {
    if (dx * dx + dz * dz > (CAMP_R + 1.5) ** 2) continue;
    const x = p.x + dx; const z = p.z + dz;
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, y); yy < y; yy++) put(x, yy, z, B.DIRT);
    put(x, y, z, (dx * 7 + dz * 3) % 5 === 0 ? B.GRAVEL : B.DIRT);   // tierra pisoteada
    for (let yy = y + 1; yy <= y + 9; yy++) put(x, yy, z, B.AIR);
  }
  // Empalizada de troncos con puntas, y dos portones.
  for (let k = 0; k < 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    const x = Math.round(p.x + Math.cos(a) * CAMP_R); const z = Math.round(p.z + Math.sin(a) * CAMP_R);
    if (p.gates.some((g) => Math.abs(g.x - x) <= 1 && Math.abs(g.z - z) <= 1)) continue;
    for (let yy = y + 1; yy <= y + 3; yy++) put(x, yy, z, B.LOG);
    if ((x + z) % 2 === 0) put(x, y + 4, z, B.LOG);
  }
  for (const g of p.gates) { for (const dx of [-2, 2]) { for (let yy = y + 1; yy <= y + 5; yy++) put(g.x + dx, yy, g.z, B.LOG); put(g.x + dx, y + 6, g.z, B.TORCH); } }
  // Fogata en el centro, rodeada de piedras.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(p.x + dx, y, p.z + dz, dx || dz ? B.COBBLE : B.COBBLE);
  put(p.x, y + 1, p.z, B.CAMPFIRE);
  // Carpas: tela negra y roja en forma de A.
  for (const t of p.tents) {
    for (let i = -2; i <= 2; i++) for (let h = 0; h <= 2; h++) for (const side of [-1, 1]) {
      const off = (2 - h) * side;
      const [x, z] = t.along === 'x' ? [t.x + i, t.z + off] : [t.x + off, t.z + i];
      put(x, y + 1 + h, z, (i + 2) % 2 ? B.WOOL_RED : B.WOOL_BLACK);
    }
    // La entrada queda abierta en un extremo.
    const [ex, ez] = t.along === 'x' ? [t.x - 2, t.z] : [t.x, t.z - 2];
    for (let h = 0; h <= 1; h++) put(ex, y + 1 + h, ez, B.AIR);
  }
  // Torre de vigilancia: cuatro postes, plataforma y antorchas.
  const tw = p.tower;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let yy = y + 1; yy <= y + 6; yy++) put(tw.x + dx, yy, tw.z + dz, B.LOG);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(tw.x + dx, y + 7, tw.z + dz, B.PLANKS);
  put(tw.x, y + 8, tw.z, B.TORCH);
  // Jaulas: barrotes alrededor de una celda, con techo.
  for (const c of p.cages) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      put(c.x + dx, y, c.z + dz, B.COBBLE);
      for (let yy = y + 1; yy <= y + 2; yy++) put(c.x + dx, yy, c.z + dz, dx || dz ? B.BARS : B.AIR);
      put(c.x + dx, y + 3, c.z + dz, B.PLANKS);
    }
  }
  // Bandera y cofre del botín.
  for (let yy = y + 1; yy <= y + 6; yy++) put(p.banner.x, yy, p.banner.z, B.LOG);
  put(p.banner.x + 1, y + 6, p.banner.z, B.WOOL_BLACK); put(p.banner.x + 1, y + 5, p.banner.z, B.WOOL_RED); put(p.banner.x + 2, y + 6, p.banner.z, B.WOOL_BLACK); put(p.banner.x + 2, y + 5, p.banner.z, B.WOOL_BLACK);
  put(p.chest.x, y + 1, p.chest.z, B.LOOT_CHEST);
  p._blocks = out;
  return out;
}

export function placeCamps(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const p of campsNear(world, x0 + CS / 2, z0 + CS / 2, CS)) {
    for (const b of campBlocks(world, p)) {
      const lx = b.x - x0; const lz = b.z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || b.y < 0 || b.y >= 96) continue;
      chunk.set(lx, b.y, lz, b.id);
    }
  }
}

// Botín del cofre (se lleva al romperlo).
export function lootTable(r = Math.random) {
  return { 131: 25 + Math.floor(r() * 30), 152: 1 + Math.floor(r() * 3), 102: 2 + Math.floor(r() * 4), 103: Math.floor(r() * 3), 129: 8 + Math.floor(r() * 10), 133: 2 + Math.floor(r() * 4) };
}
