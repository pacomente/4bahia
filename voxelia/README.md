# Voxelia

Juego de mundo abierto de bloques para PC, con su propio **launcher**. Todo el contenido es original: las texturas y los sonidos se generan por código (no usa archivos ni marcas de otros juegos).

![Launcher](launcher/assets/hero.jpg)

## Qué incluye

**Launcher (app de escritorio)**
- Perfil del jugador (nombre).
- Mis mundos: crear (nombre, semilla, modo), jugar y eliminar, con la última vez jugada y el tiempo total.
- Novedades y ajustes: distancia de renderizado, campo de visión, sensibilidad, volumen, pantalla completa y FPS.
- Botón **JUGAR**: abre el juego en su ventana. Al salir vuelve al launcher.
- Los mundos se guardan como archivos en la carpeta de datos del usuario (en Windows, `%APPDATA%\Voxelia`).

**Juego**
- **Mundo infinito** generado a partir de una semilla:
  - biomas: llanuras, bosque, desierto, nieve y montañas;
  - árboles (roble y abedul), cactus, playas, lagos y mar;
  - cuevas con carbón y hierro.
- **22 bloques** para construir: madera, piedra, vidrio, ladrillo, lana, lámparas que brillan de noche y más.
- **Modo Creativo**: bloques infinitos y vuelo (doble espacio o F).
- **Modo Supervivencia**: romper lleva tiempo según el bloque, lo que rompés va al inventario, hay vida con daño por caída, aire bajo el agua y reaparición. Ver abajo lo que lo hace distinto.
- **Ciclo de día y noche** con sol, luna, estrellas y nubes. Hay oclusión ambiental y sombras bajo techos y árboles, niebla a distancia y vista bajo el agua.
- **Física**: gravedad, saltos, colisiones, nado y correr.
- **Partículas y sonido**: partículas al romper y sonidos sintetizados al romper, colocar y caminar.
- **Interfaz**: barra rápida, inventario (E), menú de pausa con opciones y controles, e información de depuración (F3).
- **Guardado** automático cada 30 s y al salir.

## Supervivencia: qué tiene de distinto

- **Taller (C)**: no hay grillas ni recetas para memorizar. Ves la lista de todo lo que se puede fabricar, con los materiales que tenés y los que faltan, y fabricás con un clic.
- **Herramientas por nivel**: picos, hachas y palas de madera, piedra y hierro. Cada una acelera su tipo de bloque y pega más fuerte.
- **Energía en lugar de hambre**: correr y saltar gastan energía, y se recupera sola al caminar o quedarte quieto. No hay que andar buscando comida.
- **Sombras**: criaturas nocturnas que flotan hacia vos y le temen a la luz. Cerca de lámparas, cristales o faros se queman y huyen. De día se disuelven. Al vencerlas sueltan **esencia**. Cada noche que sobrevivís aparecen algunas más.
- **Cristales**: brillan en las cuevas profundas (por debajo de la altura 20). Iluminan y sirven para fabricar.
- **Faro**: marca tu punto de reaparición y proyecta un haz de luz visible desde lejos para volver a casa.
- **Planeador**: se fabrica con esencia. Mantené espacio en el aire para planear sin daño por caída.
- **Corazones extra**: con esencia y cristal subís la vida máxima, hasta 15 corazones.
- **Misiones guiadas**: 10 objetivos que te enseñan a jugar, desde juntar madera hasta fabricar el planeador.
- **Contador de días y lluvia**: el clima cambia y la lluvia oscurece el día.

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverse |
| Espacio | Saltar / nadar · doble espacio o F: volar (creativo) |
| Shift | Bajar al volar |
| Ctrl o R | Correr |
| Clic izquierdo / derecho | Romper / colocar bloque |
| Rueda o 1-9 | Elegir bloque |
| Clic de rueda | Copiar el bloque apuntado (creativo) |
| E | Inventario |
| C | Taller (supervivencia) |
| Espacio en el aire | Planear (con planeador) |
| F3 | Depuración |
| Esc | Pausa |

## Desarrollo

Requiere Node.js 22.

```bash
cd voxelia
npm install
npm start            # compila el juego y abre el launcher (Electron)
npm run dev          # solo el juego en el navegador: http://localhost:5180
npm test             # generación del mundo, física, guardado
```

## Instalador para Windows

- **Automático (recomendado):** cada cambio en `voxelia/` que llega a `main` dispara el workflow `.github/workflows/voxelia.yml`, que arma el instalador en una máquina Windows. Se descarga desde GitHub → **Actions** → *Voxelia · instalador Windows* → la última corrida → **Artifacts** → `Voxelia-Windows`.
- **Release pública (link permanente, sin cuenta):** cuando llega a `main` una versión nueva de `package.json`, el workflow publica la Release `voxelia-vX.Y.Z` con el `.exe`. Se descarga desde GitHub → **Releases**. Para sacar otra, subí `version` en `package.json`.
- **A mano en Windows:** `npm install && npm run dist:win` deja `release/Voxelia-Setup-0.2.0.exe` y una versión portable `.zip`.

El instalador no está firmado digitalmente, así que Windows SmartScreen puede mostrar "Windows protegió su PC". Se sigue con **Más información → Ejecutar de todas formas**. Para distribuirlo al público conviene un certificado de firma de código.

## Estructura

```
launcher/   main.cjs (Electron: ventanas y guardado) · preload.cjs (puente seguro) · index.html/css/js (interfaz)
game/       index.html · src/ (world, mesher, textures, player, sky, audio, ui, game) · test/
build/      icon.png
```

## Próximos pasos posibles

Animales, iluminación por bloques (antorchas), multijugador en red local, mods y paquetes de texturas, y actualizaciones automáticas desde el launcher.
