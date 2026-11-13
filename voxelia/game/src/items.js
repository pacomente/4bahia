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
  const it = ITEMS[id];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const px = size / 16;
  const dot = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x * px), Math.round(y * px), Math.ceil(px), Math.ceil(px)); };
  const handle = '#7a5230';
  if (it.kind === 'tool') {
    for (let i = 0; i < 9; i++) dot(4 + i * 0.85, 13 - i * 0.85, handle);           // mango diagonal
    if (it.tool === 'pick') { for (let i = 0; i < 9; i++) dot(4 + i, 3 + Math.abs(i - 4) * 0.5, it.color); dot(4, 4, it.color); dot(12, 4, it.color); }
    if (it.tool === 'axe') { for (let y = 2; y < 8; y++) for (let x = 9; x < 14 - (y > 5 ? 1 : 0); x++) dot(x, y, it.color); }
    if (it.tool === 'shovel') { for (let y = 1; y < 6; y++) for (let x = 10; x < 14; x++) dot(x, y, it.color); dot(11, 6, it.color); dot(12, 6, it.color); }
    if (it.tool === 'sword') {
      ctx.clearRect(0, 0, size, size);
      const edge = shadeHex(it.color, 0.7); const shine = shadeHex(it.color, 1.25);
      for (let i = 0; i < 9; i++) { dot(5 + i, 10 - i, it.color); dot(6 + i, 10 - i, edge); dot(5 + i, 9 - i, i % 3 ? shine : it.color); }   // hoja con filo y brillo
      dot(4, 10, '#4a3a2a'); dot(5, 11, '#4a3a2a'); dot(3, 9, '#4a3a2a'); dot(6, 12, '#4a3a2a');                                  // guarda
      dot(3, 12, handle); dot(2, 13, handle); dot(4, 11, handle); dot(1, 14, '#4a3a2a');                                          // mango
    }
  } else if (id === I.BOW) {
    // Arco curvo con su cuerda.
    const pts = [[11, 1], [12, 2], [13, 3], [13, 4], [14, 5], [14, 6], [14, 7], [14, 8], [14, 9], [14, 10], [13, 11], [13, 12], [12, 13], [11, 14]];
    for (const [x, y] of pts) { dot(x - 5, y, '#8a5a33'); dot(x - 6, y, '#6b4426'); }
    for (let y = 1; y < 15; y++) dot(4.2, y, '#e8e4d8');
  } else if (id === I.ARROW) {
    for (let i = 0; i < 9; i++) dot(4 + i, 12 - i, '#8a5a33');
    dot(12, 3, '#cfd4da'); dot(13, 2, '#cfd4da'); dot(12, 2, '#9aa0a8'); dot(13, 3, '#9aa0a8');
    dot(3, 12, '#f2efe6'); dot(4, 13, '#f2efe6'); dot(2, 12, '#f2efe6'); dot(3, 13, '#f2efe6');
  } else if (id === I.SHIELD) {
    for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) {
      const w = y > 9 ? 5 - (y - 9) : 5;
      if (Math.abs(x - 7.5) > w) continue;
      const rim = Math.abs(x - 7.5) > w - 1 || y === 2;
      dot(x, y, rim ? '#9aa0a8' : (x < 8) === (y < 8) ? '#8f2b26' : '#d8b45a');
    }
  } else if (it.kind === 'armor') {
    const c = it.color; const t = it.trim;
    const shapes = {
      head: (x, y) => y >= 3 && y <= 9 && x >= 3 && x <= 12 && !(y >= 7 && x >= 5 && x <= 10),
      chest: (x, y) => y >= 2 && y <= 13 && x >= 2 && x <= 13 && !(y <= 5 && x >= 6 && x <= 9) && !(y >= 7 && (x <= 3 || x >= 12)),
      legs: (x, y) => y >= 2 && y <= 14 && x >= 3 && x <= 12 && !(y >= 6 && x >= 7 && x <= 8),
      feet: (x, y) => y >= 8 && y <= 13 && ((x >= 1 && x <= 6) || (x >= 9 && x <= 14)) && !(y <= 9 && (x <= 2 || x >= 13)),
    };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!shapes[it.slot](x, y)) continue;
      const edge = !shapes[it.slot](x - 1, y) || !shapes[it.slot](x + 1, y) || !shapes[it.slot](x, y - 1) || !shapes[it.slot](x, y + 1);
      dot(x, y, edge ? t : (x + y) % 5 === 0 ? '#ffffff88' : c);
    }
  } else if (id === I.SILVER) {
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) { const d = (x - 7.5) ** 2 + (y - 7.5) ** 2; if (d < 25) dot(x, y, d > 16 ? '#8b8f96' : d < 4 ? '#ffffff' : '#d9dde3'); }
    dot(6, 6, '#f5f7fa'); dot(9, 9, '#a9aeb6');
  } else if (id === I.APPLE) {
    for (let y = 4; y < 14; y++) for (let x = 3; x < 13; x++) { const d = (x - 7.5) ** 2 + (y - 8.7) ** 2; if (d < 22) dot(x, y, d < 3 && x < 7 ? '#ff8a7a' : '#c8352b'); }
    dot(8, 2, '#5b3d22'); dot(8, 3, '#5b3d22'); dot(9, 2, '#4f9a2f'); dot(10, 2, '#4f9a2f');
  } else if (id === I.BREAD) {
    for (let y = 5; y < 12; y++) for (let x = 2; x < 14; x++) { const d = ((x - 7.5) / 6) ** 2 + ((y - 8.5) / 3.5) ** 2; if (d < 1) dot(x, y, d > 0.7 ? '#8a5a26' : y < 7 ? '#e0a95a' : '#c98a3e'); }
    for (const x of [5, 8, 11]) dot(x, 6, '#f2d39a');
  } else if (id === I.CAKE) {
    for (let y = 6; y < 13; y++) for (let x = 2; x < 14; x++) dot(x, y, y < 8 ? '#f7f2ea' : y === 10 ? '#d0457a' : '#e8c79a');
    for (const x of [4, 8, 12]) { dot(x, 5, '#c8352b'); dot(x, 4, '#ffffff'); }
  } else if (id === I.WHEAT) {
    for (let k = 0; k < 4; k++) { for (let y = 6; y < 15; y++) dot(5 + k * 2 - (y > 11 ? (k - 1.5) : 0), y, '#b89a3a'); for (let y = 2; y < 7; y++) dot(5 + k * 2, y, '#e8c75a'); }
  } else if (id === I.SEEDS) {
    for (const [x, y] of [[5, 6], [8, 5], [10, 8], [6, 9], [9, 11], [12, 6], [4, 11], [7, 12]]) { dot(x, y, '#7cab4a'); dot(x + 1, y, '#5f8a35'); }
  } else if (id === I.GLIDER) {
    for (let x = 1; x < 15; x++) { const h = 4 - Math.abs(x - 7.5) / 3; for (let y = 0; y < h; y++) dot(x, 5 + y + Math.abs(x - 7.5) / 3, x % 3 ? it.color : '#ffffff'); }
    dot(7.5, 9, handle); dot(7.5, 10, handle); dot(7.5, 11, handle);
  } else if (id === I.CRYSTAL) {
    const pts = [[8, 2], [7, 3], [9, 3], [6, 4], [10, 4], [6, 5], [10, 5], [6, 6], [10, 6], [6, 7], [10, 7], [6, 8], [10, 8], [7, 9], [9, 9], [8, 10], [5, 9], [11, 6], [4, 10], [12, 7]];
    for (let y = 3; y < 10; y++) for (let x = 7; x < 10; x++) dot(x, y, '#5ff2e6');
    for (const [x, y] of pts) dot(x, y, '#2bb3a8');
    dot(8, 4, '#e8fffd'); dot(8, 5, '#e8fffd');
  } else if (id === I.ESSENCE) {
    for (let y = 3; y < 13; y++) for (let x = 4; x < 12; x++) if ((x - 8) ** 2 + (y - 8) ** 2 < 18) dot(x, y, (x + y) % 3 ? '#8a4dff' : '#c7a6ff');
    dot(6, 7, '#ffffff'); dot(10, 7, '#ffffff');
  } else {
    for (let y = 5; y < 12; y++) for (let x = 4; x < 12; x++) dot(x, y, (x * 7 + y * 3) % 5 ? it.color : '#ffffff55');
  }
  return c;
}
