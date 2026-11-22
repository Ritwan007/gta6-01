// vehicles.js — every car in Port Meridian, and the traffic that drives them.
//
// All cars share four InstancedMeshes (bodies, cabins, wheels, lights), so
// sixty cars cost a handful of draw calls. A car is a plain record —
// position, heading, speed, colour, kind — and the fleet re-writes the
// instance matrices each frame. Traffic cars steer themselves along the
// road grid; the player's car and the police are driven from outside.

import * as THREE from "three";
import { AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, ROAD_HALF } from "./logic.js";

export const CAR_COLORS = [
  0xc23b4e, 0x3b6ec2, 0x3fae6a, 0xd8d3c8, 0x2b2f38, 0xd08a1d,
  0x7a4fc2, 0x2ea8a0, 0xc2b280, 0x8a93a5, 0x94353f, 0x4e6e3b,
];

const bodyGeo = new THREE.BoxGeometry(1.86, 0.62, 4.35);
const cabinGeo = new THREE.BoxGeometry(1.66, 0.58, 2.0);
const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2); // axle along the car's width, not upright
const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.08);
const barGeo = new THREE.BoxGeometry(1.3, 0.18, 0.5);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

function writeInstance(mesh, i, x, y, z, heading, extraYaw = 0) {
  _e.set(0, heading + extraYaw, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

export class CarFleet {
  constructor(scene, capacity = 72) {
    this.capacity = capacity;
    this.cars = [];
    this.bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity);
    this.cabins = new THREE.InstancedMesh(cabinGeo, new THREE.MeshBasicMaterial({ color: 0x14161d }), capacity);
    this.wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshBasicMaterial({ color: 0x0c0d10 }), capacity * 4);
    this.lights = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity * 4);
    this.barsRed = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff2e3c }), 8);
    this.barsBlue = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x2e7dff }), 8);
    for (const mesh of [this.bodies, this.cabins, this.wheels, this.lights, this.barsRed, this.barsBlue]) {
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    this.barPhase = 0;
    // Park every slot far underground until it is claimed.
    for (let i = 0; i < capacity; i++) {
      writeInstance(this.bodies, i, 0, -60, 0, 0);
      writeInstance(this.cabins, i, 0, -60, 0, 0);
      this.bodies.setColorAt(i, _c.setHex(0x333333));
      for (let w = 0; w < 4; w++) {
        writeInstance(this.wheels, i * 4 + w, 0, -60, 0, 0);
        this.lights.setColorAt(i * 4 + w, _c.setHex(0x000000));
        writeInstance(this.lights, i * 4 + w, 0, -60, 0, 0);
      }
    }
  }

  /** Claim a slot and put a car on the street. Returns the car record. */
  addCar({ x, z, heading = 0, color = 0x888888, kind = "sedan" }) {
    const slot = this.cars.length;
    if (slot >= this.capacity) return null;
    const car = {
      slot, x, z, heading, speed: 0, kind, color,
      wheelSpin: 0, driver: null, parked: false, dead: false,
      // traffic state (filled by Traffic for its own cars)
      traffic: null,
    };
    this.cars.push(car);
    this.bodies.setColorAt(slot, _c.setHex(color));
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    // Headlights warm white, taillights red.
    this.lights.setColorAt(slot * 4 + 0, _c.setHex(0xffe9b0));
    this.lights.setColorAt(slot * 4 + 1, _c.setHex(0xffe9b0));
    this.lights.setColorAt(slot * 4 + 2, _c.setHex(0xff2e3c));
    this.lights.setColorAt(slot * 4 + 3, _c.setHex(0xff2e3c));
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    return car;
  }

  /** Send a car back underground and out of the game. */
  removeCar(car) {
    car.dead = true;
    car.x = 0; car.z = 0;
    writeInstance(this.bodies, car.slot, 0, -60, 0, 0);
    writeInstance(this.cabins, car.slot, 0, -60, 0, 0);
    for (let w = 0; w < 4; w++) {
      writeInstance(this.wheels, car.slot * 4 + w, 0, -60, 0, 0);
      writeInstance(this.lights, car.slot * 4 + w, 0, -60, 0, 0);
    }
  }

  /** Re-write every instance matrix from the car records. */
  update(dt) {
    this.barPhase += dt;
    const flash = Math.floor(this.barPhase * 2.6) % 2 === 0;
    let barSlot = 0;
    for (const car of this.cars) {
      if (car.dead) continue;
      const i = car.slot;
      const sin = Math.sin(car.heading), cos = Math.cos(car.heading);
      car.wheelSpin += (car.speed * dt) / 0.37;
      writeInstance(this.bodies, i, car.x, 0.55, car.z, car.heading);
      writeInstance(this.cabins, i, car.x - sin * 0.25, 1.12, car.z - cos * 0.25, car.heading);
      const wheelLocal = [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]];
      wheelLocal.forEach(([lx, lz], w) => {
        const wx = car.x + lx * cos + lz * sin;
        const wz = car.z - lx * sin + lz * cos;
        writeInstance(this.wheels, i * 4 + w, wx, 0.37, wz, car.heading, 0);
        // Headlights sit at the front corners, taillights at the rear.
        const isFront = lz > 0;
        const ox = isFront ? lx * 0.82 : lx * 0.82;
        const oz = isFront ? 2.19 : -2.19;
        const hx = car.x + ox * cos + oz * sin;
        const hz = car.z - ox * sin + oz * cos;
        writeInstance(this.lights, i * 4 + w, hx, 0.62, hz, car.heading);
      });
      if (car.kind === "police" && barSlot < 8) {
        const bx = car.x - sin * 0.25, bz = car.z - cos * 0.25;
        // Alternate the red and blue halves by hiding one underground.
        writeInstance(this.barsRed, barSlot, bx - cos * 0.34, flash ? 1.5 : -60, bz + sin * 0.34, car.heading);
        writeInstance(this.barsBlue, barSlot, bx + cos * 0.34, flash ? -60 : 1.5, bz - sin * 0.34, car.heading);
        barSlot++;
      }
    }
    for (; barSlot < 8; barSlot++) {
      writeInstance(this.barsRed, barSlot, 0, -60, 0, 0);
      writeInstance(this.barsBlue, barSlot, 0, -60, 0, 0);
    }
    for (const mesh of [this.bodies, this.cabins, this.wheels, this.lights, this.barsRed, this.barsBlue]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Traffic: cars that drive the grid on their own, right-hand lanes, turning
// at intersections, slowing for the car ahead.
// ---------------------------------------------------------------------------

const ALL_ROADS_X = [...AVENUES_X, OCEAN_DRIVE_X];

export class Traffic {
  constructor(fleet, rng) {
    this.fleet = fleet;
    this.rng = rng;
    this.cars = [];
  }

  spawnOne() {
    const rng = this.rng;
    const onAvenue = rng() < 0.55;
    const car = this.fleet.addCar({
      x: 0, z: 0,
      color: rng() < 0.14 ? 0xf2c230 : CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      kind: rng() < 0.14 ? "taxi" : "sedan",
    });
    if (!car) return null;
    const t = {
      axis: onAvenue ? "NS" : "EW",
      line: onAvenue ? ALL_ROADS_X[Math.floor(rng() * ALL_ROADS_X.length)] : STREETS_Z[Math.floor(rng() * STREETS_Z.length)],
      dir: rng() < 0.5 ? 1 : -1,
      along: -150 + rng() * 300,
      speed: 0,
      cruise: 8 + rng() * 4.5,
    };
    car.traffic = t;
    this.place(car);
    this.cars.push(car);
    return car;
  }

  /** Lane offset for right-hand traffic, and the world position of a car. */
  place(car) {
    const t = car.traffic;
    const off = 3; // right-hand lane, metres from the centre line
    if (t.axis === "NS") {
      car.x = t.line + (t.dir > 0 ? -off : off);
      car.z = t.along;
      car.heading = t.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = t.along;
      car.z = t.line + (t.dir > 0 ? off : -off);
      car.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  /** The crossing roads ahead of a traffic car, for turn decisions. */
  crossings(t) {
    return t.axis === "NS" ? STREETS_Z : ALL_ROADS_X;
  }

  update(dt, obstacles) {
    const rng = this.rng;
    for (const car of this.cars) {
      if (car.dead || car.driver === "player") continue;
      const t = car.traffic;
      // Slow for anything ahead in the lane.
      let target = t.cruise;
      for (const o of obstacles) {
        if (o === car) continue;
        const dx = o.x - car.x, dz = o.z - car.z;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 10 && side < 2.2) target = Math.min(target, Math.max(0, (ahead - 5) * 1.4));
      }
      t.speed += Math.max(-14 * dt, Math.min(7 * dt, target - t.speed));
      car.speed = t.speed;
      t.along += t.dir * t.speed * dt;
      // Wrap at the city edge: leave one end, re-enter at the other.
      const limit = t.axis === "NS" ? 168 : 205;
      if (t.along > limit) t.along = -limit;
      if (t.along < -limit) t.along = limit;
      // Turn at intersections, sometimes.
      for (const cross of this.crossings(t)) {
        if (Math.abs(t.along - cross) < 1.1 && Math.abs(t.speed) > 2 && rng() < 0.006) {
          const oldLine = t.line;
          t.axis = t.axis === "NS" ? "EW" : "NS";
          t.line = cross;
          t.along = oldLine;
          t.dir = rng() < 0.5 ? 1 : -1;
          break;
        }
      }
      this.place(car);
    }
  }
}

/** Parked cars along the curbs: colour and life for the still streets. */
export function parkCars(fleet, rng) {
  const parked = [];
  const spots = [];
  for (let z = -140; z <= 140; z += 15) {
    if (rng() < 0.45) spots.push({ x: OCEAN_DRIVE_X - ROAD_HALF - 1.6, z: z + rng() * 5, heading: 0 });
    if (rng() < 0.35) spots.push({ x: OCEAN_DRIVE_X + ROAD_HALF + 1.6, z: z + 7, heading: Math.PI });
  }
  for (const sz of STREETS_Z) {
    for (let x = -160; x <= 100; x += 26) {
      if (rng() < 0.3) spots.push({ x: x + rng() * 6, z: sz - ROAD_HALF - 1.6, heading: Math.PI / 2 });
    }
  }
  // A small parking row inside the impound and the dockyard.
  for (let i = 0; i < 4; i++) spots.push({ x: -170 + i * 9, z: -124, heading: 0.2 });
  for (let i = 0; i < 3; i++) spots.push({ x: -196 + i * 10, z: 146, heading: -0.3 });
  for (const s of spots) {
    const car = fleet.addCar({
      x: s.x, z: s.z, heading: s.heading,
      color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      kind: "sedan",
    });
    if (car) {
      car.parked = true;
      parked.push(car);
    }
  }
  return parked;
}
