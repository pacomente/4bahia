import { BLOCKS, B } from './blocks.js';

// Caminata sobre bloques para aldeanos y zombis: suben un escalón, bajan hasta 3,
// pasan por puertas de un bloque de ancho y no se meten al agua.
const solid = (world, x, y, z) => BLOCKS[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))].solid;

// Altura donde puede pararse cerca de `y` en la columna (x, z), o null.
export function standY(world, x, y, z, up = 1, down = 3) {
  const by = Math.floor(y + 0.01);
  for (let k = up; k >= -down; k--) {
    const fy = by + k;
    if (fy < 1) continue;
    const below = world.getBlock(Math.floor(x), fy - 1, Math.floor(z));
    if (!BLOCKS[below].solid || below === B.WATER) continue;
    if (solid(world, x, fy, z) || solid(world, x, fy + 1, z)) continue;
    if (world.getBlock(Math.floor(x), fy, Math.floor(z)) === B.WATER) continue;
    return fy;
  }
  return null;
}

// Un paso hacia (tx, tz). Si está bloqueado prueba desvíos. Devuelve { arrived, moved }.
// e: { pos (Vector3), heading, vy, stuck }
export function stepToward(world, e, tx, tz, speed, dt) {
  // Rodeo temporal: si quedó trabado, camina un rato de costado y después vuelve a intentar.
  if (e.detour && e.detourT > 0) {
    e.detourT -= dt;
    const r = stepRaw(world, e, e.detour.x, e.detour.z, speed, dt);
    if (r.moved && !r.arrived) return { arrived: false, moved: true };
    e.detour = null;
  }
  const r = stepRaw(world, e, tx, tz, speed, dt);
  if (!r.moved && !r.arrived && e.stuck > 1.2) {
    const a = Math.atan2(tx - e.pos.x, tz - e.pos.z) + (e.side ?? 1) * Math.PI / 2;
    e.detour = { x: e.pos.x + Math.sin(a) * 3, z: e.pos.z + Math.cos(a) * 3 }; e.detourT = 1.6;
  }
  return r;
}

function stepRaw(world, e, tx, tz, speed, dt) {
  const dx = tx - e.pos.x; const dz = tz - e.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.35) return { arrived: true, moved: false };
  const base = Math.atan2(dx, dz);
  const step = Math.min(dist, speed * dt);
  for (const off of [0, 0.5, -0.5, 1.1, -1.1, 1.7, -1.7]) {
    const a = base + off * (e.side ?? 1);
    const nx = e.pos.x + Math.sin(a) * step; const nz = e.pos.z + Math.cos(a) * step;
    // Trabado hace rato: se anima a bajar saltos más altos.
    const y = standY(world, nx, e.pos.y, nz, 1, (e.stuck ?? 0) > 2.5 ? 8 : 3);
    if (y === null) continue;
    // También el borde del cuerpo (que no corte esquinas de paredes).
    const ex = nx + Math.sin(a) * 0.25; const ez = nz + Math.cos(a) * 0.25;
    if (standY(world, ex, e.pos.y, ez) === null && off === 0 && dist > 0.6) continue;
    e.pos.x = nx; e.pos.z = nz;
    e.groundY = y;
    e.heading = a;
    if (off === 0) e.stuck = 0; else e.stuck = Math.max(0, (e.stuck ?? 0) - dt * 0.5);
    return { arrived: false, moved: true };
  }
  const before = e.stuck ?? 0;
  e.stuck = before + dt;
  if (Math.floor(before / 3) !== Math.floor(e.stuck / 3)) e.side = -(e.side ?? 1);   // cada 3 s prueba por el otro lado
  return { arrived: false, moved: false };
}

// Gravedad simple hacia el piso de la columna actual.
export function settle(world, e, dt) {
  // Si quedó metido adentro de un bloque (por ejemplo, alguien construyó encima), lo saca hacia arriba.
  if (solid(world, e.pos.x, e.pos.y + 0.1, e.pos.z)) { const up = standY(world, e.pos.x, e.pos.y, e.pos.z, 4, 0); if (up !== null) { e.pos.y = up; e.vy = 0; return; } }
  const floor = standY(world, e.pos.x, e.pos.y + 0.5, e.pos.z, 1, 6) ?? e.groundY ?? e.pos.y;
  // Subir un escalón: rápido pero no instantáneo; caer: con gravedad.
  if (floor > e.pos.y + 0.01) { e.pos.y = Math.min(floor, e.pos.y + dt * 9); e.vy = 0; return; }
  e.vy = (e.vy ?? 0) - 24 * dt;
  e.pos.y += e.vy * dt;
  if (e.pos.y <= floor) { e.pos.y = floor; e.vy = 0; }
}

// Giro suave del cuerpo hacia un ángulo.
export function turnTo(current, target, dt, speed = 8) {
  const d = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + d * Math.min(1, dt * speed);
}
