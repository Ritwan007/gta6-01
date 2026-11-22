// player.js — Jax Marlowe: walking, driving, stealing, and the camera that
// follows him through Port Meridian.

import * as THREE from "three";
import { isRoad, isYard, WATER_X, PIER_Z, clampToWorld } from "./logic.js";
import { resolveCollisions } from "./world.js";

/** A small low-poly person in a loud shirt — Jax's body on foot. */
function makePersonMesh(shirtColor) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.72, 3, 8), mat(shirtColor));
  torso.position.y = 0.92;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), mat(0xc68863));
  head.position.y = 1.68;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.17, 0.62, 0.17);
  const legL = new THREE.Mesh(legGeo, mat(0x23242e));
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);
  const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.13);
  const armL = new THREE.Mesh(armGeo, mat(shirtColor));
  armL.position.set(-0.42, 0.98, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armL, armR);
  return { group: g, legL, legR, armL, armR };
}

export class Player {
  constructor(scene, fleet, colliders, hooks) {
    this.fleet = fleet;
    this.colliders = colliders;
    this.hooks = hooks;
    this.mesh = makePersonMesh(0xff2e88);
    scene.add(this.mesh.group);
    // Twin headlight beams that belong to whatever car Jax is driving.
    this.beams = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.13, depthWrite: false });
    for (const dx of [-0.62, 0.62]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 13, 10, 1, true), beamMat);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(dx, 0.62, 8.4);
      this.beams.add(cone);
    }
    this.beamLight = new THREE.SpotLight(0xffe0b0, 260, 42, 0.62, 0.5, 1.2);
    this.beams.add(this.beamLight);
    this.beamLight.position.set(0, 1.1, 1.5);
    this.beamTarget = new THREE.Object3D();
    this.beams.add(this.beamTarget);
    this.beamLight.target = this.beamTarget;
    this.beamTarget.position.set(0, 0, 26);
    this.beams.visible = false;
    scene.add(this.beams);

    this.x = 124; this.z = -30; this.heading = Math.PI;
    this.mode = "foot"; // foot | car
    this.car = null;
    this.speed = 0;
    this.vx = 0; this.vz = 0;
    this.bob = 0;
    this.steer = 0;
  }

  get pos() { return { x: this.x, z: this.z }; }

  /** The nearest stealable car within reach, or null. */
  nearestCar(maxDist = 3.6) {
    let best = null, bestD = maxDist;
    for (const car of this.fleet.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    this.mode = "car";
    this.car = car;
    car.driver = "player";
    car.parked = false;
    this.speed = car.speed ?? 0;
    this.mesh.group.visible = false;
    this.beams.visible = true;
    if (!car.stolenBefore) {
      car.stolenBefore = true;
      this.hooks.onCrime?.("theft");
      this.hooks.onStoleCar?.(car);
    }
    this.hooks.audio?.enter();
  }

  exitCar() {
    const car = this.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    car.parked = true;
    // Step out on the left side of the car.
    const sideX = -Math.cos(car.heading), sideZ = Math.sin(car.heading);
    this.x = car.x + sideX * 2.1;
    this.z = car.z + sideZ * 2.1;
    this.heading = car.heading;
    this.mode = "foot";
    this.car = null;
    this.speed = 0;
    this.mesh.group.visible = true;
    this.beams.visible = false;
    const p = resolveCollisions({ x: this.x, z: this.z }, 0.7, this.colliders);
    this.x = p.x; this.z = p.z;
  }

  /** Shove whoever stands in front of Jax. Returns true if it connected. */
  shove(crowd) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const ped = crowd.nearest(this.x + fx * 1.1, this.z + fz * 1.1, 1.5);
    if (!ped) return false;
    crowd.knockDown(ped, () => this.hooks.onCrime?.("assault"));
    this.hooks.audio?.thud(0.4);
    return true;
  }

  update(dt, input) {
    if (this.mode === "car") this.updateDriving(dt, input);
    else this.updateWalking(dt, input);
    // Keep the body (or the beams) where the player is.
    if (this.mode === "foot") {
      this.mesh.group.position.set(this.x, 0, this.z);
      this.mesh.group.rotation.y = this.heading;
      const swing = Math.sin(this.bob) * (this.speed > 0.2 ? 0.55 : 0);
      this.mesh.legL.rotation.x = swing;
      this.mesh.legR.rotation.x = -swing;
      this.mesh.armL.rotation.x = -swing * 0.8;
      this.mesh.armR.rotation.x = swing * 0.8;
    } else if (this.car) {
      this.beams.position.set(this.car.x, 0, this.car.z);
      this.beams.rotation.y = this.car.heading;
    }
  }

  updateWalking(dt, input) {
    const sprint = input.sprint ? 1.55 : 1;
    const speedTarget = 5.2 * sprint;
    let mx = 0, mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      // Move relative to the camera's yaw so WASD feels like it should.
      const yaw = input.camYaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = Math.sin(yaw - Math.PI / 2), rz = Math.cos(yaw - Math.PI / 2);
      const dx = fx * mz + rx * mx;
      const dz = fz * mz + rz * mx;
      const len = Math.hypot(dx, dz) || 1;
      this.heading = Math.atan2(dx / len, dz / len);
      this.speed = speedTarget;
      this.x += (dx / len) * this.speed * dt;
      this.z += (dz / len) * this.speed * dt;
      this.bob += dt * (input.sprint ? 13 : 10);
    } else {
      this.speed = 0;
    }
    const p = resolveCollisions({ x: this.x, z: this.z }, 0.7, this.colliders);
    this.x = p.x; this.z = p.z;
    this.keepOnLand(0.7);
    this.vx = 0; this.vz = 0;
  }

  updateDriving(dt, input) {
    const car = this.car;
    const boost = input.sprint ? 1.35 : 1;
    const maxSpeed = 30 * boost;
    if (input.forward) this.speed += 13.5 * dt * (this.speed < 0 ? 2.2 : 1);
    else if (input.back) {
      if (this.speed > 0.6) this.speed -= 26 * dt; // brake
      else this.speed -= 7.5 * dt; // reverse
    }
    if (input.handbrake) this.speed -= this.speed * 3.2 * dt;
    // Drag and rolling resistance, heavier off the tarmac.
    const offRoad = !isRoad(car.x, car.z) && !isYard(car.x, car.z);
    const onSand = car.x > 144 && Math.abs(car.z - PIER_Z) > 6;
    const dragK = onSand ? 1.5 : offRoad ? 0.55 : 0.28;
    this.speed -= this.speed * dragK * dt;
    if (!input.forward && !input.back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.4 * dt);
    this.speed = Math.max(-8.5, Math.min(maxSpeed, this.speed));
    // Steering: less bite as the speed climbs.
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += Math.max(-6 * dt, Math.min(6 * dt, steerTarget * 0.58 - this.steer));
    if (Math.abs(this.speed) > 0.05) {
      car.heading += (this.speed / 2.75) * Math.tan(this.steer) * dt;
    }
    const prevX = car.x, prevZ = car.z;
    car.x += Math.sin(car.heading) * this.speed * dt;
    car.z += Math.cos(car.heading) * this.speed * dt;
    car.speed = this.speed;
    // Body collisions. A head-on hit bounces the car back; a graze along a
    // wall just scrubs a little speed and lets the car slide — killing the
    // speed on any correction would grind the car to a halt whenever it
    // brushes a building, which city driving does constantly.
    const before = { x: car.x, z: car.z };
    const p = resolveCollisions(before, 1.75, this.colliders);
    if (p.x !== car.x || p.z !== car.z) {
      const corrX = p.x - car.x, corrZ = p.z - car.z;
      const corrLen = Math.hypot(corrX, corrZ) || 1;
      const velX = Math.sin(car.heading) * Math.sign(this.speed);
      const velZ = Math.cos(car.heading) * Math.sign(this.speed);
      const headOn = (corrX * velX + corrZ * velZ) / corrLen; // -1 = straight back
      car.x = p.x; car.z = p.z;
      if (headOn < -0.45) {
        if (Math.abs(this.speed) > 6) this.hooks.onCrash?.(Math.abs(this.speed));
        this.speed *= -0.22;
      } else {
        this.speed *= 0.94;
      }
      car.speed = this.speed;
    }
    this.hitOtherCars(prevX, prevZ);
    this.keepOnLand(1.75, car);
    this.x = car.x; this.z = car.z;
    this.heading = car.heading;
    this.vx = Math.sin(car.heading) * this.speed;
    this.vz = Math.cos(car.heading) * this.speed;
    this.hooks.audio?.engine(this.speed, input.forward);
  }

  /** Bump other cars out of the way; hard bumps are crimes and crashes. */
  hitOtherCars() {
    const car = this.car;
    for (const other of this.fleet.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d >= 3.6 || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      const push = (3.6 - d) / 2;
      other.x += nx * push;
      other.z += nz * push;
      car.x -= nx * push * 0.6;
      car.z -= nz * push * 0.6;
      if (Math.abs(this.speed) > 5) {
        other.speed = Math.max(other.speed, Math.abs(this.speed) * 0.35);
        this.speed *= 0.55;
        car.speed = this.speed;
        this.hooks.onCrash?.(Math.abs(this.speed));
        if (other.kind === "police") this.hooks.onCrime?.("policeHit");
        if (other.traffic) { other.traffic.speed = Math.min(other.traffic.speed, 2); }
      }
    }
  }

  /** The sea is not a road: stop at the waterline unless on the pier. */
  keepOnLand(radius, obj = this) {
    const onPier = Math.abs(obj.z - PIER_Z) <= 6 && obj.x > 170;
    if (obj.x > WATER_X - radius && !onPier) {
      obj.x = WATER_X - radius;
      if (obj === this.car) { this.speed *= 0.4; }
    }
    const p = clampToWorld({ x: obj.x, z: obj.z });
    obj.x = p.x; obj.z = p.z;
  }
}

// ---------------------------------------------------------------------------
// The follow camera: lazy behind the player, drag to orbit, wheel to zoom.
// ---------------------------------------------------------------------------

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yawOffset = 0;
    this.pitch = 0.34;
    this.dist = 10;
    this.yaw = Math.PI;
    this.pos = new THREE.Vector3(124, 6, -44);
  }

  orbit(dx, dy) {
    this.yawOffset -= dx * 0.0052;
    this.pitch = Math.max(0.06, Math.min(1.05, this.pitch + dy * 0.004));
  }

  zoom(delta) {
    this.dist = Math.max(5.5, Math.min(19, this.dist + delta * 0.01));
  }

  update(dt, player) {
    const targetDist = player.mode === "car" ? this.dist + 2.5 : this.dist;
    const baseYaw = player.heading; // camera sits opposite the facing, looking along it
    // The orbit offset decays back to the chase view when left alone.
    this.yawOffset *= Math.pow(0.25, dt);
    let targetYaw = baseYaw + this.yawOffset;
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * (player.mode === "car" ? 3.4 : 5));
    const height = (player.mode === "car" ? 3.4 : 2.9) + Math.sin(this.pitch) * 4.5;
    const back = Math.cos(this.pitch) * targetDist;
    const tx = player.x - Math.sin(this.yaw) * back;
    const tz = player.z - Math.cos(this.yaw) * back;
    const ty = height;
    const k = Math.min(1, dt * 6);
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.y += (ty - this.pos.y) * k;
    this.pos.z += (tz - this.pos.z) * k;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(player.x + Math.sin(player.heading) * 3.5, 1.6, player.z + Math.cos(player.heading) * 3.5);
    // Speed stretch: a whisper of extra FOV flat-out.
    const targetFov = player.mode === "car" ? 62 + Math.min(10, Math.abs(player.speed) * 0.28) : 60;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  /** The yaw the movement keys should treat as "forward": the view direction. */
  get moveYaw() {
    return this.yaw;
  }
}
