import { B } from './blocks.js';
import { I } from './items.js';
import { CS, SEA, hash3 } from './world.js';
import { villagesNear } from './villages.js';

// ───────── Mazmorras ─────────
// Una entrada de piedra con musgo y una escalera que baja hasta un pasillo, una sala con botín,
// un foso de lava con un puente angosto y, al fondo, la sala del trono del Rey Sombrío.
export const DUNGEON_REGION = 520;
const DEPTH = 18;   // altura del piso de la mazmorra

export function dungeonPlan(world, rx, rz) {
  const cache = world._dungeons ?? (world._dungeons = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  for (let t = 0; t < 20 && !plan; t++) {
    const x = rx * DUNGEON_REGION + 80 + Math.floor(hash3(world.seed, rx * 13 + t, 7171, rz) * (DUNGEON_REGION - 160));
    const z = rz * DUNGEON_REGION + 80 + Math.floor(hash3(world.seed, rx, 7272 + t, rz * 11) * (DUNGEON_REGION - 160));
    const y = world.heightAt(x, z);
    if (y <= SEA + 2 || y > SEA + 30 || Math.hypot(x, z) < 150) continue;
    if (villagesNear(world, x, z, 40).length) continue;
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(hash3(world.seed, rx, 7373, rz) * 4)];
    plan = { id: `m${rx}_${rz}`, x, z, y, dir, name: ['Mazmorra del Rey Sombrío', 'Cripta Olvidada', 'Catacumbas de la Noche'][Math.floor(hash3(world.seed, rx, 7474, rz) * 3)] };
  }
  cache.set(key, plan);
  return plan;
}

export function dungeonsNear(world, x, z, dist) {
  const out = [];
  for (let rx = Math.floor((x - dist - 110) / DUNGEON_REGION); rx <= Math.floor((x + dist + 110) / DUNGEON_REGION); rx++) for (let rz = Math.floor((z - dist - 110) / DUNGEON_REGION); rz <= Math.floor((z + dist + 110) / DUNGEON_REGION); rz++) {
    const p = dungeonPlan(world, rx, rz); if (p && Math.hypot(p.x - x, p.z - z) <= dist + 100) out.push(p);
  }
  return out;
}

// Bloques (coordenadas a lo largo del eje de la mazmorra: k avanza, w de costado).
export function dungeonBlocks(world, p) {
  if (p._blocks) return p._blocks;
  const out = []; const [fx, fz] = p.dir; const px = -fz; const pz = fx;
  const at = (k, w) => [p.x + fx * k + px * w, p.z + fz * k + pz * w];
  const put = (k, y, w, id) => { const [x, z] = at(k, w); out.push({ x, y, z, id }); };
  const wall = (k, w, y) => ((k * 7 + w * 3 + y) % 5 === 0 ? B.MOSSY_COBBLE : B.COBBLE);
  // Caja hueca: paredes y techo de piedra, piso y aire adentro.
  const hall = (k0, k1, half, y0, h, floor = B.COBBLE) => {
    for (let k = k0 - 1; k <= k1 + 1; k++) for (let w = -half - 1; w <= half + 1; w++) for (let y = y0 - 1; y <= y0 + h; y++) {
      const edge = k < k0 || k > k1 || Math.abs(w) > half || y === y0 - 1 || y === y0 + h;
      put(k, y, w, edge ? (y === y0 - 1 ? floor : wall(k, w, y)) : B.AIR);
    }
  };
  // Entrada: portal de piedra con barrotes abiertos y antorchas.
  const top = p.y;
  for (let k = -2; k <= 2; k++) for (let w = -3; w <= 3; w++) {
    const [x, z] = at(k, w); const g = world.heightAt(x, z);
    for (let y = g + 1; y <= top; y++) put(k, y, w, B.COBBLE);
    put(k, top, w, B.MOSSY_COBBLE);
    if (Math.abs(w) === 3 || Math.abs(k) === 2) for (let y = top + 1; y <= top + 4; y++) put(k, y, w, Math.abs(w) === 3 && Math.abs(k) === 2 ? B.MOSSY_COBBLE : (y === top + 4 ? B.COBBLE : (Math.abs(w) <= 1 && k === 2 ? B.AIR : (Math.abs(w) === 3 ? B.COBBLE : B.BARS))));
    for (let y = top + 1; y <= top + 3; y++) if (Math.abs(w) < 3 && Math.abs(k) < 2) put(k, y, w, B.AIR);
  }
  put(2, top + 2, -2, B.TORCH); put(2, top + 2, 2, B.TORCH);
  // Escalera: baja un bloque por paso hasta el fondo.
  let y = top; let k = 0;
  while (y > DEPTH) {
    for (let w = -1; w <= 1; w++) { put(k, y - 1, w, B.COBBLE); for (let h = 0; h <= 3; h++) put(k, y + h, w, B.AIR); put(k, y + 4, w, B.COBBLE); }
    put(k, y + 1, -2, B.COBBLE); put(k, y + 1, 2, B.COBBLE);
    if (k % 6 === 3) put(k, y + 2, 2, B.TORCH);
    k++; y--;
  }
  const k0 = k;
  // Pasillo, sala de botín, pasillo con foso de lava y sala del trono.
  hall(k0, k0 + 10, 1, DEPTH, 4);
  hall(k0 + 11, k0 + 19, 4, DEPTH, 5);
  put(k0 + 18, DEPTH, -3, B.LOOT_CHEST); put(k0 + 18, DEPTH, 3, B.BARREL); put(k0 + 12, DEPTH + 2, -4, B.TORCH); put(k0 + 12, DEPTH + 2, 4, B.TORCH);
  hall(k0 + 20, k0 + 30, 1, DEPTH, 4);
  for (let kk = k0 + 23; kk <= k0 + 27; kk++) for (const w of [-1, 1]) { put(kk, DEPTH - 1, w, B.LAVA); put(kk, DEPTH - 2, w, B.LAVA); }   // foso: solo se pasa por el medio
  hall(k0 + 31, k0 + 45, 6, DEPTH, 7, B.MOSSY_COBBLE);
  for (const [kk, w] of [[k0 + 33, -5], [k0 + 33, 5], [k0 + 43, -5], [k0 + 43, 5], [k0 + 38, -5], [k0 + 38, 5]]) { put(kk, DEPTH + 3, w, B.LAMP); }
  put(k0 + 44, DEPTH, 0, B.THRONE); put(k0 + 44, DEPTH, -1, B.BOOKSHELF); put(k0 + 44, DEPTH, 1, B.BOOKSHELF);
  for (let w = -1; w <= 1; w++) put(k0 + 45, DEPTH + 2, w, B.WOOL_BLACK);
  const [cx, cz] = at(k0 + 38, 0); const [lx, lz] = at(k0 + 18, -3); const [rx2, rz2] = at(k0 + 15, 0);
  p.boss = { x: cx + 0.5, y: DEPTH, z: cz + 0.5, r: 6 };
  p.chest = { x: lx, y: DEPTH, z: lz };
  p.hall = { x: rx2 + 0.5, y: DEPTH, z: rz2 + 0.5 };
  p._blocks = out;
  return out;
}

export function placeDungeons(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const p of dungeonsNear(world, x0 + CS / 2, z0 + CS / 2, CS)) {
    for (const b of dungeonBlocks(world, p)) {
      const lx = b.x - x0; const lz = b.z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || b.y < 1 || b.y >= 96) continue;
      chunk.set(lx, b.y, lz, b.id);
    }
  }
}

export function dungeonLoot(r = Math.random) {
  return { [I.GOLD]: 3 + Math.floor(r() * 3), [I.CRYSTAL]: 2 + Math.floor(r() * 3), [I.IRON]: 4, [I.SILVER]: 30 + Math.floor(r() * 30), [I.TREASURE_MAP]: 1 };
}
