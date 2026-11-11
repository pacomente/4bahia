import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { CS, H } from './world.js';
import { uvRect } from './textures.js';

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
  constructor() { this.pos = []; this.uv = []; this.col = []; this.emi = []; this.idx = []; }
  quad(p, uv, c, emissive, flip) {
    const n = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(c[i], c[i], c[i]);
      this.emi.push(emissive);
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
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
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

  let maxY = 0;
  for (let i = chunk.data.length - 1; i >= 0; i--) if (chunk.data[i]) { maxY = Math.floor(i / (CS * CS)); break; }

  for (let y = 0; y <= Math.min(H - 1, maxY + 1); y++) {
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const id = chunk.data[lx + lz * CS + y * CS * CS];
        if (!id) continue;
        const b = BLOCKS[id];
        const x = x0 + lx; const z = z0 + lz;
        const isWater = id === B.WATER;
        const out = isWater ? water : opaque;
        for (const f of FACES) {
          const [dx, dy, dz] = f.dir;
          const n = get(x + dx, y + dy, z + dz);
          if (!faceVisible(id, n)) continue;
          if (isWater && n === B.WATER) continue;
          const [u0, v0, u1, v1] = uvRect(b.tex[f.tex]);
          // Sombra simple: el aire frente a la cara está bajo un techo opaco.
          const shadowed = y + dy < top(x + dx, z + dz) ? 0.55 : 1;
          const pos = []; const uv = []; const col = []; const ao = [];
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
            }
            ao.push(a);
            col.push(b.emissive ? 1 : f.light * AO[a] * shadowed);
          }
          out.quad(pos, uv, col, b.emissive ? 1 : 0, ao[0] + ao[3] > ao[1] + ao[2]);
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
      attribute float emissive;
      varying vec2 vUv; varying vec3 vColor; varying float vEmissive; varying float vDepth;
      void main() {
        vUv = uv; vColor = color; vEmissive = emissive;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float opacity;
      varying vec2 vUv; varying vec3 vColor; varying float vEmissive; varying float vDepth;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.5 && opacity >= 1.0) discard;
        float light = mix(daylight, 1.0, vEmissive);
        vec3 c = tex.rgb * vColor * light;
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
