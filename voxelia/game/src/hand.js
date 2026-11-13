import * as THREE from 'three';
import { BLOCKS } from './blocks.js';
import { uvRect } from './textures.js';
import { ITEMS, isItem, itemCanvas } from './items.js';

// Mano en primera persona: brazo + lo que tenés en la mano (bloque, antorcha o ítem en relieve).
// Se dibuja en una escena aparte, encima del mundo, así nunca atraviesa paredes.
// Anima: balanceo al caminar, golpe al romper/atacar/colocar, y cambio de ítem.
const SKIN = 0xd9a77c;
const SLEEVE = 0x2f6f6a;

export class Hand {
  constructor(atlasTex) {
    this.atlasTex = atlasTex;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.root = new THREE.Group();          // se mueve con el balanceo y los golpes
    this.scene.add(this.root);
    this.mats = [];
    // Brazo: manga y piel, en diagonal hacia el centro de la pantalla.
    this.arm = new THREE.Group();
    const sleeve = this.mat(new THREE.MeshBasicMaterial({ color: SLEEVE }));
    const skin = this.mat(new THREE.MeshBasicMaterial({ color: SKIN }));
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.42), sleeve); a1.position.z = 0.17;
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), skin); a2.position.z = -0.18;
    this.arm.add(a1, a2);
    this.arm.position.set(0.46, -0.47, -0.66);
    this.arm.rotation.set(-0.25, 0.32, 0.1);
    this.root.add(this.arm);
    this.holder = new THREE.Group();        // punto donde se agarra el ítem (la mano)
    this.holder.position.set(0, 0.05, -0.34);
    this.arm.add(this.holder);
    this.itemId = undefined;
    this.swingT = 1;                        // 0..1 animación de golpe en curso
    this.equipT = 1;                        // 0..1 animación de cambio de ítem
    this.bob = 0; this.bobAmount = 0;
    this.sway = new THREE.Vector2();
    this.glow = 0;
  }

  mat(m) { this.mats.push(m); return m; }

  setItem(id) {
    if (id === this.itemId) return;
    this.itemId = id;
    this.equipT = 0;
    for (const c of [...this.holder.children]) { this.holder.remove(c); c.traverse((o) => { o.geometry?.dispose(); }); }
    for (const m of this.mats.slice(2)) m.dispose();
    this.mats = this.mats.slice(0, 2);
    this.glow = 0;
    if (!id) { this.arm.children[1].visible = true; return; }
    const mesh = isItem(id) ? this.itemMesh(id) : this.blockMesh(id);
    this.holder.add(mesh);
  }

  // Bloque: cubo con sus texturas reales (o el modelo de antorcha).
  blockMesh(id) {
    const b = BLOCKS[id];
    const mat = this.mat(new THREE.MeshBasicMaterial({ map: this.atlasTex, transparent: b.transparent, alphaTest: 0.5 }));
    if (b.emissive) this.glow = 1;
    let geo;
    if (b.shape === 'torch') {
      geo = new THREE.BoxGeometry(0.07, 0.42, 0.07);
      const [u0, v0, u1, v1] = uvRect(b.tex[1]);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * (7 / 16 + uv.getX(i) * 2 / 16), v0 + (v1 - v0) * (uv.getY(i) * 13 / 16));
      const m = new THREE.Mesh(geo, mat); m.position.set(0, 0.16, -0.04); m.rotation.x = -0.35;
      return m;
    }
    geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const uv = geo.attributes.uv;
    // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z (4 vértices cada una).
    const faceTex = [b.tex[1], b.tex[1], b.tex[0], b.tex[2], b.tex[1], b.tex[1]];
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = uvRect(faceTex[f]);
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i)); }
    }
    // Sombreado fijo por cara para que se lea el volumen.
    const shade = [0.8, 0.8, 1, 0.5, 0.65, 0.65];
    const col = []; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) col.push(shade[f], shade[f], shade[f]);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    mat.vertexColors = true;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-0.02, 0.2, -0.1);
    m.rotation.set(0.1, 0.75, 0);
    return m;
  }

  // Ítem: el ícono pixel-art "extruido" (cada píxel un cubito), como un objeto plano con grosor.
  itemMesh(id) {
    const it = ITEMS[id];
    if (it?.glow) this.glow = 1;
    const c = itemCanvas(id, 16);
    const d = c.getContext('2d').getImageData(0, 0, 16, 16).data;
    const pos = []; const col = []; const idx = [];
    const px = 0.034; const depth = 0.035;
    const color = new THREE.Color();
    const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && d[(y * 16 + x) * 4 + 3] > 40;
    const quad = (pts, shade, rgb) => {
      const n = pos.length / 3;
      for (const p of pts) { pos.push(...p); col.push(rgb.r * shade, rgb.g * shade, rgb.b * shade); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!solid(x, y)) continue;
      const i = (y * 16 + x) * 4;
      color.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
      const x0 = (x - 8) * px; const x1 = x0 + px; const y1 = (8 - y) * px; const y0 = y1 - px; const z0 = -depth / 2; const z1 = depth / 2;
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 1, color);          // frente
      quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 0.7, color);        // atrás
      if (!solid(x, y - 1)) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 0.9, color);
      if (!solid(x, y + 1)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0.55, color);
      if (!solid(x - 1, y)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.7, color);
      if (!solid(x + 1, y)) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 0.75, color);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, this.mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    // Herramientas en diagonal, como agarradas del mango.
    m.position.set(-0.02, 0.2, -0.06);
    m.rotation.set(0.15, 1.35, 0.15);
    return m;
  }

  swing() { if (this.swingT > 0.55) this.swingT = 0; }

  // ctx: { dt, moveSpeed, onGround, sprinting, light (0..1), mouseDX, mouseDY, aspect, breaking }
  update(ctx) {
    const { dt } = ctx;
    this.camera.aspect = ctx.aspect; this.camera.updateProjectionMatrix();
    // Mientras se rompe un bloque, golpes continuos.
    if (ctx.breaking && this.swingT >= 1) this.swingT = 0;
    this.swingT = Math.min(1, this.swingT + dt / 0.28);
    this.equipT = Math.min(1, this.equipT + dt / 0.22);
    // Balanceo al caminar (más amplio al correr).
    const walking = ctx.onGround && ctx.moveSpeed > 0.5;
    this.bobAmount += ((walking ? (ctx.sprinting ? 1.4 : 1) : 0) - this.bobAmount) * Math.min(1, dt * 8);
    this.bob += dt * ctx.moveSpeed * 1.9;
    // Inercia: la mano se atrasa un poco cuando girás la cámara.
    this.sway.x += (-ctx.mouseDX * 0.0009 - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (ctx.mouseDY * 0.0009 - this.sway.y) * Math.min(1, dt * 10);
    const s = Math.sin(this.swingT * Math.PI);
    const s2 = Math.sin(Math.sqrt(this.swingT) * Math.PI);
    const equip = 1 - this.equipT;
    // El conjunto se mueve con el paso y la inercia; el golpe gira el brazo sobre sí mismo (hacia adelante y al centro).
    this.root.position.set(
      Math.sin(this.bob) * 0.035 * this.bobAmount + this.sway.x,
      -Math.abs(Math.cos(this.bob)) * 0.035 * this.bobAmount + this.sway.y - equip * equip * 0.5,
      0,
    );
    this.root.rotation.set(0, 0, Math.sin(this.bob) * 0.02 * this.bobAmount);
    this.arm.position.set(0.46 - s2 * 0.14, -0.47 + s * 0.05, -0.66 - s2 * 0.12);
    this.arm.rotation.set(-0.25 - s * 0.55, 0.32 + s2 * 0.3, 0.1 - s * 0.15);
    // Luz: la de donde estás parado (los ítems de cristal y bloques que brillan, siempre iluminados).
    const l = Math.max(ctx.light, this.glow ? 1 : 0);
    for (const m of this.mats) m.color.setScalar(1).multiplyScalar(0.25 + 0.75 * l);
    // Los primeros dos materiales (manga y piel) tienen color propio.
    this.mats[0].color.set(SLEEVE).multiplyScalar(0.25 + 0.75 * ctx.light);
    this.mats[1].color.set(SKIN).multiplyScalar(0.25 + 0.75 * ctx.light);
  }

  render(renderer) {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}
