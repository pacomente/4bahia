import { B } from './blocks.js';
import { CS, SEA } from './world.js';
import { villagePlan, villagesNear, REGION } from './villages.js';

// Caminos entre aldeas vecinas: una franja de grava de 3 de ancho, con faroles cada tanto y puentes de
// madera donde cruzan agua. Las carretas de los comerciantes van y vienen por acá.
const MAX_DIST = 330;
const LINKS = 2;   // cada aldea se une con sus 2 vecinas más cercanas

// ¿El camino entre dos aldeas es transitable? (sin acantilados ni mares largos)
function viable(world, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  let prev = null; let wet = 0; let run = 0;
  for (let t = 0; t <= d; t += 4) {
    const x = Math.round(a.x + (b.x - a.x) * t / d); const z = Math.round(a.z + (b.z - a.z) * t / d);
    const g = world.heightAt(x, z);
    const y = Math.max(g, SEA);
    if (g < SEA) { wet++; run++; if (run > 12) return false; } else run = 0;
    if (prev !== null && Math.abs(y - prev) > 7) return false;
    prev = y;
  }
  return wet * 4 < d * 0.45;
}

// Aldeas con las que se une una aldea (cacheado).
export function linksOf(world, plan) {
  if (plan._links) return plan._links;
  const cand = [];
  for (let rx = plan.rx - 3; rx <= plan.rx + 3; rx++) for (let rz = plan.rz - 3; rz <= plan.rz + 3; rz++) {
    if (rx === plan.rx && rz === plan.rz) continue;
    const p = villagePlan(world, rx, rz);
    if (p) { const d = Math.hypot(p.x - plan.x, p.z - plan.z); if (d < MAX_DIST) cand.push({ p, d }); }
  }
  cand.sort((u, v) => u.d - v.d);
  plan._links = cand.slice(0, LINKS).map((c) => c.p);
  return plan._links;
}

// Rutas (pares de aldeas) cuyo camino pasa cerca de (x, z).
export function routesNear(world, x, z, margin = 0) {
  const out = new Map();
  const reach = MAX_DIST + margin;
  for (let rx = Math.floor((x - reach) / REGION); rx <= Math.floor((x + reach) / REGION); rx++) {
    for (let rz = Math.floor((z - reach) / REGION); rz <= Math.floor((z + reach) / REGION); rz++) {
      const a = villagePlan(world, rx, rz);
      if (!a) continue;
      for (const b of linksOf(world, a)) {
        const id = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (out.has(id)) continue;
        const [p, q] = a.id < b.id ? [a, b] : [b, a];
        if (segDist(x, z, p, q) > margin + 3) continue;
        const r = routeOf(world, p, q);
        if (r) out.set(id, r);
      }
    }
  }
  return [...out.values()];
}

function segDist(x, z, a, b) {
  const dx = b.x - a.x; const dz = b.z - a.z; const L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
}

const routeCache = new WeakMap();
export function routeOf(world, a, b) {
  let m = routeCache.get(world); if (!m) routeCache.set(world, m = new Map());
  const id = `${a.id}|${b.id}`;
  if (m.has(id)) return m.get(id);
  const r = viable(world, a, b) ? { id, a, b, length: Math.hypot(b.x - a.x, b.z - a.z) } : null;
  m.set(id, r);
  return r;
}

// Puntos del camino (uno por bloque) con la altura donde se pisa.
export function routePoints(world, r) {
  if (r._pts) return r._pts;
  const pts = []; const n = Math.ceil(r.length);
  for (let i = 0; i <= n; i++) {
    const x = r.a.x + (r.b.x - r.a.x) * i / n; const z = r.a.z + (r.b.z - r.a.z) * i / n;
    const g = world.heightAt(Math.round(x), Math.round(z));
    pts.push({ x: x + 0.5, z: z + 0.5, y: (g < SEA ? SEA : g) + 1, bridge: g < SEA });
  }
  r._pts = pts;
  return pts;
}

// Bloques del camino dentro de un chunk recién generado (antes de las aldeas, que lo pisan).
export function placeRoads(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const r of routesNear(world, x0 + CS / 2, z0 + CS / 2, CS)) {
    const dx = r.b.x - r.a.x; const dz = r.b.z - r.a.z;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const n = Math.ceil(r.length * 1.5);
    for (let i = 0; i <= n; i++) {
      const cx = Math.round(r.a.x + dx * i / n); const cz = Math.round(r.a.z + dz * i / n);
      if (cx < x0 - 3 || cz < z0 - 3 || cx > x0 + CS + 2 || cz > z0 + CS + 2) continue;
      if (villagesNear(world, cx, cz, 0).length) continue;   // adentro de la aldea mandan sus propias calles
      const g0 = world.heightAt(cx, cz);
      const bridge = g0 < SEA;
      for (let w = -2; w <= 2; w++) {
        const x = alongX ? cx : cx + w; const z = alongX ? cz + w : cz;
        const lx = x - x0; const lz = z - z0;
        if (lx < 0 || lz < 0 || lx >= CS || lz >= CS) continue;
        const g = world.heightAt(x, z);
        const edge = Math.abs(w) === 2;
        if (bridge) {
          if (!edge) { chunk.set(lx, SEA, lz, B.PLANKS); for (let y = SEA + 1; y <= SEA + 3; y++) chunk.set(lx, y, lz, B.AIR); }
          else { chunk.set(lx, SEA, lz, B.PLANKS); chunk.set(lx, SEA + 1, lz, B.FENCE); }
          if (edge && i % 18 === 0) { chunk.set(lx, SEA + 2, lz, B.TORCH); }
          // Pilotes hasta el fondo.
          if (edge && i % 6 === 0) for (let y = Math.max(1, g + 1); y < SEA; y++) chunk.set(lx, y, lz, B.LOG);
          continue;
        }
        if (edge) {
          if (i % 30 === 0 && w === 2 && g >= SEA) { chunk.set(lx, g + 1, lz, B.LOG); chunk.set(lx, g + 2, lz, B.TORCH); }
          continue;
        }
        if (g < SEA) continue;
        chunk.set(lx, g, lz, (x * 7 + z * 3) % 9 === 0 ? B.COBBLE : B.GRAVEL);
        for (let y = g + 1; y <= g + 5; y++) chunk.set(lx, y, lz, B.AIR);
      }
    }
  }
}
