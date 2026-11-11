import * as THREE from 'three';
import { mulberry32 } from './world.js';

const DAY_LENGTH = 600; // segundos por día completo
const C = (h) => new THREE.Color(h);
const DAY = C('#8ec9ff'); const NIGHT = C('#070b1c'); const DUSK = C('#f2925c'); const WATER_FOG = C('#1d4f99');

// Cielo: color según la hora, sol, luna, estrellas y nubes que siguen al jugador.
export class Sky {
  constructor(scene, time = 0.3) {
    this.scene = scene;
    this.time = time; // 0 amanecer · 0.25 mediodía · 0.5 atardecer · 0.75 medianoche
    this.group = new THREE.Group();
    scene.add(this.group);
    const sq = (color, size) => new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, transparent: true }));
    this.sun = sq(0xfff3b0, 26);
    this.moon = sq(0xe6ecff, 18);
    this.group.add(this.sun, this.moon);
    // Estrellas
    const rnd = mulberry32(42);
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const u = rnd() * 2 - 1; const t = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
      if (u < -0.1) continue;
      pts.push(r * Math.cos(t) * 400, u * 400, r * Math.sin(t) * 400);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.group.add(this.stars);
    // Nubes: textura generada, plano grande a altura fija.
    // Nubes: manchas rectangulares dispersas en una textura que se repite.
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const r2 = mulberry32(7);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 14; k++) {
      const cx = Math.floor(r2() * 64); const cy = Math.floor(r2() * 64);
      const w = 4 + Math.floor(r2() * 9); const h = 3 + Math.floor(r2() * 6);
      for (let i = 0; i < 4; i++) ctx.fillRect((cx + Math.floor(r2() * w) - 2) % 64, (cy + Math.floor(r2() * h) - 1) % 64, 3 + Math.floor(r2() * w), 2 + Math.floor(r2() * h));
    }
    const ct = new THREE.CanvasTexture(cv);
    ct.magFilter = THREE.NearestFilter; ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(5, 5);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.clouds.rotation.x = -Math.PI / 2;
    scene.add(this.clouds);
    this.color = new THREE.Color();
    // Lluvia: gotas que caen alrededor de la cámara. Alterna períodos secos y lluviosos.
    const drops = 1400;
    const pos = new Float32Array(drops * 3);
    for (let i = 0; i < drops; i++) { pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainPoints = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xa9c4ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false }));
    this.rainPoints.frustumCulled = false;
    scene.add(this.rainPoints);
    this.rain = 0;            // intensidad actual 0..1
    this.raining = false;
    this.weatherTimer = 150 + Math.random() * 150;
  }

  updateWeather(dt, camera) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.raining = !this.raining;
      this.weatherTimer = this.raining ? 70 + Math.random() * 90 : 180 + Math.random() * 200;
    }
    this.rain += ((this.raining ? 1 : 0) - this.rain) * Math.min(1, dt * 0.25);
    const pts = this.rainPoints;
    pts.visible = this.rain > 0.02;
    if (!pts.visible) return;
    pts.material.opacity = 0.7 * this.rain;
    pts.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
    const a = pts.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 22;
      if (y < 0) y += 30;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  }

  get daylight() {
    const s = Math.sin(this.time * Math.PI * 2);
    return Math.max(0.16, Math.min(1, s * 1.6 + 0.35) * (1 - 0.3 * (this.rain ?? 0)));
  }

  get clock() {
    const hours = (this.time * 24 + 6) % 24;
    return `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`;
  }

  update(dt, camera, underwater) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    this.updateWeather(dt, camera);
    const s = Math.sin(this.time * Math.PI * 2);
    const dl = this.daylight;
    const dusk = Math.max(0, 1 - Math.abs(s) * 4) * (this.time < 0.1 || (this.time > 0.4 && this.time < 0.6) || this.time > 0.9 ? 1 : 0);
    this.color.copy(NIGHT).lerp(DAY, (dl - 0.16) / 0.84).lerp(DUSK, dusk * 0.55);
    if (this.rain > 0.02) this.color.lerp(new THREE.Color(0x6f7782).multiplyScalar(Math.max(0.2, dl)), this.rain * 0.7);
    if (underwater) this.color.copy(WATER_FOG).multiplyScalar(Math.max(0.3, dl));
    this.group.position.copy(camera.position);
    const ang = this.time * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 300, Math.sin(ang) * 300, 0);
    this.moon.position.set(-Math.cos(ang) * 300, -Math.sin(ang) * 300, 0);
    this.sun.lookAt(camera.position); this.moon.lookAt(camera.position);
    this.stars.material.opacity = Math.max(0, 1 - dl * 2.2);
    this.clouds.position.set(camera.position.x, 128, camera.position.z);
    this.clouds.material.map.offset.set((camera.position.x / 1600) * 5 + this.time * 3, -(camera.position.z / 1600) * 5);
    this.clouds.material.color.setScalar(Math.max(0.08, (dl - 0.16) / 0.84));
    this.clouds.material.opacity = 0.35 + 0.4 * Math.min(1, dl * 1.5);
    return this.color;
  }
}
