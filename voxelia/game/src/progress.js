// ───────── Tutorial, logros y consejos ─────────

// Tutorial para quien juega por primera vez (mundo nuevo en supervivencia). Cada paso se cumple solo.
export const TUTORIAL = [
  { title: 'Moverse', hint: 'Usá W A S D para caminar y el mouse para mirar. Espacio salta.', done: (g) => g.tut.moved > 6 },
  { title: 'Romper un bloque', hint: 'Mantené apretado el clic izquierdo sobre un bloque (los troncos de los árboles son lo primero que conviene juntar).', done: (g) => Object.values(g.stats.collected).reduce((a, n) => a + n, 0) > 0 },
  { title: 'Abrir el inventario', hint: 'Apretá E para ver tus cosas y tu personaje. Otra vez E para cerrarlo.', done: (g) => g.tut.inventory },
  { title: 'Abrir el Taller', hint: 'Apretá C para fabricar cosas. Empezá por tablas con los troncos.', done: (g) => g.tut.craft },
  { title: 'Mirar el mapa', hint: 'Apretá M: ahí aparecen las aldeas cercanas.', done: (g) => g.tut.map },
  { title: 'Comer', hint: 'Los muslitos de abajo son el hambre. Clic derecho con comida en la mano para comer (manzanas de los árboles, bayas, pescado…).', done: (g) => g.tut.ate },
];

// Logros: se desbloquean una vez y quedan en el diario.
export const ACHIEVEMENTS = [
  ['first_night', '🌙', 'Primera noche', 'Sobreviviste tu primera noche.', (s) => s.nights >= 1],
  ['explorer', '🧭', 'Explorador', 'Visitaste 5 aldeas.', (s) => (s.visited ?? 0) >= 5],
  ['trader', '💰', 'Comerciante', 'Hiciste 25 trueques o compras.', (s) => (s.trades ?? 0) >= 25],
  ['fisher', '🎣', 'Pescador', 'Pescaste 20 peces.', (s) => (s.fished ?? 0) >= 20],
  ['cook', '🍲', 'Cocinero', 'Cocinaste 20 platos.', (s) => (s.cooked ?? 0) >= 20],
  ['archaeologist', '🏚', 'Arqueólogo', 'Exploraste 5 ruinas.', (s) => (s.ruins ?? 0) >= 5],
  ['treasure', '💎', 'Cazatesoros', 'Desenterraste 3 tesoros.', (s) => (s.treasures ?? 0) >= 3],
  ['tamer', '🐕', 'Mejor amigo', 'Domesticaste un lobo.', (s) => (s.pets ?? 0) >= 1],
  ['defender', '🛡', 'Defensor', 'Venciste a un jefe saqueador.', (s) => (s.leaders ?? 0) >= 1],
  ['dragonslayer', '🐉', 'Matadragones', 'Venciste al dragón de las montañas.', (s) => (s.dragons ?? 0) >= 1],
  ['seawolf', '🐍', 'Lobo de mar', 'Hundiste a la serpiente marina.', (s) => (s.serpents ?? 0) >= 1],
  ['kingslayer', '👑', 'Fin de la sombra', 'Venciste al Rey Sombrío.', (s) => (s.kings ?? 0) >= 1],
  ['lord', '🏰', 'Señor feudal', 'Te nombraron señor de una aldea.', (s) => (s.lord ?? 0) >= 1],
  ['home', '🏠', 'Hogar, dulce hogar', 'Tenés tu propia casa en un pueblo.', (s) => (s.house ?? 0) >= 1],
  ['parry', '⚔', 'Maestro del escudo', 'Desviaste 10 golpes.', (s) => (s.parries ?? 0) >= 10],
  ['reader', '📚', 'Lector', 'Leíste 5 libros.', (s) => (s.books ?? 0) >= 5],
  ['helper', '🤝', 'Buen vecino', 'Cumpliste 10 encargos de vecinos.', (s) => (s.requests ?? 0) >= 10],
  ['survivor', '🌄', 'Sobreviviente', 'Sobreviviste 10 noches.', (s) => s.nights >= 10],
];

// Consejos para la pantalla de carga.
export const TIPS = [
  'Las Sombras le tienen miedo a la luz: una antorcha cerca te protege de noche.',
  'Con la espada, mantené apretado el clic para cargar un golpe que barre a todos.',
  'Levantá el escudo justo antes del golpe para desviarlo y aturdir al enemigo.',
  'Cocinar la comida la hace rendir el doble. Una fogata alcanza.',
  'Los cartógrafos marcan en tu mapa las ruinas y las guaridas.',
  'De noche, en mar abierto, algo enorme nada bajo el agua…',
  'Los lobos se domestican con carne: después te defienden.',
  'Si la aldea te aprecia, el rey te puede nombrar señor.',
  'Las carretas unen los pueblos: seguí los caminos de grava para no perderte.',
  'El pez dorado sale de noche y vale una fortuna en los puertos.',
  'Las abejas se calman con el humo de una fogata.',
  'Con F5 cambiás a tercera persona. Con J abrís tu diario.',
];
