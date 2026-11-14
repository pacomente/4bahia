import * as THREE from 'three';
import { createHumanoid } from './humanoid.js';
import { BLOCKS } from './blocks.js';
import { TEX_INDEX, ATLAS_COLS } from './textures.js';
import { I, ITEMS, isItem, itemCanvas } from './items.js';

// Tu personaje en el inventario: modelo 3D con la armadura puesta, el escudo y lo que tenés en la mano.
// La cabeza (y un poco el cuerpo) siguen al cursor del mouse.
export const PLAYER_LOOK = { skin: '#e0b48c', hair: '#4a3020', shirt: '#2f6f6a', pants: '#3a3a52', eyes: '#2a4a7a' };

export class PlayerPreview {
  constructor(canvas, atlasCanvas) {
    this.canvas = canvas;
    this.atlasCanvas = atlasCanvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camera.position.set(0, 1.05, 5.2);
    this.camera.lookAt(0, 0.95, 0);
    // Luz suave de ambiente y una luz de frente-arriba para que se lea el volumen.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a7a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 5); this.scene.add(sun);
    this.parts = createHumanoid({ ...PLAYER_LOOK });
    // Materiales con luz (en el juego son planos; acá queremos volumen).
    this.parts.root.traverse((o) => {
      if (!o.isMesh) return;
      const toLambert = (m) => new THREE.MeshLambertMaterial({ color: m.color, map: m.map ?? null, transparent: m.transparent });
      o.material = Array.isArray(o.material) ? o.material.map(toLambert) : toLambert(o.material);
    });
    this.parts.root.position.y = -0.05;
    this.scene.add(this.parts.root);
    this.extra = [];             // piezas de armadura, escudo y objeto en la mano
    this.target = { x: 0, y: 0 }; this.look = { x: 0, y: 0 };
    this.t = 0; this.running = false; this.last = 0;
    this.key = '';
  }

  // Arma las piezas según el equipo y el ítem en la mano (solo si cambiaron).
  setEquip(equip = {}, held = null) {
    const key = JSON.stringify([equip, held]);
    if (key === this.key) return;
    this.key = key;
    for (const { parent, mesh } of this.extra) { parent.remove(mesh); mesh.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); }
    this.extra = [];
    const p = this.parts;
    const add = (parent, mesh) => { parent.add(mesh); this.extra.push({ parent, mesh }); return mesh; };
    const mat = (color) => new THREE.MeshLambertMaterial({ color });
    const piece = (id, parent, w, h, d, x, y, z) => {
      const it = ITEMS[id]; const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(it.color)); g.add(body);
      // Borde de otro color (remaches, costuras) para que se note el material.
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, Math.min(0.06, h * 0.2), d + 0.01), mat(it.trim)); trim.position.y = -h / 2 + 0.03; g.add(trim);
      g.position.set(x, y, z);
      return add(parent, g);
    };
    if (equip.head) { const hg = piece(equip.head, p.head, 0.54, 0.3, 0.54, 0, 0.36, 0); hg.children[1].position.y = -0.13; }
    if (equip.chest) {
      piece(equip.chest, p.body, 0.6, 0.78, 0.38, 0, 1.11, 0);
      piece(equip.chest, p.armL, 0.26, 0.32, 0.28, 0, -0.14, 0); piece(equip.chest, p.armR, 0.26, 0.32, 0.28, 0, -0.14, 0);
    }
    if (equip.legs) { piece(equip.legs, p.legL, 0.28, 0.5, 0.3, 0, -0.25, 0); piece(equip.legs, p.legR, 0.28, 0.5, 0.3, 0, -0.25, 0); }
    if (equip.feet) { piece(equip.feet, p.legL, 0.3, 0.2, 0.34, 0, -0.66, 0.02); piece(equip.feet, p.legR, 0.3, 0.2, 0.34, 0, -0.66, 0.02); }
    // Escudo en el brazo izquierdo.
    if (equip.offhand === I.SHIELD) add(p.armL, this.flatItem(I.SHIELD, 0.62, -0.42, 0, 0.16, Math.PI / 2));
    // Lo que tenés en la mano derecha.
    if (held) {
      if (isItem(held)) add(p.armR, this.flatItem(held, 0.55, -0.68, 0.18, 0.12, Math.PI / 2, -0.6));
      else { const cube = this.blockCube(held); cube.position.set(0, -0.72, 0.12); add(p.armR, cube); }
    }
  }

  // Ícono pixel-art como plancha fina (escudo, herramientas, comida).
  flatItem(id, size, y, z, x, rotY, rotZ = 0) {
    const tex = new THREE.CanvasTexture(itemCanvas(id, 32));
    tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.04), [mat0(), mat0(), mat0(), mat0(), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4 }), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4 })]);
    m.position.set(x, y, z); m.rotation.set(0, rotY, rotZ);
    return m;
  }

  blockCube(id) {
    const b = BLOCKS[id];
    const tex = new THREE.CanvasTexture(this.atlasCanvas); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const cols = ATLAS_COLS; const rows = this.atlasCanvas.height / 16;
    const names = [b.tex[1], b.tex[1], b.tex[0], b.tex[2], b.tex[1], b.tex[1]];
    const idx = (n) => TEX_INDEX[n];
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const i = idx(names[f]) ?? 0;
      const u0 = (i % cols) / cols; const v1 = 1 - Math.floor(i / cols) / rows;
      for (let k = 0; k < 4; k++) { const j = f * 4 + k; uv.setXY(j, u0 + uv.getX(j) / cols, v1 - 1 / rows + uv.getY(j) / rows); }
    }
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  }

  // Posición del mouse en la pantalla → hacia dónde mira el personaje.
  lookAtScreen(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height * 0.22;   // a la altura de la cabeza
    this.target.x = Math.max(-1, Math.min(1, (clientX - cx) / 380));
    this.target.y = Math.max(-1, Math.min(1, (clientY - cy) / 300));
  }

  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  frame(dt) {
    this.t += dt;
    const w = this.canvas.clientWidth; const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.round(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    // Suaviza el seguimiento del cursor.
    this.look.x += (this.target.x - this.look.x) * Math.min(1, dt * 10);
    this.look.y += (this.target.y - this.look.y) * Math.min(1, dt * 10);
    const p = this.parts;
    p.head.rotation.y = this.look.x * 0.9;
    p.head.rotation.x = this.look.y * 0.55;
    p.body.rotation.y = this.look.x * 0.35;
    // Respira y balancea apenas los brazos.
    p.body.position.y = Math.sin(this.t * 1.8) * 0.012;
    p.armL.rotation.x = Math.sin(this.t * 1.3) * 0.05; p.armR.rotation.x = -Math.sin(this.t * 1.3) * 0.05 - 0.15;
    p.armL.rotation.z = 0.06; p.armR.rotation.z = -0.06;
    p.legL.rotation.x = 0; p.legR.rotation.x = 0;
    this.renderer.render(this.scene, this.camera);
  }
}

const mat0 = () => new THREE.MeshLambertMaterial({ color: '#7a5230' });
