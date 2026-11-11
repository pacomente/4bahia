import { B, BLOCKS } from './blocks.js';

// Recorre la grilla de bloques desde el ojo del jugador (algoritmo DDA). Devuelve el bloque apuntado y la cara.
export function raycast(world, origin, dir, maxDist = 6) {
  let x = Math.floor(origin.x); let y = Math.floor(origin.y); let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x); const stepY = Math.sign(dir.y); const stepZ = Math.sign(dir.z);
  const tDeltaX = Math.abs(1 / dir.x); const tDeltaY = Math.abs(1 / dir.y); const tDeltaZ = Math.abs(1 / dir.z);
  const frac = (v, s) => (s > 0 ? Math.ceil(v) - v : v - Math.floor(v));
  let tMaxX = dir.x ? frac(origin.x, stepX) * tDeltaX : Infinity;
  let tMaxY = dir.y ? frac(origin.y, stepY) * tDeltaY : Infinity;
  let tMaxZ = dir.z ? frac(origin.z, stepZ) * tDeltaZ : Infinity;
  let face = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, face, block: BLOCKS[id] };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
  }
  return null;
}
