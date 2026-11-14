// Definición de bloques. `tex` indica la textura de cada cara: [arriba, costados, abajo].
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
  COBBLE: 9, GLASS: 10, SNOW: 11, BRICK: 12, COAL: 13, CACTUS: 14, BEDROCK: 15, GRAVEL: 16,
  IRON: 17, BIRCH_LOG: 18, BIRCH_LEAVES: 19, CLAY: 20, LAMP: 21, WOOL_RED: 22, WOOL_BLUE: 23, WOOL_WHITE: 24,
  CRYSTAL: 25, FARO: 26, TORCH: 27, WORKBENCH: 28, ROOF: 29, THATCH: 30, ADOBE: 31,
  FARMLAND: 32, WHEAT_YOUNG: 33, WHEAT_RIPE: 34, BED: 35, DOOR: 36, DOOR_OPEN: 37, WINDOW: 38,
  LAVA: 39, GLOW_MUSHROOM: 40, MOSS: 41, GOLD_ORE: 42, WOOL_BLACK: 43, BARS: 44, CAMPFIRE: 45, LOOT_CHEST: 46,
  TABLE: 47, CHAIR: 48, BOOKSHELF: 49, FIREPLACE: 50, CARPET: 51, BARREL: 52, HAY: 53, ANVIL: 54, THRONE: 55, FLOWER_RED: 56, FLOWER_YELLOW: 57,
  PINE_LEAVES: 58, PALM_LOG: 59, PALM_LEAVES: 60, TALL_GRASS: 61, BERRY_BUSH: 62, KELP: 63, SEAGRASS: 64,
  CORAL_RED: 65, CORAL_YELLOW: 66, CORAL_PURPLE: 67, CORAL_FAN: 68, DEAD_BUSH: 69,
  FENCE: 70, BELL: 71, PEW: 72, ALTAR: 73, BLACKBOARD: 74, STAINED_GLASS: 75, TROUGH: 76,
  CARROT_YOUNG: 77, CARROT_RIPE: 78, POTATO_YOUNG: 79, POTATO_RIPE: 80, PUMPKIN: 81, PUMPKIN_STEM: 82, BEEHIVE: 83, OVEN: 84, FRUIT_LEAVES: 85,
  MUD: 86, LILY_PAD: 87, VINES: 88, JUNGLE_LEAVES: 89, RED_SAND: 90, RED_ROCK: 91, ORANGE_ROCK: 92, RAIL: 93, MOSSY_COBBLE: 94, SANDSTONE: 95, CHISELED_SANDSTONE: 96,
};

export const BLOCKS = [];
function def(id, name, tex, opts = {}) {
  const t = Array.isArray(tex) ? tex : [tex, tex, tex];
  BLOCKS[id] = {
    id, name, tex: t.length === 2 ? [t[0], t[1], t[0]] : t,
    solid: opts.solid ?? true, transparent: opts.transparent ?? false, liquid: opts.liquid ?? false,
    alpha: opts.alpha ?? false, hardness: opts.hardness ?? 1, emissive: opts.emissive ?? false,
    drop: opts.drop ?? id, breakable: opts.breakable ?? true, sound: opts.sound ?? 'stone',
    tool: opts.tool ?? null,
    water: opts.water ?? false,   // agua o planta de agua (se nada adentro)   // herramienta que acelera el minado: 'pick' | 'axe' | 'shovel'
    shape: opts.shape ?? 'cube', // 'cube' | 'torch' (modelo fino)
    light: opts.light ?? 0,      // nivel de luz que emite (0-15)
  };
}

def(B.AIR, 'Aire', 'none', { solid: false, transparent: true, breakable: false });
def(B.GRASS, 'Pasto', ['grass_top', 'grass_side', 'dirt'], { hardness: 0.6, drop: B.DIRT, sound: 'grass', tool: 'shovel' });
def(B.DIRT, 'Tierra', 'dirt', { hardness: 0.5, sound: 'grass', tool: 'shovel' });
def(B.STONE, 'Piedra', 'stone', { hardness: 1.5, drop: B.COBBLE, tool: 'pick' });
def(B.SAND, 'Arena', 'sand', { hardness: 0.5, sound: 'sand', tool: 'shovel' });
def(B.WATER, 'Agua', 'water', { solid: false, transparent: true, liquid: true, breakable: false, water: true });
def(B.LOG, 'Tronco', ['log_top', 'log_side'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
def(B.LEAVES, 'Hojas', 'leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.PLANKS, 'Tablas', 'planks', { hardness: 1, sound: 'wood', tool: 'axe' });
def(B.COBBLE, 'Adoquín', 'cobble', { hardness: 1.8, tool: 'pick' });
def(B.GLASS, 'Vidrio', 'glass', { transparent: true, alpha: true, hardness: 0.3, sound: 'glass' });
def(B.SNOW, 'Nieve', ['snow', 'snow_side', 'dirt'], { hardness: 0.4, drop: B.DIRT, sound: 'sand', tool: 'shovel' });
def(B.BRICK, 'Ladrillo', 'brick', { hardness: 2, tool: 'pick' });
def(B.COAL, 'Mineral de carbón', 'coal', { hardness: 2.2, tool: 'pick', drop: 101 });
def(B.CACTUS, 'Cactus', ['cactus_top', 'cactus_side'], { hardness: 0.4, sound: 'grass' });
def(B.BEDROCK, 'Roca madre', 'bedrock', { breakable: false });
def(B.GRAVEL, 'Grava', 'gravel', { hardness: 0.6, sound: 'sand', tool: 'shovel' });
def(B.IRON, 'Mineral de hierro', 'iron', { hardness: 2.6, tool: 'pick', drop: 102 });
def(B.BIRCH_LOG, 'Tronco de abedul', ['birch_top', 'birch_side'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
def(B.BIRCH_LEAVES, 'Hojas de abedul', 'birch_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.CLAY, 'Arcilla', 'clay', { hardness: 0.6, sound: 'sand', tool: 'shovel' });
def(B.LAMP, 'Lámpara', 'lamp', { hardness: 0.5, emissive: true, sound: 'glass', light: 14 });
def(B.WOOL_RED, 'Lana roja', 'wool_red', { hardness: 0.4, sound: 'wool' });
def(B.WOOL_BLUE, 'Lana azul', 'wool_blue', { hardness: 0.4, sound: 'wool' });
def(B.WOOL_WHITE, 'Lana blanca', 'wool_white', { hardness: 0.4, sound: 'wool' });
// Propios de Voxelia: cristales luminosos de las cuevas profundas y el Faro de reaparición.
def(B.CRYSTAL, 'Cristal luminoso', 'crystal', { hardness: 2.4, emissive: true, sound: 'glass', tool: 'pick', drop: 103, light: 9 });
def(B.FARO, 'Faro', ['faro_top', 'faro_side'], { hardness: 2, emissive: true, sound: 'glass', tool: 'pick', light: 15 });
def(B.WORKBENCH, 'Mesa de trabajo', ['bench_top', 'bench_side', 'planks'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
// Bloques de las aldeas: tejas (medievales), paja (bosque) y adobe (desierto).
def(B.ROOF, 'Tejas', 'roof', { hardness: 1.4, tool: 'pick' });
def(B.THATCH, 'Paja', 'thatch', { hardness: 0.4, sound: 'grass' });
def(B.ADOBE, 'Adobe', 'adobe', { hardness: 1, sound: 'sand', tool: 'shovel' });
// Campo y casa: tierra arada, trigo (brote y maduro), cama, puerta (cerrada/abierta) y ventana.
def(B.FARMLAND, 'Tierra arada', ['farmland', 'dirt'], { hardness: 0.5, drop: B.DIRT, sound: 'grass', tool: 'shovel' });
def(B.WHEAT_YOUNG, 'Trigo creciendo', 'wheat_young', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 135 });
def(B.WHEAT_RIPE, 'Trigo maduro', 'wheat_ripe', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 134 });
def(B.BED, 'Cama', ['bed_top', 'bed_side', 'planks'], { transparent: true, hardness: 0.4, sound: 'wool', shape: 'bed' });
def(B.DOOR, 'Puerta', 'door', { transparent: true, hardness: 1, sound: 'wood', tool: 'axe', shape: 'door' });
def(B.DOOR_OPEN, 'Puerta abierta', 'door', { solid: false, transparent: true, hardness: 1, sound: 'wood', tool: 'axe', shape: 'door_open', drop: B.DOOR });
def(B.WINDOW, 'Ventana', 'window', { transparent: true, alpha: true, hardness: 0.3, sound: 'glass' });
// Profundidades: lava (ilumina y quema), hongos luminosos, musgo y oro.
def(B.LAVA, 'Lava', 'lava', { solid: false, liquid: true, breakable: false, emissive: true, light: 15 });
def(B.GLOW_MUSHROOM, 'Hongo luminoso', 'glow_mushroom', { solid: false, transparent: true, hardness: 0.05, emissive: true, sound: 'grass', shape: 'crop', light: 10 });
def(B.MOSS, 'Piedra musgosa', 'moss', { hardness: 1.5, tool: 'pick', drop: B.COBBLE });
def(B.GOLD_ORE, 'Mineral de oro', 'gold_ore', { hardness: 3, tool: 'pick', drop: 152 });
// Campamentos de saqueadores: lana negra, barrotes de jaula, fogata y cofre del botín.
def(B.WOOL_BLACK, 'Lana negra', 'wool_black', { hardness: 0.4, sound: 'wool' });
def(B.BARS, 'Barrotes', 'bars', { transparent: true, alpha: true, hardness: 2.5, tool: 'pick' });
def(B.CAMPFIRE, 'Fogata', 'campfire', { solid: false, transparent: true, hardness: 0.3, emissive: true, sound: 'wood', shape: 'crop', light: 14, drop: B.LOG });
def(B.LOOT_CHEST, 'Cofre del botín', ['chest_top', 'chest_side', 'planks'], { hardness: 1.5, sound: 'wood', tool: 'axe', drop: 0 });
// Muebles y decoración del hogar.
def(B.TABLE, 'Mesa', ['table_top', 'planks', 'planks'], { transparent: true, hardness: 1, sound: 'wood', tool: 'axe', shape: 'table' });
def(B.CHAIR, 'Silla', 'planks', { transparent: true, hardness: 0.8, sound: 'wood', tool: 'axe', shape: 'chair' });
def(B.BOOKSHELF, 'Biblioteca', ['planks', 'bookshelf', 'planks'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
def(B.FIREPLACE, 'Hogar a leña', ['cobble', 'brick', 'cobble'], { transparent: true, hardness: 2, tool: 'pick', shape: 'fireplace', light: 12 });
def(B.CARPET, 'Alfombra', 'carpet', { solid: false, transparent: true, hardness: 0.1, sound: 'wool', shape: 'carpet' });
def(B.BARREL, 'Barril', ['barrel_top', 'barrel_side', 'barrel_top'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
def(B.HAY, 'Fardo de heno', ['hay_top', 'hay_side', 'hay_top'], { hardness: 0.5, sound: 'grass' });
def(B.ANVIL, 'Yunque', 'anvil', { transparent: true, hardness: 4, tool: 'pick', shape: 'anvil' });
def(B.THRONE, 'Trono', 'throne', { transparent: true, hardness: 3, sound: 'wood', shape: 'throne' });
def(B.FLOWER_RED, 'Amapolas', 'flower_red', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop' });
def(B.FLOWER_YELLOW, 'Margaritas', 'flower_yellow', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop' });
// Vegetación: pinos, palmeras, pasto alto, arbustos de bayas y matas secas.
def(B.PINE_LEAVES, 'Hojas de pino', 'pine_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.PALM_LOG, 'Tronco de palmera', ['palm_top', 'palm_side'], { hardness: 1.2, sound: 'wood', tool: 'axe' });
def(B.PALM_LEAVES, 'Hojas de palmera', 'palm_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.TALL_GRASS, 'Pasto alto', 'tall_grass', { solid: false, transparent: true, hardness: 0.02, sound: 'grass', shape: 'crop', drop: 0 });
def(B.BERRY_BUSH, 'Arbusto de bayas', 'berry_bush', { solid: false, transparent: true, hardness: 0.1, sound: 'grass', shape: 'crop', drop: 153 });
def(B.DEAD_BUSH, 'Mata seca', 'dead_bush', { solid: false, transparent: true, hardness: 0.02, sound: 'grass', shape: 'crop', drop: 0 });
// Fondo del mar: algas, pasto marino y corales (las plantas de agua cuentan como agua para nadar).
def(B.KELP, 'Algas', 'kelp', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', water: true, drop: 0 });
def(B.SEAGRASS, 'Pasto marino', 'seagrass', { solid: false, transparent: true, hardness: 0.02, sound: 'grass', shape: 'crop', water: true, drop: 0 });
def(B.CORAL_RED, 'Coral rojo', 'coral_red', { hardness: 0.8, sound: 'stone', tool: 'pick' });
def(B.CORAL_YELLOW, 'Coral amarillo', 'coral_yellow', { hardness: 0.8, sound: 'stone', tool: 'pick' });
def(B.CORAL_PURPLE, 'Coral violeta', 'coral_purple', { hardness: 0.8, sound: 'stone', tool: 'pick' });
def(B.CORAL_FAN, 'Abanico de coral', 'coral_fan', { solid: false, transparent: true, hardness: 0.05, shape: 'crop', water: true });
// Biomas nuevos: pantano, selva y cañones; ruinas (piedra con musgo, arenisca, rieles de mina).
def(B.MUD, 'Barro', 'mud', { hardness: 0.5, sound: 'grass', tool: 'shovel' });
def(B.LILY_PAD, 'Nenúfar', 'lily_pad', { solid: false, transparent: true, hardness: 0.02, sound: 'grass', shape: 'carpet' });
def(B.VINES, 'Lianas', 'vines', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 0 });
def(B.JUNGLE_LEAVES, 'Hojas de selva', 'jungle_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass', drop: 0 });
def(B.RED_SAND, 'Arena roja', 'red_sand', { hardness: 0.5, sound: 'sand', tool: 'shovel' });
def(B.RED_ROCK, 'Roca roja', 'red_rock', { hardness: 1.3, tool: 'pick' });
def(B.ORANGE_ROCK, 'Roca naranja', 'orange_rock', { hardness: 1.3, tool: 'pick' });
def(B.RAIL, 'Riel', 'rail', { solid: false, transparent: true, hardness: 0.6, sound: 'wood', shape: 'carpet' });
def(B.MOSSY_COBBLE, 'Adoquín con musgo', 'mossy_cobble', { hardness: 2, tool: 'pick' });
def(B.SANDSTONE, 'Arenisca', ['sandstone_top', 'sandstone', 'sandstone_top'], { hardness: 1, tool: 'pick' });
def(B.CHISELED_SANDSTONE, 'Arenisca tallada', ['sandstone_top', 'chiseled_sandstone', 'sandstone_top'], { hardness: 1, tool: 'pick' });
// Cultivos nuevos, calabazas, colmenas, horno y frutales.
def(B.CARROT_YOUNG, 'Zanahorias (creciendo)', 'carrot_young', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 160 });
def(B.CARROT_RIPE, 'Zanahorias', 'carrot_ripe', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 160 });
def(B.POTATO_YOUNG, 'Papas (creciendo)', 'potato_young', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 161 });
def(B.POTATO_RIPE, 'Papas', 'potato_ripe', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 161 });
def(B.PUMPKIN, 'Calabaza', ['pumpkin_top', 'pumpkin_side', 'pumpkin_top'], { hardness: 0.8, sound: 'wood', tool: 'axe' });
def(B.PUMPKIN_STEM, 'Planta de calabaza', 'pumpkin_stem', { solid: false, transparent: true, hardness: 0.05, sound: 'grass', shape: 'crop', drop: 170 });
def(B.BEEHIVE, 'Colmena', ['hive_top', 'hive_side', 'hive_top'], { hardness: 0.6, sound: 'wood', tool: 'axe' });
def(B.OVEN, 'Horno', ['cobble', 'oven', 'cobble'], { hardness: 2.5, tool: 'pick', light: 9 });
def(B.FRUIT_LEAVES, 'Hojas de manzano', 'fruit_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass', drop: 0 });
// Vida de pueblo: corrales, iglesia y escuela.
def(B.FENCE, 'Cerca', 'planks', { transparent: true, hardness: 0.8, sound: 'wood', tool: 'axe', shape: 'fence' });
def(B.BELL, 'Campana', 'bell', { transparent: true, hardness: 3, tool: 'pick', shape: 'bell' });
def(B.PEW, 'Banco de iglesia', 'planks', { transparent: true, hardness: 0.8, sound: 'wood', tool: 'axe', shape: 'pew' });
def(B.ALTAR, 'Altar', ['altar_top', 'altar_side', 'planks'], { transparent: true, hardness: 2, sound: 'wood', tool: 'axe', shape: 'altar' });
def(B.BLACKBOARD, 'Pizarrón', ['planks', 'blackboard', 'planks'], { hardness: 1, sound: 'wood', tool: 'axe' });
def(B.STAINED_GLASS, 'Vitral', 'stained_glass', { transparent: true, alpha: true, hardness: 0.3, sound: 'glass' });
def(B.TROUGH, 'Comedero', ['trough_top', 'planks', 'planks'], { transparent: true, hardness: 0.8, sound: 'wood', tool: 'axe', shape: 'trough' });
def(B.TORCH, 'Antorcha', 'torch', { solid: false, transparent: true, hardness: 0.05, emissive: true, sound: 'wood', shape: 'torch', light: 13 });

// Bloques disponibles en el inventario creativo (orden de la grilla).
export const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.BIRCH_LOG, B.LEAVES, B.BIRCH_LEAVES,
  B.GLASS, B.BRICK, B.SAND, B.GRAVEL, B.CLAY, B.SNOW, B.CACTUS, B.COAL, B.IRON, B.LAMP, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_WHITE, B.CRYSTAL, B.FARO, B.TORCH, B.WORKBENCH, B.ROOF, B.THATCH, B.ADOBE, B.FARMLAND, B.BED, B.DOOR, B.WINDOW, B.MOSS, B.GOLD_ORE, B.WOOL_BLACK, B.BARS, B.GLOW_MUSHROOM, B.CAMPFIRE, B.TABLE, B.CHAIR, B.BOOKSHELF, B.FIREPLACE, B.CARPET, B.BARREL, B.HAY, B.ANVIL, B.THRONE, B.FLOWER_RED, B.FLOWER_YELLOW, B.PINE_LEAVES, B.PALM_LOG, B.PALM_LEAVES, B.TALL_GRASS, B.BERRY_BUSH, B.KELP, B.CORAL_RED, B.CORAL_YELLOW, B.CORAL_PURPLE, B.CORAL_FAN, B.FENCE, B.BELL, B.PEW, B.ALTAR, B.BLACKBOARD, B.STAINED_GLASS, B.TROUGH, B.PUMPKIN, B.BEEHIVE, B.OVEN, B.FRUIT_LEAVES, B.MUD, B.LILY_PAD, B.JUNGLE_LEAVES, B.RED_SAND, B.RED_ROCK, B.ORANGE_ROCK, B.RAIL, B.MOSSY_COBBLE, B.SANDSTONE, B.CHISELED_SANDSTONE];

// Bloques que emiten luz (iluminan alrededor y repelen a las Sombras).
export const LIGHT_BLOCKS = new Set(BLOCKS.filter((b) => b?.light > 0).map((b) => b.id));

export const isSolid = (id) => BLOCKS[id]?.solid ?? false;
export const isTransparent = (id) => BLOCKS[id]?.transparent ?? true;
