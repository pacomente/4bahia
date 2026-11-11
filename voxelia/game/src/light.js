import { BLOCKS } from './blocks.js';
import { CS, H } from './world.js';

// Luz de bloques (lámparas, antorchas, cristales, faros): se propaga por el aire y lo transparente,
// perdiendo un nivel por bloque, y no atraviesa bloques opacos. Se calcula por chunk, con un margen
// que cubre las fuentes de los chunks vecinos.
export const MAX_LIGHT = 15;
const M = MAX_LIGHT - 1;              // alcance máximo de una fuente
const blocksLight = (id) => id !== 0 && !BLOCKS[id].transparent;

export function computeChunkLight(world, chunk) {
  const W = CS + 2 * M;
  const ox = chunk.cx * CS - M; const oz = chunk.cz * CS - M;
  const near = []; const grid = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = world.getChunk(chunk.cx + dx, chunk.cz + dz); grid.push(c?.data ?? null); if (c) near.push(c); }
  // Fuentes de luz dentro de la región.
  const sources = [];
  for (const c of near) {
    const d = c.data;
    for (let i = 0; i < d.length; i++) {
      const id = d[i];
      if (!id || !BLOCKS[id].light) continue;
      const x = c.cx * CS + (i % CS); const z = c.cz * CS + (Math.floor(i / CS) % CS); const y = Math.floor(i / (CS * CS));
      if (x - ox < 0 || x - ox >= W || z - oz < 0 || z - oz >= W) continue;
      sources.push([x - ox, y, z - oz, BLOCKS[id].light]);
    }
  }
  if (!sources.length) return null;
  const level = new Uint8Array(W * W * H);
  const at = (x, y, z) => x + z * W + y * W * W;
  // Bloque en la región (la región entra en los 3×3 chunks alrededor; M < CS).
  const idAt = (rx, y, rz) => {
    const x = rx + CS - M; const z = rz + CS - M;   // relativo al chunk vecino de menor x/z
    const d = grid[Math.floor(z / CS) * 3 + Math.floor(x / CS)];
    return d ? d[(x % CS) + (z % CS) * CS + y * CS * CS] : 0;
  };
  const queue = [];
  for (const [x, y, z, l] of sources) { const i = at(x, y, z); if (level[i] < l) { level[i] = l; queue.push(x, y, z); } }
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let q = 0; q < queue.length; q += 3) {
    const x = queue[q]; const y = queue[q + 1]; const z = queue[q + 2];
    const l = level[at(x, y, z)] - 1;
    if (l <= 0) continue;
    for (const [dx, dy, dz] of DIRS) {
      const nx = x + dx; const ny = y + dy; const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= W || ny < 0 || ny >= H) continue;
      const ni = at(nx, ny, nz);
      if (level[ni] >= l || blocksLight(idAt(nx, ny, nz))) continue;
      level[ni] = l;
      queue.push(nx, ny, nz);
    }
  }
  // Nivel de luz (0-15) en una posición del mundo.
  return (x, y, z) => {
    const rx = x - ox; const rz = z - oz;
    if (rx < 0 || rz < 0 || rx >= W || rz >= W || y < 0 || y >= H) return 0;
    return level[at(rx, y, rz)];
  };
}
