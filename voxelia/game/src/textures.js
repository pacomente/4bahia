import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { drawFurniture, N as ICON_N } from './icons.js';

// Texturas pixel-art de 16×16 generadas por código (sin archivos externos) y empaquetadas en un atlas.
const S = 16;
const NAMES = ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'water', 'log_top', 'log_side', 'leaves', 'planks',
  'cobble', 'glass', 'snow', 'snow_side', 'brick', 'coal', 'cactus_top', 'cactus_side', 'bedrock', 'gravel', 'iron',
  'birch_top', 'birch_side', 'birch_leaves', 'clay', 'lamp', 'wool_red', 'wool_blue', 'wool_white', 'crystal', 'faro_top', 'faro_side', 'torch', 'bench_top', 'bench_side', 'roof', 'thatch', 'adobe', 'farmland', 'wheat_young', 'wheat_ripe', 'bed_top', 'bed_side', 'door', 'window', 'lava', 'glow_mushroom', 'moss', 'gold_ore', 'wool_black', 'bars', 'campfire', 'chest_top', 'chest_side', 'table_top', 'bookshelf', 'fireplace', 'carpet', 'barrel_top', 'barrel_side', 'hay_top', 'hay_side', 'anvil', 'throne', 'flower_red', 'flower_yellow', 'pine_leaves', 'palm_top', 'palm_side', 'palm_leaves', 'tall_grass', 'berry_bush', 'dead_bush', 'kelp', 'seagrass', 'coral_red', 'coral_yellow', 'coral_purple', 'coral_fan', 'bell', 'altar_top', 'altar_side', 'blackboard', 'stained_glass', 'trough_top', 'carrot_young', 'carrot_ripe', 'potato_young', 'potato_ripe', 'pumpkin_top', 'pumpkin_side', 'pumpkin_stem', 'hive_top', 'hive_side', 'oven', 'fruit_leaves', 'mud', 'lily_pad', 'vines', 'jungle_leaves', 'red_sand', 'red_rock', 'orange_rock', 'rail', 'mossy_cobble', 'sandstone', 'sandstone_top', 'chiseled_sandstone'];
const COLS = 8;
export const ATLAS_COLS = COLS;
export const ATLAS_ROWS = Math.ceil(NAMES.length / COLS);
export const TEX_INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));

// Generador pseudoaleatorio con semilla fija: las texturas salen siempre iguales.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));

function paint(name, px) {
  const r = rng([...name].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const set = (x, y, c, a = 255) => { const i = (y * S + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  const noise = (base, amt) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(base, 1 - amt / 2 + r() * amt)); };
  const speckle = (c, n) => { for (let k = 0; k < n; k++) set(Math.floor(r() * S), Math.floor(r() * S), c); };
  const blob = (c, n, size = 2) => { for (let k = 0; k < n; k++) { const x0 = Math.floor(r() * (S - size)); const y0 = Math.floor(r() * (S - size)); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (r() > 0.25) set(x0 + x, y0 + y, shade(c, 0.85 + r() * 0.3)); } };
  const grass = hex('#5fa339'); const dirt = hex('#8a5a3b'); const stone = hex('#8b8b8b');
  switch (name) {
    case 'grass_top': noise(grass, 0.35); speckle(shade(grass, 1.25), 18); break;
    case 'dirt': noise(dirt, 0.4); speckle(shade(dirt, 0.7), 14); break;
    case 'grass_side':
      noise(dirt, 0.4); speckle(shade(dirt, 0.7), 10);
      for (let x = 0; x < S; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) set(x, y, shade(grass, 0.85 + r() * 0.3)); }
      break;
    case 'stone': noise(stone, 0.25); for (let k = 0; k < 6; k++) { const y = Math.floor(r() * S); const x0 = Math.floor(r() * 10); for (let x = x0; x < x0 + 4 + r() * 4 && x < S; x++) set(x, y, shade(stone, 0.75)); } break;
    case 'cobble':
      noise(stone, 0.2);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + Math.floor(y / 4) * 3) % 5 === 0 || y % 4 === 0) set(x, y, shade(stone, 0.6));
      break;
    case 'sand': noise(hex('#dccf96'), 0.18); speckle(hex('#c9b97a'), 20); break;
    case 'gravel': noise(hex('#878079'), 0.3); blob(hex('#a49d95'), 10); blob(hex('#5f5953'), 8); break;
    case 'clay': noise(hex('#9fa6b3'), 0.12); break;
    case 'water': noise(hex('#2f6fd6'), 0.15); for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x++) if ((x + y) % 7 < 3) set(x, y, hex('#5b95ea')); break;
    case 'log_side': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#6b4a2b'), (x % 4 === 0 ? 0.75 : 1) * (0.9 + r() * 0.2))); break;
    case 'log_top': {
      const c = hex('#b08a55');
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d > 6.5 ? hex('#6b4a2b') : shade(c, Math.floor(d) % 2 ? 0.85 : 1)); }
      break;
    }
    case 'birch_side':
      noise(hex('#e8e4d8'), 0.08);
      for (let k = 0; k < 7; k++) { const y = Math.floor(r() * S); const x0 = Math.floor(r() * 12); for (let x = x0; x < x0 + 2 + r() * 3 && x < S; x++) set(x, y, hex('#2b2b2b')); }
      break;
    case 'birch_top': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d > 6.5 ? hex('#e8e4d8') : shade(hex('#d8c38f'), Math.floor(d) % 2 ? 0.88 : 1)); } break;
    case 'leaves': case 'birch_leaves': {
      const c = name === 'leaves' ? hex('#3f8f2c') : hex('#7cab4a');
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = r(); set(x, y, shade(c, 0.7 + v * 0.5), v < 0.18 ? 0 : 255); }
      break;
    }
    case 'planks':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#b5874f'), (y % 4 === 3 ? 0.7 : 1) * (0.92 + r() * 0.12) * (((x + (Math.floor(y / 4) % 2) * 8) % 16 === 0) ? 0.75 : 1)));
      break;
    case 'glass':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
        const shine = (x - y === 3 || x - y === 4) && x > 3 && x < 12;
        set(x, y, edge ? hex('#cfe7f0') : hex('#e8f6fb'), edge ? 255 : shine ? 140 : 0);
      }
      break;
    case 'snow': noise(hex('#f4f8fb'), 0.06); break;
    case 'snow_side': noise(dirt, 0.4); for (let x = 0; x < S; x++) { const h = 3 + Math.floor(r() * 2); for (let y = 0; y < h; y++) set(x, y, hex('#f4f8fb')); } break;
    case 'brick':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const mortar = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7;
        set(x, y, mortar ? hex('#c9c2b8') : shade(hex('#9c4a35'), 0.88 + r() * 0.2));
      }
      break;
    case 'coal': noise(stone, 0.25); blob(hex('#262626'), 7); break;
    case 'iron': noise(stone, 0.25); blob(hex('#d8a982'), 6); break;
    case 'cactus_side': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#4b8a2c'), (x % 5 === 2 ? 0.75 : 1) * (0.92 + r() * 0.15))); speckle(hex('#e6e2b5'), 8); break;
    case 'cactus_top': noise(hex('#5a9b36'), 0.2); break;
    case 'bedrock': noise(hex('#4a4a4a'), 0.6); break;
    case 'lamp':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1 || x === 7 || y === 7;
        set(x, y, edge ? hex('#7a5a2a') : shade(hex('#ffd36b'), 0.9 + r() * 0.15));
      }
      break;
    case 'wool_red': noise(hex('#b8352f'), 0.15); break;
    case 'wool_blue': noise(hex('#2f4fb8'), 0.15); break;
    case 'wool_white': noise(hex('#eae8e4'), 0.08); break;
    case 'crystal': {
      noise(hex('#4a4f5c'), 0.25);
      // Vetas de cristal turquesa brillante.
      for (let k = 0; k < 5; k++) {
        let x = Math.floor(r() * 12) + 2; let y = Math.floor(r() * 12) + 2;
        for (let i = 0; i < 5; i++) { set(x, y, shade(hex('#5ff2e6'), 0.85 + r() * 0.3)); x += r() < 0.5 ? 1 : 0; y += r() < 0.5 ? -1 : 1; if (x >= S || y < 0 || y >= S) break; }
      }
      break;
    }
    case 'faro_top': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d < 3 ? hex('#bffcf6') : d < 5 ? shade(hex('#5ff2e6'), 0.9 + r() * 0.2) : shade(hex('#7d7f88'), 0.85 + r() * 0.2)); } break;
    case 'faro_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const frame = x < 2 || x > 13 || y < 2 || y > 13;
        set(x, y, frame ? shade(hex('#7d7f88'), 0.85 + r() * 0.2) : shade(hex('#5ff2e6'), (y % 4 < 2 ? 0.8 : 1) * (0.9 + r() * 0.15)));
      }
      break;
    case 'torch':
      // Palito de madera con llama (el resto transparente). El mesher usa la franja x 7-8.
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (let y = 6; y < S; y++) for (let x = 7; x < 9; x++) set(x, y, shade(hex('#7a5230'), x === 7 ? 1.1 : 0.85));
      for (let y = 3; y < 6; y++) for (let x = 7; x < 9; x++) set(x, y, y === 3 ? hex('#fff6c2') : y === 4 ? hex('#ffd34d') : hex('#ff9a2e'));
      set(7, 2, hex('#ffe98a')); set(8, 2, hex('#ffb347'), 200);
      break;
    case 'bench_top': {
      // Tablero de madera con cuadrícula de trabajo y borde oscuro.
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
        const grid = (x === 5 || x === 10 || y === 5 || y === 10) && !edge;
        set(x, y, edge ? hex('#5b3d22') : grid ? hex('#7a5230') : shade(hex('#c49a62'), 0.9 + r() * 0.15));
      }
      break;
    }
    case 'bench_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#a77a45'), (y % 4 === 3 ? 0.72 : 1) * (0.92 + r() * 0.12)));
      for (let x = 0; x < S; x++) { set(x, 0, hex('#5b3d22')); set(x, 1, hex('#c49a62')); }
      // Herramientas colgadas: un martillo y una sierra.
      for (let y = 4; y < 12; y++) set(4, y, hex('#5b3d22'));
      for (let x = 2; x < 7; x++) { set(x, 4, hex('#9a9a9a')); set(x, 5, hex('#7d7d7d')); }
      for (let y = 4; y < 12; y++) for (let x = 9; x < 13; x++) if (x - 9 <= (y - 4) / 2) set(x, y, y % 2 ? hex('#cfcfcf') : hex('#a9a9a9'));
      for (let y = 3; y < 5; y++) for (let x = 9; x < 13; x++) set(x, y, hex('#5b3d22'));
      break;
    case 'roof':
      // Tejas de barro superpuestas en hileras desplazadas.
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 4); const lx = (x + (row % 2) * 2) % 4; const ly = y % 4;
        const f = (ly === 3 ? 0.6 : ly === 0 ? 1.12 : 1) * (lx === 0 ? 0.8 : 1) * (0.92 + r() * 0.12);
        set(x, y, shade(hex('#a2482e'), f));
      }
      break;
    case 'thatch':
      // Paja: fibras verticales doradas con atados cada 5 filas.
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#d8b45a'), (y % 5 === 4 ? 0.72 : 1) * (x % 2 ? 0.9 : 1.04) * (0.88 + r() * 0.2)));
      break;
    case 'adobe':
      noise(hex('#d39a63'), 0.14);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0) set(x, y, hex('#b07a48'));
      speckle(hex('#e6b986'), 10);
      break;
    case 'farmland':
      // Surcos húmedos.
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#6b4428'), (y % 4 === 0 ? 0.65 : y % 4 === 1 ? 1.12 : 1) * (0.9 + r() * 0.15)));
      break;
    case 'wheat_young': case 'wheat_ripe': {
      const ripe = name === 'wheat_ripe';
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (let k = 0; k < 6; k++) {
        const x = 1 + k * 2 + Math.floor(r() * 2); const top = ripe ? 2 + Math.floor(r() * 3) : 7 + Math.floor(r() * 4);
        for (let y = top; y < S; y++) set(x, y, ripe ? shade(hex('#b89a3a'), y > 10 ? 0.75 : 1) : shade(hex('#5fa339'), 0.8 + r() * 0.3));
        if (ripe) for (let y = top; y < top + 4; y++) { set(x, y, shade(hex('#e8c75a'), 0.9 + r() * 0.2)); if (x + 1 < S) set(x + 1, y, hex('#d8b14a')); }
        else if (x + 1 < S) set(x + 1, top + 1, hex('#7cc24a'));
      }
      break;
    }
    case 'bed_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || x === S - 1;
        if (y < 5) set(x, y, edge ? hex('#c9c2b8') : shade(hex('#f2efe6'), 0.95 + r() * 0.05));        // almohada
        else set(x, y, edge ? shade(hex('#7a2420'), 1) : shade(hex('#b8352f'), (x + y) % 6 === 0 ? 0.85 : 1));   // frazada
      }
      break;
    case 'bed_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, y < 7 ? shade(hex('#b8352f'), y === 6 ? 0.7 : 1) : y < 10 ? shade(hex('#8a5a33'), 0.95 + r() * 0.1) : (x < 3 || x > 12) ? hex('#6b4426') : [0, 0, 0], y >= 10 && x >= 3 && x <= 12 ? 0 : 255);
      break;
    case 'door':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const frame = x < 2 || x > 13 || y < 1 || y > 14;
        const win = y >= 2 && y <= 6 && x >= 4 && x <= 11 && !(x === 7 || x === 8 || y === 4);
        set(x, y, frame ? hex('#5b3d22') : win ? hex('#cfe7f0') : shade(hex('#9a6a3a'), (x % 4 === 1 ? 0.8 : 1) * (0.92 + r() * 0.12)));
      }
      set(12, 9, hex('#d8c08a')); set(12, 10, hex('#a8905a'));
      break;
    case 'window':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
        set(x, y, frame ? shade(hex('#7a5230'), 0.9 + r() * 0.15) : hex('#dff1f8'), frame ? 255 : (x + y) % 9 === 0 ? 150 : 60);
      }
      break;
    case 'mud': noise(hex('#4a3a2a'), 0.3); speckle(hex('#2e241a'), 18); speckle(hex('#5f4a34'), 10); break;
    case 'lily_pad':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 7.5, y - 7.5); const notch = x > 7 && Math.abs(y - 7.5) < 1.2; set(x, y, shade(hex('#3f8a2c'), 0.85 + r() * 0.25), d < 7 && !notch ? 255 : 0); }
      set(5, 6, hex('#f2a8d8')); set(6, 6, hex('#ffffff')); set(5, 5, hex('#f2a8d8'));
      break;
    case 'vines':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (const x0 of [2, 6, 10, 13]) { let x = x0; for (let y = 0; y < S; y++) { set(Math.round(x), y, shade(hex('#3f7a2c'), 0.8 + r() * 0.4)); if (y % 3 === 1) set(Math.round(x) + 1, y, hex('#5f9a3c')); x += (r() - 0.5) * 0.6; } }
      break;
    case 'jungle_leaves': { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = r(); set(x, y, shade(hex('#2f7a1c'), 0.65 + v * 0.55), v < 0.12 ? 0 : 255); } break; }
    case 'red_sand': noise(hex('#c8642a'), 0.25); speckle(hex('#a84a1a'), 16); break;
    case 'red_rock': case 'orange_rock': {
      const c = name === 'red_rock' ? hex('#a8482a') : hex('#d8803a');
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(c, (y % 5 === 0 ? 0.82 : 1) * (0.9 + r() * 0.12)));
      break;
    }
    case 'rail':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (let y = 1; y < S; y += 4) for (let x = 1; x < 15; x++) set(x, y, shade(hex('#7a5230'), 0.85 + r() * 0.2)), set(x, y + 1, shade(hex('#5b3d22'), 0.9));
      for (let y = 0; y < S; y++) { set(3, y, hex('#9aa0a8')); set(4, y, hex('#6a6e76')); set(11, y, hex('#9aa0a8')); set(12, y, hex('#6a6e76')); }
      break;
    case 'mossy_cobble':
      noise(stone, 0.2);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + Math.floor(y / 4) * 3) % 5 === 0 || y % 4 === 0) set(x, y, shade(stone, 0.6));
      blob(hex('#4f8a2c'), 8, 3); speckle(hex('#6fb043'), 14);
      break;
    case 'sandstone': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#e0cc8a'), (y === 4 || y === 11 ? 0.85 : 1) * (0.93 + r() * 0.1))); break;
    case 'sandstone_top': noise(hex('#e8d49a'), 0.12); break;
    case 'chiseled_sandstone':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#e0cc8a'), 0.93 + r() * 0.1));
      for (let k = 2; k < 14; k++) { set(k, 2, hex('#a8904a')); set(k, 13, hex('#a8904a')); set(2, k, hex('#a8904a')); set(13, k, hex('#a8904a')); }
      for (const [x, y] of [[7, 5], [8, 5], [6, 6], [9, 6], [6, 7], [9, 7], [7, 8], [8, 8], [7, 9], [8, 9], [7, 10], [8, 10]]) set(x, y, hex('#8a7234'));   // ojo tallado
      break;
    case 'carrot_young': case 'carrot_ripe': case 'potato_young': case 'potato_ripe': {
      // Matas de hojas; las maduras asoman la zanahoria o tienen florcitas (papa).
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      const ripe = name.endsWith('ripe'); const carrot = name.startsWith('carrot');
      for (let k = 0; k < 5; k++) {
        const x = 1 + k * 3; const top = ripe ? 4 + Math.floor(r() * 3) : 9 + Math.floor(r() * 3);
        for (let y = top; y < 15; y++) { set(x, y, shade(hex(carrot ? '#4f9a2c' : '#3f7a2c'), 0.8 + r() * 0.35)); if (y % 3 === 0 && x + 1 < S) set(x + 1, y - 1, hex(carrot ? '#7cc24a' : '#5f9a3c')); }
        if (ripe && carrot) { set(x, 15, hex('#f08a2a')); set(x, 14, hex('#f08a2a')); if (x + 1 < S) set(x + 1, 15, hex('#d86a1a')); }
        if (ripe && !carrot) { set(x, top, hex('#f4f0e8')); if (x + 1 < S) set(x + 1, top, hex('#e8d0f0')); }
      }
      break;
    }
    case 'pumpkin_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#e8902a'), (x % 4 === 0 ? 0.72 : 1) * (0.9 + r() * 0.12)));
      break;
    case 'pumpkin_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 7.5, y - 7.5); set(x, y, shade(hex('#e8902a'), (d < 2 ? 0.6 : 1) * (0.88 + r() * 0.12))); }
      set(7, 7, hex('#5a3a1a')); set(8, 7, hex('#5a3a1a')); set(7, 8, hex('#3f7a2c'));
      break;
    case 'pumpkin_stem':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (let k = 0; k < 3; k++) { let x = 4 + k * 4; for (let y = 15; y > 6; y--) { set(Math.round(x), y, shade(hex('#5f9a3c'), 0.8 + r() * 0.3)); x += (r() - 0.5) * 0.8; } set(Math.round(x) - 1, 6, hex('#7cc24a')); set(Math.round(x) + 1, 7, hex('#7cc24a')); }
      set(12, 12, hex('#f2d84a')); set(4, 10, hex('#f2d84a'));
      break;
    case 'hive_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (y % 4 === 3) ? hex('#a87a2a') : shade(hex('#e8c060'), 0.9 + r() * 0.15));
      for (let x = 6; x <= 9; x++) for (let y = 9; y <= 11; y++) set(x, y, hex('#3a2414'));   // entrada
      break;
    case 'hive_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) ? hex('#c89a3a') : shade(hex('#f2c94c'), 0.9 + r() * 0.12));
      break;
    case 'oven':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#8b8b8b'), (y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 ? 0.65 : 1) * (0.9 + r() * 0.12)));
      for (let y = 6; y < 13; y++) for (let x = 4; x < 12; x++) { const arch = y === 6 && (x === 4 || x === 11); if (!arch) set(x, y, y > 9 ? (r() < 0.5 ? hex('#ff8a1e') : hex('#ffd34d')) : hex('#2a1810')); }
      break;
    case 'fruit_leaves': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = r(); set(x, y, shade(hex('#3f8f2c'), 0.7 + v * 0.5), v < 0.16 ? 0 : 255); }
      for (const [x, y] of [[3, 4], [11, 3], [7, 9], [13, 11], [2, 12]]) { set(x, y, hex('#d8352b')); set(x + 1, y, hex('#a01e16')); set(x, y + 1, hex('#a01e16')); }
      break;
    }
    case 'bell':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#d8a83a'), (x < 3 ? 0.75 : x > 12 ? 0.85 : 1.05) * (0.92 + r() * 0.12)));
      for (let x = 0; x < S; x++) set(x, 13, hex('#a87a20'));
      break;
    case 'altar_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (x < 2 || x > 13) ? hex('#d8b14a') : shade(hex('#f2efe6'), 0.94 + r() * 0.08));
      break;
    case 'altar_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const cross = (x >= 7 && x <= 8 && y >= 3 && y <= 13) || (y >= 6 && y <= 7 && x >= 4 && x <= 11);
        set(x, y, y < 3 ? shade(hex('#f2efe6'), 0.95) : cross ? hex('#e8c040') : shade(hex('#7a1e2a'), 0.9 + r() * 0.12));
      }
      break;
    case 'blackboard':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (x < 1 || y < 1 || x > 14 || y > 14) ? hex('#7a5230') : shade(hex('#24402e'), 0.92 + r() * 0.12));
      // "A B C" y una suma con tiza.
      for (const [x, y] of [[3, 4], [4, 3], [5, 4], [3, 5], [5, 5], [4, 4], [8, 3], [8, 4], [8, 5], [9, 3], [9, 4], [10, 5], [9, 5], [12, 3], [13, 3], [12, 4], [12, 5], [13, 5], [3, 9], [4, 9], [5, 9], [4, 8], [4, 10], [7, 9], [8, 9], [10, 8], [10, 9], [11, 9], [12, 9], [10, 10], [11, 10], [12, 10]]) set(x, y, hex('#e8ece8'));
      for (let x = 2; x < 14; x++) set(x, 12, hex('#9ab0a0'));
      break;
    case 'stained_glass': {
      const cols = [hex('#c0392b'), hex('#2f6fd8'), hex('#e8c040'), hex('#3aa860'), hex('#9b59b6')];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const lead = x < 1 || y < 1 || x > 14 || y > 14 || (x + y) % 6 === 0 || (x - y + 16) % 6 === 0;
        set(x, y, lead ? hex('#2a2a2e') : cols[(Math.floor((x + y) / 6) + Math.floor((x - y + 16) / 6)) % cols.length], lead ? 255 : 170);
      }
      break;
    }
    case 'trough_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (x < 2 || x > 13 || y < 2 || y > 13) ? shade(hex('#8a5a33'), 0.9 + r() * 0.15) : r() < 0.5 ? hex('#d8b14a') : hex('#b8902a'));
      break;
    case 'lava':
      // Lava: naranja brillante con manchas amarillas y costra oscura.
      noise(hex('#e8561c'), 0.25);
      blob(hex('#ffc93c'), 9, 3); blob(hex('#ff8a1e'), 8, 2); speckle(hex('#7a1c0c'), 12);
      break;
    case 'glow_mushroom':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (const [cx, top, w] of [[4, 6, 3], [10, 3, 4], [13, 9, 2]]) {
        for (let y = top + 2; y < S; y++) set(cx, y, hex('#d8e8e0'));                       // pie
        for (let y = top; y < top + 2; y++) for (let x = cx - w; x <= cx + w; x++) if (x >= 0 && x < S) set(x, y, (x + y) % 3 ? hex('#4ff0d0') : hex('#c8fff2'));   // sombrero
        if (top > 0) for (let x = cx - w + 1; x < cx + w; x++) if (x >= 0 && x < S) set(x, top - 1, hex('#2bb3a8'));
      }
      break;
    case 'moss': noise(stone, 0.25); blob(hex('#5f8a35'), 10, 3); speckle(hex('#7cab4a'), 14); break;
    case 'gold_ore': noise(stone, 0.25); blob(hex('#f2c94c'), 6); speckle(hex('#fff2a8'), 4); break;
    case 'wool_black': noise(hex('#26232a'), 0.18); break;
    case 'bars':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const bar = x % 5 === 1 || x % 5 === 2 || y === 1 || y === 14;
        set(x, y, bar ? shade(hex('#5c6068'), x % 5 === 1 ? 1.2 : 0.9) : [0, 0, 0], bar ? 255 : 0);
      }
      break;
    case 'campfire':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (let x = 1; x < 15; x++) { set(x, 14, hex('#6b4426')); set(x, 15, hex('#4a2f1a')); }   // leños
      for (let k = 0; k < 7; k++) {
        const x = 3 + k * 1.6 | 0; const top = 3 + Math.floor(r() * 6);
        for (let y = top; y < 14; y++) set(x, y, y < top + 2 ? hex('#fff2a8') : y < top + 5 ? hex('#ffb347') : hex('#e8561c'));
        if (x + 1 < S) for (let y = top + 2; y < 14; y++) set(x + 1, y, hex('#ff8a1e'));
      }
      break;
    case 'chest_top': case 'chest_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const band = x < 2 || x > 13 || (name === 'chest_side' ? y === 5 || y === 6 : y < 2 || y > 13);
        set(x, y, band ? shade(hex('#5c6068'), 0.9 + r() * 0.2) : shade(hex('#8a5a33'), (y % 4 === 0 ? 0.8 : 1) * (0.9 + r() * 0.15)));
      }
      if (name === 'chest_side') for (let y = 5; y < 9; y++) for (let x = 7; x < 9; x++) set(x, y, hex('#f2c94c'));   // cerradura de oro
      break;
    case 'table_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
        set(x, y, edge ? hex('#7a5230') : shade(hex('#c99a5e'), (x % 5 === 0 ? 0.88 : 1) * (0.94 + r() * 0.1)));
      }
      break;
    case 'bookshelf': {
      // Dos estantes con lomos de libros de colores.
      const cols = ['#8f2b26', '#2f4fb8', '#3f7a2c', '#b8842a', '#5a2b7a', '#2a6b6b', '#c9c2b4'];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, hex('#6b4426'));
      for (const y0 of [1, 9]) {
        let x = 1;
        while (x < 15) {
          const w = 1 + Math.floor(r() * 2); const h = 5 + Math.floor(r() * 2); const c = hex(cols[Math.floor(r() * cols.length)]);
          for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = y0 + (6 - h); y < y0 + 6; y++) set(xx, y, shade(c, xx === x ? 1.15 : 0.9));
          x += w;
        }
        for (let x2 = 0; x2 < S; x2++) set(x2, y0 + 6, hex('#9a6a3a'));
      }
      break;
    }
    case 'fireplace':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const mortar = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7;
        set(x, y, mortar ? hex('#c9c2b8') : shade(hex('#9c4a35'), 0.88 + r() * 0.2));
      }
      // Boca del hogar con arco, leños y fuego.
      for (let y = 5; y < 15; y++) for (let x = 3; x < 13; x++) {
        const arch = y < 7 && (x === 3 || x === 12 || (y === 5 && (x === 4 || x === 11)));
        if (arch) continue;
        const fire = y > 7 && y < 13 && Math.abs(x - 7.5) < 4 - (12 - y) * 0.4 + r();
        set(x, y, y >= 13 ? hex('#4a2f1a') : fire ? (y < 10 ? hex('#ffd34d') : hex('#ff8a1e')) : hex('#1a1210'));
      }
      break;
    case 'carpet':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const border = x < 2 || y < 2 || x > 13 || y > 13;
        const diamond = Math.abs(x - 7.5) + Math.abs(y - 7.5) < 4.5;
        set(x, y, border ? hex('#d8b14a') : diamond ? hex('#2f4fb8') : shade(hex('#8f2b26'), 0.92 + r() * 0.12));
      }
      break;
    case 'barrel_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const hoop = y === 2 || y === 3 || y === 12 || y === 13;
        set(x, y, hoop ? shade(hex('#5c6068'), 0.9 + r() * 0.2) : shade(hex('#8a5a33'), (x % 4 === 0 ? 0.72 : 1) * (0.9 + r() * 0.15)));
      }
      break;
    case 'barrel_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 7.5, y - 7.5); set(x, y, d > 7 ? hex('#5c6068') : shade(hex('#a87442'), (Math.floor(d) % 3 === 0 ? 0.8 : 1) * (0.92 + r() * 0.1))); }
      break;
    case 'hay_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (y === 4 || y === 11) ? hex('#8f2b26') : shade(hex('#d8b14a'), (x % 2 ? 0.88 : 1.05) * (0.9 + r() * 0.15)));
      break;
    case 'hay_top':
      noise(hex('#c9a040'), 0.2); for (let k = 0; k < 20; k++) set(Math.floor(r() * S), Math.floor(r() * S), hex('#e8c75a'));
      for (let x = 0; x < S; x++) { set(x, 4, hex('#8f2b26')); set(x, 11, hex('#8f2b26')); }
      break;
    case 'anvil': noise(hex('#3e4248'), 0.2); for (let x = 0; x < S; x++) set(x, 0, hex('#8b9098')); break;
    case 'throne':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x < 2 || x > 13 || y < 2;
        set(x, y, edge ? shade(hex('#e8c040'), 0.9 + r() * 0.2) : shade(hex('#8f1e3a'), (x + y) % 5 === 0 ? 0.85 : 1));
      }
      break;
    case 'flower_red': case 'flower_yellow': {
      const petal = name === 'flower_red' ? hex('#d8352b') : hex('#f2e04c'); const core = name === 'flower_red' ? hex('#26232a') : hex('#d88a1e');
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      for (const [cx, cy] of [[4, 5], [11, 3], [8, 9]]) {
        for (let y = cy + 2; y < S; y++) set(cx, y, hex('#4f8a2c'));
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, 1]]) set(cx + dx, cy + dy, petal);
        set(cx, cy, core);
      }
      break;
    }
    case 'pine_leaves':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = r(); set(x, y, shade(hex('#2f5a3a'), 0.7 + v * 0.5 + ((x + y) % 4 === 0 ? 0.15 : 0)), v < 0.12 ? 0 : 255); }
      break;
    case 'palm_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, shade(hex('#a8864e'), (y % 4 === 0 ? 0.7 : y % 4 === 1 ? 1.1 : 1) * (0.92 + r() * 0.12)));
      break;
    case 'palm_top': for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 7.5, y - 7.5); set(x, y, d > 6.5 ? hex('#7a5a30') : shade(hex('#c9a46a'), Math.floor(d) % 2 ? 0.86 : 1)); } break;
    case 'palm_leaves':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const stripe = (x + y) % 3 === 0; const v = r(); set(x, y, shade(hex('#5fa339'), stripe ? 1.25 : 0.8 + v * 0.3), v < 0.1 ? 0 : 255); }
      break;
    case 'tall_grass': case 'dead_bush': case 'berry_bush': case 'kelp': case 'seagrass': case 'coral_fan': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [0, 0, 0], 0);
      const col = { tall_grass: '#6fb043', dead_bush: '#8a6a3a', berry_bush: '#3f7a2c', kelp: '#3f8a4a', seagrass: '#4fa05a', coral_fan: '#e86aa8' }[name];
      if (name === 'kelp') { for (let y = 0; y < S; y++) { const x = 7 + Math.round(Math.sin(y * 0.7) * 2); set(x, y, shade(hex(col), 0.9 + r() * 0.2)); set(x + 1, y, shade(hex(col), 0.75)); if (y % 4 === 1) { set(x + 2, y, hex('#6fb043')); set(x + 3, y + 1, hex('#6fb043')); } } break; }
      if (name === 'coral_fan') { for (let k = 0; k < 5; k++) { let x = 7.5; let y = 15; const a = -1.2 + k * 0.6; for (let i = 0; i < 12; i++) { x += Math.sin(a) * 0.6; y -= 1; set(Math.round(x), Math.round(y), shade(hex(col), 0.8 + r() * 0.4)); } } break; }
      for (let k = 0; k < (name === 'berry_bush' ? 9 : 7); k++) {
        let x = 2 + r() * 12; const top = name === 'dead_bush' ? 5 + r() * 6 : 2 + r() * 8; const lean = (r() - 0.5) * 0.4;
        for (let y = 15; y > top; y--) { set(Math.round(x), y, shade(hex(col), 0.8 + r() * 0.4)); x += lean; }
      }
      if (name === 'berry_bush') for (let k = 0; k < 7; k++) { const x = 2 + Math.floor(r() * 12); const y = 3 + Math.floor(r() * 9); set(x, y, hex('#d8352b')); set(x + 1, y, hex('#a01e16')); set(x, y - 1, hex('#ff8a7a')); }
      break;
    }
    case 'coral_red': case 'coral_yellow': case 'coral_purple': {
      const base = hex({ coral_red: '#d8463a', coral_yellow: '#f2c94c', coral_purple: '#9a4de0' }[name]);
      noise(base, 0.2);
      for (let k = 0; k < 14; k++) { const x = Math.floor(r() * S); const y = Math.floor(r() * S); set(x, y, shade(base, 1.35)); set((x + 1) % S, y, shade(base, 0.6)); }
      break;
    }
    default: noise(hex('#ff00ff'), 0);
  }
}

// Canvas con todas las texturas (también se usa para dibujar los íconos del inventario).
export function buildAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * S;
  canvas.height = ATLAS_ROWS * S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  NAMES.forEach((name, i) => {
    const img = ctx.createImageData(S, S);
    paint(name, img.data);
    ctx.putImageData(img, (i % COLS) * S, Math.floor(i / COLS) * S);
  });
  return canvas;
}

export function buildAtlasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Coordenadas UV de una textura del atlas (con un pequeño margen para evitar sangrado).
export function uvRect(name) {
  const i = TEX_INDEX[name] ?? 0;
  const e = 0.001;
  const u0 = (i % COLS) / COLS + e;
  const v1 = 1 - Math.floor(i / COLS) / ATLAS_ROWS - e;
  return [u0, v1 - 1 / ATLAS_ROWS + 2 * e, u0 + 1 / COLS - 2 * e, v1];
}

// Ícono isométrico de un bloque (para la barra rápida y el inventario).
export function blockIcon(atlas, id, size = 48) {
  const b = BLOCKS[id];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Muebles: dibujo con su forma real.
  const fg = drawFurniture(id, B);
  if (fg) { const k = size / ICON_N; for (let y = 0; y < ICON_N; y++) for (let x = 0; x < ICON_N; x++) { const col = fg[y * ICON_N + x]; if (col) { ctx.fillStyle = col; ctx.fillRect(Math.floor(x * k), Math.floor(y * k), Math.ceil(k), Math.ceil(k)); } } return c.toDataURL(); }
  if (b.shape === 'torch' || b.shape === 'crop' || b.shape === 'door' || b.shape === 'door_open') {
    const i = TEX_INDEX[b.tex[1]];
    ctx.drawImage(atlas, (i % COLS) * S, Math.floor(i / COLS) * S, S, S, 0, 0, size, size);
    return c.toDataURL();
  }
  const src = (name) => { const i = TEX_INDEX[name]; return [(i % COLS) * S, Math.floor(i / COLS) * S]; };
  const h = size / 2;
  const q = size / 4;
  // Cara superior
  const [tx, ty] = src(b.tex[0]);
  ctx.save(); ctx.setTransform(h / S, q / S, -h / S, q / S, h, 0); ctx.drawImage(atlas, tx, ty, S, S, 0, 0, S, S); ctx.restore();
  // Cara izquierda
  const [sx, sy] = src(b.tex[1]);
  ctx.save(); ctx.setTransform(h / S, q / S, 0, h / S, 0, q); ctx.drawImage(atlas, sx, sy, S, S, 0, 0, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, S, S); ctx.restore();
  // Cara derecha
  ctx.save(); ctx.setTransform(h / S, -q / S, 0, h / S, h, h); ctx.drawImage(atlas, sx, sy, S, S, 0, 0, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, S, S); ctx.restore();
  return c.toDataURL();
}
