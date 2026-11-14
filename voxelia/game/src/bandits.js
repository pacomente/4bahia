import * as THREE from 'three';
import { B } from './blocks.js';
import { createHumanoid, animateHumanoid, lightHumanoid, makeProp } from './humanoid.js';
import { standY, stepToward, settle, turnTo } from './walk.js';
import { campsNear } from './camps.js';

// ───────── Saqueadores ─────────
// Viven en los campamentos: un jefe, saqueadores con hacha y arqueros. Si te acercás, te atacan
// (todos juntos si golpeás a uno). De noche, a veces salen a saquear una aldea buena: atacan a los
// aldeanos que quedaron afuera y se roban comida de la plaza. Al amanecer se retiran.
// En las jaulas del campamento hay prisioneros: rompé los barrotes para liberarlos.
const TYPES = {
  leader: { hp: 40, dmg: 5, speed: 2.1, scale: 1.18, cooldown: 1.2 },
  raider: { hp: 14, dmg: 3, speed: 2.3, scale: 1, cooldown: 1.0 },
  archer: { hp: 10, dmg: 3, speed: 2.1, scale: 1, cooldown: 2.4 },
};
const LEADER_NAMES = ['Brago el Rojo', 'Tuerta Malvina', 'Garrón', 'La Víbora', 'Mordaz', 'Cuervo Viejo'];
const SHOUTS = { aggro: ['¡Un intruso!', '¡A él!', '¡Nadie entra al campamento!', '¡Agárrenlo!'], raid: ['¡Saqueen todo!', '¡La comida es nuestra!', '¡Ja, ja, ja!'], flee: ['¡Retirada!', '¡Se hace de día, vámonos!'], leader: ['¿Te atrevés a venir a mi campamento?', '¡Vas a pagar caro!'] };
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function bubble(text) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = 'bold 26px Trebuchet MS, sans-serif';
  const w = Math.min(560, Math.ceil(g.measureText(text).width) + 28); c.width = w; c.height = 50;
  g.font = 'bold 26px Trebuchet MS, sans-serif';
  g.fillStyle = 'rgba(90,10,10,0.75)'; g.beginPath(); g.roundRect(0, 0, w, 42, 10); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 8, 42); g.lineTo(w / 2, 50); g.lineTo(w / 2 + 8, 42); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 14, 22, w - 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(w / 100, 0.5, 1);
  return s;
}

export class Bandits {
  constructor(scene, world, sound, saved = {}) {
    this.scene = scene; this.world = world; this.sound = sound;
    this.records = new Map(Object.entries(saved ?? {}));   // campamento → { defeated, killed, freed, leaderName }
    this.active = new Map();
    this.list = [];            // saqueadores en escena (del campamento y de incursiones)
    this.captives = [];
    this.t = 0; this.scanT = 0; this.wasNight = false;
  }

  record(plan) {
    if (!this.records.has(plan.id)) this.records.set(plan.id, { defeated: false, killed: { raider: 0, archer: 0 }, freed: [], leaderName: LEADER_NAMES[(plan.rx * 7 + plan.rz * 13 + 99) % LEADER_NAMES.length] });
    return this.records.get(plan.id);
  }
  serialize() { return Object.fromEntries(this.records); }

  spawn(kind, x, y, z, extra = {}) {
    const T = TYPES[kind];
    const r = Math.random;
    const parts = createHumanoid({
      skin: ['#d9a77c', '#b8835a', '#8d5a3b', '#f0c8a0'][Math.floor(r() * 4)], hair: '#1a1a1a',
      shirt: kind === 'leader' ? '#5a1e1e' : ['#3a2a22', '#2a2a30', '#4a3a2a'][Math.floor(r() * 3)], pants: '#1e1c22',
      hat: kind === 'leader' ? 'helmet' : 'bandana', hatColor: kind === 'archer' ? '#26232a' : '#8f2b26',
      cape: kind === 'leader' ? '#1c1a20' : null, beard: kind === 'leader' ? '#2b1d12' : r() < 0.4 ? '#2b1d12' : null, scale: T.scale,
    });
    const prop = makeProp(kind === 'archer' ? 'bow' : 'axe');
    parts.tool.add(prop);
    parts.root.position.set(x, y, z);
    this.scene.add(parts.root);
    const b = { kind, parts, pos: new THREE.Vector3(x, y, z), heading: r() * 6.28, vy: 0, stuck: 0, side: 1, hp: T.hp, max: T.hp, T, flash: 0, cooldown: 1 + r(), phase: r() * 6, walk: 0, state: 'idle', timer: r() * 3, target: null, dead: false, deadT: 0, bubble: null, bubbleT: 0, aggro: false, isBandit: true, ...extra };
    this.list.push(b);
    return b;
  }

  remove(b) {
    this.scene.remove(b.parts.root);
    b.parts.root.traverse((o) => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    if (b.bubble) this.scene.remove(b.bubble);
    this.list = this.list.filter((x) => x !== b);
  }

  say(b, text, secs = 2.5) {
    if (b.bubble) { this.scene.remove(b.bubble); b.bubble.material.map.dispose(); b.bubble.material.dispose(); }
    b.bubble = bubble(text); b.bubbleT = secs; this.scene.add(b.bubble);
  }

  ground(x, z, y) { const fy = standY(this.world, x, y + 2, z, 3, 10); return fy ?? y; }

  // ───── Campamentos cerca: aparecen sus habitantes y prisioneros ─────
  scan(player) {
    for (const plan of campsNear(this.world, player.pos.x, player.pos.z, 90)) {
      if (this.active.has(plan.id) || !this.world.getChunk(Math.floor(plan.x / 16), Math.floor(plan.z / 16))) continue;
      const rec = this.record(plan);
      const a = { plan, rec, members: [], captives: [] };
      this.active.set(plan.id, a);
      if (!rec.defeated) {
        const at = (rad) => { const ang = Math.random() * 6.28; const x = plan.x + 0.5 + Math.cos(ang) * rad; const z = plan.z + 0.5 + Math.sin(ang) * rad; return [x, this.ground(x, z, plan.y + 1), z]; };
        a.members.push(this.spawn('leader', ...at(3), { camp: a, name: rec.leaderName }));
        for (let k = 0; k < 3 - rec.killed.raider; k++) a.members.push(this.spawn('raider', ...at(4 + Math.random() * 4), { camp: a }));
        for (let k = 0; k < 2 - rec.killed.archer; k++) a.members.push(this.spawn('archer', ...at(5 + Math.random() * 3), { camp: a }));
      }
      plan.cages.forEach((c, i) => { if (!rec.freed.includes(i)) a.captives.push(this.spawnCaptive(a, i, c)); });
    }
    for (const [id, a] of this.active) {
      if (Math.hypot(a.plan.x - player.pos.x, a.plan.z - player.pos.z) < 160) continue;
      for (const b of [...a.members]) if (!b.raid) this.remove(b);
      for (const c of a.captives) this.removeCaptive(c);
      this.active.delete(id);
    }
  }

  spawnCaptive(a, i, c) {
    const parts = createHumanoid({ skin: '#f0c8a0', hair: '#5b3d22', shirt: '#7a6a5a', pants: '#4a4038' });
    const pos = new THREE.Vector3(c.x + 0.5, a.plan.y + 1, c.z + 0.5);
    parts.root.position.copy(pos);
    this.scene.add(parts.root);
    return { parts, pos, cage: i, cell: c, a, free: false, t: Math.random() * 5, heading: Math.random() * 6, vy: 0, stuck: 0, side: 1, phase: 0, walk: 0, bubble: null, bubbleT: 0, sayT: 3 };
  }
  removeCaptive(c) {
    this.scene.remove(c.parts.root);
    c.parts.root.traverse((o) => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    if (c.bubble) this.scene.remove(c.bubble);
  }

  // ───── Incursiones: de noche, un grupo sale a saquear una aldea ─────
  startRaid(villagePlan, camp) {
    const ang = Math.atan2(camp.z - villagePlan.z, camp.x - villagePlan.x);
    const raid = { village: villagePlan, campName: camp.name, stolen: 0 };
    for (let k = 0; k < 4; k++) {
      const a = ang + (k - 1.5) * 0.25; const rad = villagePlan.radius + 6;
      const x = villagePlan.x + 0.5 + Math.cos(a) * rad; const z = villagePlan.z + 0.5 + Math.sin(a) * rad;
      const b = this.spawn(k === 3 ? 'archer' : 'raider', x, this.ground(x, z, villagePlan.y + 4), z, { raid });
      b.aggro = true;
      if (k === 0) this.say(b, pick(SHOUTS.raid), 3);
    }
    return raid;
  }

  // ctx: { player, daylight, enabled, villagers, villages (aldeas activas: {plan, rec}), lightAt, onHitPlayer(dmg, dir, quien),
  //        onHitVillager(e, dmg), onKilled(b, byPlayer), onShoot(origin, dir), onRaid(plan, campName), onSteal(plan, n), onFreed(captive, plan) }
  update(dt, ctx) {
    this.t += dt;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 1; this.scan(ctx.player); }
    const night = ctx.daylight < 0.35;
    // Al anochecer se decide si hay incursión en las aldeas cercanas.
    if (night && !this.wasNight && ctx.enabled) {
      for (const v of ctx.villages ?? []) {
        const camp = campsNear(this.world, v.plan.x, v.plan.z, 420).find((c) => !this.record(c).defeated);
        if (camp && Math.random() < 0.45) { this.startRaid(v.plan, camp); ctx.onRaid?.(v.plan, camp.name); }
      }
    }
    this.wasNight = night;
    const player = ctx.player;
    const ppos = player.pos;
    for (const b of [...this.list]) {
      if (b.dead) {
        b.deadT += dt;
        b.parts.root.rotation.x = -Math.min(1, b.deadT * 2.5) * Math.PI / 2;
        b.parts.root.position.y = b.pos.y + 0.15;
        lightHumanoid(b.parts, Math.max(0, 0.6 - b.deadT * 0.4));
        if (b.deadT > 1.5) this.remove(b);
        continue;
      }
      if (!this.world.getChunk(Math.floor(b.pos.x / 16), Math.floor(b.pos.z / 16))) continue;
      b.cooldown -= dt; b.flash = Math.max(0, b.flash - dt); b.timer -= dt;
      const dPlayer = Math.hypot(ppos.x - b.pos.x, ppos.z - b.pos.z);
      const home = b.camp?.plan ?? b.raid?.village;
      let goal = null; let speed = b.T.speed; let attacking = false; let facing = null;
      // Al amanecer, los de la incursión se van.
      if (b.fleeing || (b.raid && ctx.daylight > 0.45)) {
        if (!b.target || !b.fleeing) { b.fleeing = true; this.say(b, pick(SHOUTS.flee)); const a = Math.random() * 6.28; b.target = { x: b.pos.x + Math.cos(a) * 60, z: b.pos.z + Math.sin(a) * 60 }; }
        goal = b.target; speed *= 1.3;
        if (dPlayer > 50) { this.remove(b); continue; }
      } else {
        // ¿A quién atacar? Al jugador si está cerca (o si ya los provocó), si no a un aldeano que esté afuera.
        let foe = null;
        const reach = b.aggro ? 26 : b.kind === 'archer' ? 16 : 13;
        if (ctx.enabled && dPlayer < reach && Math.abs(ppos.y - b.pos.y) < 8) foe = { kind: 'player', pos: ppos };
        if (!foe && b.raid) {
          let best = 16;
          for (const v of ctx.villagers ?? []) { if (v.hidden) continue; const d = Math.hypot(v.pos.x - b.pos.x, v.pos.z - b.pos.z); if (d < best) { best = d; foe = { kind: 'villager', e: v, pos: v.pos }; } }
        }
        if (foe && foe.kind === 'player' && !b.aggro) {
          // Provocado: avisa al resto del campamento.
          for (const o of b.camp?.members ?? []) o.aggro = true;
          b.aggro = true; this.say(b, pick(b.kind === 'leader' ? SHOUTS.leader : SHOUTS.aggro));
        }
        if (foe) {
          const d = Math.hypot(foe.pos.x - b.pos.x, foe.pos.z - b.pos.z);
          facing = Math.atan2(foe.pos.x - b.pos.x, foe.pos.z - b.pos.z);
          if (b.kind === 'archer') {
            // Mantiene distancia y dispara con un poco de elevación (la flecha cae).
            if (d < 6) { goal = { x: b.pos.x - (foe.pos.x - b.pos.x), z: b.pos.z - (foe.pos.z - b.pos.z) }; }
            else if (d > 14) goal = { x: foe.pos.x, z: foe.pos.z };
            if (d < 20 && b.cooldown <= 0) {
              b.cooldown = b.T.cooldown;
              const from = new THREE.Vector3(b.pos.x, b.pos.y + 1.45, b.pos.z);
              const to = new THREE.Vector3(foe.pos.x, foe.pos.y + 1.0, foe.pos.z);
              const dir = to.sub(from); const dist = dir.length(); dir.normalize();
              dir.y += (0.5 * 16 * (dist / 26) ** 2) / dist + (Math.random() - 0.5) * 0.04;
              ctx.onShoot?.(from, dir.normalize(), b, foe);
              attacking = true;
            }
          } else {
            goal = { x: foe.pos.x, z: foe.pos.z }; speed *= 1.15;
            if (d < 1.6 && Math.abs(foe.pos.y - b.pos.y) < 1.8) {
              attacking = true; goal = null;
              if (b.cooldown <= 0) {
                b.cooldown = b.T.cooldown;
                const dir = new THREE.Vector3(foe.pos.x - b.pos.x, 0, foe.pos.z - b.pos.z).normalize();
                if (foe.kind === 'player') ctx.onHitPlayer(b.T.dmg, dir, b); else ctx.onHitVillager(foe.e, b.T.dmg, b);
              }
            }
          }
        } else if (b.raid) {
          // Sin nadie a quien atacar: a la plaza, a robar comida.
          const v = b.raid.village;
          const dPlaza = Math.hypot(v.x - b.pos.x, v.z - b.pos.z);
          if (dPlaza > 4) goal = { x: v.x + 0.5 + Math.sin(b.phase) * 3, z: v.z + 0.5 + Math.cos(b.phase) * 3 };
          else { b.stealT = (b.stealT ?? 6) - dt; if (b.stealT <= 0) { b.stealT = 8; ctx.onSteal?.(v, 3); if (Math.random() < 0.5) this.say(b, pick(SHOUTS.raid)); } }
        } else if (home) {
          // En el campamento: pasea entre las carpas y la fogata; si se alejó mucho, vuelve.
          b.aggro = b.aggro && dPlayer < 34;
          if (!b.target || b.timer <= 0) { b.timer = 3 + Math.random() * 5; const a = Math.random() * 6.28; const r = b.kind === 'leader' ? 2.5 : 3 + Math.random() * 6; b.target = { x: home.x + 0.5 + Math.cos(a) * r, z: home.z + 0.5 + Math.sin(a) * r }; }
          goal = Math.hypot(b.target.x - b.pos.x, b.target.z - b.pos.z) > 0.8 ? b.target : null;
          speed *= 0.6;
        }
      }
      let moving = false;
      if (goal) moving = stepToward(this.world, b, goal.x, goal.z, speed, dt).moved;
      settle(this.world, b, dt);
      if (facing !== null) b.heading = facing;
      // Animación.
      b.walk += ((moving ? 1 : 0) - b.walk) * Math.min(1, dt * 8);
      if (moving) b.phase += dt * speed * 4;
      const root = b.parts.root;
      root.position.copy(b.pos);
      root.rotation.y = turnTo(root.rotation.y, b.heading, dt, 9);
      animateHumanoid(b.parts, { t: this.t + b.phase, phase: b.phase, walk: b.walk, action: attacking ? 'attack' : b.aggro && !moving ? 'guard' : 'idle' });
      b.lightT = (b.lightT ?? 0) - dt;
      if (b.lightT <= 0) { b.lightT = 0.3; b.light = ctx.lightAt(b.pos.x, b.pos.y + 1.5, b.pos.z); }
      lightHumanoid(b.parts, b.light ?? 1, b.flash);
      if (b.bubble) {
        b.bubbleT -= dt; b.bubble.position.set(b.pos.x, b.pos.y + 2.4 * b.T.scale, b.pos.z); b.bubble.material.opacity = Math.min(1, b.bubbleT * 2);
        if (b.bubbleT <= 0) { this.scene.remove(b.bubble); b.bubble.material.map.dispose(); b.bubble.material.dispose(); b.bubble = null; }
      }
    }
    this.updateCaptives(dt, ctx);
  }

  // Prisioneros: piden ayuda; si se rompen los barrotes de su jaula, salen corriendo hacia la aldea más cercana.
  updateCaptives(dt, ctx) {
    for (const a of this.active.values()) {
      for (const c of [...a.captives]) {
        c.t += dt;
        const d = Math.hypot(ctx.player.pos.x - c.pos.x, ctx.player.pos.z - c.pos.z);
        if (!c.free) {
          // ¿Rompieron algún barrote de la jaula?
          c.checkT = (c.checkT ?? 0) - dt;
          if (c.checkT <= 0) {
            c.checkT = 0.5;
            let broken = false;
            // Si la jaula todavía no está cargada, getBlock da aire: no cuenta como rota.
            const loaded = [-1, 1].every((dx) => [-1, 1].every((dz) => this.world.getChunk(Math.floor((c.cell.x + dx) / 16), Math.floor((c.cell.z + dz) / 16))));
            if (loaded) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && this.world.getBlock(c.cell.x + dx, a.plan.y + 1, c.cell.z + dz) !== B.BARS) broken = true;
            if (broken) {
              c.free = true; c.freeT = 0;
              if (!a.rec.freed.includes(c.cage)) a.rec.freed.push(c.cage);
              this.sayCaptive(c, '¡Libre! ¡Gracias, gracias!', 3);
              ctx.onFreed?.(c, a.plan);
            }
          }
          c.sayT -= dt;
          if (c.sayT <= 0 && d < 10) { c.sayT = 7 + Math.random() * 5; this.sayCaptive(c, pick(['¡Socorro! ¡Sacame de acá!', '¡Rompé los barrotes!', 'Por favor…']), 2.5); }
          animateHumanoid(c.parts, { t: c.t, phase: 0, walk: 0, action: d < 8 && Math.sin(c.t) > 0 ? 'scared' : 'idle', lookPitch: 0.3 });
          if (d < 8) c.parts.root.rotation.y = turnTo(c.parts.root.rotation.y, Math.atan2(ctx.player.pos.x - c.pos.x, ctx.player.pos.z - c.pos.z), dt, 4);
        } else {
          // Sale de la jaula y se aleja hacia el portón; después desaparece (llegó a una aldea).
          c.freeT += dt;
          const gate = a.plan.gates[0];
          const moving = stepToward(this.world, c, gate.x + 0.5, gate.z - 4, 3, dt).moved;
          settle(this.world, c, dt);
          c.walk += ((moving ? 1 : 0) - c.walk) * Math.min(1, dt * 8);
          if (moving) c.phase += dt * 12;
          c.parts.root.position.copy(c.pos);
          c.parts.root.rotation.y = turnTo(c.parts.root.rotation.y, c.heading, dt, 8);
          animateHumanoid(c.parts, { t: c.t, phase: c.phase, walk: c.walk, action: moving ? 'idle' : 'cheer' });
          if (c.freeT > 9) { this.removeCaptive(c); a.captives = a.captives.filter((x) => x !== c); continue; }
        }
        c.lightT = (c.lightT ?? 0) - dt;
        if (c.lightT <= 0) { c.lightT = 0.4; c.light = ctx.lightAt(c.pos.x, c.pos.y + 1.5, c.pos.z); }
        lightHumanoid(c.parts, c.light ?? 1);
        if (c.bubble) { c.bubbleT -= dt; c.bubble.position.set(c.pos.x, c.pos.y + 2.3, c.pos.z); if (c.bubbleT <= 0) { this.scene.remove(c.bubble); c.bubble = null; } }
      }
    }
  }
  sayCaptive(c, text, secs) { if (c.bubble) this.scene.remove(c.bubble); c.bubble = bubble(text); c.bubble.material.color.set('#ffffff'); c.bubbleT = secs; this.scene.add(c.bubble); }

  // Daño desde cualquier fuente. Devuelve true si murió.
  damage(b, dmg, ctx, byPlayer, push) {
    if (b.dead) return false;
    b.hp -= dmg; b.flash = 0.2;
    if (byPlayer) { b.aggro = true; for (const o of b.camp?.members ?? []) o.aggro = true; }
    if (push) { b.pos.x += push.x * (b.kind === 'leader' ? 0.3 : 0.6); b.pos.z += push.z * (b.kind === 'leader' ? 0.3 : 0.6); b.vy = 4; }
    this.sound.tone(b.kind === 'leader' ? 140 : 200, 0.14, 0.15, 'sawtooth');
    if (b.hp > 0) return false;
    b.dead = true; b.deadT = 0;
    this.sound.tone(110, 0.4, 0.15, 'sawtooth');
    if (b.camp) {
      const rec = b.camp.rec;
      if (b.kind === 'leader') {
        rec.defeated = true;
        // Sin jefe, el resto huye.
        let shouted = false;
        for (const o of b.camp.members) if (o !== b && !o.dead) { o.fleeing = true; o.target = { x: o.pos.x + (Math.random() - 0.5) * 120, z: o.pos.z + (Math.random() - 0.5) * 120 }; if (!shouted) { this.say(o, '¡Cayó el jefe! ¡Corran!'); shouted = true; } }
      } else rec.killed[b.kind] = (rec.killed[b.kind] ?? 0) + 1;
      b.camp.members = b.camp.members.filter((x) => x !== b);
    }
    ctx.onKilled?.(b, byPlayer);
    return true;
  }

  // Golpe cuerpo a cuerpo (rayo desde el ojo).
  hit(origin, dir, range, dmg, ctx) {
    let best = null; let bestT = range;
    for (const b of this.list) {
      if (b.dead) continue;
      const c = new THREE.Vector3(b.pos.x, b.pos.y + 1.1 * b.T.scale, b.pos.z);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < 0.75 * b.T.scale) { best = b; bestT = t; }
    }
    if (!best) return false;
    this.damage(best, dmg, ctx, true, new THREE.Vector3(dir.x, 0, dir.z).normalize());
    return true;
  }

  // Al amanecer los campamentos reclutan a los que faltan (salvo los que perdieron a su jefe).
  dawn() { for (const rec of this.records.values()) if (!rec.defeated) rec.killed = { raider: 0, archer: 0 }; }

  // Jefe enojado más cercano (para la barra de vida en pantalla).
  boss(player) {
    return this.list.find((b) => b.kind === 'leader' && !b.dead && b.aggro && Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z) < 30) ?? null;
  }

  clear() { for (const b of [...this.list]) this.remove(b); }
}
