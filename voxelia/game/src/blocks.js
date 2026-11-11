// Definición de bloques. `tex` indica la textura de cada cara: [arriba, costados, abajo].
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
  COBBLE: 9, GLASS: 10, SNOW: 11, BRICK: 12, COAL: 13, CACTUS: 14, BEDROCK: 15, GRAVEL: 16,
  IRON: 17, BIRCH_LOG: 18, BIRCH_LEAVES: 19, CLAY: 20, LAMP: 21, WOOL_RED: 22, WOOL_BLUE: 23, WOOL_WHITE: 24,
  CRYSTAL: 25, FARO: 26, TORCH: 27, WORKBENCH: 28,
};

export const BLOCKS = [];
function def(id, name, tex, opts = {}) {
  const t = Array.isArray(tex) ? tex : [tex, tex, tex];
  BLOCKS[id] = {
    id, name, tex: t.length === 2 ? [t[0], t[1], t[0]] : t,
    solid: opts.solid ?? true, transparent: opts.transparent ?? false, liquid: opts.liquid ?? false,
    alpha: opts.alpha ?? false, hardness: opts.hardness ?? 1, emissive: opts.emissive ?? false,
    drop: opts.drop ?? id, breakable: opts.breakable ?? true, sound: opts.sound ?? 'stone',
    tool: opts.tool ?? null,   // herramienta que acelera el minado: 'pick' | 'axe' | 'shovel'
    shape: opts.shape ?? 'cube', // 'cube' | 'torch' (modelo fino)
    light: opts.light ?? 0,      // nivel de luz que emite (0-15)
  };
}

def(B.AIR, 'Aire', 'none', { solid: false, transparent: true, breakable: false });
def(B.GRASS, 'Pasto', ['grass_top', 'grass_side', 'dirt'], { hardness: 0.6, drop: B.DIRT, sound: 'grass', tool: 'shovel' });
def(B.DIRT, 'Tierra', 'dirt', { hardness: 0.5, sound: 'grass', tool: 'shovel' });
def(B.STONE, 'Piedra', 'stone', { hardness: 1.5, drop: B.COBBLE, tool: 'pick' });
def(B.SAND, 'Arena', 'sand', { hardness: 0.5, sound: 'sand', tool: 'shovel' });
def(B.WATER, 'Agua', 'water', { solid: false, transparent: true, liquid: true, breakable: false });
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
def(B.TORCH, 'Antorcha', 'torch', { solid: false, transparent: true, hardness: 0.05, emissive: true, sound: 'wood', shape: 'torch', light: 13 });

// Bloques disponibles en el inventario creativo (orden de la grilla).
export const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.BIRCH_LOG, B.LEAVES, B.BIRCH_LEAVES,
  B.GLASS, B.BRICK, B.SAND, B.GRAVEL, B.CLAY, B.SNOW, B.CACTUS, B.COAL, B.IRON, B.LAMP, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_WHITE, B.CRYSTAL, B.FARO, B.TORCH, B.WORKBENCH];

// Bloques que emiten luz (iluminan alrededor y repelen a las Sombras).
export const LIGHT_BLOCKS = new Set(BLOCKS.filter((b) => b?.light > 0).map((b) => b.id));

export const isSolid = (id) => BLOCKS[id]?.solid ?? false;
export const isTransparent = (id) => BLOCKS[id]?.transparent ?? true;
