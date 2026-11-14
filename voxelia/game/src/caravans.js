import * as THREE from 'three';
import { routesNear, routePoints } from './roads.js';
import { createHumanoid, animateHumanoid, lightHumanoid } from './humanoid.js';

// Carretas de comercio: un caballo tira de un carro con toldo, manejado por un carretero.
// Van de una aldea a otra por el camino, llevan lo que le sobra a una y le falta a la otra,
// y la que recibe le paga en plata al tesoro de la que manda.
const SPEED = 3.2;

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

// Qué se lleva de una aldea a otra: lo que más le sobra al que manda y le falta al que recibe.
export function tradeGoods(from, to) {
  from.stock ??= { food: 14, wood: 12, stone: 12 }; to.stock ??= { food: 14, wood: 12, stone: 12 };
  let best = null;
  for (const k of ['food', 'wood', 'stone']) {
    const diff = from.stock[k] - to.stock[k];
    if (diff >= 6 && (!best || diff > best.diff)) best = { k, diff };
  }
  if (!best) return null;
  const n = Math.min(10, Math.floor(best.diff / 2));
  const price = Math.max(1, Math.ceil(n / 2));
  return { kind: best.k, n, price };
}

export function applyTrade(from, to, goods) {
  from.stock[goods.kind] -= goods.n; to.stock[goods.kind] += goods.n;
  to.treasury = (to.treasury ?? 20) - goods.price; from.treasury = (from.treasury ?? 20) + goods.price;
  if (to.treasury < 0) { from.treasury += to.treasury; to.treasury = 0; }
  from.caravans = (from.caravans ?? 0) + 1;
}

export const GOODS_NAME = { food: 'comida', wood: 'madera', stone: 'piedra' };

export class Caravans {
  constructor(scene, world, animals) {
    this.scene = scene; this.world = world; this.animals = animals;
    this.list = []; this.timers = new Map(); this.scanT = 0; this.t = 0;
    this.mats = {
      wood: new THREE.MeshBasicMaterial({ color: 0x8a5a33 }), dark: new THREE.MeshBasicMaterial({ color: 0x4a2f1a }),
      cloth: new THREE.MeshBasicMaterial({ color: 0xf2ece0 }), crate: new THREE.MeshBasicMaterial({ color: 0xb08050 }),
      wheel: new THREE.MeshBasicMaterial({ color: 0x3e2614 }), iron: new THREE.MeshBasicMaterial({ color: 0x6a6e76 }),
    };
    this.wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10);
  }

  build(name) {
    const m = this.mats; const g = new THREE.Group();
    // Carro: caja, varas hacia el caballo, ruedas y toldo arqueado.
    const cart = new THREE.Group();
    const bed = box(1.4, 0.18, 2.0, m.wood); bed.position.y = 0.75;
    const sideL = box(0.08, 0.4, 2.0, m.dark); sideL.position.set(-0.7, 1.0, 0); const sideR = sideL.clone(); sideR.position.x = 0.7;
    const back = box(1.4, 0.4, 0.08, m.dark); back.position.set(0, 1.0, -1.0);
    const shaftL = box(0.07, 0.07, 1.6, m.dark); shaftL.position.set(-0.45, 0.85, 1.7); const shaftR = shaftL.clone(); shaftR.position.x = 0.45;
    cart.add(bed, sideL, sideR, back, shaftL, shaftR);
    const wheels = [];
    for (const [x, z] of [[-0.78, 0.6], [0.78, 0.6], [-0.78, -0.6], [0.78, -0.6]]) {
      const w = new THREE.Mesh(this.wheelGeo, m.wheel); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); cart.add(w); wheels.push(w);
      const hub = box(0.14, 0.14, 0.14, m.iron); hub.position.set(x * 1.06, 0.45, z); cart.add(hub);
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * Math.PI; const c = box(1.5 / 5 + 0.08, 0.06, 1.7, m.cloth);
      c.position.set(Math.cos(a) * 0.68, 1.2 + Math.sin(a) * 0.62, -0.15); c.rotation.z = a - Math.PI / 2; cart.add(c);
    }
    for (const [x, z, s] of [[-0.3, -0.5, 0.45], [0.3, -0.6, 0.4], [0.05, 0.1, 0.38]]) { const c = box(s, s, s, m.crate); c.position.set(x, 0.84 + s / 2, z); cart.add(c); }
    g.add(cart);
    // Caballo adelante.
    const horse = this.animals.horseMesh(0x8a5a33);
    horse.position.set(0, 0, 3.0); horse.scale.setScalar(0.92);
    g.add(horse);
    // Carretero sentado adelante del carro.
    const parts = createHumanoid({ skin: '#d9a77c', hair: '#5b3d22', shirt: '#6b4a2b', pants: '#3b3024', hat: 'cap', hatColor: '#8f2b26' });
    parts.root.position.set(0, 0.62, 0.85); parts.root.scale.setScalar(0.9);
    g.add(parts.root);
    g.userData = { wheels, horse, parts, name };
    return g;
  }

  spawn(route, forward) {
    const pts = routePoints(this.world, route);
    const from = forward ? route.a : route.b; const to = forward ? route.b : route.a;
    const list = forward ? pts : [...pts].reverse();
    // Arranca y termina en el borde de cada aldea (adentro mandan las calles del pueblo).
    let i0 = list.findIndex((p) => Math.hypot(p.x - from.x, p.z - from.z) > from.radius * 0.85);
    let i1 = list.length - 1; while (i1 > 0 && Math.hypot(list[i1].x - to.x, list[i1].z - to.z) < to.radius * 0.85) i1--;
    if (i0 < 0 || i1 - i0 < 10) return null;
    const path = list.slice(i0, i1 + 1);
    const mesh = this.build(from.name);
    mesh.position.set(path[0].x, path[0].y, path[0].z);
    this.scene.add(mesh);
    const c = { route, from, to, path, s: 0, mesh, state: 'go', wait: 0, y: path[0].y, phase: Math.random() * 6 };
    this.list.push(c);
    return c;
  }

  remove(c) { this.scene.remove(c.mesh); c.mesh.traverse((o) => o.geometry && o.geometry !== this.wheelGeo && o.geometry.dispose()); this.list = this.list.filter((x) => x !== c); }

  // ctx: { player, daylight, onDepart(c), onArrive(c) }
  update(dt, ctx) {
    this.t += dt;
    const P = ctx.player.pos;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 2;
      for (const r of routesNear(this.world, P.x, P.z, 120)) {
        if (this.list.some((c) => c.route === r)) continue;
        const t = (this.timers.get(r.id) ?? 4 + Math.random() * 20) - 2;
        this.timers.set(r.id, t);
        if (t > 0 || ctx.daylight < 0.4) continue;
        this.timers.set(r.id, 80 + Math.random() * 80);
        r._fwd = !r._fwd;
        const c = this.spawn(r, r._fwd);
        if (c) ctx.onDepart?.(c);
      }
    }
    const light = Math.max(0.25, ctx.daylight);
    for (const c of [...this.list]) {
      const ud = c.mesh.userData;
      let moving = false;
      if (c.state === 'go') {
        c.s = Math.min(c.path.length - 1, c.s + SPEED * dt);
        moving = true;
        if (c.s >= c.path.length - 1) { c.state = 'arrived'; c.wait = 8; ctx.onArrive?.(c); }
      } else { c.wait -= dt; if (c.wait <= 0) { this.remove(c); continue; } }
      const i = Math.floor(c.s); const f = c.s - i;
      const p0 = c.path[i]; const p1 = c.path[Math.min(c.path.length - 1, i + 1)];
      const ahead = c.path[Math.min(c.path.length - 1, i + 4)];
      const x = p0.x + (p1.x - p0.x) * f; const z = p0.z + (p1.z - p0.z) * f;
      // Altura suavizada: mira un poco adelante para no saltar escalones.
      const ty = Math.max(p0.y, p1.y, ahead.y - 0.5);
      c.y += (ty - c.y) * Math.min(1, dt * 5);
      c.mesh.position.set(x, c.y, z);
      if (ahead !== p0) c.mesh.rotation.y = Math.atan2(ahead.x - x, ahead.z - z);
      // Ruedas que giran, caballo que camina, carretero con las riendas.
      for (const w of ud.wheels) if (moving) w.rotation.x += SPEED * dt / 0.45;
      const legs = ud.horse.userData.legs; const sw = moving ? Math.sin(this.t * 7 + c.phase) * 0.5 : 0;
      legs.forEach((l, k) => { l.rotation.x = k % 2 ? sw : -sw; });
      ud.horse.userData.head.rotation.x = moving ? Math.sin(this.t * 7 + c.phase) * 0.06 : 0.3;
      animateHumanoid(ud.parts, { t: this.t + c.phase, phase: 0, walk: 0, action: 'sit', lookYaw: Math.sin(this.t * 0.4 + c.phase) * 0.5 });
      lightHumanoid(ud.parts, light);
      ud.horse.userData.mats.forEach((m, k) => m.color.copy(ud.horse.userData.base[k]).multiplyScalar(k === 2 ? 1 : light));
      for (const m of Object.values(this.mats)) { m.userData.base ??= m.color.getHex(); m.color.setHex(m.userData.base).multiplyScalar(light); }
      if (Math.hypot(x - P.x, z - P.z) > 220) this.remove(c);
    }
  }

  clear() { for (const c of [...this.list]) this.remove(c); }
}
