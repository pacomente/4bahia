import * as THREE from 'three';

// Modelo de persona en bloques, con articulaciones (cabeza, torso, brazos y piernas que giran
// desde hombros y caderas). Lo usan los aldeanos y los zombis.
// look: { skin, shirt, pants, hair, eyes, hat: 'hood'|'helmet'|'wrap'|'fur'|'cap'|null, hatColor, beard, apron, scale, zombie }

// Cara pintada en una textura chica (8×8, pixel-art).
function faceTexture(look) {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = look.skin; g.fillRect(0, 0, 8, 8);
  if (look.hair && look.hat !== 'helmet') { g.fillStyle = look.hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 2); g.fillRect(7, 2, 1, 2); }
  g.fillStyle = '#ffffff'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
  g.fillStyle = look.eyes ?? '#3a2a1a'; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
  if (look.zombie) { g.fillStyle = '#1d2b14'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1); g.fillStyle = '#c23b2b'; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1); g.fillStyle = '#2a3a1f'; g.fillRect(2, 6, 4, 1); g.fillRect(3, 5, 1, 1); }
  else { g.fillStyle = '#00000033'; g.fillRect(3, 4, 2, 1); g.fillStyle = '#8a3b2b'; g.fillRect(3, 6, 2, 1); }
  if (look.beard) { g.fillStyle = look.beard; g.fillRect(1, 5, 6, 3); g.fillStyle = '#8a3b2b'; g.fillRect(3, 6, 2, 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// Pieza que gira desde un extremo (hombro, cadera): el grupo es el pivote y la caja cuelga hacia abajo.
function limb(w, h, d, mat, x, y, z) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z);
  const m = box(w, h, d, mat); m.position.y = -h / 2;
  pivot.add(m);
  return pivot;
}

export function createHumanoid(look) {
  const mats = [];
  const M = (color, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...extra }); m.userData.base = new THREE.Color(color); mats.push(m); return m; };
  const skin = M(look.skin); const shirt = M(look.shirt); const pants = M(look.pants);
  const shoe = M('#3a2c22');
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  // Piernas (cadera a 0.75).
  const legL = limb(0.24, 0.75, 0.26, pants, -0.13, 0.75, 0); const legR = limb(0.24, 0.75, 0.26, pants, 0.13, 0.75, 0);
  for (const l of [legL, legR]) { const s = box(0.25, 0.1, 0.3, shoe); s.position.set(0, -0.7, 0.02); l.add(s); }
  // Torso.
  const torso = box(0.52, 0.72, 0.3, shirt); torso.position.y = 1.11;
  body.add(legL, legR, torso);
  if (look.apron) { const a = box(0.44, 0.6, 0.02, M(look.apron)); a.position.set(0, 1.0, 0.16); body.add(a); }
  const belt = box(0.54, 0.07, 0.32, M('#4a3423')); belt.position.y = 0.8; body.add(belt);
  // Brazos (hombros a 1.42).
  const armL = limb(0.2, 0.68, 0.22, shirt, -0.37, 1.42, 0); const armR = limb(0.2, 0.68, 0.22, shirt, 0.37, 1.42, 0);
  for (const a of [armL, armR]) { const h = box(0.19, 0.14, 0.21, skin); h.position.y = -0.62; a.add(h); }
  body.add(armL, armR);
  // Cabeza (cuello a 1.47) con cara al frente.
  const head = new THREE.Group(); head.position.y = 1.47;
  const faceMat = M('#ffffff', { map: faceTexture(look) }); faceMat.userData.base = new THREE.Color('#ffffff');
  const headMats = [skin, skin, look.hair ? M(look.hair) : skin, skin, faceMat, look.hair ? M(look.hair) : skin];
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), headMats); skull.position.y = 0.23;
  head.add(skull);
  // Sombreros según el estilo y el oficio.
  if (look.hat === 'hood') { const h = box(0.52, 0.3, 0.52, M(look.hatColor)); h.position.y = 0.42; const back = box(0.52, 0.42, 0.08, M(look.hatColor)); back.position.set(0, 0.22, -0.27); head.add(h, back); }
  if (look.hat === 'helmet') { const metal = M('#a8adb4'); const h = box(0.52, 0.22, 0.52, metal); h.position.y = 0.42; const nose = box(0.06, 0.2, 0.06, metal); nose.position.set(0, 0.26, 0.26); const crest = box(0.06, 0.12, 0.4, M('#b8352f')); crest.position.y = 0.58; head.add(h, nose, crest); }
  if (look.hat === 'wrap') { const h = box(0.52, 0.18, 0.52, M(look.hatColor)); h.position.y = 0.44; const tail = box(0.14, 0.34, 0.08, M(look.hatColor)); tail.position.set(0.14, 0.2, -0.27); head.add(h, tail); }
  if (look.hat === 'fur') { const h = box(0.56, 0.2, 0.56, M(look.hatColor)); h.position.y = 0.46; const flapL = box(0.08, 0.22, 0.3, M(look.hatColor)); flapL.position.set(-0.27, 0.24, 0); const flapR = flapL.clone(); flapR.position.x = 0.27; head.add(h, flapL, flapR); }
  if (look.hat === 'bandana') {
    // Saqueador: pañuelo rojo en la cabeza y máscara oscura sobre la boca.
    const red = M(look.hatColor ?? '#8f2b26'); const mask = M('#1c1a20');
    const band = box(0.5, 0.12, 0.5, red); band.position.y = 0.4; const knot = box(0.12, 0.14, 0.06, red); knot.position.set(0.1, 0.34, -0.26);
    const m = box(0.48, 0.16, 0.06, mask); m.position.set(0, 0.1, 0.23);
    head.add(band, knot, m);
  }
  if (look.hat === 'cap') { const h = box(0.5, 0.12, 0.5, M(look.hatColor)); h.position.y = 0.5; const brim = box(0.5, 0.04, 0.2, M(look.hatColor)); brim.position.set(0, 0.45, 0.32); head.add(h, brim); }
  if (look.hat === 'crown') {
    // Corona dorada con puntas y piedras.
    const gold = M('#e8c040'); const gem = M('#c8352b');
    const band = box(0.5, 0.1, 0.5, gold); band.position.y = 0.5;
    head.add(band);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0.22], [0, -0.22], [0.22, 0], [-0.22, 0]]) { const p = box(0.07, 0.12, 0.07, gold); p.position.set(x, 0.6, z); head.add(p); }
    const g = box(0.08, 0.06, 0.02, gem); g.position.set(0, 0.5, 0.26); head.add(g);
  }
  if (look.cape) { const c = box(0.5, 0.95, 0.04, M(look.cape)); c.position.set(0, 1.0, -0.18); body.add(c); }
  body.add(head);
  // Herramienta en la mano derecha (lanza del guardia, martillo del constructor, antorcha).
  const tool = new THREE.Group(); tool.position.set(0, -0.66, 0.08); armR.add(tool);
  // Mano izquierda: escudo (guardias) o antorcha de noche.
  const offhand = new THREE.Group(); offhand.position.set(-0.04, -0.5, 0.06); armL.add(offhand);
  root.scale.setScalar(look.scale ?? 1);
  root.rotation.order = 'YXZ';   // para poder acostarse (x) mirando hacia un lado (y)
  const parts = { root, body, head, armL, armR, legL, legR, tool, offhand, mats };
  return parts;
}

// Objetos para la mano: lanza, martillo, antorcha encendida.
export function makeProp(kind) {
  const g = new THREE.Group();
  const wood = new THREE.MeshBasicMaterial({ color: '#7a5230' }); wood.userData.base = new THREE.Color('#7a5230');
  if (kind === 'spear') {
    const stick = box(0.06, 1.6, 0.06, wood); stick.position.y = 0.2; stick.rotation.x = Math.PI / 2; stick.position.set(0, 0, 0.3);
    const tipMat = new THREE.MeshBasicMaterial({ color: '#cfd4da' }); tipMat.userData.base = new THREE.Color('#cfd4da');
    const tip = box(0.1, 0.22, 0.04, tipMat); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0, 1.15);
    g.add(stick, tip); g.rotation.x = -1.2;
  }
  if (kind === 'sword') {
    // Espada de hierro: empuñadura, guarda y hoja con filo claro.
    const grip = box(0.06, 0.2, 0.06, wood); grip.position.y = 0;
    const steel = new THREE.MeshBasicMaterial({ color: '#cfd4da' }); steel.userData.base = new THREE.Color('#cfd4da');
    const dark = new THREE.MeshBasicMaterial({ color: '#7a7f88' }); dark.userData.base = new THREE.Color('#7a7f88');
    const guard = box(0.28, 0.05, 0.08, dark); guard.position.y = 0.12;
    const blade = box(0.09, 0.72, 0.03, steel); blade.position.y = 0.5;
    const edge = box(0.02, 0.7, 0.035, dark); edge.position.y = 0.5;
    const tip = box(0.05, 0.08, 0.03, steel); tip.position.y = 0.9;
    const pommel = box(0.08, 0.06, 0.08, dark); pommel.position.y = -0.12;
    g.add(grip, guard, blade, edge, tip, pommel); g.rotation.x = 1.35;
  }
  if (kind === 'shield' || kind.startsWith?.('shield:')) {
    // Escudo de madera con borde de hierro, umbo y el color de la aldea. Plano en x-z: se gira según la guardia.
    const color = kind.split(':')[1] ?? '#2f4fb8';
    const face = new THREE.MeshBasicMaterial({ color }); face.userData.base = new THREE.Color(color);
    const rim = new THREE.MeshBasicMaterial({ color: '#8a8f98' }); rim.userData.base = new THREE.Color('#8a8f98');
    const planks = new THREE.MeshBasicMaterial({ color: '#8a5a33' }); planks.userData.base = new THREE.Color('#8a5a33');
    const board = box(0.6, 0.06, 0.74, planks); board.position.y = -0.06;
    const paint = box(0.5, 0.065, 0.64, face); paint.position.y = -0.065;
    const stripe = box(0.12, 0.07, 0.64, planks); stripe.position.y = -0.068;
    const boss = box(0.16, 0.08, 0.16, rim); boss.position.y = -0.1;
    const top = box(0.62, 0.07, 0.05, rim); top.position.set(0, -0.06, 0.37); const bot = top.clone(); bot.position.z = -0.37;
    const l = box(0.05, 0.07, 0.76, rim); l.position.set(-0.31, -0.06, 0); const r2 = l.clone(); r2.position.x = 0.31;
    g.add(board, paint, stripe, boss, top, bot, l, r2);
    g.userData.shield = true;
  }
  if (kind === 'hammer') {
    const stick = box(0.06, 0.5, 0.06, wood); stick.position.y = 0.1;
    const headMat = new THREE.MeshBasicMaterial({ color: '#8b8b8b' }); headMat.userData.base = new THREE.Color('#8b8b8b');
    const h = box(0.28, 0.12, 0.12, headMat); h.position.y = 0.36;
    g.add(stick, h); g.rotation.x = 1.2;
  }
  if (kind === 'torch') {
    const stick = box(0.06, 0.45, 0.06, wood); stick.position.y = 0.12;
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: '#ffcf4d' })); flame.position.y = 0.4;
    g.add(stick, flame); g.rotation.x = 1.1; g.userData.flame = flame;
  }
  if (kind === 'axe') {
    const stick = box(0.06, 0.55, 0.06, wood); stick.position.y = 0.12;
    const headMat = new THREE.MeshBasicMaterial({ color: '#9aa0a8' }); headMat.userData.base = new THREE.Color('#9aa0a8');
    const h = box(0.06, 0.2, 0.18, headMat); h.position.set(0, 0.32, 0.08);
    g.add(stick, h); g.rotation.x = 1.2;
  }
  if (kind === 'bow') {
    const m = new THREE.MeshBasicMaterial({ color: '#6b4426' }); m.userData.base = new THREE.Color('#6b4426');
    for (let k = -3; k <= 3; k++) { const seg = box(0.05, 0.14, 0.05, m); seg.position.set(0, k * 0.12, 0.25 - Math.abs(k) * 0.05); g.add(seg); }
    const str = new THREE.MeshBasicMaterial({ color: '#e8e4d8' }); str.userData.base = new THREE.Color('#e8e4d8');
    const s2 = box(0.01, 0.84, 0.01, str); s2.position.z = 0.08; g.add(s2);
  }
  if (kind === 'rod') {
    const stick = box(0.04, 1.3, 0.04, wood); stick.position.set(0, 0.5, 0.3); stick.rotation.x = 0.5;
    const lineMat = new THREE.MeshBasicMaterial({ color: '#e8e4d8' }); lineMat.userData.base = new THREE.Color('#e8e4d8');
    const line = box(0.01, 1.1, 0.01, lineMat); line.position.set(0, 0.6, 1.0);
    const bob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: '#d8352b' })); bob.position.set(0, 0.05, 1.0);
    g.add(stick, line, bob); g.rotation.x = 0.9;
  }
  if (kind === 'basket') {
    const m = new THREE.MeshBasicMaterial({ color: '#b08a55' }); m.userData.base = new THREE.Color('#b08a55');
    const b = box(0.3, 0.22, 0.24, m); b.position.set(0, 0, 0.12); g.add(b);
  }
  return g;
}

// Animación de una persona. state: { t, walk (0..1 velocidad), action: 'idle'|'walk'|'build'|'wave'|'talk'|'zombie'|'cheer'|'sit', lookYaw, lookPitch }
export function animateHumanoid(p, s) {
  const sw = Math.sin(s.phase) * s.walk;
  p.legL.rotation.x = sw * 0.8; p.legR.rotation.x = -sw * 0.8;
  p.body.position.y = Math.abs(Math.cos(s.phase)) * 0.05 * s.walk + Math.sin(s.t * 1.8) * 0.008;   // paso + respiración
  p.body.rotation.z = Math.sin(s.phase) * 0.03 * s.walk;
  // Cabeza: mira al objetivo (girando hasta 70°) y asiente al hablar.
  p.head.rotation.y = Math.max(-1.2, Math.min(1.2, s.lookYaw ?? 0));
  p.head.rotation.x = (s.lookPitch ?? 0) + (s.action === 'talk' ? Math.sin(s.t * 9) * 0.08 : 0);
  let aL = -sw * 0.7; let aR = sw * 0.7; let aLz = 0; let aRz = 0;
  if (s.action === 'zombie') { aL = -1.45 + Math.sin(s.t * 2) * 0.1; aR = -1.4 + Math.sin(s.t * 2 + 1) * 0.1; p.body.rotation.x = 0.12; p.head.rotation.z = Math.sin(s.t * 1.3) * 0.15; }
  else p.body.rotation.x = 0;
  if (s.action === 'build') aR = -1.6 + Math.abs(Math.sin(s.t * 7)) * 1.3;            // martillazos
  if (s.action === 'farm') { aR = -0.9 + Math.sin(s.t * 4) * 0.5; aL = -0.9 + Math.sin(s.t * 4 + Math.PI) * 0.5; p.body.rotation.x = 0.35; }
  if (s.action === 'wave') { aR = Math.PI; aRz = -0.3 + Math.sin(s.t * 10) * 0.35; }
  if (s.action === 'talk') { aR = -0.5 + Math.sin(s.t * 5) * 0.25; aL = -0.3 + Math.sin(s.t * 4 + 1) * 0.2; }
  if (s.action === 'cheer') { aR = Math.PI - 0.2; aL = Math.PI - 0.2; aRz = -0.2; aLz = 0.2; p.body.position.y += Math.abs(Math.sin(s.t * 8)) * 0.15; }
  if (s.action === 'scared') { aR = -2.6; aL = -2.6; aRz = 0.4; aLz = -0.4; }
  if (s.action === 'guard') { aR = -0.35; }
  if (s.action === 'attack') aR = -1.8 + Math.sin(s.t * 14) * 0.9;
  // Combate con espada y escudo: guardia, tajo (swing 0..1) y escudo arriba (block 0..1).
  const block = s.block ?? 0;
  if (s.action === 'fight') {
    aR = -0.75 + Math.sin(s.t * 2) * 0.05; aRz = -0.1;
    aL = -0.45 - block * 1.05; aLz = block * 0.45;
    p.body.rotation.x = 0.08 + block * 0.08;
    if (s.swing >= 0) { aR = -2.75 + s.swing * 2.7; aRz = -0.2 + s.swing * 0.1; p.legR.rotation.x = -0.35 * Math.sin(s.swing * Math.PI); p.legL.rotation.x = 0.25 * Math.sin(s.swing * Math.PI); }
  }
  if (p.offhand?.children.length) {
    const sh = p.offhand.children[0].userData.shield;
    // El escudo cuelga al costado y, al cubrirse, gira para tapar el frente.
    p.offhand.rotation.z = sh ? (1 - (s.action === 'fight' ? Math.max(block, 0.35) : 0)) * Math.PI / 2 : 0;
    if (sh && s.action === 'fight') p.offhand.rotation.y = -block * 0.4;
  }
  if (s.action === 'fight' && s.swing >= 0) p.body.rotation.y = -0.35 + s.swing * 0.7;
  else if (s.action === 'chop') { const k = Math.abs(Math.sin(s.t * 4)); aR = -1.9 + k * 1.4; aL = -1.7 + k * 1.3; p.body.rotation.y = -0.4 + k * 0.5; }
  else p.body.rotation.y = 0;
  if (s.action === 'eat') { aR = -2.3 + Math.abs(Math.sin(s.t * 6)) * 0.25; aRz = 0.5; p.head.rotation.x = 0.1 + Math.sin(s.t * 12) * 0.05; }
  if (s.action === 'fish') { aR = -1.0 + Math.sin(s.t * 1.5) * 0.08; aL = -0.8; }
  if (s.action === 'sit') { p.legL.rotation.x = -Math.PI / 2; p.legR.rotation.x = -Math.PI / 2; aR = -1.1 + Math.abs(Math.sin(s.t * 3)) * 0.4; aL = -0.7; p.body.position.y = Math.sin(s.t * 1.8) * 0.006; }
  if (s.action === 'sleep') { aR = 0; aL = 0; p.legL.rotation.x = 0; p.legR.rotation.x = 0; p.head.rotation.y = 0; p.head.rotation.x = 0; p.body.position.y = Math.sin(s.t * 1.2) * 0.01; }
  p.armL.rotation.x = aL; p.armR.rotation.x = aR; p.armL.rotation.z = aLz; p.armR.rotation.z = aRz;
}

// Luz sobre el modelo: multiplica los colores base (0..1), con un tinte rojo al recibir golpes.
export function lightHumanoid(p, light, flash = 0) {
  for (const m of p.mats) {
    if (flash > 0) m.color.setRGB(1, 0.45, 0.45);
    else m.color.copy(m.userData.base).multiplyScalar(light);
  }
}
