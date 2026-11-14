import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;
const GRAVITY = 28;
const JUMP = 8.6;
const WALK = 4.3;
const SPRINT = 6.2;
const FLY = 11;
const SNEAK = 1.7;
const EYE_SNEAK = 1.38;
const COYOTE = 0.12;     // se puede saltar un instante después de pisar el borde
const JUMP_BUFFER = 0.14; // y apretar salto un instante antes de tocar el suelo también cuenta

export class Player {
  constructor(world, pos) {
    this.world = world;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.vel = new THREE.Vector3();
    this.yaw = pos.yaw ?? 0;
    this.pitch = pos.pitch ?? 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.fallStart = null;
    this.input = { f: 0, b: 0, l: 0, r: 0, jump: false, down: false, sprint: false };
    this.stepDist = 0;
    // Energía (supervivencia): correr y saltar la gastan; se recupera descansando.
    this.useStamina = false;
    this.stamina = 100;
    this.hasGlider = false;
    this.gliding = false;
    // Agacharse (Shift en el suelo): más lento, la cámara baja y no te caés de los bordes.
    this.sneaking = false;
    this.eyeHeight = EYE;
    this.coyote = 0; this.jumpBuffer = 0; this.prevJump = false;
    this.sprinting = false;
  }

  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }
  look() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  solidAt(x, y, z) { const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return BLOCKS[id].solid; }

  // ¿La caja del jugador en (x,y,z) choca con algún bloque sólido?
  collides(x, y, z) {
    const hw = WIDTH / 2;
    for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw - 1e-6); bx++)
      for (let by = Math.floor(y); by <= Math.floor(y + HEIGHT - 1e-6); by++)
        for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw - 1e-6); bz++)
          if (BLOCKS[this.world.getBlock(bx, by, bz)].solid) return true;
    return false;
  }

  intersectsBlock(bx, by, bz) {
    const hw = WIDTH / 2;
    return this.pos.x + hw > bx && this.pos.x - hw < bx + 1 && this.pos.y + HEIGHT > by && this.pos.y < by + 1 && this.pos.z + hw > bz && this.pos.z - hw < bz + 1;
  }

  // Devuelve eventos: { fallDamage, step }
  update(dt) {
    const events = {};
    const feet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    const head = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
    this.inWater = feet === B.WATER || feet === B.LAVA;   // en la lava también se nada (lento)
    this.inLava = feet === B.LAVA || this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1), Math.floor(this.pos.z)) === B.LAVA;
    this.headInWater = head === B.WATER;

    const i = this.input;
    const fwd = i.f - i.b;
    const side = i.r - i.l;
    const sin = Math.sin(this.yaw); const cos = Math.cos(this.yaw);
    this.sneaking = i.down && !this.flying && !this.inWater;
    const canSprint = i.sprint && !this.sneaking && (!this.useStamina || this.stamina > 2);
    let speed = this.flying ? FLY * (i.sprint ? 1.8 : 1) : this.sneaking ? SNEAK : canSprint ? SPRINT : WALK;
    this.eyeHeight += ((this.sneaking ? EYE_SNEAK : EYE) - this.eyeHeight) * Math.min(1, dt * 14);
    speed *= this.slow ?? 1;   // cubriéndose con el escudo se camina más lento
    if (this.inWater && !this.flying) speed *= 0.55;
    let mx = -sin * fwd + cos * side;
    let mz = -cos * fwd - sin * side;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; }
    this.sprinting = canSprint && len > 0 && !this.flying;
    // Salto con margen: "coyote time" y salto anticipado.
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    if (i.jump && !this.prevJump) this.jumpBuffer = JUMP_BUFFER; else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.prevJump = i.jump;
    // Aceleración suave (más control en el suelo).
    const accel = this.onGround || this.flying ? 18 : this.inWater ? 6 : 6;
    this.vel.x += (mx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (mz - this.vel.z) * Math.min(1, accel * dt);

    if (this.flying) {
      const vy = (i.jump ? 1 : 0) - (i.down ? 1 : 0);
      this.vel.y += (vy * FLY - this.vel.y) * Math.min(1, 12 * dt);
    } else if (this.inWater) {
      this.vel.y -= GRAVITY * 0.25 * dt;
      if (i.jump) this.vel.y = Math.min(this.vel.y + 30 * dt, 3.2);
      this.vel.y = Math.max(this.vel.y, -3);
    } else {
      this.vel.y -= GRAVITY * dt;
      if ((this.jumpBuffer > 0 || (i.jump && this.onGround)) && this.coyote > 0 && this.vel.y <= 0.01) {
        this.vel.y = this.useStamina && this.stamina < 6 ? JUMP * 0.75 : JUMP;
        if (this.useStamina) this.stamina = Math.max(0, this.stamina - 6);
        this.coyote = 0; this.jumpBuffer = 0;
        events.jumped = true;
      }
      this.vel.y = Math.max(this.vel.y, -55);
      // Planeador: con Espacio apretado en caída se planea hacia donde se mira.
      this.gliding = this.hasGlider && i.jump && !this.onGround && this.vel.y < 0;
      if (this.gliding) {
        this.vel.y = Math.max(this.vel.y, -2.2);
        const gx = -Math.sin(this.yaw) * 8.5; const gz = -Math.cos(this.yaw) * 8.5;
        this.vel.x += (gx - this.vel.x) * Math.min(1, 2.5 * dt);
        this.vel.z += (gz - this.vel.z) * Math.min(1, 2.5 * dt);
        this.fallStart = null;
      }
    }
    if (this.useStamina) {
      const moving = len > 0;
      if (canSprint && moving && !this.flying) this.stamina = Math.max(0, this.stamina - 16 * dt);
      else this.stamina = Math.min(100, this.stamina + (moving ? 12 : 22) * dt);
    }

    // Movimiento eje por eje con colisiones.
    const wasGround = this.onGround;
    const vyBefore = this.vel.y;
    this.onGround = false;
    const move = (axis, d) => {
      if (!d) return;
      const steps = Math.ceil(Math.abs(d) / 0.4);
      const s = d / steps;
      for (let k = 0; k < steps; k++) {
        const nx = this.pos.x + (axis === 0 ? s : 0);
        const ny = this.pos.y + (axis === 1 ? s : 0);
        const nz = this.pos.z + (axis === 2 ? s : 0);
        // Agachado sobre el suelo: no deja avanzar si debajo no quedaría nada que pisar.
        if (axis !== 1 && this.sneaking && wasGround && !this.collides(nx, ny - 0.1, nz)) {
          if (axis === 0) this.vel.x = 0; else this.vel.z = 0;
          return;
        }
        if (this.collides(nx, ny, nz)) {
          if (axis === 1) { if (s < 0) this.onGround = true; this.vel.y = 0; }
          else if (axis === 0) this.vel.x = 0; else this.vel.z = 0;
          return;
        }
        this.pos.set(nx, ny, nz);
      }
    };
    move(1, this.vel.y * dt);
    move(0, this.vel.x * dt);
    move(2, this.vel.z * dt);
    if (this.onGround && !wasGround && vyBefore < -2) events.landed = -vyBefore;

    // Daño por caída (supervivencia): altura caída al tocar el suelo.
    if (!this.onGround && !this.inWater && !this.flying && !this.gliding && this.vel.y < 0 && this.fallStart === null) this.fallStart = this.pos.y;
    if ((this.onGround || this.inWater || this.flying) && this.fallStart !== null) {
      const dist = this.fallStart - this.pos.y;
      if (this.onGround && !wasGround && dist > 3.5) events.fallDamage = Math.floor(dist - 3);
      this.fallStart = null;
    }
    if (this.onGround && len > 0) {
      this.stepDist += Math.hypot(this.vel.x, this.vel.z) * dt;
      if (this.stepDist > 2.1) { this.stepDist = 0; events.step = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5), Math.floor(this.pos.z)); }
    }
    if (this.pos.y < -20) { events.void = true; }
    return events;
  }
}
