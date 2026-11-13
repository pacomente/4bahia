import { B } from './blocks.js';
import { I } from './items.js';

// Taller: recetas de un clic (sin grilla). `in` se consume y `out` se agrega al inventario.
// - `cat`: categoría para las pestañas del Taller.
// - `mesa: true`: necesita una Mesa de trabajo cerca (las básicas se hacen a mano).
// - `special`: mejora que no es un ítem (corazón extra). `once`: se fabrica una sola vez.
export const CATEGORIES = [
  { id: 'all', name: 'Todo' },
  { id: 'basic', name: 'Básico' },
  { id: 'tools', name: 'Herramientas' },
  { id: 'weapons', name: 'Armas' },
  { id: 'light', name: 'Luz' },
  { id: 'build', name: 'Construcción' },
  { id: 'special', name: 'Especial' },
];

const tool = (id, name, out, ins, cat, desc) => ({ id, name, in: ins, out: { [out]: 1 }, cat, mesa: true, desc });

export const RECIPES = [
  { id: 'planks', name: 'Tablas', in: { [B.LOG]: 1 }, out: { [B.PLANKS]: 4 }, alt: { [B.BIRCH_LOG]: 1 }, cat: 'basic', desc: 'La base de casi todo. Sirven tanto el roble como el abedul.' },
  { id: 'bench', name: 'Mesa de trabajo', in: { [B.PLANKS]: 4 }, out: { [B.WORKBENCH]: 1 }, cat: 'basic', desc: 'Colocala y hacé clic derecho sobre ella: desbloquea herramientas, armas y mejoras.' },
  { id: 'torch', name: 'Antorchas', in: { [I.COAL]: 1, [B.PLANKS]: 1 }, out: { [B.TORCH]: 4 }, cat: 'light', desc: 'Luz barata para cuevas y refugios. Las Sombras no se acercan.' },

  tool('pick_wood', 'Pico de madera', I.PICK_WOOD, { [B.PLANKS]: 3 }, 'tools', 'Rompe piedra y minerales el doble de rápido.'),
  tool('axe_wood', 'Hacha de madera', I.AXE_WOOD, { [B.PLANKS]: 3 }, 'tools', 'Para troncos, tablas y madera.'),
  tool('shovel_wood', 'Pala de madera', I.SHOVEL_WOOD, { [B.PLANKS]: 2 }, 'tools', 'Para tierra, arena, grava y nieve.'),
  tool('sword_wood', 'Espada de madera', I.SWORD_WOOD, { [B.PLANKS]: 2 }, 'weapons', 'Pega más fuerte que cualquier herramienta del mismo nivel.'),
  tool('pick_stone', 'Pico de piedra', I.PICK_STONE, { [B.COBBLE]: 3, [B.PLANKS]: 2 }, 'tools', 'Más rápido y dura más del doble que el de madera.'),
  tool('axe_stone', 'Hacha de piedra', I.AXE_STONE, { [B.COBBLE]: 3, [B.PLANKS]: 2 }, 'tools', 'Tala árboles en un momento.'),
  tool('shovel_stone', 'Pala de piedra', I.SHOVEL_STONE, { [B.COBBLE]: 1, [B.PLANKS]: 2 }, 'tools', 'Cava rápido y dura más.'),
  tool('sword_stone', 'Espada de piedra', I.SWORD_STONE, { [B.COBBLE]: 2, [B.PLANKS]: 1 }, 'weapons', 'Dos golpes y una Sombra se disuelve.'),
  tool('pick_iron', 'Pico de hierro', I.PICK_IRON, { [I.IRON]: 3, [B.PLANKS]: 2 }, 'tools', 'Para minar en serio.'),
  tool('axe_iron', 'Hacha de hierro', I.AXE_IRON, { [I.IRON]: 3, [B.PLANKS]: 2 }, 'tools', 'Corta cualquier madera casi al instante.'),
  tool('shovel_iron', 'Pala de hierro', I.SHOVEL_IRON, { [I.IRON]: 1, [B.PLANKS]: 2 }, 'tools', 'Mueve montañas de tierra.'),
  tool('sword_iron', 'Espada de hierro', I.SWORD_IRON, { [I.IRON]: 2, [B.PLANKS]: 1 }, 'weapons', 'Para las noches más largas.'),
  tool('pick_crystal', 'Pico de cristal', I.PICK_CRYSTAL, { [I.CRYSTAL]: 3, [I.ESSENCE]: 1, [B.PLANKS]: 2 }, 'tools', 'El más rápido de todos y brilla en tu mano.'),
  tool('axe_crystal', 'Hacha de cristal', I.AXE_CRYSTAL, { [I.CRYSTAL]: 3, [I.ESSENCE]: 1, [B.PLANKS]: 2 }, 'tools', 'Brilla en la oscuridad y casi no se gasta.'),
  tool('shovel_crystal', 'Pala de cristal', I.SHOVEL_CRYSTAL, { [I.CRYSTAL]: 1, [I.ESSENCE]: 1, [B.PLANKS]: 2 }, 'tools', 'Cava como si nada.'),
  tool('sword_crystal', 'Espada de cristal', I.SWORD_CRYSTAL, { [I.CRYSTAL]: 2, [I.ESSENCE]: 2, [B.PLANKS]: 1 }, 'weapons', 'Hecha con la esencia de las propias Sombras.'),

  { id: 'bow', name: 'Arco', in: { [B.PLANKS]: 3, [B.WOOL_WHITE]: 2 }, out: { [I.BOW]: 1 }, cat: 'weapons', mesa: true, desc: 'Clic derecho dispara flechas. Ideal para zombis que vienen en grupo.' },
  { id: 'arrows', name: 'Flechas', in: { [B.PLANKS]: 1, [B.COBBLE]: 1 }, out: { [I.ARROW]: 6 }, cat: 'weapons', mesa: true, desc: 'Munición para el arco. Las que se clavan en bloques se pueden juntar.' },
  { id: 'shield', name: 'Escudo', in: { [B.PLANKS]: 4, [I.IRON]: 1 }, out: { [I.SHIELD]: 1 }, cat: 'weapons', mesa: true, desc: 'Con el escudo en la mano los golpes te sacan 60% menos.' },
  { id: 'glass', name: 'Vidrio', in: { [B.SAND]: 2, [I.COAL]: 1 }, out: { [B.GLASS]: 2 }, cat: 'build', mesa: true, desc: 'Ventanas transparentes.' },
  { id: 'brick', name: 'Ladrillo', in: { [B.CLAY]: 2, [I.COAL]: 1 }, out: { [B.BRICK]: 4 }, cat: 'build', mesa: true, desc: 'Arcilla cocida, firme y prolija.' },
  { id: 'lamp', name: 'Lámpara', in: { [B.GLASS]: 1, [I.COAL]: 2 }, out: { [B.LAMP]: 2 }, cat: 'light', mesa: true, desc: 'Ilumina más que una antorcha y es un bloque sólido.' },
  { id: 'faro', name: 'Faro', in: { [I.CRYSTAL]: 3, [B.COBBLE]: 4 }, out: { [B.FARO]: 1 }, cat: 'special', mesa: true, desc: 'Tu punto de reaparición. Proyecta un haz de luz visible desde lejos.' },
  { id: 'glider', name: 'Planeador', in: { [I.CRYSTAL]: 4, [I.ESSENCE]: 2, [B.PLANKS]: 4 }, out: { [I.GLIDER]: 1 }, once: true, cat: 'special', mesa: true, desc: 'Mantené Espacio en el aire para planear. Sin daño por caída.' },
  { id: 'heart', name: 'Corazón extra', in: { [I.CRYSTAL]: 3, [I.ESSENCE]: 3 }, out: {}, special: 'heart', cat: 'special', mesa: true, desc: 'Sube tu vida máxima en un corazón (hasta 15).' },
];

const has = (inv, req) => Object.entries(req).every(([id, n]) => (inv[id] ?? 0) >= n);

// Devuelve los ingredientes a usar (la receta base o su alternativa) o null si no alcanza.
export function ingredientsFor(recipe, inventory) {
  if (has(inventory, recipe.in)) return recipe.in;
  if (recipe.alt && has(inventory, recipe.alt)) return recipe.alt;
  return null;
}

// state: { maxHealth, nearBench }. nearBench: hay una Mesa de trabajo cerca.
export function canCraft(recipe, inventory, state = {}) {
  if (recipe.mesa && state.nearBench === false) return false;
  if (recipe.once && (inventory[Object.keys(recipe.out)[0]] ?? 0) > 0) return false;
  if (recipe.special === 'heart' && (state.maxHealth ?? 20) >= 30) return false;
  return !!ingredientsFor(recipe, inventory);
}

// Cuántas veces seguidas se puede fabricar (para "Fabricar todo").
export function craftableTimes(recipe, inventory, state = {}) {
  if (!canCraft(recipe, inventory, state)) return 0;
  if (recipe.once || recipe.special) return 1;
  const use = ingredientsFor(recipe, inventory);
  return Math.min(...Object.entries(use).map(([id, n]) => Math.floor((inventory[id] ?? 0) / n)));
}

// Aplica la receta sobre el inventario (lo modifica). Devuelve lo producido o null.
export function craft(recipe, inventory, state = {}) {
  if (!canCraft(recipe, inventory, state)) return null;
  const use = ingredientsFor(recipe, inventory);
  for (const [id, n] of Object.entries(use)) {
    inventory[id] -= n;
    if (inventory[id] <= 0) delete inventory[id];
  }
  for (const [id, n] of Object.entries(recipe.out)) inventory[id] = (inventory[id] ?? 0) + n;
  return { out: recipe.out, special: recipe.special ?? null };
}
