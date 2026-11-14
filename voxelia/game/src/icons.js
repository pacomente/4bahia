// Íconos de ítems en pixel-art de 32×32, dibujados por código: cada material tiene su paleta
// (madera veteada, piedra rugosa, hierro pulido, cristal translúcido), luz desde arriba a la
// izquierda, brillo y contorno oscuro. Se usan en el HUD, el inventario, la mano y el personaje.
export const N = 32;
const OUTLINE = '#1b1512';

// Paletas: [sombra, medio, claro, brillo].
export const RAMPS = {
  wood: ['#4a2f1a', '#7a5230', '#a87442', '#d0a066'],
  darkwood: ['#3a2414', '#5b3d22', '#7a5230', '#9a6a3a'],
  stone: ['#3e3e42', '#66666c', '#8e8e94', '#b8b8be'],
  iron: ['#5d636c', '#9aa0a8', '#d2d6dc', '#ffffff'],
  gold: ['#8a5a14', '#d09a2a', '#f2c94c', '#fff2a8'],
  crystal: ['#156b66', '#22a69b', '#5ff2e6', '#d8fffb'],
  leather: ['#3a2418', '#5c3a26', '#7d5236', '#9a6a48'],
  cloth: ['#8a8378', '#c9c2b4', '#ece6da', '#ffffff'],
  red: ['#5a1410', '#8f2b26', '#c8352b', '#ff7a6a'],
  coal: ['#0e0e10', '#26262a', '#3e3e44', '#8a8a96'],
  essence: ['#2a1250', '#5a2bb0', '#8a4dff', '#e0ccff'],
  silver: ['#5d636c', '#a9aeb6', '#d9dde3', '#ffffff'],
  bread: ['#6b3a12', '#a8642a', '#d8954a', '#f2c88a'],
  apple: ['#5a0e0a', '#a01e16', '#d8352b', '#ff9a8a'],
  green: ['#2e5418', '#4f8a2c', '#7cc24a', '#c8f09a'],
  wheat: ['#7a5a1a', '#b89a3a', '#e0c055', '#fff0a8'],
};
const TOOL_RAMP = { wood: 'wood', stone: 'stone', iron: 'iron', crystal: 'crystal' };

function canvasGrid() {
  const g = new Array(N * N).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N && c) g[y * N + x] = c; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y * N + x] : null);
  return { g, set, get };
}

// Formas básicas. `shade(t)` recibe 0..1 (oscuro → claro) y devuelve el color de la paleta.
const pickRamp = (ramp, v) => ramp[Math.max(0, Math.min(3, Math.floor(v * 4)))];

// Línea gruesa de (x0,y0) a (x1,y1): el lado izquierdo/arriba más claro (luz arriba a la izquierda).
function thickLine(set, x0, y0, x1, y1, w, ramp, bias = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0); const nx = -(y1 - y0) / len; const ny = (x1 - x0) / len;
  const light = nx < 0 || (nx === 0 && ny < 0) ? -1 : 1;    // normal que apunta hacia la luz
  for (let s = 0; s <= len; s += 0.4) {
    const cx = x0 + ((x1 - x0) * s) / len; const cy = y0 + ((y1 - y0) * s) / len;
    for (let o = -w / 2; o <= w / 2; o += 0.5) {
      const v = 0.5 + (o / w) * light * -1.4 + bias;
      set(cx + nx * o, cy + ny * o, pickRamp(ramp, v));
    }
  }
}

function disk(set, cx, cy, r, ramp, { light = 1, ry = r } = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2;
    if (d > 1) continue;
    const lit = 1 - (((x - cx + r * 0.45) / r) ** 2 + ((y - cy + ry * 0.45) / ry) ** 2) * 0.55;
    set(x, y, pickRamp(ramp, Math.max(0, lit * light)));
  }
}

function poly(set, pts, colorAt) {
  const minY = Math.floor(Math.min(...pts.map((p) => p[1]))); const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]; const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(x, y, colorAt(x, y));
  }
}

// Mango de herramienta en diagonal, con veta de madera y empuñadura de cuero en los mejores niveles.
function handle(set, tier, from = [5, 27], to = [19, 13]) {
  thickLine(set, from[0], from[1], to[0], to[1], 2.6, RAMPS[tier === 'crystal' || tier === 'iron' ? 'darkwood' : 'wood']);
  if (tier === 'iron' || tier === 'crystal') thickLine(set, from[0] + 1, from[1] - 1, from[0] + 5, from[1] - 5, 3, RAMPS.leather);
  set(from[0] - 1, from[1] + 1, RAMPS.darkwood[0]);
}

// Herramienta: mango + cabeza según el tipo.
function drawTool(set, it) {
  const ramp = RAMPS[TOOL_RAMP[it.tier] ?? 'stone'];
  const glow = it.tier === 'crystal';
  if (it.tool === 'pick') {
    handle(set, it.tier);
    // Cabeza perpendicular al mango (eje (1,1)), curvada hacia adelante, con puntas afiladas.
    for (let t = -1; t <= 1; t += 0.02) {
      const bow = (1 - t * t) * 3;
      const ax = 19 + t * 10 + bow * 0.7; const ay = 13 + t * 10 - bow * 0.7;
      const thick = 3.2 - Math.abs(t) * 2.2;
      for (let o = 0; o <= thick; o += 0.5) set(ax - o * 0.7, ay + o * 0.7, pickRamp(ramp, 0.95 - o / thick * 0.7));
    }
    set(9, 3, ramp[3]); set(28, 22, ramp[1]);
  } else if (it.tool === 'axe') {
    handle(set, it.tier, [6, 27], [21, 12]);
    poly(set, [[17, 9], [23, 3], [29, 6], [29, 14], [24, 17]], (x, y) => pickRamp(ramp, 0.95 - ((x - 17) + (y - 3)) / 30 + (x > 26 ? 0.2 : 0)));
    for (let k = 0; k < 7; k++) set(29, 6 + k, ramp[3]);   // filo brillante
  } else if (it.tool === 'shovel') {
    handle(set, it.tier, [5, 27], [17, 15]);
    // Pala: hoja ancha que sigue al mango y termina en punta redondeada.
    const dir = [Math.SQRT1_2, -Math.SQRT1_2]; const per = [Math.SQRT1_2, Math.SQRT1_2];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x - 16) * dir[0] + (y - 16) * dir[1]; const v = (x - 16) * per[0] + (y - 16) * per[1];
      if (u < 0 || u > 13) continue;
      const half = u < 9 ? 4.4 : 4.4 * Math.sqrt(Math.max(0, 1 - ((u - 9) / 4.2) ** 2));
      if (Math.abs(v) > half) continue;
      set(x, y, pickRamp(ramp, 0.8 - v / 9 - (u < 1.5 ? 0.3 : 0)));
    }
  } else if (it.tool === 'sword') {
    // Hoja con canal central, guarda y pomo.
    thickLine(set, 9, 23, 26, 6, 3.4, ramp, 0.1);
    thickLine(set, 10, 22, 25, 7, 0.6, [ramp[3], ramp[3], ramp[3], ramp[3]]);
    poly(set, [[25, 5], [29, 3], [27, 7]], () => ramp[2]);
    thickLine(set, 5, 19, 13, 27, 2.4, RAMPS[it.tier === 'crystal' ? 'gold' : 'darkwood']);   // guarda
    thickLine(set, 4, 28, 8, 24, 2.4, RAMPS.leather);
    disk(set, 3.5, 28.5, 1.6, RAMPS.gold);
  } else if (it.tool === 'bow') {
    for (let t = -1; t <= 1; t += 0.02) {
      const x = 12 + (1 - t * t) * 9; const y = 16 + t * 13;
      for (let o = 0; o < 2.5; o += 0.5) set(x + o - 1, y, pickRamp(RAMPS.wood, 0.9 - o / 3));
    }
    for (let y = 3; y <= 29; y++) set(12, y, '#ece6da');
    thickLine(set, 18, 15, 22, 17, 2.4, RAMPS.leather);
  }
  if (glow) for (let k = 0; k < 6; k++) set(10 + k * 3, 4 + (k % 2), '#ffffff');
}

function drawArmor(set, it) {
  const ramp = RAMPS[it.tier === 'cloth' ? 'cloth' : it.tier === 'iron' ? 'iron' : 'crystal'];
  const trim = it.tier === 'cloth' ? RAMPS.red : it.tier === 'iron' ? RAMPS.stone : RAMPS.gold;
  const sh = (x, y, x0, w) => pickRamp(ramp, 0.95 - (x - x0) / w * 0.7 - (y % 6 === 0 && it.tier === 'cloth' ? 0.15 : 0));
  if (it.slot === 'head') {
    poly(set, [[7, 22], [7, 12], [10, 7], [16, 5], [22, 7], [25, 12], [25, 22], [21, 22], [21, 15], [11, 15], [11, 22]], (x, y) => sh(x, y, 7, 18));
    for (let x = 7; x <= 25; x++) set(x, 14, trim[2]);
    if (it.tier === 'iron') { for (let y = 7; y <= 14; y++) set(16, y, ramp[3]); }
  } else if (it.slot === 'chest') {
    poly(set, [[5, 9], [11, 5], [14, 8], [18, 8], [21, 5], [27, 9], [25, 15], [23, 14], [23, 27], [9, 27], [9, 14], [7, 15]], (x, y) => sh(x, y, 5, 22));
    for (let y = 9; y <= 27; y++) set(16, y, trim[1]);
    for (let x = 9; x <= 23; x++) set(x, 20, trim[2]);
    for (const [x, y] of [[12, 12], [20, 12], [12, 24], [20, 24]]) set(x, y, ramp[3]);
  } else if (it.slot === 'legs') {
    poly(set, [[8, 6], [24, 6], [25, 28], [18, 28], [16, 13], [14, 28], [7, 28]], (x, y) => sh(x, y, 7, 18));
    for (let x = 8; x <= 24; x++) set(x, 8, trim[2]);
  } else {
    for (const ox of [3, 17]) poly(set, [[ox, 12], [ox + 7, 12], [ox + 7, 21], [ox + 12, 22], [ox + 12, 27], [ox, 27]], (x, y) => sh(x, y, ox, 12));
    for (const ox of [3, 17]) for (let x = ox; x <= ox + 12; x++) set(x, 25, trim[1]);
  }
}

// Dibujo de cada ítem (los que no tienen dibujo propio usan un bloque genérico de su color).
export function drawItem(id, it, I) {
  const { g, set } = canvasGrid();
  if (it.kind === 'tool') drawTool(set, it);
  else if (it.kind === 'armor') drawArmor(set, it);
  else switch (id) {
    case I.COAL:
      for (const [x, y, r] of [[12, 18, 7], [21, 14, 6], [18, 23, 5]]) disk(set, x, y, r, RAMPS.coal);
      for (const [x, y] of [[9, 15], [19, 11], [16, 21], [22, 16]]) set(x, y, RAMPS.coal[3]);
      break;
    case I.IRON: case I.GOLD: {
      const r = RAMPS[id === I.IRON ? 'iron' : 'gold'];
      poly(set, [[4, 20], [10, 12], [28, 12], [22, 20]], () => r[3]);                 // cara de arriba
      poly(set, [[4, 20], [22, 20], [22, 26], [4, 26]], (x) => pickRamp(r, 0.6 - x / 60));   // frente
      poly(set, [[22, 20], [28, 12], [28, 18], [22, 26]], () => r[0]);              // costado
      for (let x = 11; x <= 25; x += 3) set(x, 15, r[2]);
      break;
    }
    case I.CRYSTAL:
      for (const [x0, top, w, h] of [[8, 9, 5, 18], [15, 3, 6, 24], [22, 11, 5, 16]]) {
        poly(set, [[x0, top + 4], [x0 + w / 2, top], [x0 + w, top + 4], [x0 + w, top + h], [x0, top + h]], (x, y) => pickRamp(RAMPS.crystal, 1 - (x - x0) / w * 0.75 - (y - top) / 80));
        for (let y = top + 3; y < top + h - 2; y++) set(x0 + 1, y, '#ffffff');
      }
      break;
    case I.ESSENCE:
      disk(set, 16, 16, 10, RAMPS.essence);
      for (let a = 0; a < 6.2; a += 0.15) { const r = 2 + a * 1.1; set(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, RAMPS.essence[3]); }
      set(12, 12, '#ffffff'); set(13, 11, '#ffffff');
      break;
    case I.SILVER:
      disk(set, 16, 16, 12, RAMPS.silver);
      for (let a = 0; a < 6.3; a += 0.05) set(16 + Math.cos(a) * 11.5, 16 + Math.sin(a) * 11.5, RAMPS.silver[0]);
      // Sello: una corona chiquita.
      poly(set, [[10, 20], [10, 12], [13, 16], [16, 10], [19, 16], [22, 12], [22, 20]], () => RAMPS.silver[1]);
      for (let x = 10; x <= 22; x++) set(x, 20, RAMPS.silver[0]);
      break;
    case I.APPLE:
      disk(set, 16, 19, 10, RAMPS.apple, { ry: 9 });
      thickLine(set, 16, 10, 18, 5, 1.6, RAMPS.darkwood);
      poly(set, [[18, 7], [24, 4], [26, 7], [21, 10]], (x) => pickRamp(RAMPS.green, 0.9 - (x - 18) / 20));
      set(11, 14, '#ffffff'); set(12, 14, '#ffd0c8');
      break;
    case I.BREAD:
      disk(set, 16, 18, 13, RAMPS.bread, { ry: 7 });
      for (const x of [9, 15, 21]) for (let k = 0; k < 4; k++) set(x + k, 13 + k, RAMPS.bread[3]);
      break;
    case I.CAKE:
      poly(set, [[4, 14], [16, 8], [28, 14], [16, 20]], () => '#fbf6ee');                                  // crema arriba
      poly(set, [[4, 14], [16, 20], [16, 28], [4, 22]], (x, y) => ((y - x / 2) % 6 < 2 ? '#d0457a' : '#e8c79a'));   // capas
      poly(set, [[16, 20], [28, 14], [28, 22], [16, 28]], (x, y) => ((y + x / 2) % 6 < 2 ? '#a0325c' : '#c9a57a'));
      disk(set, 16, 11, 2.4, RAMPS.apple);
      break;
    case I.WHEAT:
      for (let k = 0; k < 5; k++) {
        const x = 9 + k * 3.5;
        thickLine(set, x, 30, 16, 16, 1.4, RAMPS.wheat);
        for (let y = 3 + (k % 2) * 2; y < 13; y += 2) { set(x - 1 + (16 - x) * 0.1, y, RAMPS.wheat[2]); set(x + (16 - x) * 0.1, y + 1, RAMPS.wheat[3]); }
      }
      for (let x = 11; x <= 21; x++) set(x, 18, RAMPS.red[1]);
      break;
    case I.SEEDS:
      for (const [x, y] of [[9, 12], [15, 9], [21, 13], [12, 19], [18, 18], [24, 21], [8, 24], [15, 25], [22, 27]]) disk(set, x, y, 2, RAMPS.green, { ry: 1.5 });
      break;
    case I.ARROW:
      thickLine(set, 6, 26, 24, 8, 1.6, RAMPS.wood);
      poly(set, [[22, 6], [29, 3], [26, 10]], (x) => pickRamp(RAMPS.iron, 1 - (x - 22) / 10));
      for (const [ox, oy] of [[3, 25], [6, 28]]) thickLine(set, ox, oy, ox + 4, oy - 4, 2.4, RAMPS.cloth);
      break;
    case I.SHIELD:
      poly(set, [[5, 5], [27, 5], [27, 16], [16, 29], [5, 16]], (x, y) => {
        const rim = x <= 6 || x >= 26 || y <= 6 || (y >= 15 && Math.abs(x - 16) >= 29 - y - 2);
        if (rim) return pickRamp(RAMPS.iron, 0.9 - y / 40);
        return (x < 16) === (y < 15) ? pickRamp(RAMPS.red, 0.85 - y / 60) : pickRamp(RAMPS.gold, 0.85 - y / 60);
      });
      disk(set, 16, 15, 2.5, RAMPS.iron);
      break;
    case I.GLIDER:
      poly(set, [[2, 18], [16, 7], [30, 18], [16, 14]], (x) => ((Math.floor(x / 4)) % 2 ? RAMPS.crystal[2] : '#ece6da'));
      thickLine(set, 16, 14, 16, 27, 1.6, RAMPS.darkwood);
      thickLine(set, 9, 23, 23, 23, 1.6, RAMPS.darkwood);
      break;
    default:
      poly(set, [[8, 8], [24, 8], [24, 24], [8, 24]], (x, y) => pickRamp(RAMPS.stone, 1 - (x + y) / 48));
  }
  // Contorno: celdas vacías pegadas a una pintada.
  const out = g.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y * N + x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx; const yy = y + dy; return xx >= 0 && yy >= 0 && xx < N && yy < N && g[yy * N + xx]; });
    if (near) out[y * N + x] = OUTLINE;
  }
  return out;
}

// Íconos de muebles (se dibujan con su forma real en vez de un cubo).
export function drawFurniture(id, B) {
  const { g, set } = canvasGrid();
  const W = RAMPS.wood; const D = RAMPS.darkwood;
  const legs = (pts, h) => { for (const [x, y] of pts) thickLine(set, x, y, x, y + h, 2, D); };
  if (id === B.TABLE) {
    poly(set, [[3, 12], [16, 6], [29, 12], [16, 18]], (x) => pickRamp(W, 0.95 - Math.abs(x - 16) / 40));
    poly(set, [[3, 12], [16, 18], [16, 21], [3, 15]], () => W[1]); poly(set, [[16, 18], [29, 12], [29, 15], [16, 21]], () => W[0]);
    legs([[5, 15], [15, 20], [27, 15]], 11);
  } else if (id === B.CHAIR || id === B.THRONE) {
    const throne = id === B.THRONE;
    const M = throne ? RAMPS.red : W; const T = throne ? RAMPS.gold : D;
    poly(set, [[8, 3], [20, 1], [20, throne ? 14 : 15], [8, 17]], (x, y) => pickRamp(M, 0.9 - (y - 2) / 30));   // respaldo
    for (let y = 2; y <= 16; y++) { set(8, y, T[2]); set(20, y - 1, T[1]); }
    poly(set, [[6, 18], [17, 14], [27, 18], [16, 22]], () => M[2]);      // asiento
    poly(set, [[6, 18], [16, 22], [16, 24], [6, 20]], () => T[1]); poly(set, [[16, 22], [27, 18], [27, 20], [16, 24]], () => T[0]);
    legs([[7, 20], [16, 23], [26, 20]], 8);
  } else if (id === B.ANVIL) {
    const I = RAMPS.stone;
    poly(set, [[2, 9], [22, 7], [30, 10], [25, 15], [7, 15]], (x) => pickRamp(I, 0.95 - x / 50));
    poly(set, [[11, 15], [21, 15], [19, 21], [13, 21]], () => I[1]);
    poly(set, [[7, 21], [25, 21], [27, 27], [5, 27]], (x) => pickRamp(I, 0.7 - x / 60));
    for (let x = 4; x <= 24; x++) set(x, 8 + (x > 22 ? 1 : 0), I[3]);
  } else if (id === B.CARPET) {
    poly(set, [[2, 16], [16, 9], [30, 16], [16, 23]], (x, y) => { const d = Math.abs(x - 16) / 2 + Math.abs(y - 16); return d > 6.2 ? '#d8b14a' : d < 3 ? '#2f4fb8' : '#8f2b26'; });
  } else if (id === B.FIREPLACE) {
    poly(set, [[4, 4], [28, 4], [28, 29], [4, 29]], (x, y) => ((y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7) ? '#c9c2b8' : pickRamp(RAMPS.red, 0.55 - y / 80)));
    poly(set, [[9, 13], [12, 10], [20, 10], [23, 13], [23, 27], [9, 27]], () => '#1a1210');
    for (let k = 0; k < 5; k++) thickLine(set, 11 + k * 2.4, 26, 12 + k * 2.2, 17 + (k % 2) * 3, 1.6, ['#e8561c', '#ff8a1e', '#ffd34d', '#fff2a8']);
    thickLine(set, 10, 27, 22, 27, 1.6, D);
  } else return null;
  const out = g.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y * N + x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N && g[(y + dy) * N + x + dx])) out[y * N + x] = OUTLINE;
  }
  return out;
}
