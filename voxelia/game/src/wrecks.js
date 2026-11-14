import { B } from './blocks.js';
import { CS, SEA, hash3 } from './world.js';

// Barcos hundidos en el fondo del mar: casco de tablas y troncos, mástil roto con un jirón de vela
// y un cofre con tesoro (perlas, oro y plata). Uno por región, solo en agua profunda.
export const WRECK_REGION = 120;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function wreckPlan(world, rx, rz) {
  const cache = world._wrecks ?? (world._wrecks = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  const r = rng(Math.floor(hash3(world.seed, rx, 5151, rz) * 4294967296));
  if (r() < 0.6) {
    for (let t = 0; t < 10 && !plan; t++) {
      const x = rx * WRECK_REGION + 15 + Math.floor(r() * (WRECK_REGION - 30));
      const z = rz * WRECK_REGION + 15 + Math.floor(r() * (WRECK_REGION - 30));
      const y = world.heightAt(x, z);
      if (y > SEA - 7) continue;
      let ok = true;
      for (let k = -5; k <= 5 && ok; k += 5) if (world.heightAt(x + k, z) > SEA - 5 || world.heightAt(x, z + k) > SEA - 5) ok = false;
      if (ok) plan = { id: `w${rx}_${rz}`, x, z, y, along: r() < 0.5 ? 'x' : 'z', name: ['La Gaviota Perdida', 'El Tritón', 'La Esperanza', 'El Viejo Lobo', 'La Sirena'][Math.floor(r() * 5)] };
    }
  }
  cache.set(key, plan);
  return plan;
}

export function wrecksNear(world, x, z, dist = 0) {
  const out = [];
  for (let rx = Math.floor((x - 12 - dist) / WRECK_REGION); rx <= Math.floor((x + 12 + dist) / WRECK_REGION); rx++) {
    for (let rz = Math.floor((z - 12 - dist) / WRECK_REGION); rz <= Math.floor((z + 12 + dist) / WRECK_REGION); rz++) {
      const p = wreckPlan(world, rx, rz);
      if (p && Math.hypot(p.x - x, p.z - z) <= 8 + dist) out.push(p);
    }
  }
  return out;
}

function wreckBlocks(p) {
  if (p._blocks) return p._blocks;
  const out = []; const put = (a, y, b, id) => out.push(p.along === 'x' ? { x: p.x + a, y, z: p.z + b, id } : { x: p.x + b, y, z: p.z + a, id });
  const y = p.y + 1;
  // Casco: fondo, costados que se achican hacia proa y popa, algunas tablas faltantes (está roto).
  for (let a = -5; a <= 5; a++) {
    const half = Math.abs(a) >= 4 ? 1 : 2;
    for (let b = -half; b <= half; b++) {
      if ((a * 7 + b * 3) % 11 === 0) continue;   // agujeros
      put(a, y, b, B.PLANKS);
      if (Math.abs(b) === half) { put(a, y + 1, b, Math.abs(a) % 3 === 0 ? B.LOG : B.PLANKS); if (a > -3) put(a, y + 2, b, B.PLANKS); }
    }
  }
  put(-6, y + 1, 0, B.LOG); put(6, y + 2, 0, B.LOG);   // proa y popa
  // Mástil quebrado con un jirón de vela.
  for (let k = 1; k <= 5; k++) put(0, y + k, 0, B.LOG);
  put(1, y + 4, 0, B.WOOL_WHITE); put(1, y + 3, 0, B.WOOL_WHITE); put(2, y + 3, 0, B.WOOL_WHITE);
  put(-3, y + 1, 0, B.LOOT_CHEST);
  put(3, y + 1, 1, B.BARREL);
  p._blocks = out;
  return out;
}

export function placeWrecks(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const p of wrecksNear(world, x0 + CS / 2, z0 + CS / 2, CS)) {
    for (const b of wreckBlocks(p)) {
      const lx = b.x - x0; const lz = b.z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || b.y < 0 || b.y >= SEA) continue;
      chunk.set(lx, b.y, lz, b.id);
    }
  }
}

// Tesoro del naufragio.
export function treasure(r = Math.random) {
  return { 157: 2 + Math.floor(r() * 3), 152: 2 + Math.floor(r() * 3), 131: 20 + Math.floor(r() * 25), 103: 1 + Math.floor(r() * 3) };
}
