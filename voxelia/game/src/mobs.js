import * as THREE from 'three';
import { BLOCKS, LIGHT_BLOCKS } from './blocks.js';

const HP = 6;
const LIGHT_RADIUS = 4;

// ¿Hay un bloque de luz (lámpara, cristal, faro) cerca de este punto?
export function nearLight(world, x, y, z, r = LIGHT_RADIUS) {
  const bx = Math.floor(x); const by = Math.floor(y); const bz = Math.floor(z);
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (dx * dx + dy * dy + dz * dz > r * r) continue;
    if (LIGHT_BLOCKS.has(world.getBlock(bx + dx, by + dy, bz + dz))) return { x: bx + dx + 0.5, y: by + dy + 0.5, z: bz + dz + 0.5 };
  }
  return null;
}

const solidAt = (world, x, y, z) => BLOCKS[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))].solid;

// Sombras: criaturas nocturnas que flotan hacia el jugador y le temen a la luz.
export class Shadows {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.list = [];
    this.spawnTimer = 0;
    this.t = 0;
    this.geo = {
      body: new THREE.BoxGeometry(0.7, 1.1, 0.7),
      aura: new THREE.BoxGeometry(1.0, 1.4, 1.0),
      eye: new THREE.PlaneGeometry(0.16, 0.1),
      wisp: new THREE.BoxGeometry(0.34, 0.34, 0.34),
    };
  }

  createMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geo.body, new THREE.MeshBasicMaterial({ color: 0x150b26, transparent: true, opacity: 0.92 }));
    const aura = new THREE.Mesh(this.geo.aura, new THREE.MeshBasicMaterial({ color: 0x7b4dff, transparent: true, opacity: 0.22, depthWrite: false }));
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9c6ff, transparent: true, opacity: 1 });
    const e1 = new THREE.Mesh(this.geo.eye, eyeMat); e1.position.set(-0.15, 0.22, 0.36);
    const e2 = new THREE.Mesh(this.geo.eye, eyeMat); e2.position.set(0.15, 0.22, 0.36);
    // Estela de humo: tres cubitos que siguen al cuerpo con retraso y se achican.
    const wispMat = new THREE.MeshBasicMaterial({ color: 0x2a1650, transparent: true, opacity: 0.55, depthWrite: false });
    const wisps = [0.8, 0.6, 0.4].map((sc) => { const w = new THREE.Mesh(this.geo.wisp, wispMat); w.scale.setScalar(sc); w.userData.sc = sc; return w; });
    g.rotation.order = 'YXZ';   // se inclina hacia donde va
    g.add(body, aura, e1, e2);
    g.userData = { body, aura, eyeMat, wisps, wispMat, eyes: [e1, e2] };
    return g;
  }

  spawnAt(x, y, z) {
    const mesh = this.createMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    for (const w of mesh.userData.wisps) { w.position.set(x, y - 0.3, z); this.scene.add(w); }
    const m = { mesh, hp: HP, cooldown: 0, flash: 0, burning: false, fade: 0, lightCheck: 0, light: null, phase: Math.random() * 6 };
    this.list.push(m);
    return m;
  }

  remove(m) {
    this.scene.remove(m.mesh);
    for (const w of m.mesh.userData.wisps) this.scene.remove(w);
    m.mesh.userData.wispMat.dispose();
    for (const c of m.mesh.children) c.material.dispose();
    this.list = this.list.filter((x) => x !== m);
  }

  // ctx: { player, daylight, enabled, nights, onHitPlayer(dmg), onKilled(position) }
  update(dt, ctx) {
    this.t += dt;
    const { player } = ctx;
    const night = ctx.daylight < 0.4;
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z);

    // Aparición de noche, lejos de la luz.
    this.spawnTimer -= dt;
    const cap = 3 + Math.min(ctx.nights ?? 0, 5);
    if (ctx.enabled && night && this.spawnTimer <= 0 && this.list.length < cap) {
      this.spawnTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 10;
      const x = Math.floor(player.pos.x + Math.cos(a) * r);
      const z = Math.floor(player.pos.z + Math.sin(a) * r);
      const top = this.world.topAt(x, z);
      if (top > 0 && !nearLight(this.world, x, top + 1, z, 6)) this.spawnAt(x + 0.5, top + 1.6, z + 0.5);
    }

    for (const m of [...this.list]) {
      const p = m.mesh.position;
      const ud = m.mesh.userData;
      // De día se desvanecen sin dejar nada.
      if (!night && ctx.daylight > 0.55) m.fade += dt;
      if (m.fade > 0) {
        const o = Math.max(0, 1 - m.fade / 1.5);
        ud.body.material.opacity = 0.92 * o; ud.aura.material.opacity = 0.22 * o; ud.eyeMat.opacity = o; ud.wispMat.opacity = 0.55 * o;
        p.y += dt * 0.8;
        if (o <= 0) this.remove(m);
        continue;
      }
      // Luz cercana: se queman y huyen.
      m.lightCheck -= dt;
      if (m.lightCheck <= 0) { m.lightCheck = 0.5; m.light = nearLight(this.world, p.x, p.y, p.z); }
      const dir = new THREE.Vector3();
      if (m.light) {
        dir.set(p.x - m.light.x, 0.3, p.z - m.light.z).normalize();
        m.hp -= dt * 1.5;
        if (m.hp <= 0) { this.kill(m, ctx, false); continue; }
      } else {
        dir.subVectors(target, p);
        const dist = dir.length();
        dir.normalize();
        // Contacto con el jugador.
        m.cooldown -= dt;
        if (dist < 1.15 && m.cooldown <= 0) {
          m.cooldown = 1.2;
          ctx.onHitPlayer(2, dir.clone());
        }
        if (dist < 0.9) dir.set(0, 0, 0);
      }
      const speed = (2.5 + Math.min(ctx.nights ?? 0, 4) * 0.2) * (m.light ? 1.4 : 1);
      // Se mueven eje por eje sin atravesar bloques; si chocan, suben.
      for (const axis of ['x', 'z', 'y']) {
        const step = dir[axis] * speed * dt;
        if (!step) continue;
        const nx = p.x + (axis === 'x' ? step : 0); const ny = p.y + (axis === 'y' ? step : 0); const nz = p.z + (axis === 'z' ? step : 0);
        if (!solidAt(this.world, nx, ny, nz) && !solidAt(this.world, nx, ny + 0.5, nz) && !solidAt(this.world, nx, ny - 0.5, nz)) p[axis] = axis === 'x' ? nx : axis === 'y' ? ny : nz;
        else if (axis !== 'y' && !solidAt(this.world, p.x, p.y + 1, p.z)) p.y += speed * dt;
      }
      // Animación: flotan ondulando, se inclinan al perseguir, ojos que laten y estela de humo.
      const wave = Math.sin(this.t * 3 + m.phase);
      ud.body.position.y = wave * 0.08;
      ud.body.scale.set(1 - wave * 0.05, 1 + wave * 0.07, 1 - wave * 0.05);
      m.mesh.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
      m.mesh.rotation.x += ((m.light ? -0.25 : 0.22) - m.mesh.rotation.x) * Math.min(1, dt * 4);
      const pulse = 0.65 + 0.35 * Math.sin(this.t * 6 + m.phase);
      ud.eyeMat.color.setRGB(0.85 * pulse + 0.15, 0.78 * pulse + 0.1, 1);
      for (const e of ud.eyes) e.scale.y = Math.sin(this.t * 0.9 + m.phase) > 0.97 ? 0.15 : 1;   // parpadeo
      let lead = p;
      ud.wisps.forEach((w, i) => {
        const follow = new THREE.Vector3(lead.x, lead.y - (i === 0 ? 0.45 : 0.1), lead.z);
        w.position.lerp(follow, Math.min(1, dt * (7 - i * 1.5)));
        w.rotation.y += dt * (1.5 + i); w.rotation.x += dt * (1 + i * 0.5);
        lead = w.position;
      });
      m.flash = Math.max(0, m.flash - dt);
      ud.aura.material.color.set(m.flash > 0 ? 0xffffff : m.light ? 0xff9a4d : 0x7b4dff);
      ud.aura.material.opacity = m.flash > 0 ? 0.6 : 0.18 + Math.sin(this.t * 5 + m.phase) * 0.06;
      if (p.distanceTo(target) > 64) this.remove(m);
    }
  }

  // Golpe del jugador: rayo desde el ojo. Devuelve true si le pegó a una Sombra.
  hit(origin, dir, range, damage, ctx) {
    let best = null; let bestT = range;
    for (const m of this.list) {
      if (m.fade > 0) continue;
      const to = new THREE.Vector3().subVectors(m.mesh.position, origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(m.mesh.position) < 0.8) { best = m; bestT = t; }
    }
    if (!best) return false;
    best.hp -= damage;
    best.flash = 0.15;
    best.mesh.position.addScaledVector(dir, 1.2);
    this.sound.tone(260, 0.12, 0.2, 'triangle');
    if (best.hp <= 0) this.kill(best, ctx, true);
    return true;
  }

  kill(m, ctx, byPlayer) {
    this.sound.tone(520, 0.08, 0.15, 'sine');
    setTimeout(() => this.sound.tone(330, 0.2, 0.15, 'sine'), 80);
    ctx.onKilled?.(m.mesh.position.clone(), byPlayer);
    this.remove(m);
  }

  clear() { for (const m of [...this.list]) this.remove(m); }
}
