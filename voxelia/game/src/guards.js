// ───────── Guardias: combate con espada y escudo ─────────
// Cómo piensan los guardias de una aldea cuando hay peligro:
//  1. Evalúan las amenazas: qué tan peligroso es cada enemigo, qué tan cerca está de un vecino
//     (o del jugador) y cuánta vida le queda.
//  2. Se reparten los enemigos entre todos: cada uno toma el que más le conviene, sin amontonarse
//     sobre el mismo (un jefe aguanta hasta 3 guardias, un zombi o un arquero solo 1). Mantienen su
//     objetivo salvo que aparezca algo bastante más urgente.
//  3. Pelean de verdad: se acercan cubriéndose de las flechas, se ponen entre el enemigo y el pueblo,
//     rodean al enemigo si son varios, leen cuándo va a golpear y levantan el escudo justo a tiempo,
//     y contraatacan fuerte apenas el enemigo falla. Cada tercer golpe es un tajo pesado que empuja.
//  4. Si están muy heridos y hay otro guardia peleando, se repliegan a curarse y vuelven.
export const GUARD_HP = 24;
const CAP = { leader: 3, raider: 2, archer: 1, zombie: 1 };
const DANGER = { leader: 3.2, raider: 2, archer: 2.4, zombie: 1.5 };
const REACH = 2.1;          // alcance de la espada
const SWING = 0.34;         // duración de un tajo (s)

export const kindOf = (z) => (z.isBandit ? z.kind : 'zombie');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Amenazas alrededor de una aldea, con su puntaje de urgencia.
export function threats(plan, enemies, civilians, player) {
  const R = (plan.radius ?? 30) + 18;
  const out = [];
  for (const z of enemies) {
    if (z.dead) continue;
    const dC = dist(z.pos, plan);
    if (dC > R) continue;
    let near = Infinity;
    for (const c of civilians) if (!c.hidden) near = Math.min(near, dist(c.pos, z.pos));
    const dPl = player ? dist(player.pos, z.pos) : Infinity;
    const k = kindOf(z);
    const hurt = 1 - Math.min(1, z.hp / (z.max ?? 12));
    const score = DANGER[k] + Math.max(0, 7 - near) * 0.8 + Math.max(0, 5 - dPl) * 0.45 + hurt * 1.5 - (dC / R) * 0.8;
    out.push({ z, k, score, cap: CAP[k] ?? 1, near });
  }
  return out;
}

// Reparto de enemigos entre los guardias (codicioso, con memoria del objetivo anterior).
export function assign(guards, list) {
  const load = new Map();
  const ready = guards.filter((g) => !g.retreating);
  for (const g of ready) {
    let best = null; let bestV = -Infinity;
    for (const t of list) {
      const n = load.get(t) ?? 0;
      const over = n >= t.cap ? 3 : 0;
      const v = t.score - dist(g.pos, t.z.pos) * 0.12 - n * 1.6 - over + (g.foe === t.z ? 1.5 : 0);
      if (v > bestV) { bestV = v; best = t; }
    }
    g.foe = best?.z ?? null; g.foeKind = best?.k ?? null; g.protect = best ? best.near < 4 : false;
    g.slot = best ? load.get(best) ?? 0 : 0;
    if (best) load.set(best, (load.get(best) ?? 0) + 1);
    g.mates = 0;
  }
  for (const g of ready) if (g.foe) g.mates = ready.filter((o) => o.foe === g.foe).length;
  for (const g of guards) if (g.retreating) g.foe = null;
}

// Un cuadro de pelea de un guardia. Devuelve { goal, speed } para moverse (o null si se queda).
// ctx: hitZombie(z, dmg, e, push), onGuardHit(e, z, heavy), say(e, text)
export function fight(e, plan, dt, ctx, t) {
  const z = e.foe;
  e.atkCd = Math.max(0, (e.atkCd ?? 0) - dt);
  let wantBlock = false; let goal = null; let speed = 3.0;
  e.action = 'fight';
  if (!z || z.dead) { e.foe = null; e.block = Math.max(0, (e.block ?? 0) - dt * 6); return null; }
  const d = dist(e.pos, z.pos);
  const toZ = Math.atan2(z.pos.x - e.pos.x, z.pos.z - e.pos.z);
  e.heading = toZ;
  const k = e.foeKind ?? kindOf(z);
  // ¿Está por pegar? Solo si está a su alcance y su enfriamiento está por terminar (si ya está en cero
  // y no pega, es que no llega: no hay que esperarlo). Nunca se queda cubierto más de medio segundo.
  const cd = z.cooldown ?? 9;
  const windup = k !== 'archer' && d < (k === 'leader' ? 2.0 : 1.8) && cd > -0.05 && cd < 0.38 && (e.holdT ?? 0) < 0.55;
  if (e.swing >= 0) {
    // Tajo en curso: el golpe entra a mitad del movimiento.
    const prev = e.swing; e.swing += dt / SWING;
    if (prev < 0.5 && e.swing >= 0.5 && d < REACH + 0.3) {
      const heavy = e.combo === 2 || e.riposte;
      const dmg = (heavy ? 6 : 4) + (e.riposte ? 2 : 0);
      const push = { x: Math.sin(toZ) * (heavy ? 1.6 : 0.6), z: Math.cos(toZ) * (heavy ? 1.6 : 0.6) };
      ctx.hitZombie?.(z, dmg, e, push);
      if (heavy && z.cooldown !== undefined) z.cooldown = Math.max(z.cooldown, 0.7);   // aturdido
      ctx.onGuardHit?.(e, z, heavy);
      e.riposte = false;
    }
    if (e.swing >= 1) e.swing = -1;
  }
  if (k === 'archer' && d > REACH + 0.4) {
    // Contra arqueros: carga en zigzag con el escudo en alto.
    wantBlock = true; speed = 3.4;
    const side = Math.sin(t * 2.6 + e.phase) * 1.4;
    goal = { x: z.pos.x + Math.cos(toZ) * side, z: z.pos.z - Math.sin(toZ) * side, near: 0.5 };
  } else if (d > REACH) {
    // Acercarse. Si hay varios sobre el mismo enemigo, cada uno toma un lado (lo rodean);
    // el primero se pone entre el enemigo y el centro de la aldea.
    const base = Math.atan2(plan.x - z.pos.x, plan.z - z.pos.z);
    const ang = base + (e.slot ?? 0) * ((Math.PI * 2) / Math.max(2, e.mates ?? 1)) * (e.slot % 2 ? 1 : -1);
    const r = d > 5 ? 0.8 : 1.5;
    goal = { x: z.pos.x + Math.sin(ang) * r, z: z.pos.z + Math.cos(ang) * r, near: 0.4 };
    speed = e.protect ? 3.7 : d > 6 ? 3.4 : 2.6;
    wantBlock = d < 3 && (z.cooldown ?? 9) > -0.05 && (z.cooldown ?? 9) < 0.5;
  } else {
    // Cuerpo a cuerpo: cubrirse a tiempo, contraatacar y moverse alrededor.
    if (windup && e.swing < 0) { wantBlock = true; e.parry = true; e.holdT = (e.holdT ?? 0) + dt; }
    else if (e.atkCd <= 0 && e.swing < 0) {
      e.holdT = 0;
      e.riposte = !!e.parry && (z.cooldown ?? 0) > 0.45;   // el enemigo acaba de pegar: es el momento
      e.parry = false;
      e.swing = 0; e.combo = ((e.combo ?? -1) + 1) % 3; e.atkCd = 0.7 + Math.random() * 0.25;
    }
    if (e.swing < 0 && !wantBlock) {
      // Paso lateral alrededor del enemigo mientras recupera el golpe.
      e.strafeT = (e.strafeT ?? 0) - dt;
      if (e.strafeT <= 0) { e.strafeT = 0.8 + Math.random() * 1.2; e.strafeSide = Math.random() < 0.5 ? -1 : 1; }
      const a = toZ + Math.PI + (e.strafeSide ?? 1) * 0.7;
      goal = { x: z.pos.x + Math.sin(a) * 1.55, z: z.pos.z + Math.cos(a) * 1.55, near: 0.3 };
      speed = 1.6;
    }
  }
  e.block = (e.block ?? 0) + ((wantBlock ? 1 : 0) - (e.block ?? 0)) * Math.min(1, dt * 14);
  return goal ? { goal, speed } : null;
}

// ¿El guardia frena este golpe con el escudo? (de frente y con el escudo arriba)
export function blocks(e, from) {
  if (!from || (e.block ?? 0) < 0.5) return false;
  const a = Math.atan2(from.x - e.pos.x, from.z - e.pos.z);
  const diff = Math.abs(((a - e.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return diff < 1.1;
}
