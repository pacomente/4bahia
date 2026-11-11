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
- **Modo Supervivencia**: romper lleva tiempo según el bloque, lo que rompés va al inventario, hay vida con daño por caída, aire bajo el agua y reaparición.
- **Ciclo de día y noche** con sol, luna, estrellas y nubes. Hay oclusión ambiental y sombras bajo techos y árboles, niebla a distancia y vista bajo el agua.
- **Física**: gravedad, saltos, colisiones, nado y correr.
- **Partículas y sonido**: partículas al romper y sonidos sintetizados al romper, colocar y caminar.
- **Interfaz**: barra rápida, inventario (E), menú de pausa con opciones y controles, e información de depuración (F3).
- **Guardado** automático cada 30 s y al salir.

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
- **Release pública:** creá un tag `voxelia-v0.1.0` y el workflow publica una Release con el `.exe`.
- **A mano en Windows:** `npm install && npm run dist:win` deja `release/Voxelia Setup 0.1.0.exe` y una versión portable `.zip`.

El instalador no está firmado digitalmente, así que Windows SmartScreen puede mostrar "Windows protegió su PC". Se sigue con **Más información → Ejecutar de todas formas**. Para distribuirlo al público conviene un certificado de firma de código.

## Estructura

```
launcher/   main.cjs (Electron: ventanas y guardado) · preload.cjs (puente seguro) · index.html/css/js (interfaz)
game/       index.html · src/ (world, mesher, textures, player, sky, audio, ui, game) · test/
build/      icon.png
```

## Próximos pasos posibles

Crafteo y herramientas, animales y criaturas, iluminación por bloques (antorchas), multijugador en red local, mods y paquetes de texturas, y actualizaciones automáticas desde el launcher.
