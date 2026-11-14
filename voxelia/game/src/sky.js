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
    // Clima: despejado, lluvia o tormenta (con rayos). En la nieve cae nieve; en el desierto no llueve.
    this.weather = 'clear'; this.storm = 0; this.snow = 0; this.flash = 0; this.boltT = 8; this.day = 0;
    const flakes = 900; const fp = new Float32Array(flakes * 3);
    for (let i = 0; i < flakes; i++) { fp[i * 3] = (Math.random() - 0.5) * 50; fp[i * 3 + 1] = Math.random() * 30; fp[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.snowPoints = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0, depthWrite: false }));
    this.snowPoints.frustumCulled = false; scene.add(this.snowPoints);
    // Luna con fases (8 dibujos, cambia cada día).
    this.moonTex = []; for (let k = 0; k < 8; k++) this.moonTex.push(moonPhase(k));
    this.moon.material.map = this.moonTex[0]; this.moon.material.color.set(0xffffff); this.moon.material.needsUpdate = true;
    // Estrellas fugaces.
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.shooting = new THREE.Line(sgeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.shooting.frustumCulled = false; this.group.add(this.shooting); this.shootT = 20; this.shot = null;
    // Auroras (en la nieve, de noche): cintas de colores que ondulan.
    this.aurora = new THREE.Group();
    const at = auroraTexture();
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.PlaneGeometry(420, 70, 40, 1);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: at, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      m.position.set((k - 1) * 60, 150 + k * 18, -160 - k * 50); m.rotation.x = 0.35; m.userData.base = Float32Array.from(geo.attributes.position.array);
      this.aurora.add(m);
    }
    this.group.add(this.aurora); this.auroraK = 0;
  }

  // Clima: lo pide el juego con el bioma donde está el jugador. Devuelve eventos (rayo).
  setEnv(env) { this.env = env; }

  updateWeather(dt, camera) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === 'clear') { this.weather = Math.random() < 0.3 ? 'storm' : 'rain'; this.weatherTimer = 70 + Math.random() * 90; }
      else { this.weather = 'clear'; this.weatherTimer = 180 + Math.random() * 200; }
    }
    this.raining = this.weather !== 'clear';
    const biome = this.env?.biome; const cold = biome === 'snow' || (this.env?.altitude ?? 0) > 70; const dry = biome === 'desert';
    const wet = this.raining && !dry ? 1 : 0;
    this.rain += ((wet && !cold ? 1 : 0) - this.rain) * Math.min(1, dt * 0.25);
    this.snow += ((wet && cold ? 1 : 0) - this.snow) * Math.min(1, dt * 0.25);
    this.storm += ((this.weather === 'storm' && wet ? 1 : 0) - this.storm) * Math.min(1, dt * 0.2);
    const pts = this.rainPoints;
    pts.visible = this.rain > 0.02;
    if (pts.visible) {
      pts.material.opacity = 0.7 * this.rain;
      pts.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
      const a = pts.geometry.attributes.position; const fall = dt * (22 + this.storm * 10); const wind = dt * this.storm * 6;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - fall; if (y < 0) y += 30;
        let x = a.getX(i) + wind; if (x > 25) x -= 50;
        a.setY(i, y); a.setX(i, x);
      }
      a.needsUpdate = true;
    }
    const sp = this.snowPoints;
    sp.visible = this.snow > 0.02;
    if (sp.visible) {
      sp.material.opacity = 0.9 * this.snow;
      sp.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
      const a = sp.geometry.attributes.position; this.snowT = (this.snowT ?? 0) + dt;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * 2.4; if (y < 0) y += 30;
        a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(this.snowT * 1.3 + i) * dt * 0.6);
      }
      a.needsUpdate = true;
    }
    // Rayos en la tormenta: destello y trueno (el juego lo hace sonar con un poco de demora).
    this.flash = Math.max(0, this.flash - dt * 3);
    this.thunder = null;
    if (this.storm > 0.6) {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.boltT = 5 + Math.random() * 12; this.flash = 1; this.thunder = { delay: 0.3 + Math.random() * 2.5 }; }
    }
  }

  get daylight() {
    const s = Math.sin(this.time * Math.PI * 2);
    return Math.max(0.16, Math.min(1, s * 1.6 + 0.35) * (1 - 0.3 * (this.rain ?? 0) - 0.2 * (this.storm ?? 0)));
  }

  get clock() {
    const hours = (this.time * 24 + 6) % 24;
    return `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`;
  }

  update(dt, camera, underwater) {
    const before = this.time;
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    if (this.time < before) { this.day++; this.moon.material.map = this.moonTex[this.day % 8]; this.moon.material.needsUpdate = true; }
    this.updateWeather(dt, camera);
    const s = Math.sin(this.time * Math.PI * 2);
    const dl = this.daylight;
    const dusk = Math.max(0, 1 - Math.abs(s) * 4) * (this.time < 0.1 || (this.time > 0.4 && this.time < 0.6) || this.time > 0.9 ? 1 : 0);
    this.color.copy(NIGHT).lerp(DAY, (dl - 0.16) / 0.84).lerp(DUSK, dusk * 0.55);
    if (this.rain > 0.02) this.color.lerp(new THREE.Color(0x6f7782).multiplyScalar(Math.max(0.2, dl)), this.rain * 0.7);
    if (this.snow > 0.02) this.color.lerp(new THREE.Color(0xc8d0dc).multiplyScalar(Math.max(0.2, dl)), this.snow * 0.6);
    if (this.storm > 0.02) this.color.lerp(new THREE.Color(0x3a3f4a).multiplyScalar(Math.max(0.25, dl)), this.storm * 0.6);
    if (this.flash > 0) this.color.lerp(new THREE.Color(0xe8eeff), this.flash * 0.85);
    if (underwater) this.color.copy(WATER_FOG).multiplyScalar(Math.max(0.3, dl));
    this.group.position.copy(camera.position);
    const ang = this.time * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 300, Math.sin(ang) * 300, 0);
    this.moon.position.set(-Math.cos(ang) * 300, -Math.sin(ang) * 300, 0);
    this.sun.lookAt(camera.position); this.moon.lookAt(camera.position);
    this.stars.material.opacity = Math.max(0, 1 - dl * 2.2) * (1 - Math.max(this.rain, this.snow) * 0.9);
    // Estrella fugaz de vez en cuando (noches despejadas).
    const clearNight = dl < 0.3 && this.rain < 0.1 && this.snow < 0.1;
    this.shootT -= dt;
    if (this.shootT <= 0 && clearNight && !this.shot) { this.shootT = 8 + Math.random() * 25; const a = Math.random() * 6.28; this.shot = { x: Math.cos(a) * 250, y: 160 + Math.random() * 120, z: Math.sin(a) * 250, vx: -Math.cos(a + 0.6) * 260, vy: -60, vz: -Math.sin(a + 0.6) * 260, life: 0.9 }; }
    if (this.shot) {
      const sh = this.shot; sh.life -= dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.z += sh.vz * dt;
      const p = this.shooting.geometry.attributes.position;
      p.setXYZ(0, sh.x, sh.y, sh.z); p.setXYZ(1, sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12, sh.z - sh.vz * 0.12); p.needsUpdate = true;
      this.shooting.material.opacity = Math.max(0, Math.min(1, sh.life * 2));
      if (sh.life <= 0) { this.shot = null; this.shooting.material.opacity = 0; }
    }
    // Auroras: en la nieve, de noche y sin nubes de tormenta.
    const wantAurora = this.env?.biome === 'snow' && dl < 0.3 && this.snow < 0.5 ? 1 : 0;
    this.auroraK += (wantAurora - this.auroraK) * Math.min(1, dt * 0.3);
    this.aurora.visible = this.auroraK > 0.02;
    if (this.aurora.visible) {
      this.auroraT = (this.auroraT ?? 0) + dt;
      this.aurora.children.forEach((m, k) => {
        m.material.opacity = this.auroraK * (0.55 - k * 0.12);
        const pos = m.geometry.attributes.position; const b = m.userData.base;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, b[i * 3 + 2] + Math.sin(b[i * 3] * 0.02 + this.auroraT * (0.5 + k * 0.2)) * 18);
        pos.needsUpdate = true;
      });
    }
    this.clouds.position.set(camera.position.x, 128, camera.position.z);
    this.clouds.material.map.offset.set((camera.position.x / 1600) * 5 + this.time * 3, -(camera.position.z / 1600) * 5);
    this.clouds.material.color.setScalar(Math.max(0.08, (dl - 0.16) / 0.84));
    this.clouds.material.opacity = 0.35 + 0.4 * Math.min(1, dl * 1.5);
    return this.color;
  }
}

// Luna: disco claro con la parte en sombra según la fase (0 = llena … 4 = nueva).
function moonPhase(k) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const f = k / 8;   // 0..1
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x - 15.5) / 14; const dy = (y - 15.5) / 14;
    if (dx * dx + dy * dy > 1) continue;
    const w = Math.sqrt(1 - dy * dy);
    // Terminador: una elipse que barre el disco.
    const t = Math.cos(f * Math.PI * 2) * w;
    const lit = f <= 0.5 ? dx >= -t || (f === 0) : dx <= t;
    const crater = ((x * 7 + y * 13) % 11 === 0) ? 0.8 : 1;
    const v = lit ? Math.floor(230 * crater) : 40;
    g.fillStyle = `rgba(${v},${v},${Math.min(255, v + 15)},${lit ? 1 : 0.25})`; g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter;
  return tex;
}

// Textura de aurora: franjas verdes y violetas que se desvanecen hacia arriba y abajo.
function auroraTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(160,80,255,0)'); grad.addColorStop(0.35, 'rgba(140,90,255,0.5)'); grad.addColorStop(0.7, 'rgba(60,255,150,0.9)'); grad.addColorStop(1, 'rgba(60,255,150,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 3) { g.fillStyle = `rgba(255,255,255,${0.05 + (x % 7) * 0.02})`; g.fillRect(x, 0, 1, 64); }
  return new THREE.CanvasTexture(c);
}
