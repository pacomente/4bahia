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
  }

  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }
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
    this.inWater = feet === B.WATER;
    this.headInWater = head === B.WATER;

    const i = this.input;
    const fwd = i.f - i.b;
    const side = i.r - i.l;
    const sin = Math.sin(this.yaw); const cos = Math.cos(this.yaw);
    let speed = this.flying ? FLY * (i.sprint ? 1.8 : 1) : i.sprint ? SPRINT : WALK;
    if (this.inWater && !this.flying) speed *= 0.55;
    let mx = -sin * fwd + cos * side;
    let mz = -cos * fwd - sin * side;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; }
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
      if (i.jump && this.onGround) this.vel.y = JUMP;
      this.vel.y = Math.max(this.vel.y, -55);
    }

    // Movimiento eje por eje con colisiones.
    const wasGround = this.onGround;
    this.onGround = false;
    const move = (axis, d) => {
      if (!d) return;
      const steps = Math.ceil(Math.abs(d) / 0.4);
      const s = d / steps;
      for (let k = 0; k < steps; k++) {
        const nx = this.pos.x + (axis === 0 ? s : 0);
        const ny = this.pos.y + (axis === 1 ? s : 0);
        const nz = this.pos.z + (axis === 2 ? s : 0);
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

    // Daño por caída (supervivencia): altura caída al tocar el suelo.
    if (!this.onGround && !this.inWater && !this.flying && this.vel.y < 0 && this.fallStart === null) this.fallStart = this.pos.y;
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
