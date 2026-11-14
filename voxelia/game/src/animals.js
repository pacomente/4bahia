import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';

// Lanudos: animales pacíficos y redondos que pastan de día en llanuras y bosques.
// Caminan solos, saltan escalones de un bloque, huyen si les pegás y sueltan lana.
const HP = 4;
const GROUND = new Set([B.GRASS, B.DIRT, B.SNOW, B.SAND]);
// Especies: vida, velocidad, si huyen al acercarse, si saltan, y caminar de costado (cangrejos).
export const SPECIES = {
  lanudo: { name: 'Lanudo', hp: 4, speed: 1.1, flee: 3.6, scared: 0, scale: 1 },
  deer: { name: 'Ciervo', hp: 6, speed: 1.4, flee: 5.5, scared: 9, scale: 1 },
  rabbit: { name: 'Conejo', hp: 2, speed: 1.6, flee: 4.6, scared: 6, hop: true, scale: 1 },
  horse: { name: 'Caballo', hp: 10, speed: 1.3, flee: 5, scared: 0, scale: 1, ride: true },
  chicken: { name: 'Gallina', hp: 2, speed: 0.9, flee: 3, scared: 2.5, hop: true, scale: 1 },
  wolf: { name: 'Lobo', hp: 8, speed: 1.3, flee: 4.6, scared: 0, scale: 1, hostile: true },
  parrot: { name: 'Loro', hp: 2, speed: 1.0, flee: 3.5, scared: 4, hop: true, scale: 1 },
  crab: { name: 'Cangrejo', hp: 2, speed: 0.9, flee: 2.2, scared: 3, sideways: true, scale: 1 },
};
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
      tail: new THREE.BoxGeometry(0.22, 0.22, 0.2),
      ear: new THREE.BoxGeometry(0.2, 0.08, 0.12),
      head: new THREE.BoxGeometry(0.46, 0.46, 0.42),
      leg: new THREE.BoxGeometry(0.18, 0.4, 0.18),
      eye: new THREE.PlaneGeometry(0.08, 0.08),
    };
  }

  createMesh(species, color) {
    if (species === 'deer') return this.deerMesh();
    if (species === 'rabbit') return this.rabbitMesh(color);
    if (species === 'crab') return this.crabMesh();
    if (species === 'horse') return this.horseMesh(color);
    if (species === 'chicken') return this.chickenMesh();
    if (species === 'wolf') return this.wolfMesh(color);
    if (species === 'parrot') return this.parrotMesh(color);
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
    const tuft = new THREE.Mesh(this.geo.tuft, wool); tuft.position.set(0, 0.27, -0.02);
    // Orejas caídas que se mueven y colita esponjosa que se sacude.
    const earL = new THREE.Mesh(this.geo.ear, skin); earL.position.set(-0.29, 0.1, -0.02);
    const earR = new THREE.Mesh(this.geo.ear, skin); earR.position.set(0.29, 0.1, -0.02);
    head.add(tuft, e1, e2, earL, earR);
    const tail = new THREE.Mesh(this.geo.tail, wool); tail.position.set(0, 0.95, -0.6);
    g.add(body, head, tail, ...legs);
    g.userData = { mats: [wool, skin, eyeMat], base: [new THREE.Color(color), new THREE.Color(0x3b2f2a), new THREE.Color(0xffffff)], legs, head, body, tail, ears: [earL, earR], eyes: [e1, e2] };
    return g;
  }

  // Modelos de las especies nuevas. Devuelven las mismas partes que el Lanudo (patas, cabeza, cuerpo, cola…).
  parts(g, mats, colors, extra) { g.userData = { mats, base: colors.map((c) => new THREE.Color(c)), ...extra }; return g; }
  deerMesh() {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const fur = new THREE.MeshBasicMaterial({ color: 0x8a5a33 }); const light = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 }); const dark = new THREE.MeshBasicMaterial({ color: 0x3a2a1a }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const body = box(0.55, 0.55, 1.15, fur); body.position.y = 1.05;
    const neck = box(0.25, 0.5, 0.25, fur); neck.position.set(0, 1.4, 0.5); neck.rotation.x = -0.4;
    const head = new THREE.Group(); head.position.set(0, 1.62, 0.68);
    const skull = box(0.3, 0.3, 0.45, fur); skull.position.z = 0.1; const nose = box(0.16, 0.14, 0.12, dark); nose.position.set(0, -0.05, 0.36);
    const e1 = box(0.05, 0.06, 0.02, eyeMat); e1.position.set(-0.16, 0.05, 0.14); const e2 = e1.clone(); e2.position.x = 0.16;
    const earL = box(0.06, 0.18, 0.1, fur); earL.position.set(-0.16, 0.2, -0.05); const earR = earL.clone(); earR.position.x = 0.16;
    head.add(skull, nose, e1, e2, earL, earR);
    // Astas ramificadas.
    for (const s of [-1, 1]) { const a = box(0.05, 0.4, 0.05, dark); a.position.set(s * 0.1, 0.38, -0.05); a.rotation.z = s * -0.4; const b = box(0.05, 0.2, 0.05, dark); b.position.set(s * 0.22, 0.5, 0.05); b.rotation.x = 0.6; head.add(a, b); }
    const tail = box(0.14, 0.18, 0.1, light); tail.position.set(0, 1.18, -0.6);
    const belly = box(0.5, 0.12, 0.9, light); belly.position.y = 0.8;
    const legs = [[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.42], [0.18, -0.42]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.85, z); const m = box(0.12, 0.85, 0.12, fur); m.position.y = -0.42; l.add(m); return l; });
    g.add(body, belly, neck, head, tail, ...legs);
    return this.parts(g, [fur, light, dark, eyeMat], [0x8a5a33, 0xe8dcc0, 0x3a2a1a, 0x1a1a1a], { legs, head, body, tail, ears: [earL, earR], eyes: [e1, e2], headY: 1.62, grazeY: 1.05 });
  }
  rabbitMesh(color) {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const fur = new THREE.MeshBasicMaterial({ color }); const white = new THREE.MeshBasicMaterial({ color: 0xffffff }); const pink = new THREE.MeshBasicMaterial({ color: 0xe8a0a8 }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const body = box(0.32, 0.3, 0.45, fur); body.position.y = 0.25;
    const head = new THREE.Group(); head.position.set(0, 0.42, 0.24);
    const skull = box(0.24, 0.22, 0.24, fur); const nose = box(0.06, 0.05, 0.02, pink); nose.position.set(0, -0.02, 0.13);
    const e1 = box(0.04, 0.05, 0.02, eyeMat); e1.position.set(-0.08, 0.04, 0.12); const e2 = e1.clone(); e2.position.x = 0.08;
    const earL = box(0.06, 0.3, 0.04, fur); earL.position.set(-0.06, 0.25, -0.03); const earR = earL.clone(); earR.position.x = 0.06;
    head.add(skull, nose, e1, e2, earL, earR);
    const tail = box(0.12, 0.12, 0.1, white); tail.position.set(0, 0.3, -0.26);
    const legs = [[-0.1, 0.15], [0.1, 0.15], [-0.11, -0.15], [0.11, -0.15]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.12, z); const m = box(0.08, 0.14, 0.12, fur); m.position.y = -0.06; l.add(m); return l; });
    g.add(body, head, tail, ...legs);
    return this.parts(g, [fur, white, pink, eyeMat], [color, 0xffffff, 0xe8a0a8, 0x1a1a1a], { legs, head, body, tail, ears: [earL, earR], eyes: [e1, e2], headY: 0.42, grazeY: 0.32, bodyY: 0.25 });
  }
  horseMesh(color) {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const coat = new THREE.MeshBasicMaterial({ color }); const mane = new THREE.MeshBasicMaterial({ color: 0x2a1d14 }); const leather = new THREE.MeshBasicMaterial({ color: 0x6b3a1e }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const body = box(0.7, 0.72, 1.55, coat); body.position.y = 1.3;
    const neck = box(0.34, 0.85, 0.4, coat); neck.position.set(0, 1.78, 0.68); neck.rotation.x = -0.5;
    const maneM = box(0.12, 0.85, 0.3, mane); maneM.position.set(0, 1.86, 0.55); maneM.rotation.x = -0.5;
    const head = new THREE.Group(); head.position.set(0, 2.15, 0.95);
    const skull = box(0.32, 0.34, 0.7, coat); skull.position.set(0, 0, 0.2); const muzzle = box(0.26, 0.24, 0.2, mane); muzzle.position.set(0, -0.06, 0.6);
    const e1 = box(0.05, 0.07, 0.04, eyeMat); e1.position.set(-0.17, 0.06, 0.12); const e2 = e1.clone(); e2.position.x = 0.17;
    const earL = box(0.08, 0.18, 0.06, coat); earL.position.set(-0.11, 0.24, -0.06); const earR = earL.clone(); earR.position.x = 0.11;
    head.add(skull, muzzle, e1, e2, earL, earR);
    const saddle = box(0.74, 0.12, 0.6, leather); saddle.position.set(0, 1.71, 0); const blanket = box(0.76, 0.3, 0.5, new THREE.MeshBasicMaterial({ color: 0x8f2b26 })); blanket.position.set(0, 1.58, 0);
    const tail = box(0.16, 0.7, 0.16, mane); tail.position.set(0, 1.25, -0.82); tail.rotation.x = 0.35;
    const legs = [[-0.24, 0.6], [0.24, 0.6], [-0.24, -0.6], [0.24, -0.6]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 1.0, z); const m = box(0.18, 1.0, 0.18, coat); m.position.y = -0.5; const hoof = box(0.2, 0.12, 0.2, mane); hoof.position.y = -0.95; l.add(m, hoof); return l; });
    g.add(body, neck, maneM, head, saddle, blanket, tail, ...legs);
    return this.parts(g, [coat, mane, eyeMat, leather, blanket.material], [color, 0x2a1d14, 0x111111, 0x6b3a1e, 0x8f2b26], { legs, head, body, tail, ears: [earL, earR], eyes: [e1, e2], headY: 2.15, grazeY: 1.3, bodyY: 1.3 });
  }
  wolfMesh(color) {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const fur = new THREE.MeshBasicMaterial({ color }); const light = new THREE.MeshBasicMaterial({ color: 0xd8d4cc }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23f }); const nose = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const collar = new THREE.MeshBasicMaterial({ color: 0xc8352b });
    const body = box(0.42, 0.42, 0.95, fur); body.position.y = 0.62;
    const ruff = box(0.52, 0.5, 0.4, fur); ruff.position.set(0, 0.7, 0.3);
    const head = new THREE.Group(); head.position.set(0, 0.85, 0.6);
    const skull = box(0.36, 0.32, 0.32, fur); const snout = box(0.18, 0.16, 0.24, light); snout.position.set(0, -0.06, 0.26); const n = box(0.08, 0.06, 0.04, nose); n.position.set(0, -0.01, 0.39);
    const e1 = box(0.06, 0.04, 0.02, eyeMat); e1.position.set(-0.1, 0.05, 0.165); const e2 = e1.clone(); e2.position.x = 0.1;
    const earL = box(0.1, 0.16, 0.06, fur); earL.position.set(-0.11, 0.22, -0.04); const earR = earL.clone(); earR.position.x = 0.11;
    const col = box(0.4, 0.08, 0.36, collar); col.position.set(0, -0.15, -0.05); col.visible = false;
    head.add(skull, snout, n, e1, e2, earL, earR, col);
    const tail = box(0.12, 0.12, 0.45, fur); tail.position.set(0, 0.72, -0.62); tail.rotation.x = 0.6;
    const legs = [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.42, z); const m = box(0.12, 0.42, 0.12, fur); m.position.y = -0.21; l.add(m); return l; });
    g.add(body, ruff, head, tail, ...legs);
    return this.parts(g, [fur, light, eyeMat, nose, collar], [color, 0xd8d4cc, 0xffd23f, 0x1a1a1a, 0xc8352b], { legs, head, body, tail, ears: [earL, earR], eyes: [e1, e2], headY: 0.85, grazeY: 0.55, bodyY: 0.62, collar: col });
  }
  parrotMesh(color) {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const feathers = new THREE.MeshBasicMaterial({ color }); const wing = new THREE.MeshBasicMaterial({ color: 0x2f6fd8 }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); const beakM = new THREE.MeshBasicMaterial({ color: 0x3a3a3a });
    const body = box(0.22, 0.34, 0.24, feathers); body.position.y = 0.35;
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.06);
    const skull = box(0.18, 0.18, 0.18, feathers); const beak = box(0.06, 0.1, 0.08, beakM); beak.position.set(0, -0.03, 0.12);
    const e1 = box(0.03, 0.04, 0.02, eyeMat); e1.position.set(-0.08, 0.03, 0.05); const e2 = e1.clone(); e2.position.x = 0.08;
    head.add(skull, beak, e1, e2);
    const wingL = box(0.04, 0.26, 0.2, wing); wingL.position.set(-0.13, 0.36, -0.02); const wingR = wingL.clone(); wingR.position.x = 0.13;
    const tail = box(0.1, 0.3, 0.06, wing); tail.position.set(0, 0.16, -0.14); tail.rotation.x = 0.4;
    const legs = [-0.05, 0.05].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.18, 0); const m = box(0.04, 0.18, 0.04, beakM); m.position.y = -0.09; l.add(m); return l; });
    g.add(body, head, wingL, wingR, tail, ...legs);
    return this.parts(g, [feathers, wing, eyeMat, beakM], [color, 0x2f6fd8, 0x111111, 0x3a3a3a], { legs, head, body, tail, ears: [wingL, wingR], eyes: [e1, e2], headY: 0.6, grazeY: 0.55, bodyY: 0.35 });
  }
  chickenMesh() {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const white = new THREE.MeshBasicMaterial({ color: 0xf4f0e8 }); const yellow = new THREE.MeshBasicMaterial({ color: 0xe8b02a }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); const red = new THREE.MeshBasicMaterial({ color: 0xd8352b });
    const body = box(0.32, 0.3, 0.42, white); body.position.y = 0.34;
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.18);
    const skull = box(0.2, 0.24, 0.18, white); const beak = box(0.08, 0.06, 0.1, yellow); beak.position.set(0, -0.02, 0.13); const comb = box(0.04, 0.08, 0.14, red); comb.position.set(0, 0.15, 0); const wattle = box(0.05, 0.08, 0.04, red); wattle.position.set(0, -0.1, 0.1);
    const e1 = box(0.03, 0.04, 0.02, eyeMat); e1.position.set(-0.1, 0.04, 0.06); const e2 = e1.clone(); e2.position.x = 0.1;
    head.add(skull, beak, comb, wattle, e1, e2);
    const wingL = box(0.04, 0.2, 0.3, white); wingL.position.set(-0.18, 0.36, 0); const wingR = wingL.clone(); wingR.position.x = 0.18;
    const tail = box(0.14, 0.2, 0.08, white); tail.position.set(0, 0.48, -0.22);
    const legs = [-0.07, 0.07].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.2, 0); const m = box(0.04, 0.2, 0.04, yellow); m.position.y = -0.1; l.add(m); return l; });
    g.add(body, head, wingL, wingR, tail, ...legs);
    return this.parts(g, [white, yellow, eyeMat, red], [0xf4f0e8, 0xe8b02a, 0x111111, 0xd8352b], { legs, head, body, tail, ears: [wingL, wingR], eyes: [e1, e2], headY: 0.6, grazeY: 0.42, bodyY: 0.34 });
  }
  crabMesh() {
    const g = new THREE.Group(); const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const shell = new THREE.MeshBasicMaterial({ color: 0xd8462a }); const dark = new THREE.MeshBasicMaterial({ color: 0x8f2b16 }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const body = box(0.55, 0.2, 0.4, shell); body.position.y = 0.22;
    const head = new THREE.Group(); head.position.set(0, 0.32, 0.14);
    const e1 = box(0.05, 0.12, 0.05, eyeMat); e1.position.set(-0.1, 0.06, 0.05); const e2 = e1.clone(); e2.position.x = 0.1;
    head.add(e1, e2);
    const clawL = box(0.16, 0.12, 0.16, shell); clawL.position.set(-0.32, 0.24, 0.24); const clawR = clawL.clone(); clawR.position.x = 0.32;
    const tail = new THREE.Group();
    const legs = [-0.2, 0, 0.2].flatMap((z) => [-1, 1].map((sx) => { const l = new THREE.Group(); l.position.set(sx * 0.3, 0.18, z); const m = box(0.22, 0.05, 0.05, dark); m.position.x = sx * 0.08; m.rotation.z = sx * -0.5; l.add(m); return l; }));
    g.add(body, head, clawL, clawR, tail, ...legs);
    return this.parts(g, [shell, dark, eyeMat], [0xd8462a, 0x8f2b16, 0x1a1a1a], { legs, head, body, tail, ears: [clawL, clawR], eyes: [e1, e2], headY: 0.32, grazeY: 0.32, bodyY: 0.22 });
  }

  // Altura del suelo (bloque sólido más alto) en una columna; -1 si no hay.
  groundAt(x, z) {
    const top = this.world.topAt(Math.floor(x), Math.floor(z));
    return top;
  }

  spawnAt(x, z, species = 'lanudo', opts = {}) {
    const top = this.groundAt(x, z);
    if (top < 0) return null;
    const color = species === 'wolf' ? [0x8a8a8a, 0x6a6058, 0xb8b0a8][Math.floor(Math.random() * 3)] : species === 'parrot' ? [0xd8352b, 0x3aa860, 0xf2c94c][Math.floor(Math.random() * 3)] : species === 'horse' ? [0x8a5a33, 0x5a3a22, 0x2a2420, 0xd8d0c0, 0xb08050][Math.floor(Math.random() * 5)] : species === 'rabbit' ? (this.world.getBlock(Math.floor(x), top, Math.floor(z)) === B.SNOW ? 0xf4f4f4 : [0x8a7a68, 0xa8987a, 0x6b5a4a][Math.floor(Math.random() * 3)]) : COLORS[Math.floor(Math.random() * COLORS.length)];
    const mesh = this.createMesh(species, color);
    mesh.position.set(x, top + 1, z);
    this.scene.add(mesh);
    const sp = SPECIES[species];
    const a = { mesh, species, sp, pen: opts.pen ?? null, penId: opts.penId ?? null, tamed: !!opts.tamed, petName: opts.petName ?? null, hp: sp.hp, cooldown: 0, heading: Math.random() * Math.PI * 2, walk: 0, timer: 0, flee: 0, flash: 0, vy: 0, phase: Math.random() * 6 };
    this.list.push(a);
    return a;
  }

  remove(a) {
    this.scene.remove(a.mesh);
    a.mesh.traverse((o) => o.geometry && !Object.values(this.geo).includes(o.geometry) && o.geometry.dispose());
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
      if (ctx.daylight > 0.45 && this.list.length < 12) {
        const ang = Math.random() * Math.PI * 2; const r = 18 + Math.random() * 22;
        const x = Math.floor(player.pos.x + Math.cos(ang) * r) + 0.5; const z = Math.floor(player.pos.z + Math.sin(ang) * r) + 0.5;
        const top = this.groundAt(x, z);
        const ground = this.world.getBlock(Math.floor(x), top, Math.floor(z));
        const above = this.world.getBlock(Math.floor(x), top + 1, Math.floor(z));
        if (top > 0 && GROUND.has(ground) && !BLOCKS[above].solid && !BLOCKS[above].water) {
          // Cada lugar tiene sus animales: cangrejos en la playa, ciervos en el bosque, conejos en la nieve.
          const biome = this.world.biome(Math.floor(x), Math.floor(z));
          let species = null;
          if (ground === B.SAND) species = top <= 35 ? 'crab' : (biome === 'desert' && Math.random() < 0.3 ? 'rabbit' : null);
          else if (ground === B.SNOW || biome === 'snow') species = 'rabbit';
          else if (biome === 'forest') species = Math.random() < 0.5 ? 'deer' : Math.random() < 0.5 ? 'rabbit' : 'lanudo';
          else if (biome === 'jungle') species = Math.random() < 0.6 ? 'parrot' : 'deer';
          else species = Math.random() < 0.2 ? 'horse' : Math.random() < 0.6 ? 'lanudo' : 'rabbit';
          if (species) {
            // En manada: a veces aparecen varios juntos.
            this.spawnAt(x, z, species);
            if (Math.random() < 0.6) this.spawnAt(x + 1, z + 1, species);
            if (species === 'crab' && Math.random() < 0.6) this.spawnAt(x - 1, z + 1, species);
          }
        }
      }
      // De noche, en bosques y en la nieve, salen lobos en manada (de a 2 o 3).
      const wolves = this.list.filter((a) => a.species === 'wolf' && !a.tamed).length;
      if (ctx.daylight < 0.35 && wolves < 3 && Math.random() < 0.25) {
        const ang = Math.random() * Math.PI * 2; const r = 26 + Math.random() * 14;
        const x = Math.floor(player.pos.x + Math.cos(ang) * r) + 0.5; const z = Math.floor(player.pos.z + Math.sin(ang) * r) + 0.5;
        const biome = this.world.biome(Math.floor(x), Math.floor(z));
        const top = this.groundAt(x, z);
        if (top > 0 && (biome === 'forest' || biome === 'snow' || biome === 'mountains') && GROUND.has(this.world.getBlock(Math.floor(x), top, Math.floor(z)))) {
          const n = 2 + (Math.random() < 0.5 ? 1 : 0);
          for (let k = 0; k < n; k++) { const w = this.spawnAt(x + k, z + (k % 2), 'wolf'); if (w) w.aggro = true; }
          ctx.onHowl?.(x, z);
        }
      }
    }

    const light = Math.max(0.28, ctx.daylight);
    for (const a of [...this.list]) {
      const p = a.mesh.position;
      if (a.ridden) { this.animate(a, dt, light); continue; }   // el jugador lo maneja (ver game.js)
      a.cooldown = Math.max(0, (a.cooldown ?? 0) - dt);
      if (a.tamed || (a.sp.hostile && (a.aggro || ctx.daylight < 0.35))) { if (this.hunt(a, dt, ctx)) { this.animate(a, dt, light); continue; } }
      // Decide: caminar, quedarse quieto o huir del jugador.
      a.timer -= dt; a.flee = Math.max(0, a.flee - dt);
      // Los asustadizos (ciervos, conejos, cangrejos) huyen si te acercás.
      if (a.sp.scared && a.flee <= 0 && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < a.sp.scared) a.flee = 2.5;
      if (a.flee > 0) {
        a.heading = Math.atan2(p.x - player.pos.x, p.z - player.pos.z) + Math.sin(this.t * 3 + a.phase) * 0.4;
        a.walk = 1;
      } else if (a.timer <= 0) {
        a.timer = 2 + Math.random() * 4;
        a.walk = Math.random() < 0.55 ? 1 : 0;
        a.heading += (Math.random() - 0.5) * 2.4;
      }
      const speed = a.flee > 0 ? a.sp.flee : a.sp.speed;
      if (a.walk) {
        const nx = p.x + Math.sin(a.heading) * speed * dt; const nz = p.z + Math.cos(a.heading) * speed * dt;
        const ground = this.groundAt(nx, nz);
        const above = this.world.getBlock(Math.floor(nx), ground + 1, Math.floor(nz));
        const feet = Math.floor(p.y) - 1;
        // Solo escalones de un bloque, nada de meterse al agua (el "techo" de columna ignora el agua) ni a pozos profundos.
        const inPen = !a.pen || (nx > a.pen.x0 + 0.3 && nx < a.pen.x1 + 0.7 && nz > a.pen.z0 + 0.3 && nz < a.pen.z1 + 0.7);
        const ok = inPen && ground >= 0 && !BLOCKS[above].water && !BLOCKS[above].solid && ground - feet <= 1 && feet - ground <= 3;
        if (ok) { p.x = nx; p.z = nz; if ((ground > feet || (a.sp.hop && Math.random() < dt * 4)) && a.vy === 0) a.vy = a.sp.hop ? 4.5 : 6; } else { a.heading += Math.PI * (0.5 + Math.random()); a.timer = 1.5; }
      }
      // Gravedad simple hacia el suelo de la columna.
      const floor = this.groundAt(p.x, p.z) + 1;
      a.vy -= 22 * dt;
      p.y += a.vy * dt;
      if (p.y <= floor) { p.y = floor; a.vy = 0; }
      this.animate(a, dt, light);
      if (!a.tamed && p.distanceTo(player.pos) > (a.pen ? 140 : 90)) this.remove(a);
    }
  }

  // Lobos salvajes: persiguen y muerden al jugador (huyen si quedan muy heridos).
  // Perros (lobos domesticados): siguen al jugador y atacan a lo que lo amenace.
  // Devuelve true si este cuadro ya se movió (no hace la caminata normal).
  hunt(a, dt, ctx) {
    const p = a.mesh.position; const P = ctx.player.pos;
    let target = null; let goal = null; let speed = a.sp.flee;
    if (a.tamed) {
      // Enemigo cerca del jugador: a atacarlo. Si no, seguir al dueño.
      let best = 10;
      for (const z of ctx.enemies ?? []) { if (z.dead) continue; const d = Math.hypot(z.pos.x - P.x, z.pos.z - P.z); if (d < best) { best = d; target = z; } }
      for (const w of this.list) if (w !== a && w.species === 'wolf' && !w.tamed && (w.aggro || ctx.daylight < 0.35)) { const d = Math.hypot(w.mesh.position.x - P.x, w.mesh.position.z - P.z); if (d < best) { best = d; target = { pos: w.mesh.position, animal: w }; } }
      const dP = Math.hypot(P.x - p.x, P.z - p.z);
      if (dP > 28) { p.set(P.x + 1, P.y, P.z + 1); return true; }   // se perdió: aparece al lado
      if (!target) { if (dP < 3) return false; goal = { x: P.x, z: P.z }; speed = dP > 8 ? 4.5 : 2.4; }
    } else {
      if (a.hp <= 3) return false;   // herido: vuelve a lo normal (y huye si lo golpean)
      const dP = Math.hypot(P.x - p.x, P.z - p.z);
      if (dP > 18 || ctx.mode !== 'survival') { a.aggro = a.aggro && dP < 30; return false; }
      target = { pos: P, player: true };
    }
    if (target) {
      goal = { x: target.pos.x, z: target.pos.z };
      const d = Math.hypot(goal.x - p.x, goal.z - p.z);
      if (d < 1.3) {
        goal = null;
        if (a.cooldown <= 0) {
          a.cooldown = 1.1; a.vy = 3;
          const dir = new THREE.Vector3(target.pos.x - p.x, 0, target.pos.z - p.z).normalize();
          if (target.player) ctx.onBite?.(2, dir);
          else if (target.animal) { target.animal.hp -= 3; target.animal.flash = 0.2; if (target.animal.hp <= 0) this.remove(target.animal); }
          else ctx.hitEnemy?.(target, 3, dir);
          this.sound.noise(0.1, { freq: 700, q: 2, gain: 0.25 });
        }
      }
      a.heading = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
    }
    a.walk = goal ? 1 : 0; a.flee = goal && speed > 3 ? 1 : 0;
    if (goal) {
      a.heading = Math.atan2(goal.x - p.x, goal.z - p.z);
      const nx = p.x + Math.sin(a.heading) * speed * dt; const nz = p.z + Math.cos(a.heading) * speed * dt;
      const ground = this.groundAt(nx, nz); const feet = Math.floor(p.y) - 1;
      if (ground >= 0 && ground - feet <= 1 && feet - ground <= 4 && !BLOCKS[this.world.getBlock(Math.floor(nx), ground + 1, Math.floor(nz))].water) { p.x = nx; p.z = nz; if (ground > feet && a.vy === 0) a.vy = 6; }
    }
    const floor = this.groundAt(p.x, p.z) + 1;
    a.vy -= 22 * dt; p.y += a.vy * dt; if (p.y <= floor) { p.y = floor; a.vy = 0; }
    return true;
  }

  // Domesticar: se le da carne a un lobo salvaje (a veces hace falta más de una).
  feed(a) {
    if (a.species !== 'wolf' || a.tamed) return null;
    if (Math.random() < 0.45) { a.tamed = true; a.aggro = false; a.mesh.userData.collar.visible = true; return 'tamed'; }
    return 'eat';
  }

  // Animación e iluminación de un animal (también del caballo que monta el jugador).
  animate(a, dt, light) {
    {
      const p = a.mesh.position;
      // Animación: patas que se mueven al caminar, cabeza que pasta cuando está quieto.
      const swing = a.walk ? Math.sin(this.t * (a.flee ? 16 : 9) + a.phase) * 0.5 : 0;
      a.mesh.userData.legs.forEach((l, i) => { l.rotation.x = i % 2 ? swing : -swing; });
      const ud0 = a.mesh.userData;
      // Cabeza: alta al caminar; baja a pastar (con mordiditas) cuando está quieto.
      const graze = !a.walk && Math.sin(this.t * 0.7 + a.phase) > 0;
      const hy = ud0.headY ?? 0.92; const gy = ud0.grazeY ?? 0.6; const by = ud0.bodyY ?? (a.species === 'deer' ? 1.05 : 0.78);
      ud0.head.position.y += ((a.walk ? hy : graze ? gy : hy - 0.04) - ud0.head.position.y) * Math.min(1, dt * 5);
      ud0.head.rotation.x = graze && a.species !== 'crab' ? 0.5 + Math.sin(this.t * 9 + a.phase) * 0.08 : 0;
      ud0.body.position.y = by + (a.walk ? Math.abs(Math.sin(this.t * (a.flee ? 16 : 9) + a.phase)) * 0.05 : Math.sin(this.t * 1.6 + a.phase) * 0.012);   // respira
      ud0.tail.rotation.y = Math.sin(this.t * (a.flee ? 18 : 5) + a.phase) * 0.5;
      ud0.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.35 + Math.sin(this.t * 2.2 + a.phase + i) * 0.15); });
      for (const e of ud0.eyes) e.scale.y = Math.sin(this.t * 0.8 + a.phase * 3) > 0.96 ? 0.15 : 1;   // parpadeo
      const face = a.heading + (a.sp.sideways ? Math.PI / 2 : 0);   // el cangrejo camina de costado
      a.mesh.rotation.y += (((face - a.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
      // Iluminación: siguen la luz del día; destello blanco al recibir un golpe.
      a.flash = Math.max(0, a.flash - dt);
      const ud = a.mesh.userData;
      ud.mats.forEach((m, i) => { if (a.flash > 0) m.color.setRGB(1, 0.55, 0.55); else m.color.copy(ud.base[i]).multiplyScalar(i === 2 ? 1 : light); });
      void p;
    }
  }

  // Animal que mira el jugador (para montar el caballo).
  pick(origin, dir, range = 4) {
    let best = null; let bestT = range;
    for (const a of this.list) {
      const c = a.mesh.position.clone(); c.y += a.species === 'horse' ? 1.3 : 0.6;
      const t = c.clone().sub(origin).dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < (a.species === 'horse' ? 1.1 : 0.7)) { best = a; bestT = t; }
    }
    return best;
  }

  // Golpe del jugador. Devuelve true si le pegó a un Lanudo.
  hit(origin, dir, range, damage, ctx) {
    let best = null; let bestT = range;
    for (const a of this.list) {
      if (a.ridden) continue;
      const c = a.mesh.position.clone(); c.y += a.species === 'horse' ? 1.3 : 0.75;
      const to = new THREE.Vector3().subVectors(c, origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      if (origin.clone().addScaledVector(dir, t).distanceTo(c) < 0.75) { best = a; bestT = t; }
    }
    if (!best) return false;
    if (best.tamed) return false;   // a tu perro no le pegás
    best.hp -= damage;
    best.flash = 0.2; best.flee = 5; best.vy = 5;
    if (best.species === 'wolf') { best.flee = 0; for (const w of this.list) if (w.species === 'wolf' && !w.tamed && w.mesh.position.distanceTo(best.mesh.position) < 14) w.aggro = true; }
    best.mesh.position.addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 0.6);
    this.sound.tone(420, 0.1, 0.12, 'triangle');
    if (best.hp <= 0) {
      this.sound.tone(300, 0.15, 0.1, 'sine');
      ctx.onKilled?.(best.mesh.position.clone(), best.species);
      this.remove(best);
    }
    return true;
  }

  clear() { for (const a of [...this.list]) this.remove(a); }
}
