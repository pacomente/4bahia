import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { B, BLOCKS } from './blocks.js';

// ───────── Efectos visuales ─────────
// Calidad alta: brillo suave (bloom) en lo que brilla, corrección de color con viñeta, nubes 3D,
// luciérnagas de noche y hojas que caen de los árboles.

// Corrección de color: un poco más de saturación y contraste, y bordes apenas más oscuros.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.28 }, saturation: { value: 1.1 }, contrast: { value: 1.05 }, warmth: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; uniform float contrast; uniform float warmth; varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c *= vec3(1.0 + warmth * 0.06, 1.0, 1.0 - warmth * 0.06);
      vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * vignette * 2.0;
      gl_FragColor = vec4(max(c, 0.0), t.a);
    }`,
};

export class Effects {
  constructor(renderer, scene, camera, world) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.world = world;
    this.quality = 2; this.t = 0;
    this.makeComposer();
    // Luciérnagas.
    const N = 70; const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.flies = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flies.frustumCulled = false; this.flies.visible = false; scene.add(this.flies);
    this.flyData = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, ph: Math.random() * 6.28, sp: 0.5 + Math.random(), set: false }));
    // Hojas que caen.
    this.leafGeo = new THREE.PlaneGeometry(0.16, 0.16);
    this.leafMats = [0x4f9a2c, 0x6fb043, 0x3f7a2c, 0x8ab84a].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    this.leaves = [];
    // Nubes 3D: bloques planos que viajan con el viento alrededor de la cámara.
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false, fog: false });
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cloudMat, 160);
    this.clouds.frustumCulled = false; this.clouds.renderOrder = -5; scene.add(this.clouds);
    this.cloudCells = [];
    let s = 9; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let k = 0; k < 160; k++) this.cloudCells.push({ x: (rnd() - 0.5) * 900, z: (rnd() - 0.5) * 900, w: 14 + rnd() * 34, d: 12 + rnd() * 26, h: 3 + rnd() * 3, y: 128 + rnd() * 10 });
    this.wind = 0;
  }

  makeComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.4, 0.93);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  resize(w, h) { this.composer.setSize(w, h); }

  setQuality(q) { this.quality = q; this.clouds.visible = q >= 2; if (q < 2) { this.flies.visible = false; for (const l of this.leaves) this.scene.remove(l.mesh); this.leaves = []; } }

  // ctx: { player, daylight, rain, biome, sunLow (0..1, cerca del horizonte), flatClouds (el plano viejo) }
  update(dt, ctx) {
    this.t += dt;
    if (this.quality < 2) return;
    const P = ctx.player.pos;
    // Nubes: se mueven con el viento y dan la vuelta alrededor de la cámara.
    this.wind += dt * 2.2;
    const m = new THREE.Matrix4(); const cam = this.camera.position;
    const k = Math.max(0, Math.min(1, (ctx.daylight - 0.16) / 0.84));
    const light = 0.025 + 0.875 * k * k;   // de noche, casi del color del cielo
    this.cloudMat.opacity = 0.3 + 0.58 * k;
    this.cloudMat.color.setRGB(light, light, Math.min(0.92, light * 1.06)).lerp(new THREE.Color(0.55, 0.57, 0.62).multiplyScalar(light), ctx.rain * 0.7);
    if (ctx.sunLow > 0.2 && ctx.daylight > 0.2) this.cloudMat.color.lerp(new THREE.Color(1, 0.72, 0.55), ctx.sunLow * 0.35);
    this.cloudCells.forEach((c, k) => {
      let x = ((c.x + this.wind - cam.x) % 900 + 1350) % 900 - 450; let z = ((c.z - cam.z) % 900 + 1350) % 900 - 450;
      m.makeScale(c.w, c.h, c.d).setPosition(cam.x + x, c.y, cam.z + z);
      this.clouds.setMatrixAt(k, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
    if (ctx.flatClouds) ctx.flatClouds.visible = false;
    // Luciérnagas: de noche, sin lluvia, en praderas, bosques, pantanos y selvas.
    const fliesOn = ctx.daylight < 0.35 && ctx.rain < 0.2 && ['plains', 'forest', 'swamp', 'jungle'].includes(ctx.biome);
    this.flies.visible = fliesOn;
    if (fliesOn) {
      const pos = this.flies.geometry.attributes.position; const col = this.flies.geometry.attributes.color;
      this.flyData.forEach((f, i) => {
        if (!f.set || Math.hypot(f.x - P.x, f.z - P.z) > 22) {
          const a = Math.random() * 6.28; const r = 3 + Math.random() * 18; f.x = P.x + Math.cos(a) * r; f.z = P.z + Math.sin(a) * r;
          f.y = this.world.topAt(Math.floor(f.x), Math.floor(f.z)) + 1.2 + Math.random() * 2.2; f.set = true;
        }
        f.x += Math.sin(this.t * f.sp + f.ph) * dt * 0.6; f.z += Math.cos(this.t * f.sp * 0.8 + f.ph) * dt * 0.6; f.y += Math.sin(this.t * 1.7 + f.ph) * dt * 0.25;
        pos.setXYZ(i, f.x, f.y, f.z);
        const b = Math.max(0, Math.sin(this.t * 2.2 * f.sp + f.ph)) ** 3;
        col.setXYZ(i, 0.85 * b, 1.0 * b, 0.35 * b);
      });
      pos.needsUpdate = true; col.needsUpdate = true;
    }
    // Hojas que caen de los árboles cercanos (de día y de noche, más con viento de tormenta).
    this.leafT = (this.leafT ?? 0) - dt * (1 + ctx.rain * 2);
    if (this.leafT <= 0 && this.leaves.length < 30) {
      this.leafT = 0.25;
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(P.x + (Math.random() - 0.5) * 28); const z = Math.floor(P.z + (Math.random() - 0.5) * 28);
        const y = Math.floor(P.y + Math.random() * 14);
        const id = this.world.getBlock(x, y, z);
        if (![B.LEAVES, B.BIRCH_LEAVES, B.FRUIT_LEAVES, B.JUNGLE_LEAVES].includes(id) || BLOCKS[this.world.getBlock(x, y - 1, z)].solid) continue;
        const mesh = new THREE.Mesh(this.leafGeo, this.leafMats[Math.floor(Math.random() * this.leafMats.length)]);
        mesh.position.set(x + Math.random(), y - 0.1, z + Math.random()); this.scene.add(mesh);
        this.leaves.push({ mesh, life: 9, ph: Math.random() * 6.28 });
        break;
      }
    }
    for (const l of [...this.leaves]) {
      l.life -= dt; const p = l.mesh.position;
      p.y -= dt * 0.9; p.x += Math.sin(this.t * 1.5 + l.ph) * dt * 0.7 + ctx.rain * dt * 1.5; p.z += Math.cos(this.t * 1.1 + l.ph) * dt * 0.4;
      l.mesh.rotation.set(this.t * 1.3 + l.ph, this.t * 0.9, Math.sin(this.t * 2 + l.ph));
      const shade = Math.max(0.25, ctx.daylight); l.mesh.material.color.offsetHSL(0, 0, 0); l.mesh.scale.setScalar(1);
      if (l.life <= 0 || BLOCKS[this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.05), Math.floor(p.z))].solid) { this.scene.remove(l.mesh); this.leaves = this.leaves.filter((x) => x !== l); }
      void shade;
    }
  }

  render(ctx) {
    if (this.quality >= 2) {
      this.grade.uniforms.warmth.value = ctx.sunLow * (ctx.daylight > 0.2 ? 1 : 0);
      this.bloom.strength = ctx.underwater ? 0.2 : 0.35;
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
