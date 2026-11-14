import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { SEA, hash3 } from './world.js';
import { createHumanoid, animateHumanoid, lightHumanoid, makeProp } from './humanoid.js';

// ───────── Criaturas raras ─────────
// Serpiente marina: de noche, en mar abierto y lejos de la costa. Da vueltas alrededor del jugador
// asomando del agua, embiste y puede dar vuelta el bote.
// Dragón: vive en una guarida en lo alto de las montañas. Vuela en círculos; si te acercás, ataca
// lanzando bolas de fuego y en picada.
export const LAIR_REGION = 720;

export function lairPlan(world, rx, rz) {
  const cache = world._lairs ?? (world._lairs = new Map());
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  for (let t = 0; t < 30 && !plan; t++) {
    const x = rx * LAIR_REGION + 60 + Math.floor(hash3(world.seed, rx * 31 + t, 8181, rz) * (LAIR_REGION - 120));
    const z = rz * LAIR_REGION + 60 + Math.floor(hash3(world.seed, rx, 8282 + t, rz * 17) * (LAIR_REGION - 120));
    const y = world.heightAt(x, z);
    if (world.biome(x, z) === 'mountains' && y > SEA + 24 && Math.hypot(x, z) > 250) plan = { id: `d${rx}_${rz}`, x, z, y };
  }
  cache.set(key, plan);
  return plan;
}
export function lairsNear(world, x, z, dist) {
  const out = [];
  for (let rx = Math.floor((x - dist) / LAIR_REGION); rx <= Math.floor((x + dist) / LAIR_REGION); rx++) for (let rz = Math.floor((z - dist) / LAIR_REGION); rz <= Math.floor((z + dist) / LAIR_REGION); rz++) {
    const p = lairPlan(world, rx, rz); if (p && Math.hypot(p.x - x, p.z - z) <= dist) out.push(p);
  }
  return out;
}

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

export class Creatures {
  constructor(scene, world, sound) {
    this.scene = scene; this.world = world; this.sound = sound;
    this.serpent = null; this.dragon = null; this.fireballs = []; this.bombs = []; this.t = 0; this.serpentT = 20;
    this.mat = {
      scale: new THREE.MeshBasicMaterial({ color: 0x1f6a6a }), belly: new THREE.MeshBasicMaterial({ color: 0x8ad8c8 }), fin: new THREE.MeshBasicMaterial({ color: 0x3fa8a0 }),
      eye: new THREE.MeshBasicMaterial({ color: 0xffe066 }), fang: new THREE.MeshBasicMaterial({ color: 0xf4f0e8 }),
      red: new THREE.MeshBasicMaterial({ color: 0x9a1e16 }), dark: new THREE.MeshBasicMaterial({ color: 0x4a0e0a }), wing: new THREE.MeshBasicMaterial({ color: 0x6a1410, side: THREE.DoubleSide }),
      horn: new THREE.MeshBasicMaterial({ color: 0xe8dcc0 }), fire: new THREE.MeshBasicMaterial({ color: 0xff8a1e }), core: new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    };
  }

  // ───── Serpiente marina ─────
  spawnSerpent(P) {
    const segs = [];
    const a = Math.random() * Math.PI * 2;
    for (let k = 0; k < 12; k++) {
      const g = new THREE.Group(); const s = 1 - k * 0.05;
      const body = box(1.1 * s, 1.1 * s, 1.3, this.mat.scale); const belly = box(0.9 * s, 0.3, 1.2, this.mat.belly); belly.position.y = -0.45 * s;
      const fin = box(0.12, 0.6 * s, 0.8, this.mat.fin); fin.position.y = 0.75 * s;
      g.add(body, belly, fin);
      if (k === 0) {
        const jaw = box(1.0, 0.35, 1.1, this.mat.scale); jaw.position.set(0, -0.45, 0.7);
        const e1 = box(0.18, 0.18, 0.1, this.mat.eye); e1.position.set(-0.45, 0.25, 0.55); const e2 = e1.clone(); e2.position.x = 0.45;
        for (const x of [-0.3, 0.3]) { const f = box(0.1, 0.3, 0.1, this.mat.fang); f.position.set(x, -0.25, 1.15); g.add(f); }
        g.add(jaw, e1, e2);
      }
      g.position.set(P.x + Math.cos(a) * 22, SEA - 3, P.z + Math.sin(a) * 22);
      this.scene.add(g); segs.push(g);
    }
    this.serpent = { segs, hp: 50, max: 50, ang: a, r: 18, state: 'circle', t: 0, attackT: 6, trail: [], flash: 0 };
    this.sound.tone(70, 1.4, 0.3, 'sawtooth');
  }

  updateSerpent(dt, ctx) {
    const s = this.serpent; const P = ctx.player.pos;
    s.t += dt; s.attackT -= dt; s.flash = Math.max(0, s.flash - dt);
    const head = s.segs[0].position;
    let tx; let tz;
    if (s.state === 'circle') {
      s.ang += dt * 0.45; s.r += (9 - s.r) * dt * 0.1;
      tx = P.x + Math.cos(s.ang) * s.r; tz = P.z + Math.sin(s.ang) * s.r;
      if (s.attackT <= 0) { s.state = 'charge'; s.attackT = 3; ctx.warn?.('¡La serpiente embiste!'); }
    } else if (s.state === 'charge') {
      tx = P.x; tz = P.z;
      if (Math.hypot(P.x - head.x, P.z - head.z) < 2.2) {
        ctx.onHit?.(3, 'Te mordió la serpiente marina', new THREE.Vector3(P.x - head.x, 0, P.z - head.z).normalize());
        if (ctx.inBoat) ctx.capsize?.();
        s.state = 'retreat'; s.attackT = 7 + Math.random() * 4;
      } else if (s.attackT < -2) { s.state = 'retreat'; s.attackT = 6; }
    } else {
      const a = Math.atan2(head.z - P.z, head.x - P.x); tx = P.x + Math.cos(a) * 20; tz = P.z + Math.sin(a) * 20;
      if (Math.hypot(head.x - P.x, head.z - P.z) > 16) { s.state = 'circle'; s.ang = a; s.r = 16; }
    }
    const speed = s.state === 'charge' ? 9 : 5;
    const dx = tx - head.x; const dz = tz - head.z; const d = Math.hypot(dx, dz) || 1;
    head.x += (dx / d) * Math.min(d, speed * dt); head.z += (dz / d) * Math.min(d, speed * dt);
    head.y = SEA - 1 + Math.sin(s.t * 1.6) * 1.8 + (s.state === 'charge' ? 1 : 0);
    s.segs[0].rotation.y = Math.atan2(dx, dz);
    // El cuerpo sigue la estela de la cabeza, en arcos que entran y salen del agua.
    s.trail.unshift(head.clone()); if (s.trail.length > 200) s.trail.pop();
    for (let k = 1; k < s.segs.length; k++) {
      const p = s.trail[Math.min(s.trail.length - 1, k * 6)]; if (!p) continue;
      const g = s.segs[k];
      g.lookAt(s.segs[k - 1].position);
      g.position.set(p.x, SEA - 1 + Math.sin(s.t * 1.6 - k * 0.55) * 1.8, p.z);
    }
    const light = Math.max(0.3, ctx.daylight + 0.15);
    for (const m of [this.mat.scale, this.mat.belly, this.mat.fin]) { m.userData.base ??= m.color.getHex(); if (s.flash > 0) m.color.setRGB(1, 0.5, 0.5); else m.color.setHex(m.userData.base).multiplyScalar(light); }
    if (ctx.daylight > 0.5 || Math.hypot(head.x - P.x, head.z - P.z) > 70 || (!ctx.inBoat && !ctx.player.inWater && ctx.onLandFar)) this.removeSerpent(true);
  }
  removeSerpent(sink) {
    for (const g of this.serpent.segs) { this.scene.remove(g); g.traverse((o) => o.geometry?.dispose()); }
    this.serpent = null; if (sink) this.serpentT = 60;
  }

  // ───── Dragón ─────
  buildDragon() {
    const m = this.mat; const g = new THREE.Group();
    const body = box(2.2, 1.8, 4.2, m.red); body.position.y = 0;
    const belly = box(1.8, 0.4, 3.6, m.dark); belly.position.y = -0.9;
    const neck = box(0.9, 0.9, 2.4, m.red); neck.position.set(0, 0.7, 2.8); neck.rotation.x = -0.35;
    const head = new THREE.Group(); head.position.set(0, 1.4, 4.2);
    const skull = box(1.2, 1.0, 1.6, m.red); const snout = box(0.8, 0.6, 1.0, m.red); snout.position.set(0, -0.15, 1.1);
    const e1 = box(0.2, 0.18, 0.1, m.core); e1.position.set(-0.5, 0.25, 0.6); const e2 = e1.clone(); e2.position.x = 0.5;
    for (const x of [-0.4, 0.4]) { const h = box(0.18, 0.8, 0.18, m.horn); h.position.set(x, 0.75, -0.5); h.rotation.x = -0.6; head.add(h); }
    head.add(skull, snout, e1, e2);
    const tail = new THREE.Group(); tail.position.set(0, 0, -2.1);
    for (let k = 0; k < 6; k++) { const t = box(0.9 - k * 0.12, 0.8 - k * 0.1, 1.2, m.red); t.position.z = -0.6 - k * 1.1; tail.add(t); }
    const wings = [-1, 1].map((sgn) => {
      const w = new THREE.Group(); w.position.set(sgn * 1.1, 0.6, 0.6);
      const bone = box(5.2, 0.25, 0.25, m.dark); bone.position.x = sgn * 2.6;
      const memb = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), m.wing); memb.rotation.x = -Math.PI / 2; memb.position.set(sgn * 2.6, 0, -1.4);
      w.add(bone, memb); return w;
    });
    const legs = [[-0.8, 1], [0.8, 1], [-0.8, -1.2], [0.8, -1.2]].map(([x, z]) => { const l = box(0.4, 1.2, 0.4, m.dark); l.position.set(x, -1.3, z); return l; });
    g.add(body, belly, neck, head, tail, ...wings, ...legs);
    g.userData = { wings, head, tail };
    return g;
  }

  updateDragon(dt, ctx) {
    const d = this.dragon; const P = ctx.player.pos; const lair = d.lair;
    d.t += dt; d.flash = Math.max(0, d.flash - dt); d.attackT -= dt;
    const pos = d.mesh.position;
    const dP = Math.hypot(P.x - pos.x, P.z - pos.z);
    const nearLair = Math.hypot(P.x - lair.x, P.z - lair.z);
    if (!d.aggro && nearLair < 55) { d.aggro = true; ctx.warn?.('🐉 ¡El dragón te vio!'); this.sound.tone(90, 1.6, 0.35, 'sawtooth'); }
    if (d.aggro && nearLair > 140) d.aggro = false;
    let goal;
    if (!d.aggro) {
      d.ang += dt * 0.25; goal = new THREE.Vector3(lair.x + Math.cos(d.ang) * 32, lair.y + 26, lair.z + Math.sin(d.ang) * 32);
    } else if (d.state === 'swoop') {
      goal = d.swoopTo;
      if (pos.distanceTo(goal) < 2.5) { d.state = 'circle'; d.attackT = 4; }
      if (Math.hypot(P.x - pos.x, P.z - pos.z) < 3 && Math.abs(P.y + 1 - pos.y) < 3 && !d.hitDone) { d.hitDone = true; ctx.onHit?.(5, 'El dragón te embistió', new THREE.Vector3(P.x - pos.x, 0, P.z - pos.z).normalize()); }
    } else {
      d.ang += dt * 0.6; goal = new THREE.Vector3(P.x + Math.cos(d.ang) * 20, Math.max(P.y + 14, lair.y + 8), P.z + Math.sin(d.ang) * 20);
      if (d.attackT <= 0) {
        if (Math.random() < 0.55) {
          // Bola de fuego hacia donde va a estar el jugador.
          const from = pos.clone().add(new THREE.Vector3(0, 1, 0));
          const to = new THREE.Vector3(P.x, P.y + 1, P.z);
          const v = to.sub(from).normalize().multiplyScalar(16);
          const f = new THREE.Group(); f.add(box(0.7, 0.7, 0.7, this.mat.fire), box(0.4, 0.4, 0.4, this.mat.core));
          f.position.copy(from); this.scene.add(f);
          this.fireballs.push({ mesh: f, v, life: 5 });
          this.sound.noise(0.6, { freq: 400, q: 0.5, gain: 0.35, type: 'lowpass' });
          d.attackT = 2.5 + Math.random() * 2;
        } else {
          d.state = 'swoop'; d.hitDone = false; d.swoopTo = new THREE.Vector3(P.x + (P.x - pos.x) * 0.6, P.y + 1.5, P.z + (P.z - pos.z) * 0.6);
          this.sound.tone(120, 0.8, 0.25, 'sawtooth');
        }
      }
    }
    const dir = goal.clone().sub(pos); const dist = dir.length();
    const speed = d.state === 'swoop' ? 22 : 11;
    if (dist > 0.1) pos.addScaledVector(dir.normalize(), Math.min(dist, speed * dt));
    d.mesh.rotation.y += (((Math.atan2(dir.x, dir.z) - d.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
    d.mesh.rotation.x = d.state === 'swoop' ? 0.35 : 0;
    const flap = Math.sin(d.t * (d.state === 'swoop' ? 3 : 5)) * 0.6;
    d.mesh.userData.wings[0].rotation.z = flap; d.mesh.userData.wings[1].rotation.z = -flap;
    d.mesh.userData.tail.rotation.y = Math.sin(d.t * 1.5) * 0.3;
    const light = Math.max(0.35, ctx.daylight);
    for (const m of [this.mat.red, this.mat.dark, this.mat.wing]) { m.userData.base ??= m.color.getHex(); if (d.flash > 0) m.color.setRGB(1, 0.6, 0.6); else m.color.setHex(m.userData.base).multiplyScalar(light); }
    // Rugido de vez en cuando.
    d.roarT = (d.roarT ?? 8) - dt; if (d.roarT <= 0) { d.roarT = 10 + Math.random() * 10; if (dP < 120) this.sound.noise(1.2, { freq: 160, q: 0.8, gain: 0.3 * Math.max(0.1, 1 - dP / 120), type: 'lowpass' }); }
    void dP;
  }

  updateFireballs(dt, ctx) {
    const P = ctx.player.pos;
    for (const f of [...this.fireballs]) {
      f.life -= dt; f.mesh.position.addScaledVector(f.v, dt); f.mesh.rotation.x += dt * 6; f.mesh.rotation.y += dt * 5;
      const p = f.mesh.position;
      const hitPlayer = Math.hypot(P.x - p.x, P.y + 1 - p.y, P.z - p.z) < 1.4;
      const hitBlock = BLOCKS[this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid;
      if (hitPlayer) ctx.onHit?.(4, 'Una bola de fuego del dragón', f.v.clone().setY(0).normalize());
      if (hitPlayer || hitBlock || f.life <= 0) {
        for (let k = 0; k < 6; k++) ctx.puff?.(p.x, p.y, p.z, k % 2 ? 0xff8a1e : 0x555555);
        this.sound.noise(0.4, { freq: 300, q: 0.6, gain: 0.3, type: 'lowpass' });
        this.scene.remove(f.mesh); this.fireballs = this.fireballs.filter((x) => x !== f);
      }
    }
  }

  // ───── Rey Sombrío (jefe de la mazmorra), con tres fases ─────
  // 1) Persigue y golpea fuerte. 2) Además llama a sus esbirros y se teletransporta a tu espalda.
  // 3) Furioso: más rápido y lanza ondas de choque por el piso (saltá para esquivarlas).
  spawnShadowKing(pos, dungeon) {
    const parts = createHumanoid({ skin: '#4a3a5a', shirt: '#2a1a3a', pants: '#1a1020', hair: '#0e0a14', hat: 'crown', cape: '#120a1a', scale: 1.9 });
    const sword = makeProp('sword'); parts.tool.add(sword);
    parts.root.position.set(pos.x, pos.y, pos.z); this.scene.add(parts.root);
    this.king = { parts, pos: parts.root.position, hp: 260, max: 260, dungeon, t: 0, cooldown: 2, heading: 0, flash: 0, summonT: 8, tpT: 7, waveT: 5, ring: null, phase: 1, isBoss: true };
    this.sound.tone(60, 2, 0.35, 'sawtooth');
  }
  updateShadowKing(dt, ctx) {
    const k = this.king; const P = ctx.player.pos; k.t += dt; k.cooldown -= dt; k.flash = Math.max(0, k.flash - dt);
    const ratio = k.hp / k.max; const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (phase !== k.phase) { k.phase = phase; ctx.warn?.(phase === 2 ? '👑 El Rey Sombrío llama a sus esbirros…' : '👑 ¡El Rey Sombrío está furioso!'); this.sound.tone(phase === 3 ? 50 : 70, 1.4, 0.35, 'sawtooth'); }
    const room = k.dungeon.boss;
    const dx = P.x - k.pos.x; const dz = P.z - k.pos.z; const d = Math.hypot(dx, dz);
    k.heading = Math.atan2(dx, dz);
    const speed = phase === 3 ? 3.6 : 2.4;
    let action = 'walk';
    if (d > 2.4) {
      const nx = k.pos.x + (dx / d) * speed * dt; const nz = k.pos.z + (dz / d) * speed * dt;
      if (Math.hypot(nx - room.x, nz - room.z) < room.r + 1.5) { k.pos.x = nx; k.pos.z = nz; }
    } else if (k.cooldown <= 0) {
      k.cooldown = phase === 3 ? 1.1 : 1.6; action = 'attack';
      ctx.setAttacker?.(k);
      ctx.onHit?.(5, 'El Rey Sombrío te derrotó', new THREE.Vector3(dx, 0, dz).normalize());
    } else action = k.cooldown > 1 ? 'attack' : 'idle';
    if (phase >= 2) {
      k.summonT -= dt; if (k.summonT <= 0) { k.summonT = 12; ctx.summon?.(k.pos); ctx.warn?.('¡Aparecen esbirros!'); }
      k.tpT -= dt;
      if (k.tpT <= 0) {
        k.tpT = 8 + Math.random() * 4;
        const look = ctx.player.look(); const bx = P.x - look.x * 2.5; const bz = P.z - look.z * 2.5;
        if (Math.hypot(bx - room.x, bz - room.z) < room.r + 1) { for (let i = 0; i < 6; i++) ctx.puff?.(k.pos.x, k.pos.y + 1 + i * 0.3, k.pos.z, 0x2a1a3a); k.pos.x = bx; k.pos.z = bz; this.sound.noise(0.4, { freq: 300, q: 2, gain: 0.3 }); }
      }
    }
    if (phase === 3) {
      k.waveT -= dt;
      if (k.waveT <= 0 && !k.ring) {
        k.waveT = 7;
        const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0x8a4dff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.position.set(k.pos.x, k.pos.y + 0.15, k.pos.z); this.scene.add(m);
        k.ring = { mesh: m, r: 0.5, hit: false }; this.sound.noise(0.8, { freq: 120, q: 0.6, gain: 0.45, type: 'lowpass' });
      }
    }
    if (k.ring) {
      const ring = k.ring; ring.r += dt * 9; ring.mesh.scale.setScalar(ring.r * 1.2); ring.mesh.material.opacity = Math.max(0, 0.85 - ring.r / 12);
      const dist = Math.hypot(P.x - ring.mesh.position.x, P.z - ring.mesh.position.z);
      if (!ring.hit && Math.abs(dist - ring.r) < 0.7 && ctx.player.onGround && Math.abs(P.y - ring.mesh.position.y) < 1.5) { ring.hit = true; ctx.onHit?.(4, 'La onda del Rey Sombrío te alcanzó'); }
      if (ring.r > 12) { this.scene.remove(ring.mesh); ring.mesh.geometry.dispose(); k.ring = null; }
    }
    k.parts.root.rotation.y = k.heading;
    animateHumanoid(k.parts, { t: k.t, phase: k.t * 5, walk: d > 2.4 ? 1 : 0, action, lookYaw: 0 });
    lightHumanoid(k.parts, Math.max(0.5, ctx.daylight), k.flash);
    // Si salís de la mazmorra, vuelve a su trono (y se cura un poco).
    if (d > 40) { this.scene.remove(k.parts.root); this.king = null; }
  }

  // Bomba de un lanzador saqueador: vuela en arco y explota al tocar algo (daño en un radio).
  throwBomb(from, to) {
    const m = new THREE.Group(); m.add(box(0.36, 0.36, 0.36, new THREE.MeshBasicMaterial({ color: 0x26232a })), box(0.08, 0.2, 0.08, this.mat.fire));
    m.children[1].position.y = 0.25; m.position.copy(from); this.scene.add(m);
    const dx = to.x - from.x; const dz = to.z - from.z; const d = Math.hypot(dx, dz) || 1; const T = Math.max(0.7, d / 12);
    const v = new THREE.Vector3(dx / T, ((to.y + 0.5) - from.y + 0.5 * 18 * T * T) / T, dz / T);
    this.bombs.push({ mesh: m, v, life: 5 });
    this.sound.noise(0.2, { freq: 900, q: 1, gain: 0.2 });
  }
  updateBombs(dt, ctx) {
    for (const b of [...this.bombs]) {
      b.life -= dt; b.v.y -= 18 * dt; b.mesh.position.addScaledVector(b.v, dt); b.mesh.rotation.x += dt * 8;
      const p = b.mesh.position;
      const solid = BLOCKS[this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || BLOCKS[this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].water;
      const P = ctx.player.pos; const nearPlayer = Math.hypot(P.x - p.x, P.y + 0.9 - p.y, P.z - p.z) < 1;
      if (!solid && !nearPlayer && b.life > 0) continue;
      // ¡Bum!
      for (let k = 0; k < 8; k++) ctx.puff?.(p.x, p.y, p.z, k % 2 ? 0xff8a1e : 0x444444);
      this.sound.noise(0.6, { freq: 220, q: 0.6, gain: 0.45, type: 'lowpass' });
      const dP = Math.hypot(P.x - p.x, P.y + 0.9 - p.y, P.z - p.z);
      if (dP < 2.6) ctx.onHit?.(dP < 1.3 ? 4 : 2, 'Te alcanzó una bomba de los saqueadores', new THREE.Vector3(P.x - p.x, 0, P.z - p.z).normalize());
      for (const v of ctx.villagers ?? []) if (!v.hidden && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 2.4) ctx.hurtVillager?.(v, 3, { pos: p.clone() });
      this.scene.remove(b.mesh); this.bombs = this.bombs.filter((x) => x !== b);
    }
  }

  // ctx: { player, daylight, inBoat, deepWater, onLandFar, onHit(dmg, reason, dir), capsize(), warn(text), puff(x,y,z,color), killedLairs, onKilled(kind, pos) }
  update(dt, ctx) {
    this.t += dt;
    const P = ctx.player.pos;
    // Serpiente: de noche, en mar abierto.
    this.serpentT -= dt;
    if (!this.serpent && this.serpentT <= 0) {
      this.serpentT = 25;
      if (ctx.daylight < 0.35 && ctx.deepWater && (ctx.inBoat || ctx.player.inWater) && Math.random() < 0.35) { this.spawnSerpent(P); ctx.warn?.('🐍 Algo enorme se mueve bajo el agua…'); }
    }
    if (this.serpent) this.updateSerpent(dt, ctx);
    // Dragón: aparece cuando estás a menos de 160 bloques de una guarida (si no lo venciste).
    if (!this.dragon) {
      this.lairT = (this.lairT ?? 0) - dt;
      if (this.lairT <= 0) {
        this.lairT = 3;
        const lair = lairsNear(this.world, P.x, P.z, 160).find((l) => !(ctx.killedLairs ?? []).includes(l.id));
        if (lair) { const mesh = this.buildDragon(); mesh.position.set(lair.x + 30, lair.y + 26, lair.z); this.scene.add(mesh); this.dragon = { mesh, lair, hp: 180, max: 180, ang: 0, t: 0, state: 'circle', attackT: 3, aggro: false, flash: 0 }; }
      }
    } else {
      this.updateDragon(dt, ctx);
      if (Math.hypot(P.x - this.dragon.lair.x, P.z - this.dragon.lair.z) > 220) { this.scene.remove(this.dragon.mesh); this.dragon = null; }
    }
    this.updateFireballs(dt, ctx);
    this.updateBombs(dt, ctx);
    if (this.king) this.updateShadowKing(dt, ctx);
  }

  // Golpe del jugador (espada o flecha). Devuelve true si le pegó a algo.
  hit(origin, dir, range, damage, ctx) {
    const targets = [];
    if (this.serpent) for (const g of this.serpent.segs) targets.push({ c: g.position, r: 1.0, who: 'serpent' });
    if (this.dragon) targets.push({ c: this.dragon.mesh.position, r: 2.6, who: 'dragon' });
    if (this.king) targets.push({ c: this.king.pos.clone().setY(this.king.pos.y + 1.8), r: 1.5, who: 'king' });
    let best = null; let bestT = range;
    for (const t of targets) {
      const tt = t.c.clone().sub(origin).dot(dir);
      if (tt < 0 || tt > bestT) continue;
      if (origin.clone().addScaledVector(dir, tt).distanceTo(t.c) < t.r) { best = t; bestT = tt; }
    }
    if (!best) return false;
    if (best.who === 'king') {
      const k = this.king; k.hp -= damage; k.flash = 0.2; this.sound.tone(90, 0.15, 0.2, 'sawtooth');
      if (k.hp <= 0) { const pos = k.pos.clone(); if (k.ring) this.scene.remove(k.ring.mesh); this.scene.remove(k.parts.root); ctx.onKilled?.('king', pos, k.dungeon); this.king = null; }
      return true;
    }
    const m = best.who === 'serpent' ? this.serpent : this.dragon;
    m.hp -= damage; m.flash = 0.2;
    this.sound.tone(best.who === 'dragon' ? 110 : 160, 0.15, 0.2, 'sawtooth');
    if (best.who === 'dragon') { m.aggro = true; m.attackT = Math.min(m.attackT, 1.5); }
    if (m.hp <= 0) {
      const pos = best.who === 'serpent' ? this.serpent.segs[0].position.clone() : this.dragon.mesh.position.clone();
      if (best.who === 'serpent') this.removeSerpent(true);
      else { ctx.onKilled?.('dragon', pos, this.dragon.lair); this.scene.remove(this.dragon.mesh); this.dragon = null; return true; }
      ctx.onKilled?.('serpent', pos);
    }
    return true;
  }

  // Para la barra de jefe.
  boss(P) {
    if (this.king) return { name: `Rey Sombrío · fase ${this.king.phase}`, hp: this.king.hp, max: this.king.max };
    if (this.dragon && (this.dragon.aggro || this.dragon.mesh.position.distanceTo(P) < 60)) return { name: 'Dragón de las montañas', hp: this.dragon.hp, max: this.dragon.max };
    if (this.serpent) return { name: 'Serpiente marina', hp: this.serpent.hp, max: this.serpent.max };
    return null;
  }
}
