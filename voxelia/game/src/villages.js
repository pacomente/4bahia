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
  const big = () => [plan?.castle, plan?.church, plan?.school].filter(Boolean);
  const r = rng(Math.floor(hash3(world.seed, rx, 777, rz) * 4294967296));
  // Cerca del inicio (regiones -1..0) se busca con más ganas: siempre hay una aldea a mano.
  const home = Math.abs(rx + 0.5) <= 1 && Math.abs(rz + 0.5) <= 1;
  const tries = home ? 40 : r() < 0.75 ? 6 : 0;
  let x = 0; let z = 0; let style = null; let y = 0; let fallback = null;
  // ¿Hay mar cerca? (cerca del inicio se prefiere un lugar con puerto)
  const coastal = (cx, cz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { for (let k = 10; k <= 54; k += 4) if (world.heightAt(cx + dx * k, cz + dz * k) < SEA - 3) return true; return false; });
  for (let t = 0; t < tries && !style; t++) {
    x = rx * REGION + 30 + Math.floor(r() * (REGION - 60));
    z = rz * REGION + 30 + Math.floor(r() * (REGION - 60));
    const s = STYLE_BY_BIOME[world.biome(x, z)];
    y = world.heightAt(x, z);
    const [lo, hi] = heightRange(world, x, z, 12, 3);
    if (s && y > SEA + 1 && y < SEA + 34 && hi - lo <= 10) {
      if (home && !coastal(x, z) && t < tries - 1) { fallback ??= { x, z, y, s }; continue; }
      style = s;
    }
  }
  if (!style && fallback) ({ x, z, y, s: style } = fallback);
  if (style) {
    {
      const names = NAMES[style];
      plan = { id: `v${rx}_${rz}`, rx, rz, x, z, y, style, name: names[Math.floor(r() * names.length)], houses: [], slots: [], posts: [], castle: null, church: null, school: null, pen: null, radius: 0 };
      // Castillo del rey (solo medieval): torre grande con sala del trono.
      if (plan.style === 'medieval') {
        for (let k = 0; k < 16 && !plan.castle; k++) {
          const a = r() * Math.PI * 2; const tx = Math.round(x + Math.cos(a) * 11); const tz = Math.round(z + Math.sin(a) * 11);
          const [tlo, thi] = heightRange(world, tx, tz, 3, 1);
          if (thi - tlo <= 3) plan.castle = makeHouse(world, plan, tx, tz, true);
          if (plan.castle) { const f = plan.castle.face; plan.castle.throne = { x: tx - f[0] + 0.5, z: tz - f[1] + 0.5 }; plan.castle.isCastle = true; }
        }
      }
      // Iglesia con campanario y escuela para los chicos, cerca de la plaza.
      for (const kind of ['church', 'school']) {
        for (let k = 0; k < 18 && !plan[kind]; k++) {
          const a = r() * Math.PI * 2; const rad = 12 + r() * 8;
          const tx = Math.round(x + Math.cos(a) * rad); const tz = Math.round(z + Math.sin(a) * rad);
          if (overlaps(big(), tx, tz, 2)) continue;
          const h = makeHouse(world, plan, tx, tz, true);
          if (!h) continue;
          h.beds = []; h.special = kind; plan[kind] = h;
          const f = h.face; const L = (u, v) => ({ x: tx + f[1] * u + f[0] * v + 0.5, z: tz + f[0] * u + f[1] * v + 0.5 });
          if (kind === 'church') {
            h.seats = []; for (const v of [0, 1, 2]) for (const u of [-2, -1, 1, 2]) h.seats.push(L(u, v));
            h.altar = L(0, -2); h.stand = L(0, -1); h.bell = { ...L(0, 2), y: h.y + 11 };
          } else {
            h.seats = furnish(h).chairs.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
            h.board = L(0, -2); h.stand = L(0, -1);
          }
        }
      }
      // Casas iniciales en un anillo alrededor de la plaza.
      const want = 4 + Math.floor(r() * 3);
      const a0 = r() * Math.PI * 2;
      for (let k = 0; k < 24 && plan.houses.length < want; k++) {
        const a = a0 + k * 2.39996;      // ángulo dorado: reparte sin amontonar
        const rad = 12 + r() * 5;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...big()], hx, hz, 2)) continue;
        const h = makeHouse(world, plan, hx, hz, true);
        if (h) plan.houses.push(h);
      }
      // Lugares para crecer: casas que los constructores levantan con el tiempo.
      for (let k = 0; k < 40 && plan.slots.length < 7; k++) {
        const a = a0 + 1.2 + k * 2.39996;
        const rad = 21 + r() * 9;
        const hx = Math.round(x + Math.cos(a) * rad); const hz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots, ...big()], hx, hz, 2)) continue;
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
        if (overlaps([...plan.houses, ...big()], sx, sz, -2) || plan.stalls.some((s) => Math.hypot(s.x - sx, s.z - sz) < 5)) continue;
        const f = Math.abs(x - sx) > Math.abs(z - sz) ? [Math.sign(x - sx), 0] : [0, Math.sign(z - sz) || 1];
        plan.stalls.push({ x: sx, z: sz, y: world.heightAt(sx, sz), f, spot: { x: sx - f[0] + 0.5, z: sz - f[1] + 0.5 } });
      }
      // Campos de trigo con canal de riego, cerca del borde.
      plan.fields = [];
      for (let k = 0; k < 50 && plan.fields.length < (plan.style === 'desert' ? 1 : 2); k++) {
        const a = r() * Math.PI * 2; const rad = 14 + r() * 14;
        const fx = Math.round(x + Math.cos(a) * rad); const fz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots, ...big()], fx, fz, 0) || plan.fields.some((f) => Math.hypot(f.x - fx, f.z - fz) < 10)) continue;
        const [flo, fhi] = heightRange(world, fx, fz, 4, 1);
        if (fhi - flo > 4 || flo <= SEA) continue;
        const fy = world.heightAt(fx, fz);
        const cells = [];
        for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) if (dz !== 0) cells.push({ x: fx + dx, y: fy, z: fz + dz });
        plan.fields.push({ x: fx, z: fz, y: fy, cells });
      }
      // Corral con animales, cerca de los campos: cerca de madera, portón hacia la aldea, comedero y heno.
      for (let k = 0; k < 40 && !plan.pen; k++) {
        const a = r() * Math.PI * 2; const rad = 16 + r() * 14;
        const px = Math.round(x + Math.cos(a) * rad); const pz = Math.round(z + Math.sin(a) * rad);
        if (overlaps([...plan.houses, ...plan.slots, ...big()], px, pz, 1) || plan.fields.some((f) => Math.abs(f.x - px) < 10 && Math.abs(f.z - pz) < 9)) continue;
        const [plo, phi] = heightRange(world, px, pz, 4, 1);
        if (phi - plo > 2 || plo <= SEA) continue;
        const dx = x - px; const dz = z - pz;
        const gate = Math.abs(dx) > Math.abs(dz) ? { x: px + Math.sign(dx) * 4, z: pz } : { x: px, z: pz + Math.sign(dz || 1) * 3 };
        plan.pen = { x: px, z: pz, y: world.heightAt(px, pz), x0: px - 3, x1: px + 3, z0: pz - 2, z1: pz + 2, gate, trough: { x: px - 2, z: pz - 1 }, feed: { x: px - 1.5, z: pz - 0.5 } };
      }
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4; const px = Math.round(x + Math.cos(a) * 5); const pz = Math.round(z + Math.sin(a) * 5);
        plan.posts.push({ x: px, z: pz, y: world.heightAt(px, pz) });
      }
      plan.radius = Math.max(...[...plan.houses, ...plan.slots, ...big(), ...(plan.pen ? [plan.pen] : [])].map((h) => Math.hypot(h.x - x, h.z - z))) + 6;
      // Puerto: si el mar está cerca, la aldea tiene muelle, faro y marineros.
      plan.port = findPort(world, plan);
      if (plan.port) plan.name = `Puerto ${plan.name}`;
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
  for (const it of fu.items) put(it.x, y + 1 + (it.dy ?? 0), it.z, it.id);
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
  const kind = h.special ?? ['family', 'workshop', 'farm'][((h.x * 7 + h.z * 13) % 3 + 3) % 3];
  const items = []; const add = (u, v, id, dy = 0) => items.push({ ...L(u, v), id, dy });
  const chairs = [];
  if (kind === 'school') {
    // Pupitres mirando al pizarrón (en la pared del fondo) y el escritorio de la maestra.
    for (const u of [-1, 0, 1]) add(u, -3, B.BLACKBOARD, 1);
    add(0, -2, B.TABLE); add(-2, -2, B.BOOKSHELF);
    for (const [u, v] of [[-2, -1], [-1, 1], [1, 1]]) { add(u, v, B.TABLE); add(u, v + 1, B.CHAIR); chairs.push(L(u, v + 1)); }
  } else if (kind === 'family') {
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
  if (!STYLES[plan.style].chimney || h.isCastle || h.special === 'church') return null;
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
  for (const h of [...plan.houses, plan.church, plan.school].filter(Boolean)) {
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

// Iglesia: nave de piedra con vitrales, bancos mirando al altar y campanario con campana y cruz.
function churchBlueprint(world, plan, h) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const st = STYLES[plan.style];
  const f = h.face; const L = (u, v) => [h.x + f[1] * u + f[0] * v, h.z + f[0] * u + f[1] * v];
  const P = (u, v, yy, id) => { const [x, z] = L(u, v); put(x, yy, z, id); };
  const y = h.y; const wall = plan.style === 'desert' ? B.ADOBE : B.COBBLE; const roof = st.roof ?? B.ADOBE;
  for (let u = -4; u <= 4; u++) for (let v = -4; v <= 4; v++) {
    const [x, z] = L(u, v);
    for (let yy = y + 1; yy <= y + 17; yy++) put(x, yy, z, B.AIR);
    if (Math.abs(u) > 3 || Math.abs(v) > 3) continue;
    const g = world.heightAt(x, z);
    for (let yy = Math.min(g + 1, y - 1); yy < y; yy++) put(x, yy, z, wall);
    put(x, y, z, st.floor);
  }
  // Paredes altas (5) con vitrales a los costados y una ventana redonda en el fondo.
  for (let yy = y + 1; yy <= y + 5; yy++) for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) {
    if (Math.abs(u) !== 3 && Math.abs(v) !== 3) continue;
    const corner = Math.abs(u) === 3 && Math.abs(v) === 3;
    let id = corner ? (plan.style === 'desert' ? B.ADOBE : B.BRICK) : wall;
    if (Math.abs(u) === 3 && Math.abs(v) === 1 && yy >= y + 2 && yy <= y + 4) id = B.STAINED_GLASS;
    if (v === -3 && u === 0 && (yy === y + 3 || yy === y + 4)) id = B.STAINED_GLASS;
    if (Math.abs(u) === 3 && v === 0 && yy === y + 4) id = B.LAMP;
    if (v === 3 && u === 0 && yy <= y + 2) id = B.DOOR;
    P(u, v, yy, id);
  }
  // Techo a dos aguas a lo largo de la nave, con los frentes cerrados.
  for (let k = 0; k <= 4; k++) for (let v = -4; v <= 4; v++) {
    for (let u = -4 + k; u <= 4 - k; u++) {
      if (Math.abs(u) === 4 - k) P(u, v, y + 6 + k, roof);
      else if (Math.abs(v) === 3) P(u, v, y + 6 + k, wall);
    }
  }
  // Campanario sobre la entrada: torre de 3×3, campana colgando y cruz arriba.
  for (let yy = y + 6; yy <= y + 12; yy++) for (let u = -1; u <= 1; u++) for (let v = 1; v <= 3; v++) {
    const corner = Math.abs(u) === 1 && (v === 1 || v === 3);
    const belfry = yy === y + 10 || yy === y + 11;
    P(u, v, yy, belfry && !corner ? B.AIR : yy === y + 12 ? roof : wall);
  }
  P(0, 2, y + 11, B.BELL);
  for (let u = -1; u <= 1; u++) for (let v = 1; v <= 3; v++) P(u, v, y + 13, roof);
  P(0, 2, y + 14, roof); P(0, 2, y + 15, B.LOG); P(0, 2, y + 16, B.LOG); P(0, 2, y + 17, B.LOG); P(-1, 2, y + 16, B.LOG); P(1, 2, y + 16, B.LOG);
  // Adentro: altar, velas, alfombra por el pasillo y bancos.
  P(0, -2, y + 1, B.ALTAR); P(-1, -2, y + 1, B.TORCH); P(1, -2, y + 1, B.TORCH);
  for (let v = -1; v <= 2; v++) P(0, v, y + 1, B.CARPET);
  for (const v of [0, 1, 2]) for (const u of [-2, -1, 1, 2]) P(u, v, y + 1, B.PEW);
  P(0, 3, y + 1, B.DOOR); P(0, 3, y + 2, B.DOOR);
  return out;
}

// Corral: cerca de madera alrededor, portón, comedero y fardos de heno.
function penBlueprint(world, plan, p) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  for (let x = p.x0 - 1; x <= p.x1 + 1; x++) for (let z = p.z0 - 1; z <= p.z1 + 1; z++) {
    const g = world.heightAt(x, z);
    for (let yy = g + 1; yy <= g + 3; yy++) put(x, yy, z, B.AIR);
    if (g < p.y) for (let yy = g + 1; yy <= p.y; yy++) put(x, yy, z, B.DIRT);
    const gy = Math.max(g, p.y);
    put(x, gy, z, B.GRASS);
    const edge = x === p.x0 - 1 || x === p.x1 + 1 || z === p.z0 - 1 || z === p.z1 + 1;
    if (edge && !(x === p.gate.x && z === p.gate.z)) put(x, gy + 1, z, B.FENCE);
  }
  put(p.trough.x, p.y + 1, p.trough.z, B.TROUGH);
  put(p.x1, p.y + 1, p.z1, B.HAY); put(p.x1 - 1, p.y + 1, p.z1, B.HAY); put(p.x1, p.y + 2, p.z1, B.HAY);
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
// Busca la costa en las 4 direcciones: tierra firme hasta un punto y después agua profunda por un buen trecho.
function findPort(world, plan) {
  let best = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 8; k <= 56; k++) {
      const x = plan.x + dx * k; const z = plan.z + dz * k;
      if (world.heightAt(x, z) >= SEA - 1) continue;
      // Agua: ¿sigue siendo mar al menos 14 bloques más?
      let wet = 0;
      for (let j = 0; j < 16; j++) if (world.heightAt(x + dx * j, z + dz * j) < SEA - 1) wet++;
      if (wet >= 13 && (!best || k < best.k)) best = { k, dir: [dx, dz] };
      break;
    }
  }
  if (!best) return null;
  const [dx, dz] = best.dir; const perp = [dz, dx];
  const start = { x: plan.x + dx * (best.k - 1), z: plan.z + dz * (best.k - 1) };
  const length = 14;
  const end = { x: start.x + dx * length, z: start.z + dz * length };
  // Faro al costado del arranque del muelle, sobre tierra.
  let lighthouse = null;
  for (const s of [4, -4, 6, -6]) {
    const lx = start.x - dx * 2 + perp[0] * s; const lz = start.z - dz * 2 + perp[1] * s;
    const g = world.heightAt(lx, lz);
    if (g > SEA && !plan.houses.some((h) => Math.abs(h.x - lx) < 6 && Math.abs(h.z - lz) < 6)) { lighthouse = { x: lx, z: lz, y: g }; break; }
  }
  return {
    dir: best.dir, perp, start, end, length, deckY: SEA + 1, lighthouse,
    fishSpot: { x: end.x + 0.5 - dx * 1, z: end.z + 0.5 - dz * 1 + 0 },
    dock: { x: end.x + 0.5 + perp[0] * 3 + dx * 2, z: end.z + 0.5 + perp[1] * 3 + dz * 2 },     // donde atracan los barcos
    pierWalk: { x: start.x + 0.5 + dx * 6, z: start.z + 0.5 + dz * 6 },
  };
}

// Muelle de tablas sobre pilotes, faroles en la punta, faro a rayas y un camino desde la plaza.
function portBlueprint(world, plan) {
  const out = []; const put = (x, y, z, id) => out.push({ x, y, z, id });
  const p = plan.port; const [dx, dz] = p.dir; const [px, pz] = p.perp;
  const y = p.deckY;
  for (let k = -2; k <= p.length; k++) for (let w = -1; w <= 1; w++) {
    const x = p.start.x + dx * k + px * w; const z = p.start.z + dz * k + pz * w;
    put(x, y, z, B.PLANKS);
    for (let yy = y + 1; yy <= y + 4; yy++) put(x, yy, z, B.AIR);
    // Pilotes cada 3 bloques en los bordes, desde el fondo.
    if (k % 3 === 0 && w !== 0) { const g = world.heightAt(x, z); for (let yy = Math.min(g + 1, y - 1); yy < y; yy++) put(x, yy, z, B.LOG); }
  }
  // Barandas bajas y faroles en la punta.
  for (const w of [-1, 1]) {
    const ex = p.end.x + px * w; const ez = p.end.z + pz * w;
    put(ex, y + 1, ez, B.LOG); put(ex, y + 2, ez, B.LOG); put(ex, y + 3, ez, B.LAMP);
    put(p.start.x + dx * 6 + px * w, y + 1, p.start.z + dz * 6 + pz * w, B.BARREL);
  }
  // Camino de grava desde la plaza hasta el muelle.
  for (let k = 0; k <= Math.abs(p.start.x - plan.x) + Math.abs(p.start.z - plan.z); k++) {
    const x = plan.x + dx * k; const z = plan.z + dz * k;
    if (Math.abs(x - plan.x) > Math.abs(p.start.x - plan.x) || Math.abs(z - plan.z) > Math.abs(p.start.z - plan.z)) break;
    const g = world.heightAt(x, z);
    if (g > SEA) { put(x, g, z, STYLES[plan.style].path); put(x, g + 1, z, B.AIR); put(x, g + 2, z, B.AIR); }
  }
  // Faro: torre de 3×3 a rayas rojas y blancas con una lámpara arriba.
  const L = p.lighthouse;
  if (L) {
    for (let ddx = -1; ddx <= 1; ddx++) for (let ddz = -1; ddz <= 1; ddz++) {
      const g = world.heightAt(L.x + ddx, L.z + ddz);
      for (let yy = Math.min(g + 1, L.y); yy <= L.y; yy++) put(L.x + ddx, yy, L.z + ddz, B.COBBLE);
      for (let yy = L.y + 1; yy <= L.y + 11; yy++) put(L.x + ddx, yy, L.z + ddz, (ddx || ddz) ? (Math.floor((yy - L.y) / 2) % 2 ? B.WOOL_RED : B.WOOL_WHITE) : B.AIR);
      put(L.x + ddx, L.y + 12, L.z + ddz, B.COBBLE);
      put(L.x + ddx, L.y + 13, L.z + ddz, (ddx || ddz) ? B.GLASS : B.LAMP);
      put(L.x + ddx, L.y + 14, L.z + ddz, B.ROOF);
    }
  }
  return out;
}

export function villageBlocks(world, plan) {
  if (plan._blocks) return plan._blocks;
  const list = plazaBlueprint(world, plan);
  for (const f of plan.fields ?? []) list.push(...fieldBlueprint(world, plan, f));
  for (const s of plan.stalls ?? []) list.push(...stallBlueprint(plan, s));
  if (plan.castle) list.push(...castleBlueprint(world, plan, plan.castle));
  if (plan.church) list.push(...churchBlueprint(world, plan, plan.church));
  if (plan.school) list.push(...houseBlueprint(world, plan, plan.school));
  if (plan.pen) list.push(...penBlueprint(world, plan, plan.pen));
  if (plan.port) list.push(...portBlueprint(world, plan));
  for (const h of plan.houses) list.push(...houseBlueprint(world, plan, h));
  plan._blocks = list;
  return list;
}

// Coloca en un chunk recién generado los bloques de las aldeas que lo tocan.
export function placeVillages(world, chunk) {
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  // El muelle de los puertos sale bastante más allá del radio de la aldea.
  for (const plan of villagesNear(world, x0 + CS / 2, z0 + CS / 2, CS + 48)) {
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
