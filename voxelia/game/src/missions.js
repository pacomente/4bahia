import { B } from './blocks.js';
import { I } from './items.js';

// Misiones de Supervivencia: guían al jugador por el progreso propio de Voxelia.
// stats: { collected: {id: n}, crafted: {recipeId: n}, placed: {id: n}, nights: n, kills: n }
export const MISSIONS = [
  { id: 'wood', title: 'Juntá 5 troncos', hint: 'Rompé árboles con clic izquierdo (mantené apretado).', goal: 5, progress: (s) => (s.collected[B.LOG] ?? 0) + (s.collected[B.BIRCH_LOG] ?? 0) },
  { id: 'pick', title: 'Fabricá un pico de madera', hint: 'Abrí el Taller con la tecla C: Tronco → Tablas → Pico.', goal: 1, progress: (s) => s.crafted.pick_wood ?? 0 },
  { id: 'cobble', title: 'Juntá 10 adoquines', hint: 'Con el pico en la mano la piedra se rompe mucho más rápido.', goal: 10, progress: (s) => s.collected[B.COBBLE] ?? 0 },
  { id: 'coal', title: 'Encontrá 3 de carbón', hint: 'El carbón son las manchas negras en la piedra.', goal: 3, progress: (s) => s.collected[I.COAL] ?? 0 },
  { id: 'lamp', title: 'Fabricá y colocá una lámpara', hint: 'Arena + carbón = vidrio; vidrio + carbón = lámparas. Las Sombras odian la luz.', goal: 1, progress: (s) => s.placed[B.LAMP] ?? 0 },
  { id: 'night', title: 'Sobreviví a tu primera noche', hint: 'De noche aparecen las Sombras. Quedate cerca de la luz o pelealas.', goal: 1, progress: (s) => s.nights },
  { id: 'essence', title: 'Conseguí 2 Esencias de sombra', hint: 'Golpeá a las Sombras con clic izquierdo. Las herramientas pegan más fuerte.', goal: 2, progress: (s) => s.collected[I.ESSENCE] ?? 0 },
  { id: 'crystal', title: 'Encontrá 4 Cristales', hint: 'Brillan en las cuevas profundas (debajo de la altura 20).', goal: 4, progress: (s) => s.collected[I.CRYSTAL] ?? 0 },
  { id: 'faro', title: 'Construí un Faro', hint: 'Taller: 3 cristales + 4 adoquines. Colocalo para reaparecer ahí.', goal: 1, progress: (s) => s.placed[B.FARO] ?? 0 },
  { id: 'glider', title: 'Fabricá el Planeador', hint: 'Taller: cristales, esencias y tablas. Mantené Espacio en el aire para planear.', goal: 1, progress: (s) => s.crafted.glider ?? 0 },
];

export const emptyStats = () => ({ collected: {}, crafted: {}, placed: {}, nights: 0, kills: 0 });

// Misión actual (la primera sin completar) y cuántas hay terminadas.
export function missionStatus(stats) {
  const done = MISSIONS.filter((m) => m.progress(stats) >= m.goal).length;
  const current = MISSIONS.find((m) => m.progress(stats) < m.goal) ?? null;
  return { done, total: MISSIONS.length, current, value: current ? Math.min(current.goal, current.progress(stats)) : 0 };
}
