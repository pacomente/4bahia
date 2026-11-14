import { createNoise2D, createNoise3D } from 'simplex-noise';
import { B, BLOCKS } from './blocks.js';
import { placeVillages, insideVillage } from './villages.js';
import { placeCamps, insideCamp } from './camps.js';
import { placeWrecks } from './wrecks.js';
import { placeRoads } from './roads.js';
import { placeRuins } from './ruins.js';
import { placeDungeons } from './dungeons.js';

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
    for (let y = H - 1; y >= 0; y--) { const id = this.data[idx(x, y, z)]; if (id && BLOCKS[id].solid && id !== B.GLASS && id !== B.WINDOW) { t = y; break; } }
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
    // Ruidos nuevos (se crean al final para no cambiar el terreno de mundos existentes): cavernas y grietas.
    this.n3.c = createNoise3D(rnd);
    this.n2.rav = createNoise2D(rnd);
    this.n2.ocean = createNoise2D(rnd);
    this.n2.b2 = createNoise2D(rnd);   // biomas nuevos (cañones) y alturas de mesetas
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
    c.dirty = true; c.edited = true;   // editado: la malla se rehace al toque (no espera al worker)
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

  // Biomas nuevos: cuánto de pantano o de cañón tiene un lugar (0..1), para mezclar suave el terreno.
  swampness(temp, moist) { const s = (v) => Math.max(0, Math.min(1, v)); return s((moist - 0.34) / 0.1) * s(1 - Math.abs(temp - 0.02) / 0.24); }
  canyonness(x, z, temp, moist) { const s = (v) => Math.max(0, Math.min(1, v)); return s((temp - 0.28) / 0.1) * s((0.12 - moist) / 0.1) * s((this.fbm(this.n2.b2, x, z, 2, 500) - 0.05) / 0.12); }

  biome(x, z) {
    const { temp, moist } = this.climate(x, z);
    const m = this.mountainness(x, z);
    if (m > 0.8) return 'mountains';
    if (this.canyonness(x, z, temp, moist) > 0.5) return 'canyon';
    if (temp > 0.28 && moist > 0.3) return 'jungle';
    if (this.swampness(temp, moist) > 0.5) return 'swamp';
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
    const { temp, moist } = this.climate(x, z);
    const flat = temp > 0.35 ? 0.5 : 1;
    let h = SEA + 3 + cont * 12 + hill * 6 * flat + m * m * 42 + this.n2.detail(x / 24, z / 24) * 1.2;
    // Pantano: llano y casi a nivel del agua (con charcos).
    const sw = this.swampness(temp, moist) * (1 - Math.max(0, Math.min(1, (m - 0.6) * 4)));
    if (sw > 0) { const q = Math.min(1, sw * 2); const k = q * q * (3 - 2 * q); h = h * (1 - k) + (SEA + 0.2 + this.n2.detail(x / 9, z / 9) * 1.1) * k; }
    // Cañones: mesetas escalonadas de roca roja con paredes rectas.
    const cy = this.canyonness(x, z, temp, moist);
    if (cy > 0) {
      const v = (this.fbm(this.n2.b2, x + 900, z - 400, 3, 80) * 0.5 + 0.5);
      const mesa = SEA + 6 + Math.round((v * 30) / 6) * 6;
      const k = Math.min(1, cy * 1.6);
      h = h * (1 - k) + mesa * k;
    }
    // Océanos: zonas grandes donde el terreno se hunde bajo el mar (con costas y fondo irregular).
    // Alrededor del inicio siempre hay tierra firme.
    const o = this.fbm(this.n2.ocean, x + 3000, z - 1700, 3, 950);
    const near = Math.min(1, Math.hypot(x, z) / 150);
    const sea = Math.max(0, Math.min(1, (0.02 - o) / 0.22)) * near;
    if (sea > 0) {
      const floor = SEA - 5 - sea * 13 + hill * 4 + this.n2.detail(x / 30, z / 30) * 1.5;
      const k = sea * sea * (3 - 2 * sea);
      h = h * (1 - k) + floor * k;
    }
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
        // Grieta: un tajo angosto y profundo que abre la superficie (entrada natural a las cuevas).
        const ridge = Math.abs(this.n2.rav(x / 170, z / 170));
        const ravineZone = this.n2.rav(x / 520 + 37, z / 520 - 11) > 0.15 && h > SEA + 3 && ridge < 0.05 && !insideVillage(this, x, z) && !insideCamp(this, x, z);
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id;
          if (y === 0 || (y < 3 && hash3(this.seed, x, y, z) < 0.5)) id = B.BEDROCK;
          else if (y > h) id = y <= SEA ? B.WATER : B.AIR;
          else if (y === h) {
            if (h < SEA) id = hash3(this.seed, x, 1, z) < 0.15 ? B.CLAY : hash3(this.seed, x, 2, z) < 0.3 ? B.GRAVEL : B.SAND;
            else if (biome === 'canyon') id = h > SEA + 4 ? (y % 6 < 3 ? B.RED_ROCK : B.ORANGE_ROCK) : B.RED_SAND;
            else if (biome === 'swamp') id = hash3(this.seed, x, 3, z) < 0.35 ? B.MUD : B.GRASS;
            else if (beach || biome === 'desert') id = B.SAND;
            else if (biome === 'snow' || (biome === 'mountains' && h > 66)) id = B.SNOW;
            else if (biome === 'mountains' && h > 54) id = B.STONE;
            else id = B.GRASS;
          } else if (biome === 'canyon' && y > SEA - 6) id = y % 6 < 3 ? B.RED_ROCK : B.ORANGE_ROCK;   // capas de colores en las paredes
          else if (y > h - 4) id = (beach || biome === 'desert') ? B.SAND : biome === 'swamp' ? B.MUD : (biome === 'mountains' && h > 54 ? B.STONE : B.DIRT);
          else {
            id = B.STONE;
            const r = hash3(this.seed, x, y, z);
            if (r < 0.012) id = B.COAL;
            else if (y < 28 && r < 0.017) id = B.IRON;
            else if (y < 20 && r < 0.0195) id = B.CRYSTAL;   // cristales luminosos, solo en lo profundo
            else if (y < 16 && r < 0.0218) id = B.GOLD_ORE;   // oro, más abajo todavía
          }
          // Cuevas: túneles donde dos ruidos 3D se acercan a cero.
          if (id !== B.BEDROCK && id !== B.WATER && id !== B.AIR && y > 3 && y < h - 3) {
            const a = this.n3.a(x / 28, y / 18, z / 28);
            const b = this.n3.b(x / 28, y / 18, z / 28);
            if (a * a + b * b < 0.012) id = B.AIR;
            // Cavernas: salas grandes en lo profundo.
            else if (y >= 5 && y <= 30 && y < h - 6 && this.n3.c(x / 42, y / 20, z / 42) > 0.6) id = B.AIR;
          }
          // Grietas: más anchas arriba, hasta la altura 14.
          if (ravineZone && y >= 14 && y <= h && id !== B.WATER && id !== B.BEDROCK) {
            const w = 0.012 + 0.03 * Math.min(1, (y - 14) / Math.max(1, h - 14));
            if (ridge < w) id = B.AIR;
          }
          // En el fondo, lo hueco se llena de lava.
          if (id === B.AIR && y <= 9 && y < h - 3) id = B.LAVA;
          if (id) c.set(lx, y, lz, id);
        }
        // Flores, pasto alto y arbustos de bayas en llanuras y bosques; matas secas en el desierto.
        const fr = hash3(this.seed, x, 321, z);
        if ((biome === 'plains' || biome === 'forest') && h > SEA + 1 && c.get(lx, h, lz) === B.GRASS && c.get(lx, h + 1, lz) === B.AIR) {
          if (fr < 0.03) c.set(lx, h + 1, lz, fr < 0.015 ? B.FLOWER_RED : B.FLOWER_YELLOW);
          else if (fr < (biome === 'plains' ? 0.17 : 0.11)) c.set(lx, h + 1, lz, B.TALL_GRASS);
          else if (biome === 'forest' && fr < 0.118) c.set(lx, h + 1, lz, B.BERRY_BUSH);
          // Huertas silvestres y calabazas: raras, para conseguir las primeras semillas.
          else if (biome === 'plains' && fr > 0.9985) c.set(lx, h + 1, lz, fr > 0.9993 ? B.CARROT_RIPE : B.POTATO_RIPE);
          else if (biome !== 'desert' && fr > 0.997 && fr <= 0.9985) c.set(lx, h + 1, lz, B.PUMPKIN);
        } else if (biome === 'desert' && h > SEA + 1 && c.get(lx, h, lz) === B.SAND && fr < 0.012) c.set(lx, h + 1, lz, B.DEAD_BUSH);
        else if (biome === 'canyon' && h > SEA && fr < 0.01) c.set(lx, h + 1, lz, B.DEAD_BUSH);
        else if (biome === 'jungle' && h > SEA && c.get(lx, h + 1, lz) === B.AIR) { if (fr < 0.22) c.set(lx, h + 1, lz, B.TALL_GRASS); else if (fr < 0.26) c.set(lx, h + 1, lz, B.BERRY_BUSH); }
        else if (biome === 'swamp') {
          // Pantano: nenúfares sobre el agua quieta, pasto alto y flores en la orilla.
          if (h < SEA && h >= SEA - 2 && fr < 0.12) c.set(lx, SEA + 1, lz, B.LILY_PAD);
          else if (h >= SEA && c.get(lx, h + 1, lz) === B.AIR && fr < 0.2) c.set(lx, h + 1, lz, fr < 0.03 ? B.FLOWER_YELLOW : B.TALL_GRASS);
        }
        // Fondo del mar: corales en aguas cálidas y poco profundas; pasto marino y algas en el resto.
        if (h < SEA - 1) {
          const depth = SEA - h;
          const warmSea = this.climate(x, z).temp > 0.1;
          if (warmSea && depth >= 2 && depth <= 9 && fr < 0.4) {
            c.set(lx, h, lz, [B.CORAL_RED, B.CORAL_YELLOW, B.CORAL_PURPLE][Math.floor(hash3(this.seed, x, 333, z) * 3)]);
            if (fr < 0.12) c.set(lx, h + 1, lz, B.CORAL_FAN);
            else if (fr < 0.2 && depth >= 3) c.set(lx, h + 1, lz, [B.CORAL_RED, B.CORAL_YELLOW, B.CORAL_PURPLE][Math.floor(hash3(this.seed, x, 334, z) * 3)]);
          } else if (depth >= 4 && fr < 0.08) {
            const tall = 1 + Math.floor(hash3(this.seed, x, 335, z) * (depth - 2));
            for (let y = h + 1; y <= Math.min(SEA - 1, h + tall); y++) c.set(lx, y, lz, B.KELP);
          } else if (fr < 0.35) c.set(lx, h + 1, lz, B.SEAGRASS);
        }
        // Suelo de las cuevas: musgo y hongos luminosos.
        for (let y = 10; y < Math.min(h - 5, 44); y++) {
          const below = c.get(lx, y, lz);
          if ((below !== B.STONE && below !== B.MOSS) || c.get(lx, y + 1, lz) !== B.AIR || c.get(lx, y + 2, lz) !== B.AIR) continue;
          const r = hash3(this.seed, x, y + 500, z);
          if (r < 0.35) c.set(lx, y, lz, B.MOSS);
          if (r < 0.055) c.set(lx, y + 1, lz, B.GLOW_MUSHROOM);
        }
      }
    }
    this.decorate(c);
    placeRoads(this, c);
    placeRuins(this, c);
    placeDungeons(this, c);
    placeVillages(this, c);
    placeCamps(this, c);
    placeWrecks(this, c);
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
      const cur = c.get(lx, y, lz);
      if (onlyAir && cur !== B.AIR && !(cur >= B.TALL_GRASS && cur <= B.DEAD_BUSH) && cur !== B.FLOWER_RED && cur !== B.FLOWER_YELLOW) return;
      c.set(lx, y, lz, id);
    };
    const hh = (x, z, k) => hash3(this.seed, x, k, z);
    // Copa redonda (roble y abedul).
    const roundTree = (x, h, z, log, leaves, trunk) => {
      for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, log, false);
      const top = h + trunk;
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy <= -1 ? 2 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || hh(x + dx, z + dz, top + dy) < 0.5)) continue;
          put(x + dx, top + dy, z + dz, leaves);
        }
      }
      put(x, top + 2, z, leaves);
      // Algunos robles son manzanos (hojas con fruta) y algunos tienen una colmena colgando.
      if (log === B.LOG && hh(x, z, 91) < 0.18) for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (hh(x + dx, z + dz, top + dy + 5) < 0.45) { const lx = x + dx - x0; const lz = z + dz - z0; if (lx >= 0 && lz >= 0 && lx < CS && lz < CS && c.get(lx, top + dy, lz) === B.LEAVES) c.set(lx, top + dy, lz, B.FRUIT_LEAVES); }
      if (hh(x + 31, z - 17, 5) < 0.14) { const [bx, bz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(hh(x - 11, z + 7, 3) * 4)]; put(x + bx, top - 3, z + bz, B.BEEHIVE); }
    };
    // Roble grande: tronco alto, ramas y copa ancha.
    const bigOak = (x, h, z) => {
      const trunk = 6 + Math.floor(hh(x, z, 13) * 3);
      for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, B.LOG, false);
      const top = h + trunk;
      for (const [bx, bz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hh(x + bx, z + bz, 17) < 0.6) { put(x + bx, top - 2, z + bz, B.LOG, false); put(x + bx * 2, top - 1, z + bz * 2, B.LOG, false); }
      for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const d = (dx * dx + dz * dz) / 10 + (dy * dy) / 5;
        if (d < 1 + (hh(x + dx, z + dz, top + dy) - 0.5) * 0.5) put(x + dx, top + dy, z + dz, B.LEAVES);
      }
    };
    // Pino: tronco alto y capas de agujas en forma de cono (con nieve arriba en lo frío).
    const pine = (x, h, z, snowy) => {
      const trunk = 7 + Math.floor(hh(x, z, 13) * 4);
      for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, B.LOG, false);
      const top = h + trunk;
      for (let k = 0; k <= trunk - 2; k++) {
        const y = top - k + 1;
        const rad = k === 0 ? 0 : Math.min(3, 1 + Math.floor(k / 2.2) - (k % 2 === 0 ? 1 : 0));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
          put(x + dx, y, z + dz, B.PINE_LEAVES);
        }
      }
      put(x, top + 2, z, snowy ? B.SNOW : B.PINE_LEAVES);
    };
    // Palmera: tronco anillado un poco inclinado y hojas que caen en cruz.
    const palm = (x, h, z) => {
      const trunk = 5 + Math.floor(hh(x, z, 13) * 3);
      const lean = hh(x, z, 19) < 0.5 ? [1, 0] : [0, 1];
      let tx = x; let tz = z;
      for (let k = 1; k <= trunk; k++) { if (k === Math.floor(trunk * 0.6)) { tx += lean[0]; tz += lean[1]; } put(tx, h + k, tz, B.PALM_LOG, false); }
      const top = h + trunk;
      put(tx, top + 1, tz, B.PALM_LEAVES);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const diag = dx && dz;
        put(tx + dx, top + 1, tz + dz, B.PALM_LEAVES);
        if (!diag) { put(tx + dx * 2, top + 1, tz + dz * 2, B.PALM_LEAVES); put(tx + dx * 3, top, tz + dz * 3, B.PALM_LEAVES); }
      }
    };
    const bush = (x, h, z) => { put(x, h + 1, z, B.LEAVES); if (hh(x, z, 23) < 0.5) put(x + 1, h + 1, z, B.LEAVES); if (hh(x, z, 29) < 0.4) put(x, h + 2, z, B.LEAVES); };
    const boulder = (x, h, z) => {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + dy > 2 || hh(x + dx, z + dz, h + dy + 31) < 0.25) continue;
        if (this.heightAt(x + dx, z + dz) !== h) continue;
        put(x + dx, h + 1 + dy, z + dz, hh(x + dx, z + dz, 37) < 0.4 ? B.MOSS : B.COBBLE, false);
      }
    };
    // Árbol de selva: tronco alto, copa ancha y oscura, lianas colgando.
    const jungleTree = (x, h, z) => {
      const trunk = 9 + Math.floor(hh(x, z, 13) * 6);
      for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, B.LOG, false);
      const top = h + trunk;
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy === 1 ? 2 : 3 + (dy === -1 ? 1 : 0);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx * dx + dz * dz > rad * rad + 1) continue;
          put(x + dx, top + dy, z + dz, B.JUNGLE_LEAVES);
          // Lianas en el borde de la copa.
          if (dy === -2 && dx * dx + dz * dz >= (rad - 1) * (rad - 1) && hh(x + dx, z + dz, 61) < 0.35) { const len = 2 + Math.floor(hh(x + dx, z + dz, 63) * 5); for (let k = 1; k <= len; k++) put(x + dx, top + dy - k, z + dz, B.VINES); }
        }
      }
    };
    // Árbol de pantano: bajo, ancho, con lianas.
    const swampTree = (x, h, z) => {
      const trunk = 4 + Math.floor(hh(x, z, 13) * 2);
      for (let y = h + 1; y <= h + trunk; y++) put(x, y, z, B.LOG, false);
      const top = h + trunk;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (dx * dx + dz * dz > 10 - dy * 3) continue;
        put(x + dx, top + dy, z + dz, B.LEAVES);
        if (dy === -1 && (Math.abs(dx) === 3 || Math.abs(dz) === 3) && hh(x + dx, z + dz, 67) < 0.5) for (let k = 1; k <= 3; k++) put(x + dx, top - 1 - k, z + dz, B.VINES);
      }
    };
    const fallenLog = (x, h, z) => {
      const along = hh(x, z, 41) < 0.5; const len = 3 + Math.floor(hh(x, z, 43) * 3);
      for (let k = 0; k < len; k++) { const px = along ? x + k : x; const pz = along ? z : z + k; if (this.heightAt(px, pz) === h) put(px, h + 1, pz, B.LOG); }
    };
    for (let x = x0 - 4; x < x0 + CS + 4; x++) {
      for (let z = z0 - 4; z < z0 + CS + 4; z++) {
        const r = hh(x, z, 7);
        if (r > 0.06) continue;   // la mayoría de las columnas no tienen nada
        const biome = this.biome(x, z);
        const h = this.heightAt(x, z);
        if (h <= SEA) continue;
        if (insideVillage(this, x, z) || insideCamp(this, x, z)) continue;   // sin árboles dentro de aldeas ni campamentos
        const t = hh(x, z, 11);
        const warm = this.climate(x, z).temp > 0.05;
        // Playas cálidas y oasis: palmeras.
        if (h <= SEA + 3 && warm && biome !== 'snow') { if (r < 0.025) palm(x, h, z); continue; }
        if (h <= SEA + 1) continue;
        if (biome === 'desert') {
          if (r < 0.006) { const tall = 2 + Math.floor(hh(x, z, 9) * 3); for (let y = h + 1; y <= h + tall; y++) put(x, y, z, B.CACTUS); }
          continue;
        }
        if (biome === 'snow') { if (r < 0.03) pine(x, h, z, true); continue; }
        if (biome === 'canyon') { if (r < 0.004) { const tall = 2 + Math.floor(hh(x, z, 9) * 3); for (let y = h + 1; y <= h + tall; y++) put(x, y, z, B.CACTUS); } continue; }
        if (biome === 'jungle') { if (r < 0.06) jungleTree(x, h, z); continue; }
        if (biome === 'swamp') { if (r < 0.02) swampTree(x, h, z); continue; }
        if (biome === 'mountains') { if (r < 0.012 && h < 64) pine(x, h, z, h > 56); else if (r > 0.055) boulder(x, h, z); continue; }
        if (biome === 'forest') {
          if (r < 0.05) { if (t < 0.45) roundTree(x, h, z, B.LOG, B.LEAVES, 4 + Math.floor(hh(x, z, 13) * 3)); else if (t < 0.75) roundTree(x, h, z, B.BIRCH_LOG, B.BIRCH_LEAVES, 5 + Math.floor(hh(x, z, 13) * 3)); else if (t < 0.9) bigOak(x, h, z); else pine(x, h, z, false); }
          else if (r < 0.056) fallenLog(x, h, z);
          else bush(x, h, z);
          continue;
        }
        // Llanura: árboles sueltos, arbustos y alguna roca.
        if (r < 0.009) { if (t < 0.7) roundTree(x, h, z, B.LOG, B.LEAVES, 4 + Math.floor(hh(x, z, 13) * 3)); else bigOak(x, h, z); }
        else if (r < 0.022) bush(x, h, z);
        else if (r < 0.0235) boulder(x, h, z);
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
