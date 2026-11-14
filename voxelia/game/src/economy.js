import { B } from './blocks.js';
import { I } from './items.js';

// ───────── Economía de las aldeas ─────────
// Moneda: monedas de plata. Cada oficio vende cosas propias y compra lo que necesita.
// Precio de compra (lo que pagás) y de venta (lo que te pagan, siempre menos).
export const PRICE = {
  [I.BREAD]: 3, [I.APPLE]: 2, [I.CAKE]: 9, [I.WHEAT]: 1, [I.SEEDS]: 1,
  [B.TORCH]: 1, [B.BED]: 8, [B.DOOR]: 6, [B.WINDOW]: 3, [B.ROOF]: 1, [B.THATCH]: 1, [B.ADOBE]: 1, [B.BRICK]: 1, [B.GLASS]: 1, [B.LAMP]: 4,
  [B.WOOL_WHITE]: 2, [B.WOOL_RED]: 3, [B.WOOL_BLUE]: 3, [B.PLANKS]: 1, [B.LOG]: 2, [B.COBBLE]: 1,
  [I.FISH]: 3, [I.MEAT]: 4, [I.BERRIES]: 1, [I.BOAT]: 10, [I.PEARL]: 14,
  [I.RAW_FISH]: 2, [I.SALMON]: 3, [I.RAW_MEAT]: 2, [I.CARROT]: 1, [I.POTATO]: 1, [I.BAKED_POTATO]: 2, [I.PUMPKIN_PIE]: 5, [I.STEW]: 8, [I.HONEY]: 4, [I.ROD]: 8, [I.GOLDEN_FISH]: 40, [I.OLD_BOOT]: 1, [I.PUMPKIN_SEEDS]: 2, [B.PUMPKIN]: 3,
  [I.COAL]: 2, [I.IRON]: 6, [I.GOLD]: 16, [B.WOOL_BLACK]: 3, [I.CRYSTAL]: 10, [I.ESSENCE]: 8, [I.ARROW]: 1,
  [I.BOW]: 14, [I.SHIELD]: 18, [I.SWORD_IRON]: 26, [I.PICK_IRON]: 24, [I.AXE_IRON]: 24, [I.SHOVEL_IRON]: 14,
  [I.HELMET_CLOTH]: 8, [I.CHEST_CLOTH]: 12, [I.LEGS_CLOTH]: 10, [I.BOOTS_CLOTH]: 6,
  [I.HELMET_IRON]: 24, [I.CHEST_IRON]: 40, [I.LEGS_IRON]: 34, [I.BOOTS_IRON]: 20,
  [I.HELMET_CRYSTAL]: 60, [I.CHEST_CRYSTAL]: 95, [I.LEGS_CRYSTAL]: 80, [I.BOOTS_CRYSTAL]: 50,
};
export const sellPrice = (id) => Math.max(1, Math.floor((PRICE[id] ?? 1) * 0.5));

// Qué vende y qué compra cada oficio. `level`: nivel de aldea necesario (1 Aldea, 2 Pueblo, 3 Ciudad).
// `n`: cuántas unidades vienen por compra.
export const SHOPS = {
  farmer: { sells: [{ id: I.BREAD, n: 1 }, { id: I.APPLE, n: 2 }, { id: I.SEEDS, n: 4 }, { id: I.CARROT, n: 3 }, { id: I.POTATO, n: 3 }, { id: I.PUMPKIN_SEEDS, n: 2 }, { id: I.HONEY, n: 1 }, { id: I.CAKE, n: 1, level: 2 }], buys: [I.WHEAT, I.APPLE, B.WOOL_WHITE, I.CARROT, I.POTATO, B.PUMPKIN, I.HONEY] },
  builder: { sells: [{ id: B.DOOR, n: 1 }, { id: B.WINDOW, n: 2 }, { id: B.BED, n: 1 }, { id: B.ROOF, n: 8 }, { id: B.THATCH, n: 8 }, { id: B.ADOBE, n: 8 }], buys: [B.LOG, B.PLANKS, B.COBBLE] },
  guard: { sells: [{ id: I.ARROW, n: 8 }, { id: I.BOW, n: 1 }, { id: I.SHIELD, n: 1 }, { id: I.HELMET_CLOTH, n: 1 }, { id: I.CHEST_CLOTH, n: 1 }], buys: [I.ESSENCE] },
  smith: { sells: [{ id: I.HELMET_IRON, n: 1, level: 2 }, { id: I.CHEST_IRON, n: 1, level: 2 }, { id: I.LEGS_IRON, n: 1, level: 2 }, { id: I.BOOTS_IRON, n: 1, level: 2 }, { id: I.SWORD_IRON, n: 1 }, { id: I.PICK_IRON, n: 1 }, { id: I.CHEST_CRYSTAL, n: 1, level: 3 }], buys: [I.IRON, I.COAL, I.GOLD] },
  merchant: { sells: [{ id: I.CRYSTAL, n: 1 }, { id: B.LAMP, n: 2 }, { id: B.WOOL_RED, n: 4 }, { id: B.WOOL_BLUE, n: 4 }, { id: I.CAKE, n: 1 }, { id: I.HELMET_CRYSTAL, n: 1, level: 3 }], buys: [I.CRYSTAL, I.ESSENCE, I.COAL, I.IRON, I.GOLD] },
  woodcutter: { sells: [{ id: B.LOG, n: 4 }, { id: B.PLANKS, n: 8 }, { id: B.TORCH, n: 6 }], buys: [I.APPLE, I.BREAD] },
  fisher: { sells: [{ id: I.FISH, n: 3 }, { id: I.ROD, n: 1 }, { id: I.BOAT, n: 1 }], buys: [I.RAW_FISH, I.SALMON, I.GOLDEN_FISH, I.BERRIES, I.WHEAT, I.BREAD] },
  sailor: { sells: [{ id: I.BOAT, n: 1 }, { id: I.PEARL, n: 1, level: 2 }, { id: I.CRYSTAL, n: 1 }, { id: B.LAMP, n: 2 }], buys: [I.FISH, I.PEARL, I.GOLD, B.LOG] },
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

// ───────── Economía local de cada aldea ─────────
// Cada bioma produce cosas distintas y le faltan otras: en el desierto la madera es cara, en la nieve
// la comida; los puertos tienen pescado barato y lo importado en barco. Las reservas también mueven
// los precios (si falta comida, sube), y cuando atraca un barco mercante lo importado baja un tiempo.
const CAT = {};
for (const id of [I.BREAD, I.APPLE, I.CAKE, I.WHEAT, I.FISH, I.MEAT, I.BERRIES, I.SEEDS, I.RAW_FISH, I.SALMON, I.RAW_MEAT, I.CARROT, I.POTATO, I.BAKED_POTATO, I.PUMPKIN_PIE, I.STEW, I.HONEY, B.PUMPKIN, I.PUMPKIN_SEEDS]) CAT[id] = 'food';
CAT[I.GOLDEN_FISH] = 'gems';
for (const id of [B.PLANKS, B.LOG, B.THATCH, B.DOOR, B.BED, B.TABLE, B.CHAIR, B.BARREL, I.BOAT, B.TORCH, B.WINDOW, I.ARROW, I.BOW]) CAT[id] = 'wood';
for (const id of [B.COBBLE, B.BRICK, B.ROOF, B.ADOBE, B.GLASS, B.LAMP]) CAT[id] = 'stone';
// Herramientas, armas, escudo y armaduras (sin pisar la comida ni la plata, que tienen ids en el medio).
for (const id of [...Array(18).keys()].map((k) => 110 + k).concat([130], [...Array(12).keys()].map((k) => 140 + k))) if (!CAT[id]) CAT[id] = 'metal';
CAT[I.IRON] = 'metal'; CAT[I.COAL] = 'stone';
for (const id of [B.WOOL_WHITE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_BLACK]) CAT[id] = 'wool';
for (const id of [I.CRYSTAL, I.ESSENCE, I.PEARL, I.GOLD]) CAT[id] = 'gems';
export const categoryOf = (id) => CAT[id] ?? 'misc';
const CAT_NAMES = { food: 'comida', wood: 'madera', stone: 'piedra', metal: 'metales', wool: 'lana', gems: 'gemas y oro' };

const STYLE_FACTOR = {
  medieval: { metal: 0.85, wool: 1.25 },
  rustic: { wood: 0.7, stone: 1.25, food: 0.9 },
  desert: { wood: 1.6, food: 1.3, gems: 0.8, stone: 0.85 },
  snow: { food: 1.45, wool: 0.75, wood: 0.85, metal: 1.15 },
};
const PORT_FACTOR = { food: 0.85, gems: 0.85, wood: 0.9 };

// Precio de una unidad en esta aldea (antes de redondear).
export function localPrice(id, plan, rec) {
  const base = PRICE[id] ?? 1;
  const cat = categoryOf(id);
  let f = STYLE_FACTOR[plan.style]?.[cat] ?? 1;
  if (plan.port) f *= PORT_FACTOR[cat] ?? 1;
  const st = rec?.stock;
  if (st) {
    if (cat === 'food') f *= st.food < 10 ? 1.35 : st.food > 40 ? 0.8 : 1;
    if (cat === 'wood') f *= st.wood < 6 ? 1.3 : st.wood > 30 ? 0.85 : 1;
    if (cat === 'stone') f *= st.stone < 6 ? 1.3 : st.stone > 30 ? 0.85 : 1;
  }
  if ((rec?.importDays ?? 0) > 0 && (cat === 'gems' || cat === 'metal' || cat === 'wool')) f *= 0.8;
  return base * f;
}

// ▲ caro / ▼ barato respecto del precio normal.
export function trend(id, plan, rec) {
  const ratio = localPrice(id, plan, rec) / (PRICE[id] ?? 1);
  return ratio > 1.12 ? 'up' : ratio < 0.88 ? 'down' : null;
}

// Resumen para el diálogo: qué produce la aldea y qué le falta.
export function economySummary(plan, rec) {
  const cheap = []; const dear = [];
  for (const cat of Object.keys(CAT_NAMES)) {
    const probe = Object.keys(CAT).map(Number).find((id) => CAT[id] === cat);
    const ratio = localPrice(probe, plan, rec) / (PRICE[probe] ?? 1);
    if (ratio < 0.9) cheap.push(CAT_NAMES[cat]); else if (ratio > 1.15) dear.push(CAT_NAMES[cat]);
  }
  return { cheap, dear, imports: (rec?.importDays ?? 0) > 0 };
}
