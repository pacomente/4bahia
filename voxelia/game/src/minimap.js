import { B, BLOCKS } from './blocks.js';
import { TEX_INDEX, ATLAS_COLS } from './textures.js';
import { SEA } from './world.js';

// Minimapa (esquina) y mapa grande (tecla M): vista desde arriba de lo que ya se cargó,
// con el jugador, el punto de reaparición y los faros.
export class MiniMap {
  constructor(atlasCanvas, world) {
    this.world = world;
    this.colors = blockColors(atlasCanvas);
    this.small = document.querySelector('#minimap');
    this.big = document.querySelector('#bigmap');
    this.timer = 0;
  }

  // Color de una columna: bloque de arriba, sombreado por altura; agua encima del lecho.
  columnColor(x, z) {
    const top = this.world.topAt(x, z);
    if (top < 0) return null;
    if (top < SEA && this.world.getBlock(x, SEA, z) === B.WATER) {
      const depth = Math.min(1, (SEA - top) / 12);
      return [40 - depth * 20, 100 - depth * 40, 210 - depth * 60];
    }
    const id = this.world.getBlock(x, top, z);
    const c = this.colors[id] ?? [128, 128, 128];
    const shade = 0.75 + Math.max(-0.25, Math.min(0.35, (top - SEA - 6) / 60));
    // Relieve: más claro si la columna de al lado (noroeste) está más baja.
    const nb = this.world.topAt(x - 1, z - 1);
    const relief = nb < 0 ? 1 : top > nb ? 1.12 : top < nb ? 0.86 : 1;
    return c.map((v) => Math.max(0, Math.min(255, v * shade * relief)));
  }

  draw(canvas, ctx, radius, scale) {
    const g = canvas.getContext('2d');
    const size = radius * 2;
    const img = g.createImageData(size, size);
    const px = Math.floor(ctx.player.pos.x); const pz = Math.floor(ctx.player.pos.z);
    for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
      const c = this.columnColor(px - radius + dx, pz - radius + dz);
      const i = (dz * size + dx) * 4;
      if (!c) { img.data[i + 3] = 0; continue; }
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    // Se dibuja chico y se agranda sin suavizar (pixel-art).
    const off = this.off ?? (this.off = document.createElement('canvas'));
    off.width = size; off.height = size;
    off.getContext('2d').putImageData(img, 0, 0);
    canvas.width = size * scale; canvas.height = size * scale;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(off, 0, 0, canvas.width, canvas.height);
    // Marcadores: faros (turquesa) y reaparición (casa). Si están lejos se pegan al borde como brújula.
    const W = canvas.width; const half = W / 2;
    const mark = (wx, wz, color, label) => {
      let mx = (wx - ctx.player.pos.x) * scale + half; let mz = (wz - ctx.player.pos.z) * scale + half;
      const out = mx < 6 || mz < 6 || mx > W - 6 || mz > W - 6;
      if (out) { const a = Math.atan2(mz - half, mx - half); mx = half + Math.cos(a) * (half - 7); mz = half + Math.sin(a) * (half - 7); }
      g.fillStyle = '#000'; g.fillRect(mx - 4, mz - 4, 8, 8);
      g.fillStyle = color; g.fillRect(mx - 3, mz - 3, 6, 6);
      if (label && !out && scale >= 3) { g.font = 'bold 12px sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(label, mx + 7, mz + 4); g.fillText(label, mx + 7, mz + 4); }
    };
    if (ctx.spawn) mark(ctx.spawn.x, ctx.spawn.z, '#ffe066', 'Reaparición');
    for (const f of ctx.faros) mark(f.x + 0.5, f.z + 0.5, '#5ff2e6', 'Faro');
    // Jugador: flecha que apunta hacia donde mira.
    g.save();
    g.translate(half, half);
    g.rotate(-ctx.player.yaw + Math.PI);
    const s = Math.max(5, scale * 2.2);
    g.beginPath(); g.moveTo(0, s * 1.3); g.lineTo(s * 0.8, -s * 0.8); g.lineTo(0, -s * 0.35); g.lineTo(-s * 0.8, -s * 0.8); g.closePath();
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.fill(); g.stroke();
    g.restore();
  }

  update(dt, ctx, bigOpen) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = bigOpen ? 0.5 : 0.35;
    if (bigOpen) this.draw(this.big, ctx, Math.min(150, ctx.radius), 3);
    else if (ctx.showMini) this.draw(this.small, ctx, 36, 2);
  }
}

// Color promedio de la cara superior de cada bloque, tomado del atlas de texturas.
function blockColors(atlas) {
  const g = atlas.getContext('2d');
  const out = [];
  for (const b of BLOCKS) {
    if (!b || !b.id) continue;
    const i = TEX_INDEX[b.tex[0]];
    if (i === undefined) continue;
    const d = g.getImageData((i % ATLAS_COLS) * 16, Math.floor(i / ATLAS_COLS) * 16, 16, 16).data;
    let r = 0; let gg = 0; let bb = 0; let n = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0) { r += d[k]; gg += d[k + 1]; bb += d[k + 2]; n++; }
    if (n) out[b.id] = [r / n, gg / n, bb / n];
  }
  return out;
}
