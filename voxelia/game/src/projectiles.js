import * as THREE from 'three';
import { BLOCKS } from './blocks.js';

// Flechas: vuelan con gravedad, giran según la trayectoria y se clavan en los bloques.
// Las clavadas se pueden juntar caminando encima.
export class Arrows {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.list = [];
    const wood = new THREE.MeshBasicMaterial({ color: '#8a5a33' }); const tip = new THREE.MeshBasicMaterial({ color: '#cfd4da' }); const feather = new THREE.MeshBasicMaterial({ color: '#f2efe6' });
    this.mats = [wood, tip, feather];
    this.geo = { shaft: new THREE.BoxGeometry(0.04, 0.04, 0.7), tip: new THREE.BoxGeometry(0.08, 0.08, 0.12), feather: new THREE.BoxGeometry(0.14, 0.01, 0.16) };
  }

  mesh() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(this.geo.shaft, this.mats[0]);
    const t = new THREE.Mesh(this.geo.tip, this.mats[1]); t.position.z = 0.38;
    const f1 = new THREE.Mesh(this.geo.feather, this.mats[2]); f1.position.z = -0.3;
    const f2 = f1.clone(); f2.rotation.z = Math.PI / 2;
    g.add(s, t, f1, f2);
    return g;
  }

  shoot(origin, dir, speed = 30) {
    const m = this.mesh();
    m.position.copy(origin).addScaledVector(dir, 0.6);
    this.scene.add(m);
    this.list.push({ mesh: m, vel: dir.clone().multiplyScalar(speed), stuck: false, life: 30 });
    this.sound.noise(0.18, { freq: 1600, q: 0.8, gain: 0.25, type: 'highpass' });
  }

  // hitTest(p0, p1) → función de impacto o null. pickup(pos) → true si el jugador la junta.
  update(dt, { hitTest, pickup, light }) {
    for (const a of [...this.list]) {
      a.life -= dt;
      if (a.life <= 0) { this.remove(a); continue; }
      for (const m of this.mats) m.color.setScalar(1).multiplyScalar(light);
      if (a.stuck) { if (pickup(a.mesh.position)) this.remove(a); continue; }
      a.vel.y -= 16 * dt;
      const p0 = a.mesh.position.clone();
      const p1 = p0.clone().addScaledVector(a.vel, dt);
      const hit = hitTest(p0, p1, a.vel);
      if (hit) { hit(); this.remove(a); continue; }
      // Choque con bloques: avanza en pasos cortos para no atravesar paredes finas.
      const steps = Math.ceil(p0.distanceTo(p1) / 0.25);
      let blocked = false;
      for (let k = 1; k <= steps && !blocked; k++) {
        const q = p0.clone().lerp(p1, k / steps);
        if (BLOCKS[this.world.getBlock(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z))].solid) { blocked = true; a.mesh.position.copy(p0.clone().lerp(p1, (k - 1) / steps)); }
      }
      if (blocked) { a.stuck = true; a.life = 25; this.sound.noise(0.1, { freq: 500, q: 2, gain: 0.25 }); continue; }
      a.mesh.position.copy(p1);
      a.mesh.lookAt(p1.clone().add(a.vel));
    }
  }

  remove(a) { this.scene.remove(a.mesh); this.list = this.list.filter((x) => x !== a); }
}

// Distancia mínima entre el segmento p0→p1 y un punto c.
export function segmentDistance(p0, p1, c) {
  const d = p1.clone().sub(p0); const len2 = d.lengthSq();
  const t = len2 ? Math.max(0, Math.min(1, c.clone().sub(p0).dot(d) / len2)) : 0;
  return p0.clone().addScaledVector(d, t).distanceTo(c);
}
