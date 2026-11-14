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
    case I.BERRIES:
      for (const [x, y] of [[12, 16], [18, 14], [15, 21], [21, 20], [10, 22]]) disk(set, x, y, 3.2, RAMPS.apple);
      poly(set, [[14, 10], [20, 6], [22, 9], [16, 12]], () => RAMPS.green[2]);
      break;
    case I.FISH:
      disk(set, 15, 16, 10, ['#2e5a7a', '#4f86a8', '#8ab8d8', '#e0f0ff'], { ry: 6 });
      poly(set, [[24, 16], [30, 10], [30, 22]], () => '#4f86a8');
      for (let x = 9; x < 21; x += 3) set(x, 18, '#2e5a7a');
      disk(set, 8, 14, 1.4, RAMPS.coal); set(8, 13, '#ffffff');
      break;
    case I.RAW_MEAT:
      disk(set, 14, 16, 10, ['#8a2a2a', '#c84a4a', '#e87a7a', '#ffc0b8'], { ry: 8 });
      thickLine(set, 21, 21, 28, 27, 3, RAMPS.cloth); disk(set, 28, 27, 2.2, RAMPS.cloth);
      for (let k = 0; k < 3; k++) thickLine(set, 8 + k * 4, 13, 10 + k * 4, 19, 1, ['#f4f0e8', '#f4f0e8', '#f4f0e8', '#f4f0e8']);
      break;
    case I.RAW_FISH: case I.SALMON: case I.GOLDEN_FISH: {
      const ramp = id === I.SALMON ? ['#8a3a2a', '#c8664a', '#e8866a', '#ffd0c0'] : id === I.GOLDEN_FISH ? RAMPS.gold : ['#3e6a8a', '#6a98b8', '#a8d0e8', '#ffffff'];
      disk(set, 15, 16, 10, ramp, { ry: 6 });
      poly(set, [[24, 16], [30, 10], [30, 22]], () => ramp[1]);
      for (let x = 9; x < 21; x += 3) set(x, 18, ramp[0]);
      disk(set, 8, 14, 1.4, RAMPS.coal); set(8, 13, '#ffffff');
      if (id === I.GOLDEN_FISH) { set(13, 11, '#ffffff'); set(19, 13, '#ffffff'); }
      break;
    }
    case I.CARROT:
      poly(set, [[6, 24], [20, 10], [24, 14], [9, 27]], (x, y) => pickRamp(['#a84a10', '#d8661a', '#f08a2a', '#ffc070'], 0.9 - (x + y) / 70));
      for (let k = 0; k < 3; k++) thickLine(set, 22, 12, 26 + k * 2, 3 + k * 2, 1.6, RAMPS.green);
      for (const [x, y] of [[11, 21], [15, 17], [18, 14]]) set(x, y, '#a84a10');
      break;
    case I.POTATO: case I.BAKED_POTATO: {
      const ramp = id === I.POTATO ? ['#7a5a2a', '#a8844a', '#c8a060', '#e8d0a0'] : ['#6a3a12', '#a8642a', '#d8a050', '#ffe0a0'];
      disk(set, 16, 17, 11, ramp, { ry: 8 });
      for (const [x, y] of [[11, 14], [19, 19], [15, 21], [21, 13]]) set(x, y, ramp[0]);
      if (id === I.BAKED_POTATO) { thickLine(set, 12, 12, 20, 12, 1.4, ['#fff2c0', '#fff2c0', '#fff2c0', '#fff2c0']); disk(set, 16, 12, 2, ['#f2d84a', '#f2d84a', '#fff2a8', '#fff2a8']); }
      break;
    }
    case I.PUMPKIN_PIE:
      poly(set, [[3, 18], [16, 10], [29, 18], [16, 26]], (x, y) => (Math.abs(x - 16) / 2 + Math.abs(y - 18) > 6.4 ? RAMPS.bread[2] : pickRamp(['#a8501a', '#d8762a', '#e8902a', '#ffc070'], 0.9 - y / 50)));
      poly(set, [[3, 18], [16, 26], [16, 29], [3, 21]], () => RAMPS.bread[1]); poly(set, [[16, 26], [29, 18], [29, 21], [16, 29]], () => RAMPS.bread[0]);
      break;
    case I.STEW:
      poly(set, [[4, 15], [28, 15], [24, 26], [8, 26]], (x) => pickRamp(RAMPS.wood, 0.8 - x / 60));
      disk(set, 16, 15, 12, ['#6a3a12', '#8a4a1a', '#a8642a', '#c88a4a'], { ry: 4 });
      for (const [x, y, c] of [[11, 14, '#f08a2a'], [17, 13, '#c8a060'], [21, 15, '#8a4a2a'], [14, 16, '#4f9a2c']]) { set(x, y, c); set(x + 1, y, c); }
      for (let k = 0; k < 3; k++) thickLine(set, 11 + k * 5, 10, 13 + k * 5, 4, 1, ['#d8d8d8', '#e8e8e8', '#f4f4f4', '#ffffff']);
      break;
    case I.HONEY:
      poly(set, [[9, 6], [23, 6], [25, 28], [7, 28]], (x) => pickRamp(['#a86a10', '#d8962a', '#f2b52a', '#ffe08a'], 0.95 - x / 40));
      poly(set, [[10, 3], [22, 3], [22, 7], [10, 7]], () => RAMPS.wood[2]);
      set(11, 12, '#fff2c0'); set(11, 13, '#fff2c0'); set(12, 12, '#fff2c0');
      break;
    case I.ROD:
      thickLine(set, 5, 28, 24, 4, 1.6, RAMPS.wood);
      thickLine(set, 24, 4, 27, 20, 0.6, ['#e8e4d8', '#e8e4d8', '#e8e4d8', '#e8e4d8']);
      disk(set, 27, 22, 2.2, RAMPS.red);
      thickLine(set, 6, 25, 9, 22, 2.6, RAMPS.darkwood);
      break;
    case I.OLD_BOOT:
      poly(set, [[9, 5], [18, 5], [18, 20], [27, 22], [27, 28], [7, 28]], (x, y) => pickRamp(RAMPS.leather, 0.85 - y / 60));
      for (let y = 8; y < 20; y += 3) { set(10, y, RAMPS.leather[0]); set(16, y, RAMPS.leather[0]); }
      break;
    case I.TREASURE_MAP:
      poly(set, [[4, 6], [28, 4], [27, 27], [5, 28]], (x, y) => pickRamp(['#a8905a', '#d8c08a', '#e8d8a0', '#f8f0d0'], 0.95 - (x + y) / 90));
      for (let k = 0; k < 8; k++) set(8 + k * 2, 22 - (k % 3) * 2 - k, '#8a6a3a');   // camino punteado
      thickLine(set, 21, 8, 26, 13, 1.6, RAMPS.red); thickLine(set, 26, 8, 21, 13, 1.6, RAMPS.red);
      thickLine(set, 5, 6, 5, 28, 1.6, RAMPS.wood); thickLine(set, 27, 4, 27, 27, 1.6, RAMPS.wood);
      break;
    case I.DRAGON_SCALE:
      poly(set, [[16, 3], [28, 14], [16, 29], [4, 14]], (x, y) => pickRamp(['#4a0e0a', '#8f2b26', '#c8352b', '#ffb070'], 0.95 - Math.abs(x - 16) / 20 - y / 80));
      for (let y = 8; y < 26; y += 4) thickLine(set, 10, y, 16, y + 3, 1, ['#3a0806', '#3a0806', '#3a0806', '#3a0806']);
      break;
    case I.SERPENT_FANG:
      poly(set, [[10, 4], [20, 4], [17, 22], [13, 29]], (x) => pickRamp(RAMPS.cloth, 0.95 - (x - 10) / 25));
      poly(set, [[8, 2], [22, 2], [22, 6], [8, 6]], () => '#3a6a8a');
      break;
    case I.PUMPKIN_SEEDS:
      for (const [x, y] of [[9, 12], [15, 9], [21, 13], [12, 19], [18, 18], [24, 21], [8, 24], [15, 25], [22, 27]]) disk(set, x, y, 2.2, ['#a89a6a', '#d8c890', '#f4ecc8', '#ffffff'], { ry: 1.4 });
      break;
    case I.MEAT:
      disk(set, 14, 16, 10, ['#5a2410', '#8a4a2a', '#b06a40', '#e0a070'], { ry: 8 });
      thickLine(set, 21, 21, 28, 27, 3, RAMPS.cloth); disk(set, 28, 27, 2.2, RAMPS.cloth);
      for (let k = 0; k < 3; k++) thickLine(set, 8 + k * 4, 12, 11 + k * 4, 20, 1, ['#4a1a08', '#4a1a08', '#4a1a08', '#4a1a08']);
      break;
    case I.BOAT:
      poly(set, [[2, 15], [30, 15], [26, 23], [6, 23]], (x, y) => pickRamp(RAMPS.wood, 0.95 - (y - 15) / 10));
      for (let x = 3; x <= 29; x++) set(x, 15, RAMPS.wood[3]);
      for (let x = 5; x <= 27; x += 5) for (let y = 16; y <= 22; y++) set(x, y, RAMPS.darkwood[1]);
      thickLine(set, 10, 6, 21, 19, 1.4, RAMPS.darkwood); poly(set, [[19, 17], [24, 20], [22, 22]], () => RAMPS.wood[2]);
      break;
    case I.PEARL:
      disk(set, 16, 17, 9, ['#a89ab8', '#d8cce4', '#f4eef8', '#ffffff']);
      set(12, 13, '#ffffff'); set(13, 12, '#ffffff'); set(13, 13, '#ffffff');
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
  } else if (id === B.CHAIR || id === B.THRONE || id === B.PEW) {
    const throne = id === B.THRONE;
    const M = throne ? RAMPS.red : W; const T = throne ? RAMPS.gold : D;
    poly(set, [[8, 3], [20, 1], [20, throne ? 14 : 15], [8, 17]], (x, y) => pickRamp(M, 0.9 - (y - 2) / 30));   // respaldo
    for (let y = 2; y <= 16; y++) { set(8, y, T[2]); set(20, y - 1, T[1]); }
    poly(set, [[6, 18], [17, 14], [27, 18], [16, 22]], () => M[2]);      // asiento
    poly(set, [[6, 18], [16, 22], [16, 24], [6, 20]], () => T[1]); poly(set, [[16, 22], [27, 18], [27, 20], [16, 24]], () => T[0]);
    legs([[7, 20], [16, 23], [26, 20]], 8);
  } else if (id === B.FENCE) {
    for (const x of [6, 25]) poly(set, [[x - 2, 4], [x + 2, 4], [x + 2, 29], [x - 2, 29]], (xx) => pickRamp(W, 0.9 - (xx - x + 2) / 8));
    for (const y of [10, 20]) poly(set, [[4, y], [28, y], [28, y + 3], [4, y + 3]], (xx, yy) => pickRamp(W, 0.75 - (yy - y) / 6));
  } else if (id === B.BELL) {
    const G = RAMPS.gold;
    thickLine(set, 16, 3, 16, 8, 2, D);
    poly(set, [[11, 8], [21, 8], [24, 22], [8, 22]], (x) => pickRamp(G, 0.95 - Math.abs(x - 13) / 18));
    poly(set, [[5, 22], [27, 22], [27, 26], [5, 26]], (x) => pickRamp(G, 0.7 - x / 70));
    disk(set, 16, 27, 2, G);
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
