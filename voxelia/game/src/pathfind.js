import { BLOCKS, B } from './blocks.js';
import { stepToward } from './walk.js';

// ───────── Búsqueda de caminos (A*) ─────────
// Grilla de columnas: en cada (x, z) el personaje se para a una altura. Puede subir 1 bloque y bajar 3,
// moverse en diagonal si no corta esquinas, y no se mete al agua. Las puertas cerradas no se atraviesan
// (salvo que sean el destino: así el aldeano llega a la puerta de su casa y la abre).
const solidAt = (w, x, y, z) => { const id = w.getBlock(x, y, z); return BLOCKS[id].solid; };

function standAt(w, x, y, z, goal) {
  for (let k = 1; k >= -3; k--) {
    const fy = y + k;
    if (fy < 1) continue;
    const below = w.getBlock(x, fy - 1, z);
    if (!BLOCKS[below].solid || BLOCKS[below].water) continue;
    const feet = w.getBlock(x, fy, z); const head = w.getBlock(x, fy + 1, z);
    const isGoal = goal && x === goal.x && z === goal.z;
    const passFeet = !BLOCKS[feet].solid || (isGoal && (feet === B.DOOR || feet === B.DOOR_OPEN));
    const passHead = !BLOCKS[head].solid || (isGoal && (head === B.DOOR || head === B.DOOR_OPEN));
    if (!passFeet || !passHead || BLOCKS[feet].water) continue;
    // Para subir, también tiene que haber lugar arriba de la cabeza actual.
    if (k === 1 && solidAt(w, x, y + 2, z)) continue;
    return fy;
  }
  return null;
}

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1; const r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

// Camino de `from` a `to` (puntos con x, y, z). Devuelve una lista de puntos {x, y, z} (centros de celda),
// o, si no hay camino completo, el tramo hasta la celda más cercana al destino.
export function findPath(world, from, to, { maxNodes = 900 } = {}) {
  const sx = Math.floor(from.x); const sz = Math.floor(from.z); const sy = Math.floor(from.y + 0.01);
  const goal = { x: Math.floor(to.x), z: Math.floor(to.z) };
  const h = (x, z) => { const dx = Math.abs(x - goal.x); const dz = Math.abs(z - goal.z); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const key = (x, z) => `${x},${z}`;
  const open = new Heap(); const nodes = new Map();
  const start = { x: sx, y: sy, z: sz, g: 0, f: h(sx, sz), parent: null, closed: false };
  nodes.set(key(sx, sz), start); open.push(start);
  let best = start; let count = 0;
  while (open.size && count < maxNodes) {
    const n = open.pop();
    if (n.closed) continue;
    n.closed = true; count++;
    if (h(n.x, n.z) < h(best.x, best.z)) best = n;
    if (n.x === goal.x && n.z === goal.z) { best = n; break; }
    for (const [dx, dz, cost] of DIRS) {
      const nx = n.x + dx; const nz = n.z + dz;
      const ny = standAt(world, nx, n.y, nz, goal);
      if (ny === null) continue;
      if (dx && dz) {
        // Diagonal: las dos celdas de al lado tienen que estar libres (no cortar esquinas).
        const a = standAt(world, n.x + dx, n.y, n.z, null); const b = standAt(world, n.x, n.y, n.z + dz, null);
        if (a === null || b === null || Math.abs(a - n.y) > 0 || Math.abs(b - n.y) > 0) continue;
      }
      const g = n.g + cost + (ny > n.y ? 0.6 : 0) + (ny < n.y - 1 ? 0.4 : 0);
      const k = key(nx, nz);
      const old = nodes.get(k);
      if (old && (old.closed || old.g <= g)) continue;
      const m = { x: nx, y: ny, z: nz, g, f: g + h(nx, nz), parent: n, closed: false };
      nodes.set(k, m); open.push(m);
    }
  }
  const pts = [];
  for (let n = best; n; n = n.parent) pts.push({ x: n.x + 0.5, y: n.y, z: n.z + 0.5 });
  pts.reverse();
  return { pts: smooth(world, pts), complete: best.x === goal.x && best.z === goal.z, explored: count };
}

// ¿Se puede ir en línea recta de a a b? (recorre las celdas y mira que se pueda parar en todas)
export function lineClear(world, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / 0.4);
  let y = Math.floor(a.y + 0.01);
  for (let i = 1; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n; const z = a.z + (b.z - a.z) * i / n;
    // Margen del cuerpo: los dos costados.
    for (const off of [0, 0.3, -0.3]) {
      const px = x + ((b.z - a.z) / (d || 1)) * off; const pz = z - ((b.x - a.x) / (d || 1)) * off;
      const ny = standAt(world, Math.floor(px), y, Math.floor(pz), null);
      if (ny === null || Math.abs(ny - y) > 1) return false;
      if (off === 0) y = ny;
    }
  }
  return true;
}

// Saca los puntos intermedios innecesarios (camina en línea recta cuando puede).
function smooth(world, pts) {
  if (pts.length <= 2) return pts.slice(1);
  const out = []; let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !(j - i <= 12 && lineClear(world, pts[i], pts[j]))) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

// ───────── Moverse usando caminos ─────────
// Presupuesto de búsquedas por cuadro (las búsquedas son lo caro): se reparte entre todos.
let budget = 6;
export function navFrame() { budget = 6; }

// Camina hacia goal {x, z} usando A* cuando la línea recta no sirve. Devuelve { moved, arrived }.
export function navigate(world, e, goal, speed, dt) {
  const d = Math.hypot(goal.x - e.pos.x, goal.z - e.pos.z);
  e.navT = (e.navT ?? 0) + dt;
  // Cerca, o con vía libre: directo (sin gastar búsqueda).
  if (d < 2.2) { e.nav = null; return stepToward(world, e, goal.x, goal.z, speed, dt); }
  const nav = e.nav;
  const stale = !nav || Math.hypot(nav.goal.x - goal.x, nav.goal.z - goal.z) > Math.max(1.5, d * 0.25) || e.navT > 6 || (e.stuck > 0.8 && e.navT > 0.6);
  if (stale) {
    if ((e.losT ?? 0) <= 0) {
      // Primero probar la recta (barato): si está libre, no hace falta camino.
      e.losT = 0.5;
      if (d < 24 && lineClear(world, e.pos, { x: goal.x, z: goal.z })) { e.nav = { goal: { x: goal.x, z: goal.z }, pts: [], complete: true }; e.navT = 0; return stepToward(world, e, goal.x, goal.z, speed, dt); }
    }
    e.losT = (e.losT ?? 0) - dt;
    if (budget > 0) {
      budget--;
      const r = findPath(world, e.pos, goal, { maxNodes: d > 30 ? 1400 : 800 });
      e.nav = { goal: { x: goal.x, z: goal.z }, pts: r.pts, complete: r.complete }; e.navT = 0;
    } else if (!nav) return stepToward(world, e, goal.x, goal.z, speed, dt);
  }
  const pts = e.nav?.pts ?? [];
  while (pts.length && Math.hypot(pts[0].x - e.pos.x, pts[0].z - e.pos.z) < 0.45) pts.shift();
  const next = pts[0] ?? goal;
  return stepToward(world, e, next.x, next.z, speed, dt);
}
