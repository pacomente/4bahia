import { B } from './blocks.js';
import { I } from './items.js';

// Misiones de Supervivencia: guían al jugador por el progreso propio de Voxelia.
// stats: { collected: {id: n}, crafted: {recipeId: n}, placed: {id: n}, nights: n, kills: n }
export const MISSIONS = [
  { id: 'wood', title: 'Juntá 5 troncos', hint: 'Rompé árboles con clic izquierdo (mantené apretado).', goal: 5, progress: (s) => (s.collected[B.LOG] ?? 0) + (s.collected[B.BIRCH_LOG] ?? 0) },
  { id: 'pick', title: 'Armá una Mesa y fabricá un pico', hint: 'Taller (C): Tronco → Tablas → Mesa de trabajo. Colocala, hacé clic derecho y fabricá el pico.', goal: 1, progress: (s) => s.crafted.pick_wood ?? 0 },
  { id: 'cobble', title: 'Juntá 10 adoquines', hint: 'Con el pico en la mano la piedra se rompe mucho más rápido.', goal: 10, progress: (s) => s.collected[B.COBBLE] ?? 0 },
  { id: 'coal', title: 'Encontrá 3 de carbón', hint: 'El carbón son las manchas negras en la piedra.', goal: 3, progress: (s) => s.collected[I.COAL] ?? 0 },
  { id: 'lamp', title: 'Iluminá tu refugio', hint: 'Taller: carbón + tablas = antorchas (o vidrio + carbón = lámparas). Las Sombras odian la luz.', goal: 1, progress: (s) => (s.placed[B.LAMP] ?? 0) + (s.placed[B.TORCH] ?? 0) },
  { id: 'night', title: 'Sobreviví a tu primera noche', hint: 'De noche aparecen las Sombras. Quedate cerca de la luz o pelealas.', goal: 1, progress: (s) => s.nights },
  { id: 'essence', title: 'Conseguí 2 Esencias de sombra', hint: 'Golpeá a las Sombras con clic izquierdo. Las herramientas pegan más fuerte.', goal: 2, progress: (s) => s.collected[I.ESSENCE] ?? 0 },
  { id: 'crystal', title: 'Encontrá 4 Cristales', hint: 'Brillan en las cuevas profundas (debajo de la altura 20).', goal: 4, progress: (s) => s.collected[I.CRYSTAL] ?? 0 },
  { id: 'faro', title: 'Construí un Faro', hint: 'Taller: 3 cristales + 4 adoquines. Colocalo para reaparecer ahí.', goal: 1, progress: (s) => s.placed[B.FARO] ?? 0 },
  { id: 'glider', title: 'Fabricá el Planeador', hint: 'Taller: cristales, esencias y tablas. Mantené Espacio en el aire para planear.', goal: 1, progress: (s) => s.crafted.glider ?? 0 },
  { id: 'village', title: 'Visitá una aldea', hint: 'Mirá el mapa (M): las casitas naranjas son aldeas. Hay una cerca del inicio.', goal: 1, progress: (s) => s.visited ?? 0 },
  { id: 'trade', title: 'Hacé un trueque con un aldeano', hint: 'Clic derecho sobre un aldeano para hablar. Cada oficio ofrece cosas distintas.', goal: 1, progress: (s) => s.trades ?? 0 },
  { id: 'armor', title: 'Ponete una armadura', hint: 'Taller: armadura acolchada con lana. Abrí el inventario (E) y hacé clic en la pieza para ponértela.', goal: 1, progress: (s) => s.equipped ?? 0 },
  { id: 'king', title: 'Cumplí un encargo del rey', hint: 'El rey vive en el castillo de las aldeas medievales (en las otras, el jefe). Te paga en plata.', goal: 1, progress: (s) => s.honor ?? 0 },
  { id: 'mushroom', title: 'Juntá un hongo luminoso', hint: 'Bajá a las cavernas profundas (las grietas son una buena entrada). Cuidado con la lava.', goal: 1, progress: (s) => s.collected[40] ?? 0 },
  { id: 'freed', title: 'Liberá a un prisionero', hint: 'En el mapa, los campamentos de saqueadores están en rojo. Rompé los barrotes de una jaula.', goal: 1, progress: (s) => s.freed ?? 0 },
  { id: 'port', title: 'Visitá un puerto', hint: 'Las aldeas junto al mar tienen muelle y faro. Ahí viven pescadores y marineros.', goal: 1, progress: (s) => s.ports ?? 0 },
  { id: 'boat', title: 'Navegá en bote', hint: 'Taller: 5 tablas = Bote. Clic derecho sobre el agua para ponerlo y otra vez para subir.', goal: 1, progress: (s) => s.boated ?? 0 },
  { id: 'wreck', title: 'Encontrá el tesoro de un barco hundido', hint: 'Navegá mar adentro y mirá el fondo: los naufragios guardan un cofre con perlas.', goal: 1, progress: (s) => s.wrecks ?? 0 },
  { id: 'cook', title: 'Cociná algo', hint: 'Con carne o pescado crudo en la mano, clic derecho sobre una fogata, un hogar o un horno.', goal: 1, progress: (s) => s.cooked ?? 0 },
  { id: 'fish', title: 'Pescá 3 peces', hint: 'Taller: tablas + lana = Caña de pescar. Tirala al agua y sacá el pez cuando se hunda el corcho.', goal: 3, progress: (s) => s.fished ?? 0 },
  { id: 'upgrade', title: 'Reforzá tu equipo con el herrero', hint: 'Hablá con un herrero con el arma o la armadura en la mano. Cuesta plata y hierro.', goal: 1, progress: (s) => s.upgraded ?? 0 },
  { id: 'horse', title: 'Montá a caballo', hint: 'Hay caballos en las praderas y en los corrales de las aldeas. Clic derecho para subir, Shift para bajar.', goal: 1, progress: (s) => s.rode ?? 0 },
  { id: 'caravan', title: 'Mirá llegar una carreta de comercio', hint: 'Los caminos de grava unen las aldeas. Las carretas llevan comida, madera y piedra de un pueblo a otro.', goal: 1, progress: (s) => s.caravans ?? 0 },
  { id: 'leader', title: 'Derrotá a un jefe saqueador', hint: 'Llevá armadura y escudo: el jefe pega fuerte y los arqueros disparan desde lejos.', goal: 1, progress: (s) => s.leaders ?? 0 },
];

export const emptyStats = () => ({ collected: {}, crafted: {}, placed: {}, nights: 0, kills: 0, visited: 0, trades: 0, met: 0, equipped: 0, honor: 0, freed: 0, leaders: 0 });

// Misión actual (la primera sin completar) y cuántas hay terminadas.
export function missionStatus(stats) {
  const done = MISSIONS.filter((m) => m.progress(stats) >= m.goal).length;
  const current = MISSIONS.find((m) => m.progress(stats) < m.goal) ?? null;
  // number: posición de la misión actual en la lista (no la cantidad de terminadas: se pueden cumplir fuera de orden).
  return { done, total: MISSIONS.length, current, number: current ? MISSIONS.indexOf(current) + 1 : MISSIONS.length, value: current ? Math.min(current.goal, current.progress(stats)) : 0 };
}
