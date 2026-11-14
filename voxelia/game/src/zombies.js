import * as THREE from 'three';
import { createHumanoid, animateHumanoid, lightHumanoid } from './humanoid.js';
import { standY, stepToward, settle, turnTo } from './walk.js';
import { navigate } from './pathfind.js';
import { nearLight } from './mobs.js';

// ───────── Zombis ─────────
// Salen de noche en lugares oscuros, caminan arrastrando los pies con los brazos estirados
// y persiguen al jugador o a los aldeanos que quedaron afuera.
// Al amanecer buscan sombra (bajo árboles o techos) para esconderse; si el sol los agarra, se queman.
const HP = 12;
const SKINS = ['#6f8f5a', '#7d9a5f', '#5f7d52'];
const SHIRTS = ['#3d5a7a', '#5a4a3a', '#6a3a3a', '#4a5a3a'];

export class Zombies {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.list = [];
    this.spawnTimer = 3;
    this.t = 0;
    this.smoke = [];
  }

  spawnAt(x, y, z) {
    const r = Math.random;
    const parts = createHumanoid({ skin: SKINS[Math.floor(r() * 3)], shirt: SHIRTS[Math.floor(r() * 4)], pants: '#33343f', hair: '#2e3a22', zombie: true });
    // Ropa rota: un brazo sin manga.
    parts.armL.children[0].material = parts.mats[0];
    parts.root.position.set(x, y, z);
    this.scene.add(parts.root);
    const z0 = { parts, pos: new THREE.Vector3(x, y, z), heading: r() * Math.PI * 2, vy: 0, stuck: 0, side: r() < 0.5 ? 1 : -1, hp: HP, flash: 0, cooldown: 0, phase: r() * 6, walk: 0, state: 'wander', target: null, timer: 0, burning: 0, dead: false, deadT: 0, groanT: 2 + r() * 6, hiddenT: 0 };
    this.list.push(z0);
    return z0;
  }

  remove(z) {
    this.scene.remove(z.parts.root);
    z.parts.root.traverse((o) => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    this.list = this.list.filter((x) => x !== z);
  }

  // Está a cielo abierto (sin nada arriba)?
  exposed(z) { return this.world.topAt(Math.floor(z.pos.x), Math.floor(z.pos.z)) < z.pos.y; }

  // ctx: { player, daylight, enabled, nights, villagers (aldeanos fuera de casa), villages (planes cerca),
  //        lightAt(x,y,z), onHitPlayer(dmg, dir), onHitVillager(e, dmg), onKilled(pos, byPlayer) }
  update(dt, ctx) {
    this.t += dt;
    const { player } = ctx;
    const night = ctx.daylight < 0.35;
    // Aparición: de noche, lejos de la luz, alrededor del jugador o en el borde de una aldea.
    this.spawnTimer -= dt;
    const cap = 2 + Math.min(ctx.nights ?? 0, 6);
    if (ctx.enabled && night && this.spawnTimer <= 0 && this.list.filter((z) => !z.dead).length < cap) {
      this.spawnTimer = 3.5;
      let x; let zc;
      const village = ctx.villages?.[0];
      if (village && Math.random() < 0.45) { const a = Math.random() * Math.PI * 2; x = Math.floor(village.x + Math.cos(a) * (village.radius + 4)); zc = Math.floor(village.z + Math.sin(a) * (village.radius + 4)); }
      else { const a = Math.random() * Math.PI * 2; const r = 18 + Math.random() * 14; x = Math.floor(player.pos.x + Math.cos(a) * r); zc = Math.floor(player.pos.z + Math.sin(a) * r); }
      const top = this.world.topAt(x, zc);
      if (top > 0 && Math.hypot(x - player.pos.x, zc - player.pos.z) > 14) {
        const y = standY(this.world, x + 0.5, top + 1, zc + 0.5, 1, 2);
        if (y !== null && !nearLight(this.world, x, y, zc, 7)) this.spawnAt(x + 0.5, y, zc + 0.5);
      }
    }

    for (const z of [...this.list]) {
      if (z.dead) {
        // Cae de espaldas y se deshace.
        z.deadT += dt;
        z.parts.root.rotation.x = -Math.min(1, z.deadT * 2.5) * Math.PI / 2;
        z.parts.root.position.y = z.pos.y + 0.15;
        lightHumanoid(z.parts, Math.max(0, 0.5 - z.deadT * 0.4));
        if (z.deadT > 1.2) this.remove(z);
        continue;
      }
      if (!this.world.getChunk(Math.floor(z.pos.x / 16), Math.floor(z.pos.z / 16))) continue;
      z.cooldown -= dt; z.flash = Math.max(0, z.flash - dt); z.timer -= dt;
      let goal = null; let speed = 1.25 + Math.min(ctx.nights ?? 0, 4) * 0.12;
      let attacking = false;
      const dayNow = ctx.daylight > 0.45;
      if (dayNow) {
        // De día: esconderse en la sombra; al sol, quemarse.
        if (this.exposed(z)) {
          z.burning += dt;
          z.hp -= dt * 2.2;
          if (Math.random() < dt * 8) this.puff(z.pos.x, z.pos.y + 1.6, z.pos.z, 0x555555);
          if (!z.shade || z.timer <= 0) { z.shade = this.findShade(z); z.timer = 3; }
          if (z.shade) { goal = z.shade; speed = 2.2; }
          if (z.hp <= 0) { this.kill(z, ctx, false); continue; }
        } else { z.state = 'hidden'; z.hiddenT += dt; z.burning = 0; }
        // Escondidos lejos del jugador desaparecen.
        if (z.hiddenT > 25 && Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) > 30) { this.remove(z); continue; }
      } else {
        // De noche: persigue al más cercano (jugador o aldeano afuera).
        let best = null; let bestD = 22;
        if (ctx.enabled) { const d = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z); if (d < bestD && Math.abs(player.pos.y - z.pos.y) < 6) { best = { kind: 'player', pos: player.pos }; bestD = d; } }
        for (const v of ctx.villagers ?? []) {
          if (v.hidden) continue;
          const d = Math.hypot(v.pos.x - z.pos.x, v.pos.z - z.pos.z);
          if (d < bestD) { best = { kind: 'villager', e: v, pos: v.pos }; bestD = d; }
        }
        if (best) {
          goal = { x: best.pos.x, z: best.pos.z }; speed *= 1.25;
          if (bestD < 1.3 && Math.abs(best.pos.y - z.pos.y) < 1.6) {
            attacking = true;
            if (z.cooldown <= 0) {
              z.cooldown = 1.1;
              const dir = new THREE.Vector3(best.pos.x - z.pos.x, 0, best.pos.z - z.pos.z).normalize();
              if (best.kind === 'player') ctx.onHitPlayer(3, dir, z); else ctx.onHitVillager(best.e, 3, z);
            }
          }
          z.heading = Math.atan2(best.pos.x - z.pos.x, best.pos.z - z.pos.z);
        } else if (z.timer <= 0 || !z.target) {
          z.timer = 4 + Math.random() * 4;
          z.target = { x: z.pos.x + (Math.random() - 0.5) * 12, z: z.pos.z + (Math.random() - 0.5) * 12 };
        }
        if (!best) goal = z.target;
        z.hiddenT = 0;
      }
      let moving = false;
      if (goal && !attacking && Math.hypot(goal.x - z.pos.x, goal.z - z.pos.z) > 1) moving = navigate(this.world, z, goal, speed, dt).moved;
      settle(this.world, z, dt);
      // Gemidos ocasionales cuando está cerca.
      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = 5 + Math.random() * 8;
        const d = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
        if (d < 18) { const v = 1 - d / 18; this.sound.tone(70 + Math.random() * 30, 0.6, 0.12 * v, 'sawtooth'); this.sound.noise(0.5, { freq: 240, q: 2, gain: 0.08 * v }); }
      }
      // Animación: paso arrastrado con bamboleo, brazos estirados.
      z.walk += ((moving ? 1 : 0) - z.walk) * Math.min(1, dt * 6);
      if (moving) z.phase += dt * speed * 3.4;
      const root = z.parts.root;
      root.position.copy(z.pos);
      root.rotation.y = turnTo(root.rotation.y, z.heading, dt, 6);
      root.rotation.z = Math.sin(z.phase * 0.5) * 0.08 * z.walk;
      animateHumanoid(z.parts, { t: this.t + z.phase, phase: z.phase, walk: z.walk * 0.7, action: attacking ? 'attack' : z.state === 'hidden' && dayNow ? 'idle' : 'zombie' });
      const light = ctx.lightAt(z.pos.x, z.pos.y + 1.5, z.pos.z);
      lightHumanoid(z.parts, z.burning > 0 ? Math.max(light, 0.6 + Math.sin(this.t * 30) * 0.3) : light, z.flash);
      if (Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) > 120) this.remove(z);
    }
    this.smoke = this.smoke.filter((s) => {
      s.life -= dt; s.mesh.position.y += dt * 1.2; s.mesh.material.opacity = Math.max(0, s.life) * 0.6; s.mesh.scale.multiplyScalar(1 + dt * 0.8);
      if (s.life <= 0) { this.scene.remove(s.mesh); s.mesh.material.dispose(); return false; }
      return true;
    });
  }

  // Busca una columna a la sombra cerca (árbol, techo, saliente).
  findShade(z) {
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * Math.PI * 2; const r = 2 + Math.random() * 10;
      const x = z.pos.x + Math.cos(a) * r; const zz = z.pos.z + Math.sin(a) * r;
      const y = standY(this.world, x, z.pos.y, zz, 1, 3);
      if (y === null) continue;
      if (this.world.topAt(Math.floor(x), Math.floor(zz)) > y + 1) return { x, z: zz };
    }
    return null;
  }

  puff(x, y, z, color) {
    const g = this.puffGeo ?? (this.puffGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
    this.scene.add(m);
    this.smoke.push({ mesh: m, life: 0.9 });
  }

  // Daño desde cualquier fuente (jugador, flecha, guardia). Devuelve true si murió.
  damage(z, dmg, ctx, byPlayer, push) {
    if (z.dead) return false;
    z.hp -= dmg; z.flash = 0.2;
    if (push) { z.pos.x += push.x * 0.6; z.pos.z += push.z * 0.6; z.vy = 4; }
    this.sound.tone(120, 0.15, 0.15, 'sawtooth');
    if (z.hp <= 0) { this.kill(z, ctx, byPlayer); return true; }
    return false;
  }

  kill(z, ctx, byPlayer) {
    z.dead = true; z.deadT = 0;
    for (let i = 0; i < 6; i++) this.puff(z.pos.x, z.pos.y + 0.6 + i * 0.15, z.pos.z, 0x6f8f5a);
    this.sound.tone(90, 0.4, 0.15, 'sawtooth');
    ctx.onKilled?.(z.pos.clone(), byPlayer);
  }

  // Golpe cuerpo a cuerpo del jugador: rayo desde el ojo.
  hit(origin, dir, range, damage, ctx) {
    let best = null; let bestT = range;
    for (const z of this.list) {
      if (z.dead) continue;
      const c = new THREE.Vector3(z.pos.x, z.pos.y + 1.1, z.pos.z);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < 0.75) { best = z; bestT = t; }
    }
    if (!best) return false;
    this.damage(best, damage, ctx, true, new THREE.Vector3(dir.x, 0, dir.z).normalize());
    return true;
  }

  clear() { for (const z of [...this.list]) this.remove(z); }
}
