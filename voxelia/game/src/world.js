import { createNoise2D, createNoise3D } from 'simplex-noise';
import { B, BLOCKS } from './blocks.js';
import { placeVillages, insideVillage } from './villages.js';

export const CS = 16;          // tamaño de chunk (x, z)
export const H = 96;           // altura del mundo
export const SEA = 32;         // nivel del mar
const idx = (x, y, z) => x + z * CS + y * CS * CS;

export function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Hash determinista de una posición (árboles, minerales): mismo mundo, mismo resultado.
export function hash3(seed, x, y, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.data = new Uint8Array(CS * CS * H);
    this.top = new Int16Array(CS * CS).fill(-1);   // bloque opaco más alto por columna (para sombras)
    this.meshes = null;
    this.dirty = true;
  }
  get(x, y, z) { return y < 0 || y >= H ? (y < 0 ? B.BEDROCK : B.AIR) : this.data[idx(x, y, z)]; }
  set(x, y, z, id) { this.data[idx(x, y, z)] = id; }
  recomputeTop(x, z) {
    let t = -1;
    for (let y = H - 1; y >= 0; y--) { const id = this.data[idx(x, y, z)]; if (id && id !== B.WATER && id !== B.GLASS && id !== B.TORCH) { t = y; break; } }
    this.top[x + z * CS] = t;
  }
}

export class World {
  constructor(seed, mods = {}) {
    this.seedText = String(seed);
    this.seed = hashSeed(seed);
    const rnd = mulberry32(this.seed);
    this.n2 = { cont: createNoise2D(rnd), hill: createNoise2D(rnd), mount: createNoise2D(rnd), temp: createNoise2D(rnd), moist: createNoise2D(rnd), detail: createNoise2D(rnd) };
    this.n3 = { a: createNoise3D(rnd), b: createNoise3D(rnd) };
    this.chunks = new Map();
    // Cambios del jugador sobre el mundo generado: "cx,cz" -> Map(índice -> bloque)
    this.mods = new Map(Object.entries(mods).map(([k, list]) => [k, new Map(list)]));
  }

  key(cx, cz) { return `${cx},${cz}`; }
  getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return B.AIR;
    const cx = Math.floor(x / CS); const cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    if (!c) return B.AIR;
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  // Cambia un bloque, lo registra como modificación y marca para regenerar la malla (también vecinos en el borde).
  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const cx = Math.floor(x / CS); const cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    if (!c) return false;
    const lx = x - cx * CS; const lz = z - cz * CS;
    const old = c.get(lx, y, lz);
    c.set(lx, y, lz, id);
    c.recomputeTop(lx, lz);
    c.dirty = true;
    const k = this.key(cx, cz);
    if (!this.mods.has(k)) this.mods.set(k, new Map());
    this.mods.get(k).set(idx(lx, y, lz), id);
    const mark = (dx, dz) => { const n = this.getChunk(cx + dx, cz + dz); if (n) n.dirty = true; };
    if (lx === 0) mark(-1, 0);
    if (lx === CS - 1) mark(1, 0);
    if (lz === 0) mark(0, -1);
    if (lz === CS - 1) mark(0, 1);
    // Una fuente de luz ilumina hasta 14 bloques: los 8 vecinos deben recalcular su luz.
    if (BLOCKS[old]?.light || BLOCKS[id]?.light) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) mark(dx, dz);
    return true;
  }

  topAt(x, z) {
    const cx = Math.floor(x / CS); const cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    return c ? c.top[(x - cx * CS) + (z - cz * CS) * CS] : -1;
  }

  // ───────── Generación ─────────
  fbm(fn, x, z, oct, scale) {
    let a = 1; let f = 1 / scale; let s = 0; let n = 0;
    for (let o = 0; o < oct; o++) { s += fn(x * f, z * f) * a; n += a; a *= 0.5; f *= 2; }
    return s / n;
  }

  climate(x, z) {
    return { temp: this.fbm(this.n2.temp, x, z, 2, 700), moist: this.fbm(this.n2.moist, x + 500, z - 300, 2, 600) };
  }

  biome(x, z) {
    const { temp, moist } = this.climate(x, z);
    const m = this.mountainness(x, z);
    if (m > 0.35) return 'mountains';
    if (temp > 0.35 && moist < 0.05) return 'desert';
    if (temp < -0.4) return 'snow';
    if (moist > 0.15) return 'forest';
    return 'plains';
  }

  mountainness(x, z) {
    const r = 1 - Math.abs(this.fbm(this.n2.mount, x, z, 3, 420));
    return Math.max(0, (r - 0.55) / 0.45);
  }

  heightAt(x, z) {
    const cont = this.fbm(this.n2.cont, x, z, 3, 520);
    const hill = this.fbm(this.n2.hill, x, z, 4, 140);
    const m = this.mountainness(x, z);
    const { temp } = this.climate(x, z);
    const flat = temp > 0.35 ? 0.5 : 1;
    let h = SEA + 3 + cont * 12 + hill * 6 * flat + m * m * 42 + this.n2.detail(x / 24, z / 24) * 1.2;
    return Math.max(4, Math.min(H - 8, Math.round(h)));
  }

  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    const x0 = cx * CS; const z0 = cz * CS;
    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const x = x0 + lx; const z = z0 + lz;
        const h = this.heightAt(x, z);
        const biome = this.biome(x, z);
        const beach = h <= SEA + 1 && h >= SEA - 3;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id;
          if (y === 0 || (y < 3 && hash3(this.seed, x, y, z) < 0.5)) id = B.BEDROCK;
          else if (y > h) id = y <= SEA ? B.WATER : B.AIR;
          else if (y === h) {
            if (h < SEA) id = hash3(this.seed, x, 1, z) < 0.15 ? B.CLAY : hash3(this.seed, x, 2, z) < 0.3 ? B.GRAVEL : B.SAND;
            else if (beach || biome === 'desert') id = B.SAND;
            else if (biome === 'snow' || (biome === 'mountains' && h > 66)) id = B.SNOW;
            else if (biome === 'mountains' && h > 54) id = B.STONE;
            else id = B.GRASS;
          } else if (y > h - 4) id = (beach || biome === 'desert') ? B.SAND : (biome === 'mountains' && h > 54 ? B.STONE : B.DIRT);
          else {
            id = B.STONE;
            const r = hash3(this.seed, x, y, z);
            if (r < 0.012) id = B.COAL;
            else if (y < 28 && r < 0.017) id = B.IRON;
            else if (y < 20 && r < 0.0195) id = B.CRYSTAL;   // cristales luminosos, solo en lo profundo
          }
          // Cuevas: túneles donde dos ruidos 3D se acercan a cero.
          if (id !== B.BEDROCK && id !== B.WATER && id !== B.AIR && y > 3 && y < h - 3) {
            const a = this.n3.a(x / 28, y / 18, z / 28);
            const b = this.n3.b(x / 28, y / 18, z / 28);
            if (a * a + b * b < 0.012) id = B.AIR;
          }
          if (id) c.set(lx, y, lz, id);
        }
      }
    }
    this.decorate(c);
    placeVillages(this, c);
    // Modificaciones guardadas del jugador.
    const mods = this.mods.get(this.key(cx, cz));
    if (mods) for (const [i, id] of mods) c.data[i] = id;
    for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) c.recomputeTop(lx, lz);
    this.chunks.set(this.key(cx, cz), c);
    // Los vecinos deben rehacer su malla para coser los bordes.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.getChunk(cx + dx, cz + dz); if (n) n.dirty = true; }
    return c;
  }

  // Árboles y cactus. Se recorren también columnas vecinas para que las copas crucen bordes de chunk.
  decorate(c) {
    const x0 = c.cx * CS; const z0 = c.cz * CS;
    const put = (x, y, z, id, onlyAir = true) => {
      const lx = x - x0; const lz = z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= H) return;
      if (onlyAir && c.get(lx, y, lz) !== B.AIR) return;
      c.set(lx, y, lz, id);
    };
    for (let x = x0 - 3; x < x0 + CS + 3; x++) {
      for (let z = z0 - 3; z < z0 + CS + 3; z++) {
        const biome = this.biome(x, z);
        const density = { forest: 0.045, plains: 0.006, snow: 0.012, mountains: 0.004, desert: 0.006 }[biome];
        const r = hash3(this.seed, x, 7, z);
        if (r >= density) continue;
        if (insideVillage(this, x, z)) continue;   // sin árboles dentro de las aldeas
        const h = this.heightAt(x, z);
        if (h <= SEA + 1) continue;
        if (biome === 'desert') {
          const tall = 2 + Math.floor(hash3(this.seed, x, 9, z) * 3);
          for (let y = h + 1; y <= h + tall; y++) put(x, y, z, B.CACTUS);
          continue;
        }
        if (biome === 'mountains' && h > 58) continue;
        const birch = biome === 'forest' && hash3(this.seed, x, 11, z) < 0.35;
        const log = birch ? B.BIRCH_LOG : B.LOG;
        const leaves = birch ? B.BIRCH_LEAVES : B.LEAVES;
        const trunk = 4 + Math.floor(hash3(this.seed, x, 13, z) * 3);
        for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, log, false);
        const top = h + trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const rad = dy <= -1 ? 2 : 1;
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || hash3(this.seed, x + dx, top + dy, z + dz) < 0.5)) continue;
            put(x + dx, top + dy, z + dz, leaves);
          }
        }
        put(x, top + 2, z, leaves);
      }
    }
  }

  // Punto de aparición: busca tierra firme cerca del origen.
  spawnPoint() {
    for (let r = 0; r < 200; r += 4) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a) * r); const z = Math.round(Math.sin(a) * r);
        const h = this.heightAt(x, z);
        if (h > SEA + 1 && this.biome(x, z) !== 'mountains') return { x: x + 0.5, y: h + 1.01, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: this.heightAt(0, 0) + 2, z: 0.5 };
  }

  serializeMods() {
    const out = {};
    for (const [k, m] of this.mods) if (m.size) out[k] = [...m.entries()];
    return out;
  }
}

export const isOpaqueForAO = (id) => id !== B.AIR && !BLOCKS[id].transparent;
