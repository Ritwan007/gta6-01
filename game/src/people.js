// people.js — the humans. The player's figure (Nico Vega, teal jacket) with a
// swinging walk cycle, and the pedestrians of Port Meridian: residents who
// stroll the sidewalk ring of their block, dive away from fast cars, and go
// down when clipped — each outcome the wanted rules hear about from game.js.

import * as THREE from 'three';
import { BLOCKS, BLOCK_SIZE } from './cityplan.js';
import { groundDistance } from './rng.js';

const SKIN = [0xe8b88a, 0xc68863, 0x8a5a3b, 0xf0c8a0, 0x6e4525];
const SHIRTS = [0xd94f70, 0x3f8fd2, 0xf2e3c9, 0x39b56e, 0x8a63d2, 0xe07b2a, 0xdadada, 0x274156];

function limb(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
}

/** Nico's figure: articulated arms and legs the walk cycle swings. */
export class PlayerFigure {
  constructor(scene) {
    const group = new THREE.Group();
    const jacket = 0x0f766e;
    const denim = 0x24304a;
    this.legL = limb(0.15, 0.55, 0.17, denim);
    this.legL.position.set(-0.1, 0.56, 0);
    this.legR = limb(0.15, 0.55, 0.17, denim);
    this.legR.position.set(0.1, 0.56, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.25), new THREE.MeshLambertMaterial({ color: jacket }));
    torso.position.y = 0.88;
    this.armL = limb(0.11, 0.52, 0.13, jacket);
    this.armL.position.set(-0.3, 1.14, 0);
    this.armR = limb(0.11, 0.52, 0.13, jacket);
    this.armR.position.set(0.3, 1.14, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc68863 }));
    head.position.y = 1.36;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), new THREE.MeshLambertMaterial({ color: 0x11131a }));
    cap.position.y = 1.49;
    group.add(this.legL, this.legR, torso, this.armL, this.armR, head, cap);
    this.group = group;
    this.phase = 0;
    scene.add(group);
  }

  /** speed in m/s; the stride follows it, and settles to a sway at rest. */
  update(dt, speed) {
    this.phase += dt * (2.2 + speed * 1.55);
    const swing = Math.min(0.75, speed * 0.16);
    this.legL.rotation.x = Math.sin(this.phase) * swing;
    this.legR.rotation.x = -Math.sin(this.phase) * swing;
    this.armL.rotation.x = -Math.sin(this.phase) * swing * 0.8;
    this.armR.rotation.x = Math.sin(this.phase) * swing * 0.8;
    this.group.position.y = Math.abs(Math.sin(this.phase)) * 0.045 * Math.min(1, speed);
  }

  /** A one-shot shove pose (the arm swings out); game.js times the recovery. */
  shovePose() {
    this.armR.rotation.x = -1.5;
  }
}

class Pedestrian {
  constructor(scene, rng) {
    const block = rng.pick(BLOCKS);
    this.block = block;
    this.half = BLOCK_SIZE / 2 + 3.2;
    this.s = rng.range(0, this.perimeter());
    this.speed = rng.range(0.85, 1.35);
    this.state = 'walk';
    this.stateTime = 0;
    this.fleeFrom = null;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.62, 3, 8),
      new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) }),
    );
    body.position.y = 0.82;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 7), new THREE.MeshLambertMaterial({ color: rng.pick(SKIN) }));
    head.position.y = 1.42;
    group.add(body, head);
    this.group = group;
    scene.add(group);
    this.pos = { x: block.cx, z: block.cz };
    this.heading = 0;
    this.placeOnPath();
  }

  perimeter() {
    return this.half * 8;
  }

  /** Position and heading at path distance s around the block's sidewalk ring. */
  placeOnPath() {
    const h = this.half;
    const side = Math.floor(this.s / (h * 2)) % 4;
    const t = this.s - side * h * 2 - h; // -h..h along the side
    const { cx, cz } = this.block;
    if (side === 0) {
      this.pos = { x: cx + t, z: cz - h };
      this.heading = Math.PI / 2;
    } else if (side === 1) {
      this.pos = { x: cx + h, z: cz + t };
      this.heading = 0;
    } else if (side === 2) {
      this.pos = { x: cx - t, z: cz + h };
      this.heading = -Math.PI / 2;
    } else {
      this.pos = { x: cx - h, z: cz - t };
      this.heading = Math.PI;
    }
    this.syncMesh(0);
  }

  syncMesh(bob) {
    this.group.position.set(this.pos.x, this.state === 'down' ? 0.25 : bob, this.pos.z);
    this.group.rotation.y = this.heading;
    this.group.rotation.x = this.state === 'down' ? -Math.PI / 2 : 0;
  }

  update(dt) {
    this.stateTime += dt;
    if (this.state === 'down') {
      if (this.stateTime > 4.5) {
        this.state = 'walk';
        this.stateTime = 0;
      }
      this.syncMesh(0);
      return;
    }
    if (this.state === 'flee' && this.fleeFrom) {
      const away = Math.atan2(this.pos.x - this.fleeFrom.x, this.pos.z - this.fleeFrom.z);
      this.heading = away;
      this.pos.x += Math.sin(away) * 3.4 * dt;
      this.pos.z += Math.cos(away) * 3.4 * dt;
      if (this.stateTime > 2.6) {
        this.state = 'walk';
        this.stateTime = 0;
        // Rejoin the ring at the nearest point: nudge s by snapping to the block edge.
        const dx = this.pos.x - this.block.cx;
        const dz = this.pos.z - this.block.cz;
        if (Math.abs(dx) > Math.abs(dz)) this.pos.x = this.block.cx + Math.sign(dx) * this.half;
        else this.pos.z = this.block.cz + Math.sign(dz) * this.half;
      }
      this.syncMesh(Math.abs(Math.sin(this.stateTime * 10)) * 0.05);
      return;
    }
    this.s = (this.s + this.speed * dt) % this.perimeter();
    this.placeOnPath();
    this.syncMesh(Math.abs(Math.sin(this.s * 2.4)) * 0.035);
  }

  knockDown() {
    if (this.state === 'down') return false;
    this.state = 'down';
    this.stateTime = 0;
    return true;
  }

  flee(from) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.stateTime = 0;
    this.fleeFrom = from;
  }
}

export class Pedestrians {
  constructor(scene, rng, count = 18) {
    this.peds = [];
    for (let i = 0; i < count; i += 1) this.peds.push(new Pedestrian(scene, rng));
  }

  update(dt) {
    for (const ped of this.peds) ped.update(dt);
  }

  /** Knock down everyone within radius of pos; returns how many fell (for heat). */
  knockAt(pos, radius) {
    let fell = 0;
    for (const ped of this.peds) {
      if (groundDistance(ped.pos, pos) <= radius && ped.knockDown()) fell += 1;
    }
    return fell;
  }

  /** Everyone near pos who can run, runs. */
  scareAt(pos, radius) {
    for (const ped of this.peds) {
      if (groundDistance(ped.pos, pos) <= radius) ped.flee(pos);
    }
  }

  positions() {
    return this.peds.map((ped) => ({ x: ped.pos.x, z: ped.pos.z, down: ped.state === 'down' }));
  }
}
