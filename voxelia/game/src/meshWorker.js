// Worker que arma las mallas de los chunks fuera del hilo del juego (así no hay tirones al moverse).
// Recibe el chunk y sus 8 vecinos (bloques y alturas) y devuelve los arreglos listos para la placa de video.
import { meshChunkData } from './mesher.js';
import { CS, H } from './world.js';
import { B } from './blocks.js';

class MiniWorld {
  constructor(list) { this.map = new Map(list.map((c) => [`${c.cx},${c.cz}`, c])); }
  getChunk(cx, cz) { return this.map.get(`${cx},${cz}`); }
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return 0;
    const cx = Math.floor(x / CS); const cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    if (!c) return 0;
    return c.data[(x - cx * CS) + (z - cz * CS) * CS + y * CS * CS];
  }
  topAt(x, z) {
    const cx = Math.floor(x / CS); const cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    return c ? c.top[(x - cx * CS) + (z - cz * CS) * CS] : -1;
  }
}

self.onmessage = (ev) => {
  const { id, cx, cz, chunks } = ev.data;
  const w = new MiniWorld(chunks);
  const d = meshChunkData(w, w.getChunk(cx, cz));
  const transfer = [];
  for (const g of [d.opaque, d.water]) if (g) transfer.push(g.pos.buffer, g.uv.buffer, g.col.buffer, g.emi.buffer, g.sky.buffer, g.idx.buffer);
  self.postMessage({ id, cx, cz, opaque: d.opaque, water: d.water }, transfer);
};
