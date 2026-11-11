// Definición de bloques. `tex` indica la textura de cada cara: [arriba, costados, abajo].
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
  COBBLE: 9, GLASS: 10, SNOW: 11, BRICK: 12, COAL: 13, CACTUS: 14, BEDROCK: 15, GRAVEL: 16,
  IRON: 17, BIRCH_LOG: 18, BIRCH_LEAVES: 19, CLAY: 20, LAMP: 21, WOOL_RED: 22, WOOL_BLUE: 23, WOOL_WHITE: 24,
};

export const BLOCKS = [];
function def(id, name, tex, opts = {}) {
  const t = Array.isArray(tex) ? tex : [tex, tex, tex];
  BLOCKS[id] = {
    id, name, tex: t.length === 2 ? [t[0], t[1], t[0]] : t,
    solid: opts.solid ?? true, transparent: opts.transparent ?? false, liquid: opts.liquid ?? false,
    alpha: opts.alpha ?? false, hardness: opts.hardness ?? 1, emissive: opts.emissive ?? false,
    drop: opts.drop ?? id, breakable: opts.breakable ?? true, sound: opts.sound ?? 'stone',
  };
}

def(B.AIR, 'Aire', 'none', { solid: false, transparent: true, breakable: false });
def(B.GRASS, 'Pasto', ['grass_top', 'grass_side', 'dirt'], { hardness: 0.6, drop: B.DIRT, sound: 'grass' });
def(B.DIRT, 'Tierra', 'dirt', { hardness: 0.5, sound: 'grass' });
def(B.STONE, 'Piedra', 'stone', { hardness: 1.5, drop: B.COBBLE });
def(B.SAND, 'Arena', 'sand', { hardness: 0.5, sound: 'sand' });
def(B.WATER, 'Agua', 'water', { solid: false, transparent: true, liquid: true, breakable: false });
def(B.LOG, 'Tronco', ['log_top', 'log_side'], { hardness: 1, sound: 'wood' });
def(B.LEAVES, 'Hojas', 'leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.PLANKS, 'Tablas', 'planks', { hardness: 1, sound: 'wood' });
def(B.COBBLE, 'Adoquín', 'cobble', { hardness: 1.8 });
def(B.GLASS, 'Vidrio', 'glass', { transparent: true, alpha: true, hardness: 0.3, sound: 'glass' });
def(B.SNOW, 'Nieve', ['snow', 'snow_side', 'dirt'], { hardness: 0.4, drop: B.DIRT, sound: 'sand' });
def(B.BRICK, 'Ladrillo', 'brick', { hardness: 2 });
def(B.COAL, 'Mineral de carbón', 'coal', { hardness: 2.2 });
def(B.CACTUS, 'Cactus', ['cactus_top', 'cactus_side'], { hardness: 0.4, sound: 'grass' });
def(B.BEDROCK, 'Roca madre', 'bedrock', { breakable: false });
def(B.GRAVEL, 'Grava', 'gravel', { hardness: 0.6, sound: 'sand' });
def(B.IRON, 'Mineral de hierro', 'iron', { hardness: 2.6 });
def(B.BIRCH_LOG, 'Tronco de abedul', ['birch_top', 'birch_side'], { hardness: 1, sound: 'wood' });
def(B.BIRCH_LEAVES, 'Hojas de abedul', 'birch_leaves', { transparent: true, alpha: true, hardness: 0.2, sound: 'grass' });
def(B.CLAY, 'Arcilla', 'clay', { hardness: 0.6, sound: 'sand' });
def(B.LAMP, 'Lámpara', 'lamp', { hardness: 0.5, emissive: true, sound: 'glass' });
def(B.WOOL_RED, 'Lana roja', 'wool_red', { hardness: 0.4, sound: 'wool' });
def(B.WOOL_BLUE, 'Lana azul', 'wool_blue', { hardness: 0.4, sound: 'wool' });
def(B.WOOL_WHITE, 'Lana blanca', 'wool_white', { hardness: 0.4, sound: 'wool' });

// Bloques disponibles en el inventario creativo (orden de la grilla).
export const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.BIRCH_LOG, B.LEAVES, B.BIRCH_LEAVES,
  B.GLASS, B.BRICK, B.SAND, B.GRAVEL, B.CLAY, B.SNOW, B.CACTUS, B.COAL, B.IRON, B.LAMP, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_WHITE];

export const isSolid = (id) => BLOCKS[id]?.solid ?? false;
export const isTransparent = (id) => BLOCKS[id]?.transparent ?? true;
