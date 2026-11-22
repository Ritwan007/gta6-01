// player.js — Jax Marlowe, on foot and behind the wheel.
//
// The Player owns one body (a capsule in a cream jacket) and, when it
// steals one, one car record from the fleet. On foot it walks where the
// camera points; in a car it runs a small arcade model — throttle, brake,
// handbrake, steering that bites harder the faster you go — against the
// city's colliders and its parked and moving traffic.
//
// Collision feel is the whole game here, so it is split in two: a push
// that lands mostly on the nose is a CRASH (bounce, thud, lost speed),
// while a push that lands mostly on the flank is a GRAZE — the car
// slides along the wall and keeps its speed. A graze must never flip
// the car into reverse: scrape, don't bounce.

import * as THREE from "three";
import { LANDMARKS, clampToWorld } from "./logic.js";
import { resolveCollisions } from "./world.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Turn `from` toward `to` along the short arc, by at most `step`. */
function turnToward(from, to, step) {
  let turn = to - from;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return from + clamp(turn, -step, step);
}

const TOP_SPEED = { sport: 38, taxi: 30, sedan: 31, police: 34 };
const CAR_RADIUS = 1.7;   // the same circle the police resolve with
const FOOT_RADIUS = 0.55;

export class Player {
  constructor(scene, fleet, colliders, hooks = {}) {
    this.fleet = fleet;
    this.colliders = colliders;
    this.hooks = hooks;
    this.mode = "foot";
    this.car = null;
    this.x = LANDMARKS.spawn.x;
    this.z = LANDMARKS.spawn.z;
    this.heading = LANDMARKS.spawn.heading;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.walkPhase = 0;
    this.crashCooldown = 0;

    // The body: cream jacket, pink cap, legs that swing when he runs.
    const group = new THREE.Group();
    const jacket = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.30, 0.72, 3, 8),
      new THREE.MeshBasicMaterial({ color: 0xf2ede4 }),
    );
    jacket.position.y = 0.95;
    group.add(jacket);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xc68863 }),
    );
    head.position.y = 1.62;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.09, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
    );
    cap.position.y = 1.79;
    group.add(cap);
    const legGeo = new THREE.BoxGeometry(0.13, 0.52, 0.13);
    const legMat = new THREE.MeshBasicMaterial({ color: 0x232838 });
    this.legL = new THREE.Mesh(legGeo, legMat);
    this.legL.position.set(-0.12, 0.28, 0);
    this.legR = new THREE.Mesh(legGeo, legMat);
    this.legR.position.set(0.12, 0.28, 0);
    group.add(this.legL, this.legR);
    group.position.set(this.x, 0, this.z);
    scene.add(group);
    this.mesh = group;
  }

  /** The closest stealable car, or null. Police rides are not on offer. */
  nearestCar() {
    let best = null;
    let bestD = 3.4;
    for (const car of this.fleet.cars) {
      if (car.dead || car.kind === "police" || car.driver === "player") continue;
      if (Math.abs(car.speed) > 2.5) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    this.mode = "car";
    this.car = car;
    car.driver = "player";
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.speed = car.speed;
    this.mesh.visible = false;
    this.hooks.onStoleCar?.(car);
    if (!car.stolenBefore) {
      car.stolenBefore = true;
      this.hooks.onCrime?.("theft");
    }
    this.hooks.audio?.enter();
  }

  exitCar() {
    const car = this.car;
    if (!car) { this.mode = "foot"; return; }
    car.driver = null;
    car.speed = 0;
    this.car = null;
    this.mode = "foot";
    // Step out on the left side of the car, clear of the door swing.
    const lx = -Math.cos(this.heading);
    const lz = Math.sin(this.heading);
    let px = car.x + lx * 1.8;
    let pz = car.z + lz * 1.8;
    const resolved = resolveCollisions({ x: px, z: pz }, FOOT_RADIUS, this.colliders);
    px = resolved.x;
    pz = resolved.z;
    const clamped = clampToWorld({ x: px, z: pz });
    this.x = clamped.x;
    this.z = clamped.z;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.mesh.visible = true;
  }

  /** Space, on foot: put the nearest pedestrian on the pavement. */
  shove(crowd) {
    const fx = this.x + Math.sin(this.heading) * 1.15;
    const fz = this.z + Math.cos(this.heading) * 1.15;
    const ped = crowd.nearest(fx, fz, 1.8);
    if (ped && ped.state !== "down") {
      crowd.knockDown(ped, () => this.hooks.onCrime?.("assault"));
    }
  }

  update(dt, input) {
    if (this.crashCooldown > 0) this.crashCooldown -= dt;
    if (this.mode === "car") this.updateCar(dt, input);
    else this.updateFoot(dt, input);
    // Keep the body where the state says it is.
    this.mesh.position.set(this.x, this.mode === "foot" ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  updateFoot(dt, input) {
    const yaw = input.camYaw ?? this.heading;
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // Camera basis: forward is where the camera looks; right is its right.
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = -Math.cos(yaw);
    const rz = Math.sin(yaw);
    let mx = fx * f + rx * r;
    let mz = fz * f + rz * r;
    const len = Math.hypot(mx, mz);
    const target = len > 0.01 ? (input.sprint ? 8.4 : 5.4) : 0;
    this.speed += clamp(target - this.speed, -26 * dt, 26 * dt);
    const ox = this.x;
    const oz = this.z;
    if (len > 0.01 && this.speed > 0.05) {
      mx /= len;
      mz /= len;
      this.heading = turnToward(this.heading, Math.atan2(mx, mz), 11 * dt);
      let nx = this.x + mx * this.speed * dt;
      let nz = this.z + mz * this.speed * dt;
      const resolved = resolveCollisions({ x: nx, z: nz }, FOOT_RADIUS, this.colliders);
      nx = resolved.x;
      nz = resolved.z;
      // Cars are furniture too: don't walk through them.
      for (const car of this.fleet.cars) {
        if (car.dead) continue;
        const dx = nx - car.x;
        const dz = nz - car.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 2.35) {
          nx = car.x + (dx / d) * 2.35;
          nz = car.z + (dz / d) * 2.35;
        }
      }
      const clamped = clampToWorld({ x: nx, z: nz });
      this.x = clamped.x;
      this.z = clamped.z;
      this.walkPhase += dt * (2.2 + this.speed * 1.35);
    }
    this.vx = dt > 0 ? (this.x - ox) / dt : 0;
    this.vz = dt > 0 ? (this.z - oz) / dt : 0;
    const swing = Math.sin(this.walkPhase) * clamp(this.speed / 5, 0, 1) * 0.55;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }

  updateCar(dt, input) {
    const car = this.car;
    const top = (TOP_SPEED[car.kind] ?? 31) + (input.sprint ? 5 : 0);
    if (input.forward) {
      this.speed += (input.sprint ? 20 : 14.5) * dt;
    } else if (input.back) {
      this.speed -= (this.speed > 0.5 ? 30 : 11) * dt;
    } else {
      this.speed -= this.speed * 0.5 * dt; // engine braking and drag
      if (Math.abs(this.speed) < 0.35) this.speed = 0;
    }
    if (input.handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 20 * dt);
    }
    this.speed = clamp(this.speed, -10, top);

    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (steer !== 0 && Math.abs(this.speed) > 0.2) {
      const bite = Math.min(1, Math.abs(this.speed) / 7);
      const rate = 1.8 * bite * (input.handbrake ? 1.55 : 1);
      this.heading += steer * rate * dt * Math.sign(this.speed);
    }

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.x + fx * this.speed * dt;
    let nz = this.z + fz * this.speed * dt;

    // Buildings and fences: crash on the nose, graze on the flank.
    const resolved = resolveCollisions({ x: nx, z: nz }, CAR_RADIUS, this.colliders);
    if (resolved.x !== nx || resolved.z !== nz) {
      const pushX = resolved.x - nx;
      const pushZ = resolved.z - nz;
      const pushLen = Math.hypot(pushX, pushZ) || 1;
      const noseDot = (pushX * fx + pushZ * fz) / pushLen; // < 0: the wall pushed back at the nose
      if (noseDot < -0.55 && Math.abs(this.speed) > 4.5) {
        if (this.crashCooldown <= 0) {
          this.hooks.onCrash?.(Math.abs(this.speed));
          this.crashCooldown = 0.4;
        }
        this.speed = -this.speed * 0.32; // the bounce
      } else if (Math.abs(this.speed) > 10 && this.crashCooldown <= 0) {
        this.hooks.onCrash?.(Math.abs(this.speed) * 0.3); // a graze: a scrape, kept quiet
        this.crashCooldown = 0.5;
      }
      nx = resolved.x;
      nz = resolved.z;
    }

    // Other cars: a heavier conversation, settled by shoving apart.
    for (const other of this.fleet.cars) {
      if (other === car || other.dead) continue;
      const dx = nx - other.x;
      const dz = nz - other.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 3.55) {
        nx = other.x + (dx / d) * 3.55;
        nz = other.z + (dz / d) * 3.55;
        if (Math.abs(this.speed) > 7.5 && this.crashCooldown <= 0) {
          this.hooks.onCrash?.(Math.abs(this.speed));
          this.crashCooldown = 0.4;
        }
        this.speed *= 0.55;
      }
    }

    const clamped = clampToWorld({ x: nx, z: nz });
    this.x = clamped.x;
    this.z = clamped.z;
    car.x = this.x;
    car.z = this.z;
    car.heading = this.heading;
    car.speed = this.speed;
    this.vx = fx * this.speed;
    this.vz = fz * this.speed;
  }
}

// ---------------------------------------------------------------------------
// The follow camera: lazy behind the player, obedient to the mouse. Its
// yaw is the player's movement basis on foot, so it reports it as
// moveYaw — forward on the keys is always away from this camera.
// ---------------------------------------------------------------------------

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.34;
    this.dist = 9;
    this.userHold = 0;
    this.smooth = null;
  }

  get moveYaw() {
    return this.yaw;
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.0052;
    this.pitch = clamp(this.pitch + dy * 0.0035, 0.07, 1.05);
    this.userHold = 2.6;
  }

  zoom(dy) {
    this.dist = clamp(this.dist + dy * 0.012, 6, 30);
  }

  update(dt, player) {
    if (this.smooth === null) this.yaw = player.heading; // start behind the player
    if (this.userHold > 0) this.userHold -= dt;
    // Driving straightens the camera out behind the car, hands off — and
    // the pitch drifts back to cruise height while it is at it.
    if (player.mode === "car" && this.userHold <= 0 && Math.abs(player.speed) > 2) {
      const rate = 1.9 * Math.min(1, Math.abs(player.speed) / 10);
      this.yaw = turnToward(this.yaw, player.heading, rate * dt);
      this.pitch += (0.34 - this.pitch) * Math.min(1, dt * 1.2);
    }
    const targetDist = player.mode === "car" ? 11.5 : 8.5;
    this.dist += (targetDist - this.dist) * Math.min(1, dt * 1.8);
    const flat = Math.cos(this.pitch) * this.dist;
    const cx = player.x - Math.sin(this.yaw) * flat;
    const cz = player.z - Math.cos(this.yaw) * flat;
    const cy = 1.5 + Math.sin(this.pitch) * this.dist;
    if (this.smooth === null) {
      // First frame of the night: start on the player's shoulder, not
      // swooping in from the middle of the map.
      this.smooth = new THREE.Vector3(cx, cy, cz);
    }
    const k = 1 - Math.exp(-dt * 7.5);
    this.smooth.x += (cx - this.smooth.x) * k;
    this.smooth.y += (cy - this.smooth.y) * k;
    this.smooth.z += (cz - this.smooth.z) * k;
    this.camera.position.copy(this.smooth);
    this.camera.lookAt(player.x, 1.7, player.z);
  }
}
