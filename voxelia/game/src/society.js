import { B } from './blocks.js';
import { I } from './items.js';
import { hash3 } from './world.js';

// ───────── Vida social de los pueblos ─────────

// Encargos que puede pedir cada oficio (además de los del rey).
const REQUESTS = {
  farmer: [{ id: I.SEEDS, n: 6, text: 'Me faltan semillas para la siembra.' }, { id: B.HAY, n: 2, text: 'Necesito heno para los animales.' }],
  fisher: [{ id: I.BERRIES, n: 4, text: 'Uso bayas de carnada. ¿Me conseguís?' }, { id: B.WOOL_WHITE, n: 2, text: 'Se me rompió la red: necesito lana.' }],
  sailor: [{ id: B.LOG, n: 6, text: 'Hay que arreglar el muelle: traeme troncos.' }],
  smith: [{ id: I.COAL, n: 5, text: 'Se me apagó la fragua. ¡Carbón!' }, { id: I.IRON, n: 2, text: 'Me quedé sin hierro para trabajar.' }],
  builder: [{ id: B.COBBLE, n: 16, text: 'Necesito adoquines para los cimientos.' }],
  woodcutter: [{ id: I.APPLE, n: 3, text: 'Talar da hambre… ¿unas manzanas?' }],
  guard: [{ id: I.ARROW, n: 8, text: 'Nos faltan flechas para la guardia.' }, { id: I.BREAD, n: 2, text: 'La ronda es larga: ¿un poco de pan?' }],
  merchant: [{ id: I.PEARL, n: 1, text: 'Un cliente me pidió una perla.' }],
  priest: [{ id: B.TORCH, n: 6, text: 'Faltan velas para el altar.' }],
  teacher: [{ id: B.BOOKSHELF, n: 1, text: 'Quiero una biblioteca para la escuela.' }],
  baker: [{ id: I.WHEAT, n: 6, text: 'Sin trigo no hay pan. ¿Me traés?' }, { id: I.HONEY, n: 1, text: 'Para el pastel de la fiesta me falta miel.' }],
  doctor: [{ id: I.HONEY, n: 2, text: 'La miel cura las heridas. ¿Me conseguís?' }],
  cartographer: [{ id: I.TREASURE_MAP, n: 1, text: 'Colecciono mapas viejos. ¿Encontraste alguno?' }],
  librarian: [{ id: B.BOOKSHELF, n: 1, text: 'Me falta lugar para los libros.' }],
};
export function makeRequest(prof, r = Math.random) {
  const list = REQUESTS[prof]; if (!list) return null;
  const q = list[Math.floor(r() * list.length)];
  return { ...q, reward: 6 + q.n * 2 + Math.floor(r() * 6) };
}

// Relación entre dos aldeas: aliadas, rivales o neutrales (fija según el mundo).
export function relation(world, a, b) {
  if (a.id === b.id) return 'self';
  const [p, q] = a.id < b.id ? [a, b] : [b, a];
  const h = hash3(world.seed, p.rx * 97 + q.rx, 3333, p.rz * 89 + q.rz);
  if (a.style === b.style ? h < 0.65 : h < 0.35) return 'ally';
  if (h > 0.85) return 'rival';
  return 'neutral';
}

// Día de fiesta: cada aldea tiene su fiesta cada 6 días (en un día propio).
export const isFestival = (plan, day, rec = null) => rec?.forceFestival === day || ((day + Math.floor(hash3(0, plan.rx, 4444, plan.rz) * 6)) % 6) === 0;

// Sucesor del rey/jefe: su pareja; si no, el adulto de más edad.
export function successor(rec) {
  const adults = rec.villagers.filter((v) => v.age >= 2);
  if (!adults.length) return null;
  return adults.sort((a, b) => (b.prof === 'guard') - (a.prof === 'guard') || b.age - a.age)[0];
}

// Libros de la biblioteca: historias del mundo.
export const BOOKS = [
  ['La leyenda del Faro', 'Dicen que los primeros pobladores encendieron un faro de cristal para que las Sombras no se acercaran. Desde entonces, toda luz es un pequeño faro.'],
  ['El dragón de las montañas', 'Nadie sabe de dónde vino. Vive en lo más alto y cuida su guarida. Los viejos dicen que sus escamas no las puede cortar ningún herrero.'],
  ['Crónica de los saqueadores', 'Llegaron del otro lado de los bosques y armaron campamentos con empalizadas. Sin su jefe, se desbandan como gallinas asustadas.'],
  ['Manual del buen pescador', 'El pez dorado sale de noche, en mar abierto. Paciencia: el corcho se hunde una sola vez.'],
  ['Las rutas del comercio', 'Las carretas unen los pueblos. Lo que sobra en uno falta en otro, y así todos comen. Un pueblo sin caminos es un pueblo pobre.'],
  ['Historia de los barcos hundidos', 'Muchos barcos mercantes se fueron al fondo en las tormentas. Sus cofres todavía esperan a quien se anime a bucear.'],
  ['El templo del Sol', 'En el desierto hay templos de arenisca con una sala escondida debajo. El ojo tallado en la piedra mira hacia el tesoro.'],
];

// Chismes: frases a partir de lo que pasó en el mundo.
export function gossipLine(ev) {
  switch (ev.type) {
    case 'dragon': return '¿Escuchaste? ¡Alguien venció al dragón de las montañas!';
    case 'serpent': return 'Dicen que en el mar profundo alguien hundió a la serpiente.';
    case 'treasure': return `Dicen que ${ev.who ?? 'un viajero'} desenterró un tesoro. ¡Qué suerte!`;
    case 'born': return `En ${ev.village} nació ${ev.name}. ¡Felicitaciones a la familia!`;
    case 'wedding': return `¡Se casaron ${ev.a} y ${ev.b} en ${ev.village}!`;
    case 'ship': return `Llegó un barco mercante a ${ev.village}: dicen que trajo gemas baratas.`;
    case 'caravan': return `La carreta de ${ev.from} llegó a ${ev.to} cargada de ${ev.goods}.`;
    case 'raid': return `Los saqueadores atacaron ${ev.village}… ¡qué miedo!`;
    case 'defended': return `Los guardias de ${ev.village} echaron a los enemigos. ¡Bravo!`;
    case 'king': return `En ${ev.village} hay ${ev.title} nuevo: ${ev.name}.`;
    case 'festival': return `Hoy es la fiesta de ${ev.village}. ¡Hay música en la plaza!`;
    case 'camp': return `Cayó el jefe del campamento de ${ev.camp}. Los caminos están más seguros.`;
    default: return null;
  }
}
