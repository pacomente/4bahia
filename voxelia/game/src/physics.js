import { B, BLOCKS } from './blocks.js';

// ───────── Física de bloques ─────────
const FALLING = new Set([B.SAND, B.GRAVEL, B.RED_SAND]);
const LOGS = new Set([B.LOG, B.BIRCH_LOG, B.PALM_LOG]);
const LEAVES = new Set([B.LEAVES, B.BIRCH_LEAVES, B.PINE_LEAVES, B.PALM_LEAVES, B.FRUIT_LEAVES, B.JUNGLE_LEAVES]);
const empty = (id) => id === B.AIR || BLOCKS[id].water || (!BLOCKS[id].solid && !LOGS.has(id) && BLOCKS[id].shape === 'crop');

// Arena y grava sin nada abajo: caen hasta apoyarse. Revisa la columna desde (x, y, z) hacia arriba.
export function settleFalling(world, x, y, z) {
  const moved = [];
  for (let yy = y; yy < y + 24; yy++) {
    const id = world.getBlock(x, yy, z);
    if (!FALLING.has(id)) { if (yy > y) break; continue; }
    let to = yy;
    while (to > 1 && empty(world.getBlock(x, to - 1, z))) to--;
    if (to !== yy) { world.setBlock(x, yy, z, B.AIR); world.setBlock(x, to, z, id); moved.push({ x, y: to, z, id, from: yy }); }
  }
  return moved;
}

// Árbol que se cae: si cortás la base (no hay tronco abajo), se viene abajo todo el tronco y las ramas.
// Devuelve { logs: { id: cantidad }, top, removed } o null si no era la base de un árbol.
export function fellTree(world, x, y, z, brokenId) {
  if (!LOGS.has(brokenId) || LOGS.has(world.getBlock(x, y - 1, z)) || !LOGS.has(world.getBlock(x, y + 1, z))) return null;
  const seen = new Set(); const queue = [[x, y + 1, z]]; const logs = {}; const removed = [];
  while (queue.length && removed.length < 48) {
    const [cx, cy, cz] = queue.shift(); const k = `${cx},${cy},${cz}`;
    if (seen.has(k)) continue; seen.add(k);
    const id = world.getBlock(cx, cy, cz);
    if (!LOGS.has(id) || Math.abs(cx - x) > 4 || Math.abs(cz - z) > 4) continue;
    removed.push({ x: cx, y: cy, z: cz }); logs[id] = (logs[id] ?? 0) + 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) if (dx || dz || dy) queue.push([cx + dx, cy + dy, cz + dz]);
  }
  if (removed.length < 2) return null;
  for (const b of removed) world.setBlock(b.x, b.y, b.z, B.AIR);
  const top = removed.reduce((a, b) => (b.y > a.y ? b : a), removed[0]);
  return { logs, top, removed };
}

// Hojas que quedaron sin tronco cerca: se secan y caen (de a poco, ver game.updateLeafDecay).
export function orphanLeaves(world, around, r = 4) {
  const out = [];
  for (const c of around) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      const x = c.x + dx; const y = c.y + dy; const z = c.z + dz;
      if (!LEAVES.has(world.getBlock(x, y, z))) continue;
      let supported = false;
      for (let ex = -3; ex <= 3 && !supported; ex++) for (let ey = -3; ey <= 3 && !supported; ey++) for (let ez = -3; ez <= 3 && !supported; ez++) if (LOGS.has(world.getBlock(x + ex, y + ey, z + ez))) supported = true;
      if (!supported) out.push({ x, y, z });
    }
  }
  const uniq = new Map(out.map((b) => [`${b.x},${b.y},${b.z}`, b]));
  return [...uniq.values()];
}

// Agua que corre: si se abre un hueco al lado de agua, el agua lo llena, cae y se extiende un poco.
export function flowWater(world, x, y, z, max = 48) {
  const isWater = (id) => id === B.WATER;
  const touches = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([dx, dy, dz]) => isWater(world.getBlock(x + dx, y + dy, z + dz)));
  if (!touches || world.getBlock(x, y, z) !== B.AIR) return 0;
  const queue = [[x, y, z, 0]]; let filled = 0;
  while (queue.length && filled < max) {
    const [cx, cy, cz, d] = queue.shift();
    if (world.getBlock(cx, cy, cz) !== B.AIR) continue;
    world.setBlock(cx, cy, cz, B.WATER); filled++;
    if (world.getBlock(cx, cy - 1, cz) === B.AIR) { queue.push([cx, cy - 1, cz, d]); continue; }   // cae primero
    if (d >= 3) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.getBlock(cx + dx, cy, cz + dz) === B.AIR) queue.push([cx + dx, cy, cz + dz, d + 1]);
  }
  return filled;
}
