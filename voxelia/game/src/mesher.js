import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { CS, H } from './world.js';
import { uvRect } from './textures.js';
import { computeChunkLight, MAX_LIGHT } from './light.js';

// Caras: dirección, esquinas (orden para dos triángulos 0-1-2 / 2-1-3), UV y brillo por orientación.
const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], tex: 1, light: 0.8 },
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], tex: 1, light: 0.8 },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], uv: [[1, 0], [0, 0], [1, 1], [0, 1]], tex: 2, light: 0.5 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], uv: [[1, 1], [0, 1], [1, 0], [0, 0]], tex: 0, light: 1.0 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], tex: 1, light: 0.65 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], tex: 1, light: 0.65 },
];
const AO = [0.5, 0.68, 0.84, 1];

const isLeaves = (id) => id === B.LEAVES || id === B.BIRCH_LEAVES;

function faceVisible(id, n) {
  if (n === B.AIR) return true;
  const nb = BLOCKS[n];
  if (!nb.transparent) return false;
  if (n === id) return isLeaves(id);   // vidrio/agua contra sí mismos no; hojas sí (se ven más frondosas)
  if (id === B.WATER) return !BLOCKS[n].solid || nb.alpha;
  return true;
}

class Builder {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.emi = []; this.sky = []; this.idx = []; }
  quad(p, uv, c, emissive, flip, sky = 1) {
    const n = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(c[i], c[i], c[i]);
      this.emi.push(Array.isArray(emissive) ? emissive[i] : emissive);
      this.sky.push(sky);
    }
    if (flip) this.idx.push(n, n + 1, n + 3, n, n + 3, n + 2);
    else this.idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
  }
  geometry() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('emissive', new THREE.Float32BufferAttribute(this.emi, 1));
    g.setAttribute('sky', new THREE.Float32BufferAttribute(this.sky, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Antorcha: un palito de 2/16 de ancho y 13/16 de alto (con la llama arriba), centrado en la celda.
const T0 = 7 / 16; const T1 = 9 / 16; const TH = 13 / 16;
function torchQuads(out, x, y, z, b) {
  const [u0, v0, u1, v1] = uvRect(b.tex[1]);
  const du = u1 - u0; const dv = v1 - v0;
  const U = (f) => u0 + du * f; const V = (f) => v0 + dv * f;   // f en fracción de textura (v desde abajo)
  const box = [T0, 0, T0, T1, TH, T1];
  for (const f of FACES) {
    const pos = f.corners.map((c) => [x + (c[0] ? box[3] : box[0]), y + (c[1] ? box[4] : box[1]), z + (c[2] ? box[5] : box[2])]);
    let uv;
    if (f.dir[1] === 1) uv = f.uv.map(([a, c]) => [U(a ? T1 : T0), V(c ? 13 / 16 : 12 / 16)]);       // punta de la llama
    else if (f.dir[1] === -1) uv = f.uv.map(([a, c]) => [U(a ? T1 : T0), V(c ? 1 / 16 : 0)]);
    else uv = f.uv.map(([a, c]) => [U(a ? T1 : T0), V(c ? TH : 0)]);
    out.quad(pos, uv, [1, 1, 1, 1], 1, false);
  }
}

// Construye la geometría de un chunk: una malla opaca (incluye hojas y vidrio con alpha-test) y otra de agua.
export function meshChunk(world, chunk) {
  const opaque = new Builder();
  const water = new Builder();
  const x0 = chunk.cx * CS; const z0 = chunk.cz * CS;
  const get = (x, y, z) => {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return B.AIR;
    const lx = x - x0; const lz = z - z0;
    if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) return chunk.data[lx + lz * CS + y * CS * CS];
    return world.getBlock(x, y, z);
  };
  const top = (x, z) => {
    const lx = x - x0; const lz = z - z0;
    if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) return chunk.top[lx + lz * CS];
    return world.topAt(x, z);
  };
  const occ = (x, y, z) => { const id = get(x, y, z); return id !== B.AIR && !BLOCKS[id].transparent ? 1 : 0; };
  // Luz de bloques: 0..1 por posición (null si no hay fuentes cerca → todo a oscuras).
  const lightFn = computeChunkLight(world, chunk);
  const lightAt = lightFn ? (x, y, z) => lightFn(x, y, z) / MAX_LIGHT : () => 0;

  let maxY = 0;
  for (let i = chunk.data.length - 1; i >= 0; i--) if (chunk.data[i]) { maxY = Math.floor(i / (CS * CS)); break; }

  for (let y = 0; y <= Math.min(H - 1, maxY + 1); y++) {
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const id = chunk.data[lx + lz * CS + y * CS * CS];
        if (!id) continue;
        const b = BLOCKS[id];
        const x = x0 + lx; const z = z0 + lz;
        if (b.shape === 'torch') { torchQuads(opaque, x, y, z, b); continue; }
        const isWater = id === B.WATER;
        const out = isWater ? water : opaque;
        for (const f of FACES) {
          const [dx, dy, dz] = f.dir;
          const n = get(x + dx, y + dy, z + dz);
          if (!faceVisible(id, n)) continue;
          if (isWater && n === B.WATER) continue;
          const [u0, v0, u1, v1] = uvRect(b.tex[f.tex]);
          // Luz del cielo: al aire libre 1; bajo un techo 0.6; en lo profundo (cuevas) casi nada.
          const depth = top(x + dx, z + dz) - (y + dy);
          const sky = depth <= 0 ? 1 : depth <= 6 ? 0.6 : Math.max(0.12, 0.6 - (depth - 6) * 0.06);
          const pos = []; const uv = []; const col = []; const ao = []; const lit = [];
          for (let i = 0; i < 4; i++) {
            const c = f.corners[i];
            let py = y + c[1];
            if (isWater && c[1] === 1 && get(x, y + 1, z) !== B.WATER) py -= 0.12;
            pos.push([x + c[0], py, z + c[2]]);
            uv.push([f.uv[i][0] ? u1 : u0, f.uv[i][1] ? v1 : v0]);
            // Oclusión ambiental: bloques que tocan la esquina en el plano de la cara.
            let a = 3;
            if (!b.transparent || isLeaves(id)) {
              const sx = [0, 0, 0]; const sy = [0, 0, 0];
              const axes = [0, 1, 2].filter((k) => f.dir[k] === 0);
              sx[axes[0]] = c[axes[0]] ? 1 : -1;
              sy[axes[1]] = c[axes[1]] ? 1 : -1;
              const bx = x + dx; const by = y + dy; const bz = z + dz;
              const s1 = occ(bx + sx[0], by + sx[1], bz + sx[2]);
              const s2 = occ(bx + sy[0], by + sy[1], bz + sy[2]);
              const cc = occ(bx + sx[0] + sy[0], by + sx[1] + sy[1], bz + sx[2] + sy[2]);
              a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
              // Luz suave: promedio de la luz de las celdas libres que tocan la esquina.
              if (lightFn) {
                let sum = lightAt(bx, by, bz); let n = 1;
                if (!s1) { sum += lightAt(bx + sx[0], by + sx[1], bz + sx[2]); n++; }
                if (!s2) { sum += lightAt(bx + sy[0], by + sy[1], bz + sy[2]); n++; }
                if (!cc && !(s1 && s2)) { sum += lightAt(bx + sx[0] + sy[0], by + sx[1] + sy[1], bz + sx[2] + sy[2]); n++; }
                lit.push(sum / n);
              }
            } else if (lightFn) lit.push(lightAt(x + dx, y + dy, z + dz));
            ao.push(a);
            col.push(b.emissive ? 1 : f.light * AO[a]);
          }
          // El atributo "emissive" lleva la luz de bloques por vértice (1 = el propio bloque brilla).
          const em = b.emissive ? [1, 1, 1, 1] : lightFn ? lit.map((l) => Math.pow(l, 1.4)) : 0;
          out.quad(pos, uv, col, em, ao[0] + ao[3] > ao[1] + ao[2], sky);
        }
      }
    }
  }
  return { opaque: opaque.geometry(), water: water.geometry() };
}

// Material propio: textura × color de vértice × luz del día (las lámparas ignoran la noche) + niebla.
export function createBlockMaterial(atlasTex, { transparent = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: atlasTex }, daylight: { value: 1 }, fogColor: { value: new THREE.Color(0x9fd3ff) },
      fogNear: { value: 40 }, fogFar: { value: 100 }, opacity: { value: transparent ? 0.78 : 1 },
    },
    vertexShader: `
      attribute float emissive; attribute float sky;
      varying vec2 vUv; varying vec3 vColor; varying float vEmissive; varying float vSky; varying float vDepth;
      void main() {
        vUv = uv; vColor = color; vEmissive = emissive; vSky = sky;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float opacity;
      varying vec2 vUv; varying vec3 vColor; varying float vEmissive; varying float vSky; varying float vDepth;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.5 && opacity >= 1.0) discard;
        // La luz que gana: la del cielo (según la hora y lo tapado que esté) o la de los bloques cercanos.
        float skyLight = daylight * vSky;
        float light = max(skyLight, vEmissive * 1.1);
        // Luz de bloques cálida (anaranjada) donde supera a la del cielo; los bloques que brillan no se tiñen.
        float warm = clamp((vEmissive - skyLight) * 2.2, 0.0, 1.0) * step(vEmissive, 0.995);
        vec3 c = tex.rgb * vColor * light * mix(vec3(1.0), vec3(1.18, 0.8, 0.46), warm);
        float fog = smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(mix(c, fogColor, fog), opacity);
        #include <colorspace_fragment>
      }`,
    vertexColors: true,
    transparent,
    depthWrite: !transparent,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
}
