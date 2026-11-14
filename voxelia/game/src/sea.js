import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { SEA } from './world.js';

// Vida del mar y del cielo: cardúmenes de peces, medusas que brillan de noche, bandadas de pájaros,
// barcos mercantes que van y vienen de los puertos, y los botes del jugador.
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const isWater = (id) => !!BLOCKS[id]?.water;
const BOAT_Y = SEA + 0.82;   // altura de la cubierta del bote sobre el agua

export class Sea {
  constructor(scene, world, sound) {
    this.scene = scene; this.world = world; this.sound = sound;
    this.fish = []; this.jellies = []; this.birds = []; this.ships = []; this.boats = [];
    this.riding = null; this.t = 0; this.spawnTimer = 0; this.shipTimers = new Map();
    this.mats = {
      fish: [0xf2a33a, 0x5fb8e8, 0xe8e8f0, 0xe85a6a].map((c) => new THREE.MeshBasicMaterial({ color: c })),
      jelly: new THREE.MeshBasicMaterial({ color: 0xe08cff, transparent: true, opacity: 0.85 }),
      jellyCore: new THREE.MeshBasicMaterial({ color: 0xffe0ff }),
      bird: new THREE.MeshBasicMaterial({ color: 0xf4f4f0 }), birdTip: new THREE.MeshBasicMaterial({ color: 0x3a3a3a }),
      hull: new THREE.MeshBasicMaterial({ color: 0x7a4e2a }), deck: new THREE.MeshBasicMaterial({ color: 0xb08050 }), trim: new THREE.MeshBasicMaterial({ color: 0x3e2614 }),
      sail: new THREE.MeshBasicMaterial({ color: 0xf2ece0, side: THREE.DoubleSide }), stripe: new THREE.MeshBasicMaterial({ color: 0xc0392b, side: THREE.DoubleSide }),
      flag: new THREE.MeshBasicMaterial({ color: 0xf1c40f, side: THREE.DoubleSide }),
    };
    this.fishGeo = new THREE.BoxGeometry(0.12, 0.14, 0.32); this.tailGeo = new THREE.BoxGeometry(0.02, 0.14, 0.1);
  }

  // ───────── Bichos ─────────
  waterAt(x, y, z) { return isWater(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))); }
  columnDepth(x, z) { let d = 0; for (let y = SEA - 1; y > SEA - 14 && this.waterAt(x, y, z); y--) d++; return d; }

  spawnSchool(x, z) {
    const depth = this.columnDepth(x, z);
    if (depth < 3) return;
    const mat = this.mats.fish[Math.floor(Math.random() * this.mats.fish.length)];
    const y = SEA - 1 - Math.random() * (depth - 2);
    const school = { x, y, z, heading: Math.random() * Math.PI * 2, timer: 0, members: [] };
    const n = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); const body = new THREE.Mesh(this.fishGeo, mat); const tail = new THREE.Mesh(this.tailGeo, mat); tail.position.z = -0.2; g.add(body, tail);
      g.userData.tail = tail; g.userData.off = new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.6); g.userData.phase = Math.random() * 6;
      g.position.set(x, y, z); this.scene.add(g); school.members.push(g);
    }
    this.fish.push(school);
  }

  spawnJelly(x, z) {
    const depth = this.columnDepth(x, z);
    if (depth < 2) return;
    const g = new THREE.Group();
    const bell = box(0.5, 0.35, 0.5, this.mats.jelly); bell.position.y = 0.2; const core = box(0.22, 0.18, 0.22, this.mats.jellyCore); core.position.y = 0.18;
    g.add(bell, core);
    const legs = [];
    for (let k = 0; k < 4; k++) { const l = box(0.04, 0.55, 0.04, this.mats.jelly); l.position.set(k < 2 ? -0.14 : 0.14, -0.2, k % 2 ? -0.14 : 0.14); g.add(l); legs.push(l); }
    // Una lucecita propia para que se vea en la noche (sin costo: material sin sombreado).
    g.position.set(x, SEA - 1.5 - Math.random() * Math.max(0, depth - 3), z);
    this.scene.add(g);
    this.jellies.push({ mesh: g, legs, phase: Math.random() * 6, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3 });
  }

  spawnFlock(cx, cz, y) {
    const flock = { cx, cz, y, r: 8 + Math.random() * 10, a: Math.random() * 6, speed: 0.25 + Math.random() * 0.2, birds: [], life: 60 + Math.random() * 60 };
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); const body = box(0.18, 0.14, 0.4, this.mats.bird);
      const wl = new THREE.Group(); const wr = new THREE.Group();
      const l = box(0.5, 0.03, 0.2, this.mats.bird); l.position.x = -0.27; const lt = box(0.12, 0.03, 0.2, this.mats.birdTip); lt.position.x = -0.55; wl.add(l, lt);
      const r = box(0.5, 0.03, 0.2, this.mats.bird); r.position.x = 0.27; const rt = box(0.12, 0.03, 0.2, this.mats.birdTip); rt.position.x = 0.55; wr.add(r, rt);
      g.add(body, wl, wr); g.userData = { wl, wr, off: k * 0.35, dy: (Math.random() - 0.5) * 2, dr: (Math.random() - 0.5) * 3 };
      this.scene.add(g); flock.birds.push(g);
    }
    this.birds.push(flock);
  }

  // ───────── Barcos mercantes ─────────
  shipMesh() {
    const m = this.mats; const g = new THREE.Group();
    const hull = box(2.6, 1.1, 7, m.hull); hull.position.y = 0.2;
    const bow = box(1.6, 1, 1.4, m.hull); bow.position.set(0, 0.3, 4); const bowTip = box(0.7, 0.9, 0.9, m.hull); bowTip.position.set(0, 0.4, 4.9);
    const stern = box(2.6, 1, 1.6, m.trim); stern.position.set(0, 1.1, -3);
    const deck = box(2.4, 0.1, 6.6, m.deck); deck.position.y = 0.8;
    const rimL = box(0.15, 0.35, 6.8, m.trim); rimL.position.set(-1.3, 0.95, 0); const rimR = rimL.clone(); rimR.position.x = 1.3;
    const mast = box(0.22, 7, 0.22, m.trim); mast.position.set(0, 4.2, 0.4);
    const yard = box(4.2, 0.15, 0.15, m.trim); yard.position.set(0, 6.6, 0.4);
    const sail = box(4, 4, 0.05, m.sail); sail.position.set(0, 4.6, 0.5); const stripe = box(4.01, 0.8, 0.06, m.stripe); stripe.position.set(0, 4.6, 0.5);
    const flag = box(0.9, 0.5, 0.03, m.flag); flag.position.set(0.5, 7.6, 0.4);
    const crates = [[-0.6, -1.2], [0.6, -1.4], [0.5, 1.8]].map(([x, z]) => { const c = box(0.7, 0.7, 0.7, m.deck); c.position.set(x, 1.2, z); return c; });
    g.add(hull, bow, bowTip, stern, deck, rimL, rimR, mast, yard, sail, stripe, flag, ...crates);
    g.userData = { sail, stripe, flag };
    return g;
  }

  // Un barco por puerto cargado, de vez en cuando: viene desde mar adentro, amarra y se vuelve a ir.
  updateShips(dt, ctx) {
    for (const a of ctx.ports) {
      const port = a.plan.port; const id = a.plan.id;
      if (this.ships.some((s) => s.planId === id)) continue;
      const t = (this.shipTimers.get(id) ?? 20 + Math.random() * 40) - dt;
      this.shipTimers.set(id, t);
      if (t > 0) continue;
      this.shipTimers.set(id, 150 + Math.random() * 120);
      const [dx, dz] = port.dir; const [px, pz] = port.perp;
      // Amarra al costado del extremo del muelle.
      const dock = new THREE.Vector3(port.end.x + 0.5 - dx * 3 + px * 3.4, SEA - 0.05, port.end.z + 0.5 - dz * 3 + pz * 3.4);
      const far = dock.clone().add(new THREE.Vector3(dx * 70, 0, dz * 70));
      const mesh = this.shipMesh(); mesh.position.copy(far); mesh.rotation.y = Math.atan2(-dx, -dz);
      this.scene.add(mesh);
      this.ships.push({ planId: id, plan: a.plan, mesh, dock, far, state: 'in', wait: 0, rock: Math.random() * 6 });
    }
    for (const s of [...this.ships]) {
      const p = s.mesh.position;
      s.rock += dt;
      s.mesh.rotation.z = Math.sin(s.rock * 0.9) * 0.04; s.mesh.position.y = SEA - 0.05 + Math.sin(s.rock * 1.3) * 0.08;
      s.mesh.userData.flag.rotation.y = Math.sin(this.t * 6) * 0.3;
      if (s.state === 'in' || s.state === 'out') {
        const goal = s.state === 'in' ? s.dock : s.far;
        const dx = goal.x - p.x; const dz = goal.z - p.z; const d = Math.hypot(dx, dz);
        const speed = Math.min(4, 0.6 + d * 0.15);
        if (d < 0.3) {
          if (s.state === 'in') { s.state = 'docked'; s.wait = 60; ctx.onDock?.(s.plan, p.clone()); }
          else { this.removeShip(s); continue; }
        } else {
          p.x += (dx / d) * speed * dt; p.z += (dz / d) * speed * dt;
          // La proa del modelo mira a +z: gira de a poco hacia donde va.
          s.mesh.rotation.y += (((Math.atan2(dx, dz) - s.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.5);
        }
      } else if (s.state === 'docked') {
        s.wait -= dt;
        if (s.wait <= 0) { s.state = 'out'; ctx.onLeave?.(s.plan); }
      }
      // Muy lejos del jugador: se desarma.
      if (ctx.player && Math.hypot(p.x - ctx.player.pos.x, p.z - ctx.player.pos.z) > 260) this.removeShip(s);
    }
  }
  removeShip(s) { this.scene.remove(s.mesh); s.mesh.traverse((o) => o.geometry?.dispose()); this.ships = this.ships.filter((x) => x !== s); }

  // ───────── Botes del jugador ─────────
  boatMesh() {
    const m = this.mats; const g = new THREE.Group();
    const bottom = box(1.2, 0.12, 2.2, m.deck); bottom.position.y = 0.05;
    const l = box(0.12, 0.42, 2.2, m.hull); l.position.set(-0.6, 0.26, 0); const r = l.clone(); r.position.x = 0.6;
    const f = box(1.2, 0.42, 0.12, m.hull); f.position.set(0, 0.26, 1.1); const bk = f.clone(); bk.position.z = -1.1;
    const seat = box(1.1, 0.08, 0.35, m.trim); seat.position.set(0, 0.3, -0.25);
    const oarL = box(0.06, 0.06, 1.4, m.trim); oarL.position.set(-0.75, 0.4, 0); oarL.rotation.x = 0.3; const oarR = oarL.clone(); oarR.position.x = 0.75;
    g.add(bottom, l, r, f, bk, seat, oarL, oarR);
    g.userData = { oarL, oarR };
    return g;
  }

  placeBoat(x, z, heading = 0) {
    const mesh = this.boatMesh(); mesh.position.set(x, BOAT_Y - 0.25, z); mesh.rotation.y = heading;
    this.scene.add(mesh);
    const b = { mesh, heading, speed: 0, rock: Math.random() * 6 };
    this.boats.push(b);
    return b;
  }
  removeBoat(b) { if (this.riding === b) this.riding = null; this.scene.remove(b.mesh); b.mesh.traverse((o) => o.geometry?.dispose()); this.boats = this.boats.filter((x) => x !== b); }

  // Bote apuntado por la mirada (rayo contra una esfera aproximada).
  boatHit(origin, dir, range = 5) {
    let best = null; let bestT = range;
    for (const b of this.boats) {
      const c = b.mesh.position.clone().setY(b.mesh.position.y + 0.25);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < 1.1) { best = b; bestT = t; }
    }
    return best;
  }

  // Remar: W/S adelante/atrás, A/D gira. El bote no sube a tierra.
  ride(dt, input, player) {
    const b = this.riding; if (!b) return;
    const fwd = input.f - input.b; const turn = input.l - input.r;
    b.heading += turn * dt * 1.8;
    b.speed += (fwd * 6.5 - b.speed) * Math.min(1, dt * (fwd ? 1.6 : 0.8));
    const nx = b.mesh.position.x - Math.sin(b.heading) * b.speed * dt; const nz = b.mesh.position.z - Math.cos(b.heading) * b.speed * dt;
    const free = (x, z) => this.waterAt(x, SEA - 1, z) && !BLOCKS[this.world.getBlock(Math.floor(x), SEA, Math.floor(z))].solid;
    // Prueba la proa del bote (un poco adelante) para no meter la nariz en la playa.
    const ahead = Math.sign(b.speed) * 1.1;
    if (free(nx - Math.sin(b.heading) * ahead, nz - Math.cos(b.heading) * ahead) && free(nx, nz)) { b.mesh.position.x = nx; b.mesh.position.z = nz; }
    else b.speed *= -0.2;
    b.mesh.rotation.y = b.heading;
    const ud = b.mesh.userData; const row = Math.abs(b.speed) > 0.3 ? Math.sin(this.t * 7) * 0.6 : 0;
    ud.oarL.rotation.x = 0.3 + row; ud.oarR.rotation.x = 0.3 + row;
    player.pos.set(b.mesh.position.x, b.mesh.position.y + 0.1, b.mesh.position.z);
    player.vel.set(0, 0, 0);
    player.onGround = true; player.inWater = false;
  }

  // Bajarse: busca tierra firme alrededor; si no hay, se queda en el agua al lado.
  dismount(player) {
    const b = this.riding; if (!b) return;
    this.riding = null;
    const p = b.mesh.position;
    for (let r = 1; r <= 4; r++) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2; const x = Math.floor(p.x + Math.cos(a) * r * 1.4); const z = Math.floor(p.z + Math.sin(a) * r * 1.4);
      for (let y = SEA + 3; y >= SEA - 1; y--) {
        if (BLOCKS[this.world.getBlock(x, y, z)].solid && !BLOCKS[this.world.getBlock(x, y + 1, z)].solid && !BLOCKS[this.world.getBlock(x, y + 2, z)].solid && !isWater(this.world.getBlock(x, y + 1, z))) {
          player.pos.set(x + 0.5, y + 1.01, z + 0.5); return;
        }
      }
    }
    player.pos.set(p.x + 1.5, SEA, p.z);
  }

  serialize() { return this.boats.map((b) => ({ x: b.mesh.position.x, z: b.mesh.position.z, h: b.heading })); }
  load(list) { for (const b of list ?? []) this.placeBoat(b.x, b.z, b.h); }

  // ───────── Bucle ─────────
  update(dt, ctx) {
    this.t += dt;
    const P = ctx.player.pos;
    const night = ctx.daylight < 0.35;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const ang = Math.random() * Math.PI * 2; const r = 10 + Math.random() * 26;
      const x = P.x + Math.cos(ang) * r; const z = P.z + Math.sin(ang) * r;
      if (this.fish.length < 10 && this.waterAt(x, SEA - 1, z)) this.spawnSchool(x, z);
      if (night && this.jellies.length < 14 && this.waterAt(x, SEA - 1, z)) this.spawnJelly(x, z);
      if (!night && this.birds.length < 3 && Math.random() < 0.35) this.spawnFlock(x, z, Math.max(SEA + 14, this.world.topAt?.(Math.floor(x), Math.floor(z)) + 12 || SEA + 18));
    }
    // Peces: el cardumen deambula y esquiva el fondo; cada pez lo sigue con un desfase.
    for (const s of [...this.fish]) {
      s.timer -= dt;
      if (s.timer <= 0) { s.timer = 2 + Math.random() * 3; s.heading += (Math.random() - 0.5) * 2; }
      const near = Math.hypot(P.x - s.x, P.z - s.z);
      const flee = near < 3 ? 2.6 : 1;
      if (near < 3) s.heading = Math.atan2(s.x - P.x, s.z - P.z);
      const nx = s.x + Math.sin(s.heading) * 1.2 * flee * dt; const nz = s.z + Math.cos(s.heading) * 1.2 * flee * dt;
      if (this.waterAt(nx, s.y, nz) && this.waterAt(nx, s.y - 0.6, nz)) { s.x = nx; s.z = nz; } else { s.heading += Math.PI * (0.6 + Math.random() * 0.6); }
      for (const f of s.members) {
        const o = f.userData.off; const tx = s.x + o.x; const ty = Math.min(SEA - 0.5, s.y + o.y + Math.sin(this.t * 1.5 + f.userData.phase) * 0.1); const tz = s.z + o.z;
        f.position.x += (tx - f.position.x) * Math.min(1, dt * 2.5); f.position.y += (ty - f.position.y) * Math.min(1, dt * 2.5); f.position.z += (tz - f.position.z) * Math.min(1, dt * 2.5);
        f.rotation.y = s.heading; f.userData.tail.rotation.y = Math.sin(this.t * 14 * flee + f.userData.phase) * 0.6;
      }
      if (near > 60) { for (const f of s.members) this.scene.remove(f); this.fish = this.fish.filter((x) => x !== s); }
    }
    // Medusas: suben y bajan latiendo; se van al amanecer.
    for (const j of [...this.jellies]) {
      const m = j.mesh; const pulse = Math.sin(this.t * 2 + j.phase);
      m.scale.set(1 + pulse * 0.08, 1 - pulse * 0.08, 1 + pulse * 0.08);
      m.position.y = Math.min(SEA - 0.6, m.position.y + pulse * 0.2 * dt);
      if (this.waterAt(m.position.x + j.vx * dt, m.position.y, m.position.z + j.vz * dt)) { m.position.x += j.vx * dt; m.position.z += j.vz * dt; } else { j.vx *= -1; j.vz *= -1; }
      j.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 2 + j.phase + i) * 0.25; });
      if (!night || Math.hypot(P.x - m.position.x, P.z - m.position.z) > 60) { this.scene.remove(m); m.traverse((o) => o.geometry?.dispose()); this.jellies = this.jellies.filter((x) => x !== j); }
    }
    this.mats.jelly.opacity = 0.75 + Math.sin(this.t * 1.5) * 0.12;
    // Pájaros: vuelan en ronda aleteando y se van tras un rato.
    for (const f of [...this.birds]) {
      f.life -= dt; f.a += f.speed * dt;
      for (const b of f.birds) {
        const a = f.a - b.userData.off; const r = f.r + b.userData.dr;
        b.position.set(f.cx + Math.cos(a) * r, f.y + b.userData.dy + Math.sin(this.t * 0.7 + b.userData.off) * 0.6, f.cz + Math.sin(a) * r);
        b.rotation.y = -a; b.rotation.z = 0.25;
        const flap = Math.sin(this.t * 9 + b.userData.off * 5) * 0.5; b.userData.wl.rotation.z = flap; b.userData.wr.rotation.z = -flap;
      }
      if (f.life <= 0 || night) { for (const b of f.birds) this.scene.remove(b); this.birds = this.birds.filter((x) => x !== f); }
    }
    this.updateShips(dt, ctx);
    // Botes amarrados: se mecen.
    for (const b of this.boats) {
      b.rock += dt;
      b.mesh.position.y = BOAT_Y - 0.25 + Math.sin(b.rock * 1.4) * 0.04;
      if (b !== this.riding) b.mesh.rotation.z = Math.sin(b.rock * 1.1) * 0.03;
    }
    // Brillo: de día los materiales se ven con la luz del sol; las medusas siempre brillan.
    const light = Math.max(0.2, ctx.daylight);
    for (const k of ['hull', 'deck', 'trim', 'sail', 'stripe', 'flag', 'bird', 'birdTip']) this.tint(this.mats[k], light);
    for (const m of this.mats.fish) this.tint(m, Math.max(0.3, light * 0.8));
  }

  tint(m, k) { m.userData.base ??= m.color.getHex(); m.color.setHex(m.userData.base).multiplyScalar(k); }

  clear() {
    for (const s of this.fish) for (const f of s.members) this.scene.remove(f);
    for (const j of this.jellies) this.scene.remove(j.mesh);
    for (const f of this.birds) for (const b of f.birds) this.scene.remove(b);
    for (const s of [...this.ships]) this.removeShip(s);
    for (const b of [...this.boats]) this.removeBoat(b);
    this.fish = []; this.jellies = []; this.birds = [];
  }
}

export { BOAT_Y };
