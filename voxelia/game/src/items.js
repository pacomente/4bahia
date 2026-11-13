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

// Usos máximos de una herramienta (null si no se gasta).
export const maxUses = (id) => (ITEMS[id]?.kind === 'tool' ? ITEMS[id].uses : null);

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
