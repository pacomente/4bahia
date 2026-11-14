import { B } from './blocks.js';
import { I } from './items.js';

// Cultivos: qué crece en qué, qué se planta con qué y qué se cosecha.
export const GROW = { [B.WHEAT_YOUNG]: B.WHEAT_RIPE, [B.CARROT_YOUNG]: B.CARROT_RIPE, [B.POTATO_YOUNG]: B.POTATO_RIPE };
export const RIPE = new Set(Object.values(GROW));
export const REPLANT = Object.fromEntries(Object.entries(GROW).map(([y, r]) => [r, Number(y)]));
export const PLANT = { [I.SEEDS]: B.WHEAT_YOUNG, [I.CARROT]: B.CARROT_YOUNG, [I.POTATO]: B.POTATO_YOUNG, [I.PUMPKIN_SEEDS]: B.PUMPKIN_STEM };
export const CROP_BLOCKS = new Set([...Object.keys(GROW).map(Number), ...RIPE, B.PUMPKIN_STEM]);
// Lo que da de más cada cosecha madura (además de lo que suelta el bloque).
export function harvest(id, r = Math.random) {
  if (id === B.WHEAT_RIPE) return { [I.SEEDS]: 1 + Math.floor(r() * 2) };
  if (id === B.CARROT_RIPE) return { [I.CARROT]: 1 + Math.floor(r() * 2) };
  if (id === B.POTATO_RIPE) return { [I.POTATO]: 1 + Math.floor(r() * 2) };
  return null;
}
// Cultivo de cada campo de las aldeas (fijo por posición).
export const FIELD_CROPS = [B.WHEAT_YOUNG, B.CARROT_YOUNG, B.POTATO_YOUNG];
