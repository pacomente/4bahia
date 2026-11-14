import { drawItem, N } from './icons.js';
// Ítems que no son bloques: materiales, herramientas y mejoras. Sus ids empiezan en 100.
export const I = {
  COAL: 101, IRON: 102, CRYSTAL: 103, ESSENCE: 104,
  PICK_WOOD: 110, PICK_STONE: 111, PICK_IRON: 112,
  AXE_WOOD: 113, AXE_STONE: 114, AXE_IRON: 115,
  SHOVEL_WOOD: 116, SHOVEL_STONE: 117, SHOVEL_IRON: 118,
  GLIDER: 120,
  SWORD_WOOD: 121, SWORD_STONE: 122, SWORD_IRON: 123,
  PICK_CRYSTAL: 124, AXE_CRYSTAL: 125, SHOVEL_CRYSTAL: 126, SWORD_CRYSTAL: 127,
  BOW: 128, ARROW: 129, SHIELD: 130,
  SILVER: 131, APPLE: 132, BREAD: 133, WHEAT: 134, SEEDS: 135, CAKE: 136,
  HELMET_CLOTH: 140, CHEST_CLOTH: 141, LEGS_CLOTH: 142, BOOTS_CLOTH: 143,
  HELMET_IRON: 144, CHEST_IRON: 145, LEGS_IRON: 146, BOOTS_IRON: 147,
  HELMET_CRYSTAL: 148, CHEST_CRYSTAL: 149, LEGS_CRYSTAL: 150, BOOTS_CRYSTAL: 151,
  GOLD: 152, BERRIES: 153, FISH: 154, MEAT: 155, BOAT: 156, PEARL: 157,
};

// Niveles de herramienta: velocidad de minado, daño, usos antes de romperse y color.
// El cristal es propio de Voxelia: la herramienta más rápida y brilla en la mano.
const TIERS = {
  wood: { name: 'madera', speed: 2, damage: 3, uses: 60, color: '#b5874f' },
  stone: { name: 'piedra', speed: 3.5, damage: 4, uses: 140, color: '#8b8b8b' },
  iron: { name: 'hierro', speed: 5.5, damage: 5, uses: 300, color: '#e3e3e3' },
  crystal: { name: 'cristal', speed: 8, damage: 6, uses: 500, color: '#5ff2e6', glow: true },
};

export const ITEMS = {
  [I.COAL]: { name: 'Carbón', kind: 'material', color: '#262626' },
  [I.IRON]: { name: 'Lingote de hierro', kind: 'material', color: '#d8d8d8' },
  [I.CRYSTAL]: { name: 'Cristal', kind: 'material', color: '#5ff2e6' },
  [I.ESSENCE]: { name: 'Esencia de sombra', kind: 'material', color: '#8a4dff' },
  [I.GLIDER]: { name: 'Planeador', kind: 'gear', color: '#5ff2e6', description: 'Mantené Espacio en el aire para planear. Sin daño por caída.' },
};
for (const [type, label, ids] of [
  ['pick', 'Pico', [I.PICK_WOOD, I.PICK_STONE, I.PICK_IRON, I.PICK_CRYSTAL]],
  ['axe', 'Hacha', [I.AXE_WOOD, I.AXE_STONE, I.AXE_IRON, I.AXE_CRYSTAL]],
  ['shovel', 'Pala', [I.SHOVEL_WOOD, I.SHOVEL_STONE, I.SHOVEL_IRON, I.SHOVEL_CRYSTAL]],
  ['sword', 'Espada', [I.SWORD_WOOD, I.SWORD_STONE, I.SWORD_IRON, I.SWORD_CRYSTAL]],
]) {
  ['wood', 'stone', 'iron', 'crystal'].forEach((tier, i) => {
    const t = TIERS[tier];
    // La espada no mina más rápido pero pega bastante más fuerte.
    const damage = type === 'sword' ? t.damage + 2 : t.damage;
    ITEMS[ids[i]] = { name: `${label} de ${t.name}`, kind: 'tool', tool: type, tier, speed: t.speed, damage, uses: t.uses, color: t.color, glow: !!t.glow };
  });
}

// Arco (dispara flechas con clic derecho), flechas y escudo (en la mano, frena 60% del daño).
ITEMS[I.BOW] = { name: 'Arco', kind: 'tool', tool: 'bow', tier: 'wood', speed: 1, damage: 2, uses: 200, color: '#8a5a33', description: 'Clic derecho dispara una flecha.' };
ITEMS[I.ARROW] = { name: 'Flecha', kind: 'material', color: '#cfcfcf' };
ITEMS[I.SHIELD] = { name: 'Escudo', kind: 'gear', color: '#8f2b26', description: 'Llevalo en la mano: los golpes te sacan mucho menos.' };

// Moneda y comida. La comida cura corazones y devuelve energía (no hay hambre que te mate).
ITEMS[I.BERRIES] = { name: 'Bayas', kind: 'food', heal: 2, energy: 20, color: '#c8352b' };
ITEMS[I.FISH] = { name: 'Pescado', kind: 'food', heal: 4, energy: 30, color: '#7aa8c8' };
ITEMS[I.MEAT] = { name: 'Carne asada', kind: 'food', heal: 6, energy: 40, color: '#8a4a2a' };
ITEMS[I.BOAT] = { name: 'Bote', kind: 'gear', color: '#a87442', description: 'Clic derecho sobre el agua para ponerlo; clic derecho al bote para subir. W/S reman, A/D giran, Shift para bajar.' };
ITEMS[I.PEARL] = { name: 'Perla', kind: 'material', color: '#f4eef8', description: 'Se encuentra en los barcos hundidos. Vale mucho en los puertos.' };
ITEMS[I.GOLD] = { name: 'Lingote de oro', kind: 'material', color: '#f2c94c', description: 'Vale mucho en cualquier aldea.' };
ITEMS[I.SILVER] = { name: 'Moneda de plata', kind: 'material', color: '#d9dde3', description: 'La moneda de las aldeas: con ella se compra y se vende.' };
ITEMS[I.APPLE] = { name: 'Manzana', kind: 'food', heal: 3, energy: 25, color: '#c8352b' };
ITEMS[I.BREAD] = { name: 'Pan', kind: 'food', heal: 5, energy: 40, color: '#c98a3e' };
ITEMS[I.CAKE] = { name: 'Pastel', kind: 'food', heal: 10, energy: 100, color: '#f2d8c0' };
ITEMS[I.WHEAT] = { name: 'Trigo', kind: 'material', color: '#e0bf55' };
ITEMS[I.SEEDS] = { name: 'Semillas de trigo', kind: 'seed', color: '#7cab4a', description: 'Clic derecho sobre tierra arada para sembrar.' };

// Armadura: casco, pechera, pantalones y botas. Cada punto frena 4% del daño (máximo 80%).
export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];
export const SLOT_NAMES = { head: 'Cabeza', chest: 'Torso', legs: 'Piernas', feet: 'Pies', offhand: 'Mano izquierda' };
const ARMOR_TIERS = {
  cloth: { name: 'acolchado', fem: 'acolchada', color: '#e8e4d8', trim: '#b8352f', points: [1, 2, 2, 1], uses: 80 },
  iron: { name: 'de hierro', fem: 'de hierro', color: '#d8dadf', trim: '#8b8f96', points: [2, 5, 4, 2], uses: 220 },
  crystal: { name: 'de cristal', fem: 'de cristal', color: '#5ff2e6', trim: '#2bb3a8', points: [3, 7, 5, 3], uses: 420 },
};
const ARMOR_NAMES = [['Casco', false], ['Pechera', true], ['Pantalones', false], ['Botas', true]];
for (const [tier, base] of [['cloth', I.HELMET_CLOTH], ['iron', I.HELMET_IRON], ['crystal', I.HELMET_CRYSTAL]]) {
  const t = ARMOR_TIERS[tier];
  ARMOR_SLOTS.forEach((slot, i) => {
    const [label, fem] = ARMOR_NAMES[i];
    const plural = label === 'Pantalones' || label === 'Botas';
    const adj = (fem ? t.fem : t.name) + (plural && tier === 'cloth' ? 's' : '');
    ITEMS[base + i] = { name: `${label} ${adj}`, kind: 'armor', slot, tier, points: t.points[i], uses: t.uses, color: t.color, trim: t.trim };
  });
}
ITEMS[I.SHIELD].slot = 'offhand';
ITEMS[I.SHIELD].uses = 260;
ITEMS[I.SHIELD].description = 'Equipalo en la mano izquierda (E) y mantené clic derecho o V para cubrirte.';

// Puntos de armadura de lo que llevás puesto y cuánto daño frena.
export function armorPoints(equip) { return ARMOR_SLOTS.reduce((n, s) => n + (ITEMS[equip?.[s]]?.points ?? 0), 0); }
export const armorReduction = (points) => Math.min(0.8, points * 0.04);
export const isFood = (id) => ITEMS[id]?.kind === 'food';

// Usos máximos de una herramienta (null si no se gasta).
export const maxUses = (id) => (['tool', 'armor'].includes(ITEMS[id]?.kind) || id === I.SHIELD ? ITEMS[id].uses : null);

// Aclara u oscurece un color "#rrggbb".
function shadeHex(h, f) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''); }

export const isItem = (id) => id >= 100;
export const itemName = (id, BLOCKS) => (isItem(id) ? ITEMS[id]?.name : BLOCKS[id]?.name) ?? '?';

// Multiplicador de velocidad de minado según la herramienta en la mano.
export function mineSpeed(heldId, block) {
  const it = ITEMS[heldId];
  if (!it || it.kind !== 'tool' || !block.tool || it.tool !== block.tool) return 1;
  return it.speed;
}

export function attackDamage(heldId) {
  const it = ITEMS[heldId];
  return it?.kind === 'tool' ? it.damage : 2;
}

// Íconos pixel-art de los ítems (dibujados en una grilla de 16×16).
export function itemIcon(id, size = 48) { return itemCanvas(id, size).toDataURL(); }

export function itemCanvas(id, size = 48) {
  // Pixel-art de 32×32 (ver icons.js), escalado sin suavizar.
  const grid = drawItem(id, ITEMS[id], I);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const k = size / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const col = grid[y * N + x];
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(x * k), Math.floor(y * k), Math.ceil(k), Math.ceil(k));
  }
  return c;
}
