import { B } from './blocks.js';
import { I } from './items.js';

// Taller: recetas de un clic (sin grilla). `in` se consume, `out` se agrega al inventario.
// `special` = mejora que no es un ítem (corazón extra).
export const RECIPES = [
  { id: 'planks', name: 'Tablas', in: { [B.LOG]: 1 }, out: { [B.PLANKS]: 4 }, alt: { [B.BIRCH_LOG]: 1 } },
  { id: 'pick_wood', name: 'Pico de madera', in: { [B.PLANKS]: 3 }, out: { [I.PICK_WOOD]: 1 } },
  { id: 'axe_wood', name: 'Hacha de madera', in: { [B.PLANKS]: 3 }, out: { [I.AXE_WOOD]: 1 } },
  { id: 'shovel_wood', name: 'Pala de madera', in: { [B.PLANKS]: 2 }, out: { [I.SHOVEL_WOOD]: 1 } },
  { id: 'pick_stone', name: 'Pico de piedra', in: { [B.COBBLE]: 3, [B.PLANKS]: 2 }, out: { [I.PICK_STONE]: 1 } },
  { id: 'axe_stone', name: 'Hacha de piedra', in: { [B.COBBLE]: 3, [B.PLANKS]: 2 }, out: { [I.AXE_STONE]: 1 } },
  { id: 'shovel_stone', name: 'Pala de piedra', in: { [B.COBBLE]: 1, [B.PLANKS]: 2 }, out: { [I.SHOVEL_STONE]: 1 } },
  { id: 'pick_iron', name: 'Pico de hierro', in: { [I.IRON]: 3, [B.PLANKS]: 2 }, out: { [I.PICK_IRON]: 1 } },
  { id: 'axe_iron', name: 'Hacha de hierro', in: { [I.IRON]: 3, [B.PLANKS]: 2 }, out: { [I.AXE_IRON]: 1 } },
  { id: 'shovel_iron', name: 'Pala de hierro', in: { [I.IRON]: 1, [B.PLANKS]: 2 }, out: { [I.SHOVEL_IRON]: 1 } },
  { id: 'glass', name: 'Vidrio', in: { [B.SAND]: 2, [I.COAL]: 1 }, out: { [B.GLASS]: 2 } },
  { id: 'brick', name: 'Ladrillo', in: { [B.CLAY]: 2, [I.COAL]: 1 }, out: { [B.BRICK]: 4 } },
  { id: 'torch', name: 'Antorchas', in: { [I.COAL]: 1, [B.PLANKS]: 1 }, out: { [B.TORCH]: 4 } },
  { id: 'lamp', name: 'Lámpara', in: { [B.GLASS]: 1, [I.COAL]: 2 }, out: { [B.LAMP]: 2 } },
  { id: 'faro', name: 'Faro', in: { [I.CRYSTAL]: 3, [B.COBBLE]: 4 }, out: { [B.FARO]: 1 } },
  { id: 'glider', name: 'Planeador', in: { [I.CRYSTAL]: 4, [I.ESSENCE]: 2, [B.PLANKS]: 4 }, out: { [I.GLIDER]: 1 }, once: true },
  { id: 'heart', name: 'Corazón extra', in: { [I.CRYSTAL]: 3, [I.ESSENCE]: 3 }, out: {}, special: 'heart' },
];

const has = (inv, req) => Object.entries(req).every(([id, n]) => (inv[id] ?? 0) >= n);

// Devuelve los ingredientes a usar (la receta base o su alternativa) o null si no alcanza.
export function ingredientsFor(recipe, inventory) {
  if (has(inventory, recipe.in)) return recipe.in;
  if (recipe.alt && has(inventory, recipe.alt)) return recipe.alt;
  return null;
}

export function canCraft(recipe, inventory, state = {}) {
  if (recipe.once && (inventory[Object.keys(recipe.out)[0]] ?? 0) > 0) return false;
  if (recipe.special === 'heart' && (state.maxHealth ?? 20) >= 30) return false;
  return !!ingredientsFor(recipe, inventory);
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
