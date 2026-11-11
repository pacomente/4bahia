// Ítems que no son bloques: materiales, herramientas y mejoras. Sus ids empiezan en 100.
export const I = {
  COAL: 101, IRON: 102, CRYSTAL: 103, ESSENCE: 104,
  PICK_WOOD: 110, PICK_STONE: 111, PICK_IRON: 112,
  AXE_WOOD: 113, AXE_STONE: 114, AXE_IRON: 115,
  SHOVEL_WOOD: 116, SHOVEL_STONE: 117, SHOVEL_IRON: 118,
  GLIDER: 120,
};

const TIERS = { wood: { name: 'madera', speed: 2, damage: 3, color: '#b5874f' }, stone: { name: 'piedra', speed: 3.5, damage: 4, color: '#8b8b8b' }, iron: { name: 'hierro', speed: 5.5, damage: 5, color: '#e3e3e3' } };

export const ITEMS = {
  [I.COAL]: { name: 'Carbón', kind: 'material', color: '#262626' },
  [I.IRON]: { name: 'Lingote de hierro', kind: 'material', color: '#d8d8d8' },
  [I.CRYSTAL]: { name: 'Cristal', kind: 'material', color: '#5ff2e6' },
  [I.ESSENCE]: { name: 'Esencia de sombra', kind: 'material', color: '#8a4dff' },
  [I.GLIDER]: { name: 'Planeador', kind: 'gear', color: '#5ff2e6', description: 'Mantené Espacio en el aire para planear. Sin daño por caída.' },
};
for (const [type, label, ids] of [['pick', 'Pico', [I.PICK_WOOD, I.PICK_STONE, I.PICK_IRON]], ['axe', 'Hacha', [I.AXE_WOOD, I.AXE_STONE, I.AXE_IRON]], ['shovel', 'Pala', [I.SHOVEL_WOOD, I.SHOVEL_STONE, I.SHOVEL_IRON]]]) {
  ['wood', 'stone', 'iron'].forEach((tier, i) => {
    ITEMS[ids[i]] = { name: `${label} de ${TIERS[tier].name}`, kind: 'tool', tool: type, tier, speed: TIERS[tier].speed, damage: TIERS[tier].damage, color: TIERS[tier].color };
  });
}

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
export function itemIcon(id, size = 48) {
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
  return c.toDataURL();
}
