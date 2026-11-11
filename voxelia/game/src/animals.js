import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';

// Lanudos: animales pacíficos y redondos que pastan de día en llanuras y bosques.
// Caminan solos, saltan escalones de un bloque, huyen si les pegás y sueltan lana.
const HP = 4;
const GROUND = new Set([B.GRASS, B.DIRT, B.SNOW]);
// Pelaje en tonos pastel (crema, lila, menta, durazno): no hay dos manadas iguales.
const COLORS = [0xf6efdc, 0xd9c8f2, 0xc6eedb, 0xf6d3b8, 0xf6efdc];

export class Animals {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.list = [];
    this.spawnTimer = 1;
    this.t = 0;
    this.geo = {
      body: new THREE.BoxGeometry(0.95, 0.85, 1.05),
      tuft: new THREE.BoxGeometry(0.3, 0.22, 0.3),
      head: new THREE.BoxGeometry(0.46, 0.46, 0.42),
      leg: new THREE.BoxGeometry(0.18, 0.4, 0.18),
      eye: new THREE.PlaneGeometry(0.08, 0.08),
    };
  }

  createMesh(color) {
    const g = new THREE.Group();
    const wool = new THREE.MeshBasicMaterial({ color });
    const skin = new THREE.MeshBasicMaterial({ color: 0x3b2f2a });
    const body = new THREE.Mesh(this.geo.body, wool); body.position.y = 0.78;
    const head = new THREE.Mesh(this.geo.head, skin); head.position.set(0, 0.92, 0.7);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const e1 = new THREE.Mesh(this.geo.eye, eyeMat); e1.position.set(-0.11, 0.06, 0.215);
    const e2 = new THREE.Mesh(this.geo.eye, eyeMat); e2.position.set(0.11, 0.06, 0.215);
    const legs = [[-0.28, 0.35], [0.28, 0.35], [-0.28, -0.38], [0.28, -0.38]].map(([x, z]) => { const l = new THREE.Mesh(this.geo.leg, skin); l.position.set(x, 0.2, z); return l; });
    // Mechón de pelo sobre la cabeza (rasgo propio de los Lanudos).
    const tuft = new THREE.Mesh(this.geo.tuft, wool); tuft.position.set(0, 0.27, -0.02); head.add(tuft, e1, e2);
    g.add(body, head, ...legs);
    g.userData = { mats: [wool, skin, eyeMat], base: [new THREE.Color(color), new THREE.Color(0x3b2f2a), new THREE.Color(0xffffff)], legs, head };
    return g;
  }

  // Altura del suelo (bloque sólido más alto) en una columna; -1 si no hay.
  groundAt(x, z) {
    const top = this.world.topAt(Math.floor(x), Math.floor(z));
    return top;
  }

  spawnAt(x, z) {
    const top = this.groundAt(x, z);
    if (top < 0) return null;
    const mesh = this.createMesh(COLORS[Math.floor(Math.random() * COLORS.length)]);
    mesh.position.set(x, top + 1, z);
    this.scene.add(mesh);
    const a = { mesh, hp: HP, heading: Math.random() * Math.PI * 2, walk: 0, timer: 0, flee: 0, flash: 0, vy: 0, phase: Math.random() * 6 };
    this.list.push(a);
    return a;
  }

  remove(a) {
    this.scene.remove(a.mesh);
    for (const m of a.mesh.userData.mats) m.dispose();
    this.list = this.list.filter((x) => x !== a);
  }

  // ctx: { player, daylight, onKilled(position) }
  update(dt, ctx) {
    this.t += dt;
    const { player } = ctx;
    // Aparecen de día sobre pasto, fuera de la vista inmediata, hasta 8 alrededor del jugador.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      if (ctx.daylight > 0.5 && this.list.length < 8) {
        const ang = Math.random() * Math.PI * 2; const r = 18 + Math.random() * 22;
        const x = Math.floor(player.pos.x + Math.cos(ang) * r) + 0.5; const z = Math.floor(player.pos.z + Math.sin(ang) * r) + 0.5;
        const top = this.groundAt(x, z);
        if (top > 0 && GROUND.has(this.world.getBlock(Math.floor(x), top, Math.floor(z))) && this.world.getBlock(Math.floor(x), top + 1, Math.floor(z)) === B.AIR) {
          // En manada: a veces aparecen dos juntos.
          this.spawnAt(x, z);
          if (Math.random() < 0.5) this.spawnAt(x + 1, z + 1);
        }
      }
    }

    const light = Math.max(0.28, ctx.daylight);
    for (const a of [...this.list]) {
      const p = a.mesh.position;
      // Decide: caminar, quedarse quieto o huir del jugador.
      a.timer -= dt; a.flee = Math.max(0, a.flee - dt);
      if (a.flee > 0) {
        a.heading = Math.atan2(p.x - player.pos.x, p.z - player.pos.z) + Math.sin(this.t * 3 + a.phase) * 0.4;
        a.walk = 1;
      } else if (a.timer <= 0) {
        a.timer = 2 + Math.random() * 4;
        a.walk = Math.random() < 0.55 ? 1 : 0;
        a.heading += (Math.random() - 0.5) * 2.4;
      }
      const speed = a.flee > 0 ? 3.6 : 1.1;
      if (a.walk) {
        const nx = p.x + Math.sin(a.heading) * speed * dt; const nz = p.z + Math.cos(a.heading) * speed * dt;
        const ground = this.groundAt(nx, nz);
        const above = this.world.getBlock(Math.floor(nx), ground + 1, Math.floor(nz));
        const feet = Math.floor(p.y) - 1;
        // Solo escalones de un bloque, nada de meterse al agua (el "techo" de columna ignora el agua) ni a pozos profundos.
        const ok = ground >= 0 && above !== B.WATER && !BLOCKS[above].solid && ground - feet <= 1 && feet - ground <= 3;
        if (ok) { p.x = nx; p.z = nz; if (ground > feet && a.vy === 0) a.vy = 6; } else { a.heading += Math.PI * (0.5 + Math.random()); a.timer = 1.5; }
      }
      // Gravedad simple hacia el suelo de la columna.
      const floor = this.groundAt(p.x, p.z) + 1;
      a.vy -= 22 * dt;
      p.y += a.vy * dt;
      if (p.y <= floor) { p.y = floor; a.vy = 0; }
      // Animación: patas que se mueven al caminar, cabeza que pasta cuando está quieto.
      const swing = a.walk ? Math.sin(this.t * (a.flee ? 16 : 9) + a.phase) * 0.5 : 0;
      a.mesh.userData.legs.forEach((l, i) => { l.rotation.x = i % 2 ? swing : -swing; });
      a.mesh.userData.head.position.y = a.walk ? 0.92 : 0.8 + Math.sin(this.t * 2 + a.phase) * 0.05;
      a.mesh.rotation.y += (((a.heading - a.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
      // Iluminación: siguen la luz del día; destello blanco al recibir un golpe.
      a.flash = Math.max(0, a.flash - dt);
      const ud = a.mesh.userData;
      ud.mats.forEach((m, i) => { if (a.flash > 0) m.color.setRGB(1, 0.55, 0.55); else m.color.copy(ud.base[i]).multiplyScalar(i === 2 ? 1 : light); });
      if (p.distanceTo(player.pos) > 90) this.remove(a);
    }
  }

  // Golpe del jugador. Devuelve true si le pegó a un Lanudo.
  hit(origin, dir, range, damage, ctx) {
    let best = null; let bestT = range;
    for (const a of this.list) {
      const c = a.mesh.position.clone(); c.y += 0.75;
      const to = new THREE.Vector3().subVectors(c, origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < 0.75) { best = a; bestT = t; }
    }
    if (!best) return false;
    best.hp -= damage;
    best.flash = 0.2; best.flee = 5; best.vy = 5;
    best.mesh.position.addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 0.6);
    this.sound.tone(420, 0.1, 0.12, 'triangle');
    if (best.hp <= 0) {
      this.sound.tone(300, 0.15, 0.1, 'sine');
      ctx.onKilled?.(best.mesh.position.clone());
      this.remove(best);
    }
    return true;
  }

  clear() { for (const a of [...this.list]) this.remove(a); }
}
