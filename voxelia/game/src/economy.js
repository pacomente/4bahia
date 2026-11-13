import { B } from './blocks.js';
import { I } from './items.js';

// ───────── Economía de las aldeas ─────────
// Moneda: monedas de plata. Cada oficio vende cosas propias y compra lo que necesita.
// Precio de compra (lo que pagás) y de venta (lo que te pagan, siempre menos).
export const PRICE = {
  [I.BREAD]: 3, [I.APPLE]: 2, [I.CAKE]: 9, [I.WHEAT]: 1, [I.SEEDS]: 1,
  [B.TORCH]: 1, [B.BED]: 8, [B.DOOR]: 6, [B.WINDOW]: 3, [B.ROOF]: 1, [B.THATCH]: 1, [B.ADOBE]: 1, [B.BRICK]: 1, [B.GLASS]: 1, [B.LAMP]: 4,
  [B.WOOL_WHITE]: 2, [B.WOOL_RED]: 3, [B.WOOL_BLUE]: 3, [B.PLANKS]: 1, [B.LOG]: 2, [B.COBBLE]: 1,
  [I.COAL]: 2, [I.IRON]: 6, [I.CRYSTAL]: 10, [I.ESSENCE]: 8, [I.ARROW]: 1,
  [I.BOW]: 14, [I.SHIELD]: 18, [I.SWORD_IRON]: 26, [I.PICK_IRON]: 24, [I.AXE_IRON]: 24, [I.SHOVEL_IRON]: 14,
  [I.HELMET_CLOTH]: 8, [I.CHEST_CLOTH]: 12, [I.LEGS_CLOTH]: 10, [I.BOOTS_CLOTH]: 6,
  [I.HELMET_IRON]: 24, [I.CHEST_IRON]: 40, [I.LEGS_IRON]: 34, [I.BOOTS_IRON]: 20,
  [I.HELMET_CRYSTAL]: 60, [I.CHEST_CRYSTAL]: 95, [I.LEGS_CRYSTAL]: 80, [I.BOOTS_CRYSTAL]: 50,
};
export const sellPrice = (id) => Math.max(1, Math.floor((PRICE[id] ?? 1) * 0.5));

// Qué vende y qué compra cada oficio. `level`: nivel de aldea necesario (1 Aldea, 2 Pueblo, 3 Ciudad).
// `n`: cuántas unidades vienen por compra.
export const SHOPS = {
  farmer: { sells: [{ id: I.BREAD, n: 1 }, { id: I.APPLE, n: 2 }, { id: I.SEEDS, n: 4 }, { id: I.CAKE, n: 1, level: 2 }], buys: [I.WHEAT, I.APPLE, B.WOOL_WHITE] },
  builder: { sells: [{ id: B.DOOR, n: 1 }, { id: B.WINDOW, n: 2 }, { id: B.BED, n: 1 }, { id: B.ROOF, n: 8 }, { id: B.THATCH, n: 8 }, { id: B.ADOBE, n: 8 }], buys: [B.LOG, B.PLANKS, B.COBBLE] },
  guard: { sells: [{ id: I.ARROW, n: 8 }, { id: I.BOW, n: 1 }, { id: I.SHIELD, n: 1 }, { id: I.HELMET_CLOTH, n: 1 }, { id: I.CHEST_CLOTH, n: 1 }], buys: [I.ESSENCE] },
  smith: { sells: [{ id: I.HELMET_IRON, n: 1, level: 2 }, { id: I.CHEST_IRON, n: 1, level: 2 }, { id: I.LEGS_IRON, n: 1, level: 2 }, { id: I.BOOTS_IRON, n: 1, level: 2 }, { id: I.SWORD_IRON, n: 1 }, { id: I.PICK_IRON, n: 1 }, { id: I.CHEST_CRYSTAL, n: 1, level: 3 }], buys: [I.IRON, I.COAL] },
  merchant: { sells: [{ id: I.CRYSTAL, n: 1 }, { id: B.LAMP, n: 2 }, { id: B.WOOL_RED, n: 4 }, { id: B.WOOL_BLUE, n: 4 }, { id: I.CAKE, n: 1 }, { id: I.HELMET_CRYSTAL, n: 1, level: 3 }], buys: [I.CRYSTAL, I.ESSENCE, I.COAL, I.IRON] },
  woodcutter: { sells: [{ id: B.LOG, n: 4 }, { id: B.PLANKS, n: 8 }, { id: B.TORCH, n: 6 }], buys: [I.APPLE, I.BREAD] },
  king: { sells: [], buys: [] },
};

// Nivel de la aldea según casas, mercado y castillo.
export const LEVELS = [null, { name: 'Aldea' }, { name: 'Pueblo' }, { name: 'Ciudad' }];
export function villageLevel(houses, hasCastle) {
  if (houses >= 8 && hasCastle) return 3;
  if (houses >= 6) return 2;
  return 1;
}

// Rangos del jugador según el honor ganado con los encargos del rey.
export const RANKS = [
  { honor: 0, name: 'Plebeyo' }, { honor: 2, name: 'Escudero' }, { honor: 5, name: 'Caballero' }, { honor: 9, name: 'Noble' }, { honor: 14, name: 'Héroe del reino' },
];
export const rankFor = (honor) => [...RANKS].reverse().find((r) => honor >= r.honor);

// Encargos del rey (o del jefe): entregar cosas, matar zombis o dejar luz en la plaza.
export function makeQuest(r, level) {
  const kinds = [
    { kind: 'deliver', id: I.BREAD, n: 4 + level * 2, text: (n) => `Traeme ${n} panes para el banquete.` },
    { kind: 'deliver', id: B.COBBLE, n: 24 + level * 8, text: (n) => `Necesitamos ${n} adoquines para la muralla.` },
    { kind: 'deliver', id: B.WOOL_WHITE, n: 6 + level * 2, text: (n) => `Traeme ${n} de lana para los estandartes.` },
    { kind: 'deliver', id: I.APPLE, n: 4 + level * 2, text: (n) => `Quiero ${n} manzanas frescas.` },
    { kind: 'deliver', id: I.IRON, n: 3 + level, text: (n) => `El herrero necesita ${n} lingotes de hierro.` },
    { kind: 'zombies', n: 2 + level, text: (n) => `Esta noche, eliminá ${n} zombis cerca de la aldea.` },
  ];
  const k = kinds[Math.floor(r() * kinds.length)];
  return { ...k, text: k.text(k.n), progress: 0, reward: 10 + level * 8 + Math.floor(r() * 6) };
}
