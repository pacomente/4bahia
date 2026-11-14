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
  medieval: { floor: B.PLANKS, base: B.COBBLE, wall: B.PLANKS, corner: B.LOG, roof: B.ROOF, window: B.WINDOW, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'medieval' },
  rustic: { floor: B.PLANKS, base: B.PLANKS, wall: B.PLANKS, corner: B.LOG, roof: B.THATCH, window: B.WINDOW, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'del bosque' },
  desert: { floor: B.ADOBE, base: B.ADOBE, wall: B.ADOBE, corner: B.ADOBE, roof: null, window: B.AIR, path: B.CLAY, post: B.COBBLE, light: B.TORCH, chimney: false, label: 'del desierto' },
  snow: { floor: B.PLANKS, base: B.COBBLE, wall: B.BIRCH_LOG, corner: B.LOG, roof: B.SNOW, window: B.WINDOW, path: B.GRAVEL, post: B.LOG, light: B.LAMP, chimney: true, label: 'de la nieve' },
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
    // Dos camas en las esquinas del fondo.
    beds: [1, -1].map((s) => ({ x: hx - face[0] * 2 + face[1] * 2 * s, z: hz - face[1] * 2 + face[0] * 2 * s })),
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
      plan = { id: `v${rx}_${rz}`, rx, rz, x, z, y, style, name: names[Math.floor(r() * names.length)], houses: [], slots: [], posts: [], castle: null, radius: 0 };
      // Castillo del rey (solo medieval): torre grande con sala del trono.
      if (plan.style === 'medieval') {
        for (let k = 0; k < 16 && !plan.castle; k++) {
          const a = r() * Math.PI * 2; const tx = Math.round(x + Math.cos(a) * 11); const tz = Math.round(z + Math.sin(a) * 11);
          const [tlo, thi] = heightRange(world, tx, tz, 3, 1);
          if (thi - tlo <= 3) plan.castle = makeHouse(world, plan, tx, tz, true);
          if (plan.castle) { const f = plan.castle.face; plan.castle.throne = { x: tx - f[0] + 0.5, z: tz - f[1] + 0.5 }; plan.castle.isCastle = true; }
        }
      }
      // Casas iniciales en un anillo alrededor de la plaza.
      const want = 4 + Math.floor(r() * 3);
      const a0 = r() * Math.PI * 2;
      for (let k = 0; k < 24 && plan.houses.length < want; k++) {
        const a = a0 + k * 2.39996;      // ángulo dorado: reparte sin amontonar
        const rad = 12 + r() * 5;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...(plan.castle ? [plan.castle] : [])], hx, hz, 2)) continue;
        const h = makeHouse(world, plan, hx, hz, true);
        if (h) plan.houses.push(h);
      }
      // Lugares para crecer: casas que los constructores levantan con el tiempo.
      for (let k = 0; k < 40 && plan.slots.length < 7; k++) {
        const a = a0 + 1.2 + k * 2.39996;
        const rad = 21 + r() * 9;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots, ...(plan.castle ? [plan.castle] : [])], hx, hz, 2)) continue;
        const h = makeHouse(world, plan, hx, hz, false);
        if (h) plan.slots.push(h);
      }
      if (plan.houses.length < 3) plan = null;
    }
    if (plan) {
      // Mercado: puestos con toldo alrededor de la plaza, mirando al pozo.
      plan.stalls = [];
      for (let k = 0; k < 8 && plan.stalls.length < 3; k++) {
        const a = k * Math.PI / 4 + (r() < 0.5 ? 0 : Math.PI / 8);
        const sx = Math.round(x + Math.cos(a) * 8); const sz = Math.round(z + Math.sin(a) * 8);
        if (overlaps(plan.houses, sx, sz, -2) || (plan.castle && Math.hypot(plan.castle.x - sx, plan.castle.z - sz) < 7) || plan.stalls.some((s) => Math.hypot(s.x - sx, s.z - sz) < 5)) continue;
        const f = Math.abs(x - sx) > Math.abs(z - sz) ? [Math.sign(x - sx), 0] : [0, Math.sign(z - sz) || 1];
        plan.stalls.push({ x: sx, z: sz, y: world.heightAt(sx, sz), f, spot: { x: sx - f[0] + 0.5, z: sz - f[1] + 0.5 } });
      }
      // Campos de trigo con canal de riego, cerca del borde.
      plan.fields = [];
      for (let k = 0; k < 20 && plan.fields.length < (plan.style === 'desert' ? 1 : 2); k++) {
        const a = r() * Math.PI * 2; const rad = 15 + r() * 8;
        const fx = Math.round(x + Math.cos(a) * rad); const fz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots, ...(plan.castle ? [plan.castle] : [])], fx, fz, 0) || plan.fields.some((f) => Math.hypot(f.x - fx, f.z - fz) < 10)) continue;
        const [flo, fhi] = heightRange(world, fx, fz, 4, 1);
        if (fhi - flo > 3 || flo <= SEA) continue;
        const fy = world.heightAt(fx, fz);
        const cells = [];
        for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) if (dz !== 0) cells.push({ x: fx + dx, y: fy, z: fz + dz });
        plan.fields.push({ x: fx, z: fz, y: fy, cells });
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
    // Chimenea de piedra justo arriba del hogar (el humo sale de ahí).
    if (st.chimney) { const f = furnish(h).fireplace; for (let yy = y + 4; yy <= y + 9; yy++) put(f.x, yy, f.z, B.COBBLE); }
  } else {
    for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) put(x, y + 4, z, st.wall);
    for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) if ((x === x0 || z === z0 || x === x0 + 6 || z === z0 + 6) && (x + z) % 2 === 0) put(x, y + 5, z, st.wall);
  }
  // 5. Adentro: camas, hogar con chimenea y los muebles del tipo de casa (ver furnish).
  const fu = furnish(h);
  for (const b of h.beds) put(b.x, y + 1, b.z, B.BED);
  for (const it of fu.items) put(it.x, y + 1, it.z, it.id);
  if (st.chimney) { put(fu.fireplace.x, y + 1, fu.fireplace.z, B.FIREPLACE); put(fu.fireplace.x, y + 2, fu.fireplace.z, B.COBBLE); put(fu.fireplace.x, y + 3, fu.fireplace.z, B.COBBLE); }
  put(fu.torch.x, y + 1, fu.torch.z, B.TORCH);
  put(h.door.x, y + 1, h.door.z, B.DOOR); put(h.door.x, y + 2, h.door.z, B.DOOR);
  // Flores a los costados de la entrada (si el suelo de afuera está a la altura del piso).
  for (const it of fu.flowers) if (world.heightAt(it.x, it.z) === y) put(it.x, y + 1, it.z, it.id);
  return out;
}

// Muebles de una casa según su tipo. Coordenadas locales: u = de costado, v = hacia la puerta.
// El pasillo central (u = 0) queda libre para ir de la puerta a las camas del fondo.
export function furnish(h) {
  const f = h.face; const L = (u, v) => ({ x: h.x + f[1] * u + f[0] * v, z: h.z + f[0] * u + f[1] * v });
  const kind = ['family', 'workshop', 'farm'][((h.x * 7 + h.z * 13) % 3 + 3) % 3];
  const items = []; const add = (u, v, id) => items.push({ ...L(u, v), id });
  const chairs = [];
  if (kind === 'family') {
    add(-1, 0, B.TABLE); add(-2, 0, B.CHAIR); add(-1, 1, B.CHAIR); chairs.push(L(-2, 0), L(-1, 1));
    add(0, -2, B.BOOKSHELF);
    for (const [u, v] of [[0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]]) add(u, v, B.CARPET);
  } else if (kind === 'workshop') {
    add(-1, 0, B.ANVIL); add(0, -2, B.WORKBENCH); add(-2, 0, B.BARREL); add(-2, 1, B.BARREL);
  } else {
    add(-2, 0, B.HAY); add(-2, 1, B.HAY); add(0, -2, B.BARREL); add(-1, 0, B.TABLE); add(-1, 1, B.CHAIR); chairs.push(L(-1, 1));
  }
  const table = items.find((i) => i.id === B.TABLE) ?? null;
  return {
    kind, items, chairs, table, fireplace: L(2, -1), torch: L(2, 2),
    flowers: [{ ...L(-1, 4), id: B.FLOWER_RED }, { ...L(1, 4), id: B.FLOWER_YELLOW }],
  };
}

// Chimenea (para el humo): punta de la chimenea de una casa, o null.
export function chimneyTop(plan, h) {
  if (!STYLES[plan.style].chimney || h.isCastle) return null;
  const f = furnish(h).fireplace;
  return { x: f.x + 0.5, y: h.y + 10.2, z: f.z + 0.5 };
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

// Castillo: torre de 7×7 de piedra, más alta, con torrecitas, almenas y sala del trono adentro.
function castleBlueprint(world, plan, h) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const x0 = h.x - 3; const z0 = h.z - 3; const y = h.y;
  for (let x = x0 - 1; x <= x0 + 7; x++) for (let z = z0 - 1; z <= z0 + 7; z++) {
    for (let yy = y + 1; yy <= y + 12; yy++) put(x, yy, z, B.AIR);
    if (x < x0 || z < z0 || x > x0 + 6 || z > z0 + 6) continue;
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, y - 1); yy < y; yy++) put(x, yy, z, B.COBBLE);
    put(x, y, z, B.PLANKS);
  }
  for (let yy = y + 1; yy <= y + 6; yy++) for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) {
    const edge = x === x0 || z === z0 || x === x0 + 6 || z === z0 + 6;
    if (!edge) continue;
    if (x === h.door.x && z === h.door.z && yy <= y + 2) { put(x, yy, z, B.DOOR); continue; }
    const mid = (x === h.x || z === h.z) && !(x === h.door.x && z === h.door.z);
    if (mid && (yy === y + 3 || yy === y + 4)) { put(x, yy, z, B.WINDOW); continue; }
    put(x, yy, z, yy === y + 1 || (x === x0 || x === x0 + 6) && (z === z0 || z === z0 + 6) ? B.COBBLE : B.BRICK);
  }
  for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) put(x, y + 7, z, B.COBBLE);
  // Almenas y torrecitas en las esquinas.
  for (let x = x0; x <= x0 + 6; x++) for (let z = z0; z <= z0 + 6; z++) {
    const edge = x === x0 || z === z0 || x === x0 + 6 || z === z0 + 6;
    const corner = (x === x0 || x === x0 + 6) && (z === z0 || z === z0 + 6);
    if (corner) { put(x, y + 8, z, B.COBBLE); put(x, y + 9, z, B.COBBLE); put(x, y + 10, z, B.ROOF); }
    else if (edge && (x + z) % 2 === 0) put(x, y + 8, z, B.COBBLE);
  }
  put(h.x, y + 8, h.z, B.LAMP);
  // Sala del trono: alfombra roja de la puerta al trono, estandartes y antorchas.
  const f = h.face;
  for (let k = -2; k <= 2; k++) put(h.x + f[0] * k, y, h.z + f[1] * k, B.WOOL_RED);
  const throne = { x: h.x - f[0] * 2, z: h.z - f[1] * 2 };
  put(throne.x, y + 1, throne.z, B.THRONE);
  // Bibliotecas a los costados del trono.
  for (const sgn of [1, -1]) put(h.x + f[1] * 2 * sgn - f[0] * 1, y + 1, h.z + f[0] * 2 * sgn - f[1] * 1, B.BOOKSHELF);
  for (const s of [1, -1]) {
    put(h.x + f[1] * 3 * s - f[0] * 1, y + 4, h.z + f[0] * 3 * s - f[1] * 1, B.WOOL_BLUE);   // estandartes
    put(h.x + f[1] * 2 * s + f[0] * 1, y + 1, h.z + f[0] * 2 * s + f[1] * 1, B.TORCH);
  }
  for (const b of h.beds) put(b.x, y + 1, b.z, B.BED);
  return out;
}

// Mercado: mostrador de tablas, postes y toldo a rayas.
function stallBlueprint(plan, s) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const [fx, fz] = s.f; const px = fz; const pz = fx;   // perpendicular
  const y = s.y;
  for (let k = -1; k <= 1; k++) {
    for (let j = -1; j <= 0; j++) for (let yy = y + 1; yy <= y + 3; yy++) put(s.x + px * k + fx * j, yy, s.z + pz * k + fz * j, B.AIR);
    put(s.x + px * k, y + 1, s.z + pz * k, B.PLANKS);
    if (k !== 0) put(s.x + px * k, y + 2, s.z + pz * k, k < 0 ? B.HAY : B.BARREL);   // mercadería sobre el mostrador
    for (let j = -1; j <= 0; j++) put(s.x + px * k + fx * j, y + 4, s.z + pz * k + fz * j, (k + 2) % 2 ? B.WOOL_RED : B.WOOL_WHITE);
  }
  for (const k of [-1, 1]) for (let yy = y + 1; yy <= y + 3; yy++) put(s.x + px * k - fx, yy, s.z + pz * k - fz, B.LOG);
  return out;
}

// Campo de trigo: tierra arada, canal de agua en el medio, borde de troncos y trigo plantado.
function fieldBlueprint(world, plan, f) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  for (let dx = -4; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) {
    const x = f.x + dx; const z = f.z + dz;
    for (let yy = f.y + 1; yy <= f.y + 4; yy++) put(x, yy, z, B.AIR);
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, f.y - 1); yy < f.y; yy++) put(x, yy, z, B.DIRT);
    const border = Math.abs(dx) === 4 || Math.abs(dz) === 3;
    if (border) { put(x, f.y, z, B.LOG); continue; }
    if (dz === 0) { put(x, f.y, z, B.WATER); continue; }
    put(x, f.y, z, B.FARMLAND);
    put(x, f.y + 1, z, ((x * 7 + z * 13) & 3) ? B.WHEAT_RIPE : B.WHEAT_YOUNG);
  }
  return out;
}

// Todos los bloques de la aldea tal como nace (casas iniciales, castillo, mercado, campos). Caché por plan.
export function villageBlocks(world, plan) {
  if (plan._blocks) return plan._blocks;
  const list = plazaBlueprint(world, plan);
  for (const f of plan.fields ?? []) list.push(...fieldBlueprint(world, plan, f));
  for (const s of plan.stalls ?? []) list.push(...stallBlueprint(plan, s));
  if (plan.castle) list.push(...castleBlueprint(world, plan, plan.castle));
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
