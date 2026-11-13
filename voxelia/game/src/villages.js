import { B } from './blocks.js';
import { CS, SEA, hash3 } from './world.js';

// ───────── Aldeas ─────────
// El mundo se divide en regiones de REGION×REGION bloques; algunas tienen una aldea.
// Todo sale de la semilla: misma semilla, mismas aldeas, mismas casas en el mismo lugar.
// Estilo según el bioma: medieval (llanura), rústica (bosque), desierto y nieve.
export const REGION = 128;
const HOUSE = 7;                         // casas de 7×7 (interior 5×5)

const NAMES = {
  medieval: ['Robledal', 'Piedrahita', 'Valdemora', 'Torrealba', 'Castrillo', 'Peñalba', 'Villacrespa', 'Montecruz'],
  rustic: ['Hojarasca', 'Musgoverde', 'Fresneda', 'Los Pinos', 'Brezal', 'Helechos', 'Ramalinda'],
  desert: ['Arenales', 'Oasis Rojo', 'Dunas Altas', 'Palmeral', 'Sol de Barro', 'Espejismo'],
  snow: ['Escarcha', 'Nevadilla', 'Pico Blanco', 'Hielo Viejo', 'Ventisca', 'Albarrada'],
};

const STYLE_BY_BIOME = { plains: 'medieval', forest: 'rustic', desert: 'desert', snow: 'snow' };

// Materiales de cada estilo.
export const STYLES = {
  medieval: { floor: B.PLANKS, base: B.COBBLE, wall: B.PLANKS, corner: B.LOG, roof: B.ROOF, window: B.GLASS, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'medieval' },
  rustic: { floor: B.PLANKS, base: B.PLANKS, wall: B.PLANKS, corner: B.LOG, roof: B.THATCH, window: B.GLASS, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'del bosque' },
  desert: { floor: B.ADOBE, base: B.ADOBE, wall: B.ADOBE, corner: B.ADOBE, roof: null, window: B.AIR, path: B.CLAY, post: B.COBBLE, light: B.TORCH, chimney: false, label: 'del desierto' },
  snow: { floor: B.PLANKS, base: B.COBBLE, wall: B.BIRCH_LOG, corner: B.LOG, roof: B.SNOW, window: B.GLASS, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'de la nieve' },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Rango de alturas del terreno natural en un cuadrado (para ver si es bastante plano).
function heightRange(world, cx, cz, r, step = 2) {
  let lo = Infinity; let hi = -Infinity;
  for (let dx = -r; dx <= r; dx += step) for (let dz = -r; dz <= r; dz += step) { const h = world.heightAt(cx + dx, cz + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}

// Casa: posición, piso, puerta mirando hacia la plaza y puntos de entrada (afuera → puerta → adentro).
function makeHouse(world, plan, hx, hz, initial) {
  const [lo, hi] = heightRange(world, hx, hz, 3, 1);
  if (hi - lo > 4 || lo <= SEA) return null;
  const y = world.heightAt(hx, hz);
  const dx = plan.x - hx; const dz = plan.z - hz;
  let face;
  if (Math.abs(dx) > Math.abs(dz)) face = dx > 0 ? [1, 0] : [-1, 0]; else face = dz > 0 ? [0, 1] : [0, -1];
  const door = { x: hx + face[0] * 3, z: hz + face[1] * 3 };
  return {
    x: hx, z: hz, y, face, door, initial,
    outside: { x: hx + face[0] * 5 + 0.5, z: hz + face[1] * 5 + 0.5 },
    doorCell: { x: door.x + 0.5, z: door.z + 0.5 },
    inside: { x: hx + 0.5 - face[0] * 1, z: hz + 0.5 - face[1] * 1 },
  };
}

const overlaps = (list, x, z, gap) => list.some((h) => Math.abs(h.x - x) < HOUSE + gap && Math.abs(h.z - z) < HOUSE + gap);

// Plan de la aldea de una región (o null si no hay). Se guarda en caché en el mundo.
export function villagePlan(world, rx, rz) {
  const cache = world._villages ?? (world._villages = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  const r = rng(Math.floor(hash3(world.seed, rx, 777, rz) * 4294967296));
  // Cerca del inicio (regiones -1..0) se busca con más ganas: siempre hay una aldea a mano.
  const home = Math.abs(rx + 0.5) <= 1 && Math.abs(rz + 0.5) <= 1;
  const tries = home ? 24 : r() < 0.75 ? 6 : 0;
  let x = 0; let z = 0; let style = null; let y = 0;
  for (let t = 0; t < tries && !style; t++) {
    x = rx * REGION + 30 + Math.floor(r() * (REGION - 60));
    z = rz * REGION + 30 + Math.floor(r() * (REGION - 60));
    const s = STYLE_BY_BIOME[world.biome(x, z)];
    y = world.heightAt(x, z);
    const [lo, hi] = heightRange(world, x, z, 12, 3);
    if (s && y > SEA + 1 && y < SEA + 34 && hi - lo <= 10) style = s;
  }
  if (style) {
    {
      const names = NAMES[style];
      plan = { id: `v${rx}_${rz}`, rx, rz, x, z, y, style, name: names[Math.floor(r() * names.length)], houses: [], slots: [], posts: [], tower: null, radius: 0 };
      // Casas iniciales en un anillo alrededor de la plaza.
      const want = 4 + Math.floor(r() * 3);
      const a0 = r() * Math.PI * 2;
      for (let k = 0; k < 14 && plan.houses.length < want; k++) {
        const a = a0 + k * 2.39996;      // ángulo dorado: reparte sin amontonar
        const rad = 12 + r() * 5;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps(plan.houses, hx, hz, 2)) continue;
        const h = makeHouse(world, plan, hx, hz, true);
        if (h) plan.houses.push(h);
      }
      // Lugares para crecer: casas que los constructores levantan con el tiempo.
      for (let k = 0; k < 40 && plan.slots.length < 7; k++) {
        const a = a0 + 1.2 + k * 2.39996;
        const rad = 21 + r() * 9;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots], hx, hz, 2)) continue;
        const h = makeHouse(world, plan, hx, hz, false);
        if (h) plan.slots.push(h);
      }
      if (plan.houses.length < 3) plan = null;
    }
    if (plan) {
      // Torre de vigilancia (solo medieval) y faroles alrededor de la plaza.
      if (plan.style === 'medieval') {
        for (let k = 0; k < 10 && !plan.tower; k++) {
          const a = r() * Math.PI * 2; const tx = Math.round(x + Math.cos(a) * 8); const tz = Math.round(z + Math.sin(a) * 8);
          if (overlaps(plan.houses, tx, tz, 0)) continue;
          const [tlo, thi] = heightRange(world, tx, tz, 2, 1);
          if (thi - tlo <= 3) plan.tower = { x: tx, z: tz, y: world.heightAt(tx, tz) };
        }
      }
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4; const px = Math.round(x + Math.cos(a) * 5); const pz = Math.round(z + Math.sin(a) * 5);
        plan.posts.push({ x: px, z: pz, y: world.heightAt(px, pz) });
      }
      plan.radius = Math.max(...[...plan.houses, ...plan.slots].map((h) => Math.hypot(h.x - x, h.z - z))) + 6;
    }
  }
  cache.set(key, plan);
  return plan;
}

// Aldeas cuyo radio llega a menos de `dist` bloques de (x, z).
export function villagesNear(world, x, z, dist = 0) {
  const out = [];
  const reach = 48 + dist;
  for (let rx = Math.floor((x - reach) / REGION); rx <= Math.floor((x + reach) / REGION); rx++) {
    for (let rz = Math.floor((z - reach) / REGION); rz <= Math.floor((z + reach) / REGION); rz++) {
      const p = villagePlan(world, rx, rz);
      if (p && Math.hypot(p.x - x, p.z - z) <= p.radius + dist) out.push(p);
    }
  }
  return out;
}

// ───────── Planos de construcción ─────────
// Lista ordenada de bloques (de abajo hacia arriba), la misma que usa el generador y el constructor.
export function houseBlueprint(world, plan, h) {
  const st = STYLES[plan.style];
  const out = [];
  const put = (x, y, z, id) => out.push({ x, y, z, id });
  const x0 = h.x - 3; const z0 = h.z - 3; const y = h.y;
  // 1. Despejar lo que haya arriba (terreno, árboles) y rellenar cimientos en pendiente.
  for (let x = x0 - 1; x <= x0 + 7; x++) for (let z = z0 - 1; z <= z0 + 7; z++) {
    for (let yy = y + 1; yy <= y + 9; yy++) put(x, yy, z, B.AIR);
    if (x < x0 || z < z0 || x > x0 + 6 || z > z0 + 6) continue;
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, y - 1); yy < y; yy++) put(x, yy, z, st.base);
  }
  // 2. Piso.
  for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) put(x, y, z, st.floor);
  // 3. Paredes, capa por capa, con puerta hacia la plaza y ventanas en los otros lados.
  const side = (x, z) => (x === x0 || x === x0 + 6) && (z === z0 || z === z0 + 6) ? 'corner' : 'wall';
  for (let yy = y + 1; yy <= y + 3; yy++) {
    for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) {
      const edge = x === x0 || z === z0 || x === x0 + 6 || z === z0 + 6;
      if (!edge) continue;
      if (x === h.door.x && z === h.door.z && yy <= y + 2) { put(x, yy, z, B.AIR); continue; }
      const mid = (x === h.x && (z === z0 || z === z0 + 6)) || (z === h.z && (x === x0 || x === x0 + 6));
      if (mid && yy === y + 2) { put(x, yy, z, st.window); continue; }
      put(x, yy, z, side(x, z) === 'corner' ? st.corner : yy === y + 1 ? st.base : st.wall);
    }
  }
  // 4. Techo: pirámide hueca con alero (o techo plano con almenas en el desierto).
  if (st.roof) {
    for (let k = 0; k <= 4; k++) {
      const a = x0 - 1 + k; const b = x0 + 7 - k; const c = z0 - 1 + k; const d = z0 + 7 - k;
      for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) if (k === 4 || x === a || x === b || z === c || z === d) put(x, y + 4 + k, z, st.roof);
    }
    // Chimenea de piedra en una esquina.
    if (st.chimney) for (let yy = y + 4; yy <= y + 8; yy++) put(x0 + 5, yy, z0 + 5, B.COBBLE);
  } else {
    for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) put(x, y + 4, z, st.wall);
    for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) if ((x === x0 || z === z0 || x === x0 + 6 || z === z0 + 6) && (x + z) % 2 === 0) put(x, y + 5, z, st.wall);
  }
  // 5. Adentro: luz, una "cama" de lana y una mesa de trabajo.
  const back = { x: h.x - h.face[0] * 2, z: h.z - h.face[1] * 2 };
  put(back.x + h.face[1] * 2, y + 1, back.z + h.face[0] * 2, B.TORCH);
  put(back.x - h.face[1] * 2, y + 1, back.z - h.face[0] * 2, B.WOOL_RED);
  put(back.x, y + 1, back.z, B.WORKBENCH);
  return out;
}

// Chimenea (para el humo): punta de la chimenea de una casa, o null.
export function chimneyTop(plan, h) {
  return STYLES[plan.style].chimney ? { x: h.x - 3 + 5 + 0.5, y: h.y + 9.2, z: h.z - 3 + 5 + 0.5 } : null;
}

function towerBlueprint(world, plan, t) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const x0 = t.x - 2; const z0 = t.z - 2; const y = t.y;
  const dx = Math.sign(plan.x - t.x); const dz = Math.sign(plan.z - t.z);
  const door = Math.abs(plan.x - t.x) > Math.abs(plan.z - t.z) ? { x: t.x + dx * 2, z: t.z } : { x: t.x, z: t.z + (dz || 1) * 2 };
  for (let x = x0; x <= x0 + 4; x++) for (let z = z0; z <= z0 + 4; z++) {
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, y); yy <= y; yy++) put(x, yy, z, B.COBBLE);
    for (let yy = y + 1; yy <= y + 12; yy++) put(x, yy, z, B.AIR);
  }
  for (let yy = y + 1; yy <= y + 8; yy++) for (let x = x0; x <= x0 + 4; x++) for (let z = z0; z <= z0 + 4; z++) {
    const edge = x === x0 || z === z0 || x === x0 + 4 || z === z0 + 4;
    if (!edge) continue;
    if (x === door.x && z === door.z && yy <= y + 2) continue;
    // Troneras: aberturas angostas a media altura.
    if ((yy === y + 5) && (x === t.x || z === t.z)) continue;
    put(x, yy, z, B.COBBLE);
  }
  for (let x = x0 - 1; x <= x0 + 5; x++) for (let z = z0 - 1; z <= z0 + 5; z++) put(x, y + 9, z, B.PLANKS);
  // Almenas.
  for (let x = x0 - 1; x <= x0 + 5; x++) for (let z = z0 - 1; z <= z0 + 5; z++) {
    const edge = x === x0 - 1 || z === z0 - 1 || x === x0 + 5 || z === z0 + 5;
    if (edge && (x + z) % 2 === 0) put(x, y + 10, z, B.COBBLE);
  }
  put(t.x, y + 10, t.z, B.LAMP);
  put(t.x, y + 1, t.z, B.TORCH);
  return out;
}

// Plaza con pozo, caminos a cada casa y faroles.
function plazaBlueprint(world, plan) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const st = STYLES[plan.style];
  const ground = (x, z) => world.heightAt(x, z);
  const pave = (x, z) => { const g = ground(x, z); if (g > SEA) { put(x, g, z, st.path); put(x, g + 1, z, B.AIR); put(x, g + 2, z, B.AIR); } };
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (dx * dx + dz * dz <= 26) pave(plan.x + dx, plan.z + dz);
  // Caminos rectos (en L) desde la plaza hasta la entrada de cada casa.
  for (const h of plan.houses) {
    const tx = Math.floor(h.outside.x); const tz = Math.floor(h.outside.z);
    for (let x = Math.min(plan.x, tx); x <= Math.max(plan.x, tx); x++) pave(x, plan.z);
    for (let z = Math.min(plan.z, tz); z <= Math.max(plan.z, tz); z++) pave(tx, z);
    pave(Math.floor(h.doorCell.x), Math.floor(h.doorCell.z));
  }
  // Pozo de 4×4 con agua y techito.
  const y = plan.y; const x0 = plan.x - 2; const z0 = plan.z - 2;
  for (let x = x0; x <= x0 + 3; x++) for (let z = z0; z <= z0 + 3; z++) {
    const inner = x > x0 && x < x0 + 3 && z > z0 && z < z0 + 3;
    put(x, y - 1, z, inner ? B.WATER : B.COBBLE);
    put(x, y, z, inner ? B.WATER : B.COBBLE);
    put(x, y + 1, z, inner ? B.AIR : B.COBBLE);
    for (let yy = y + 2; yy <= y + 3; yy++) put(x, yy, z, (x === x0 || x === x0 + 3) && (z === z0 || z === z0 + 3) ? (plan.style === 'desert' ? B.ADOBE : B.LOG) : B.AIR);
    put(x, y + 4, z, plan.style === 'desert' ? B.ADOBE : st.roof ?? B.PLANKS);
  }
  // Faroles.
  for (const p of plan.posts) {
    put(p.x, p.y + 1, p.z, st.post); put(p.x, p.y + 2, p.z, st.post); put(p.x, p.y + 3, p.z, st.light);
  }
  return out;
}

// Todos los bloques de la aldea tal como nace (casas iniciales, torre, plaza). Caché por plan.
export function villageBlocks(world, plan) {
  if (plan._blocks) return plan._blocks;
  const list = plazaBlueprint(world, plan);
  if (plan.tower) list.push(...towerBlueprint(world, plan, plan.tower));
  for (const h of plan.houses) list.push(...houseBlueprint(world, plan, h));
  plan._blocks = list;
  return list;
}

// Coloca en un chunk recién generado los bloques de las aldeas que lo tocan.
export function placeVillages(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  for (const plan of villagesNear(world, x0 + CS / 2, z0 + CS / 2, CS)) {
    for (const b of villageBlocks(world, plan)) {
      const lx = b.x - x0; const lz = b.z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || b.y < 0 || b.y >= 96) continue;
      chunk.set(lx, b.y, lz, b.id);
    }
  }
}

// ¿Esta columna está dentro de una aldea? (para no plantar árboles encima)
export function insideVillage(world, x, z) {
  return villagesNear(world, x, z, 0).length > 0;
}
