// vehicles.js — the car factory and the traffic system. Every car in Port
// Meridian is built from the same few boxes: a body, a glass cabin, four
// wheels merged into one mesh, and emissive lights, so thirty cars stay cheap
// to draw. Traffic drives the cityplan grid by waypoint steering: pick the
// next intersection, steer for its lane point, brake for whatever is ahead.

import * as THREE from 'three';
import { AVENUES, CITY, LANE_OFFSET, STREETS } from './cityplan.js';
import { mergeParts } from './city.js';
import { angleDelta, clamp, groundDistance, turnToward } from './rng.js';

export const CAR_LENGTH = 4.3;
export const CAR_WIDTH = 1.9;

export const CAR_COLORS = [0xc23b4e, 0x2e6fc2, 0xd8d8dc, 0x22242a, 0x3fae6a, 0xe07b2a, 0x7a4fd0, 0xb8b0a4, 0x2aa8b8, 0x8c1f3a];

const glassMat = new THREE.MeshPhongMaterial({ color: 0x10151f, shininess: 90, specular: 0x8899bb });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false });
const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff2a30, fog: false });
const bodyGeos = {
  body: new THREE.BoxGeometry(CAR_WIDTH, 0.62, CAR_LENGTH),
  cabin: new THREE.BoxGeometry(1.64, 0.55, 2.05),
  sportCabin: new THREE.BoxGeometry(1.58, 0.42, 1.9),
  spoiler: new THREE.BoxGeometry(1.7, 0.09, 0.42),
};
const wheelGeo = (() => {
  const parts = [];
  const one = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10);
  for (const [x, z] of [[-0.88, 1.42], [0.88, 1.42], [-0.88, -1.42], [0.88, -1.42]]) {
    parts.push({
      geometry: one.clone(),
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0.37, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
        new THREE.Vector3(1, 1, 1),
      ),
    });
  }
  return mergeParts(parts);
})();

/**
 * Build one car. Options: sport (low cabin + spoiler), police (black-and-white
 * with a light bar — the bar's lamps are in userData for police.js to flash).
 * The model's nose points along +Z; heading 0 faces +Z.
 */
export function createCarMesh(color, options = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const body = new THREE.Mesh(bodyGeos.body, paint);
  body.position.y = 0.58;
  group.add(body);
  const cabin = new THREE.Mesh(options.sport ? bodyGeos.sportCabin : bodyGeos.cabin, glassMat);
  cabin.position.set(0, options.sport ? 1.02 : 1.13, -0.18);
  group.add(cabin);
  const wheels = new THREE.Mesh(wheelGeo, tyreMat);
  group.add(wheels);
  const lights = new THREE.Group();
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headlightMat);
    head.position.set(x, 0.62, CAR_LENGTH / 2 + 0.01);
    lights.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), taillightMat);
    tail.position.set(x, 0.66, -CAR_LENGTH / 2 - 0.01);
    lights.add(tail);
  }
  group.add(lights);
  if (options.sport) {
    const spoiler = new THREE.Mesh(bodyGeos.spoiler, paint);
    spoiler.position.set(0, 1.05, -1.95);
    group.add(spoiler);
  }
  if (options.police) {
    const bar = new THREE.Group();
    const baseBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.5), tyreMat);
    baseBar.position.y = 1.47;
    bar.add(baseBar);
    const lampGeo = new THREE.BoxGeometry(0.55, 0.16, 0.44);
    const redLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xff2038, fog: false }));
    redLamp.position.set(-0.34, 1.58, 0);
    bar.add(redLamp);
    const blueLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x2266ff, fog: false }));
    blueLamp.position.set(0.34, 1.58, 0);
    bar.add(blueLamp);
    group.add(bar);
    group.userData.redLamp = redLamp;
    group.userData.blueLamp = blueLamp;
  }
  group.userData.paint = paint;
  return group;
}

/** Forward vector for a heading (heading 0 = +Z, turning left is positive). */
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/**
 * One traffic car: drives avenue/street lanes between intersections. `road`
 * is {axis:'x'|'z', at:number} — the avenue x or street z it runs along —
 * and `dir` its direction of travel along that axis.
 */
class TrafficCar {
  constructor(scene, rng) {
    this.mesh = createCarMesh(rng.pick(CAR_COLORS), { sport: rng.chance(0.18) });
    scene.add(this.mesh);
    this.speed = 0;
    this.cruise = rng.range(8.5, 12.5);
    this.place(rng, null);
  }

  place(rng, near) {
    const onAvenue = rng.chance(0.55);
    if (onAvenue) {
      const at = rng.pick(AVENUES);
      const dir = rng.chance(0.5) ? 1 : -1;
      const z = near ? clamp(near.z + rng.range(-140, 140), CITY.minZ + 14, CITY.maxZ - 14) : rng.range(CITY.minZ + 14, CITY.maxZ - 14);
      this.road = { axis: 'z', at };
      this.dir = dir;
      this.pos = { x: at + (dir > 0 ? -LANE_OFFSET : LANE_OFFSET), z };
    } else {
      const at = rng.pick(STREETS);
      const dir = rng.chance(0.5) ? 1 : -1;
      const x = near ? clamp(near.x + rng.range(-140, 140), CITY.minX + 14, CITY.maxX - 14) : rng.range(CITY.minX + 14, CITY.maxX - 14);
      this.road = { axis: 'x', at };
      this.pos = { x, z: at + (dir > 0 ? LANE_OFFSET : -LANE_OFFSET) };
    }
    this.heading = this.road.axis === 'z' ? (this.dir > 0 ? 0 : Math.PI) : this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.target = null;
    this.pickTarget(rng);
    this.syncMesh();
  }

  /** The next intersection point ahead, in this car's lane on the cross road. */
  pickTarget(rng) {
    const cross = this.road.axis === 'z' ? STREETS : AVENUES;
    const along = this.road.axis === 'z' ? this.pos.z : this.pos.x;
    const ahead = cross.filter((c) => (c - along) * this.dir > 8);
    const next = ahead.length ? ahead.reduce((a, b) => (Math.abs(b - along) < Math.abs(a - along) ? b : a)) : null;
    if (next === null) {
      // End of the road: aim past the edge; update() will U-turn there.
      const end = this.road.axis === 'z' ? (this.dir > 0 ? CITY.maxZ - 6 : CITY.minZ + 6) : this.dir > 0 ? CITY.maxX - 6 : CITY.minX + 6;
      this.target = this.road.axis === 'z' ? { x: this.pos.x, z: end } : { x: end, z: this.pos.z };
      this.targetIsEnd = true;
      return;
    }
    this.targetIsEnd = false;
    // At the intersection we may turn: aim at the lane point just past it.
    const turn = rng.chance(0.45);
    if (turn) {
      const newDir = rng.chance(0.5) ? 1 : -1;
      if (this.road.axis === 'z') {
        this.pendingRoad = { axis: 'x', at: next };
        this.pendingDir = newDir;
        this.target = { x: this.road.at + (this.dir > 0 ? -LANE_OFFSET : LANE_OFFSET), z: next + (newDir > 0 ? LANE_OFFSET : -LANE_OFFSET) };
      } else {
        this.pendingRoad = { axis: 'z', at: next };
        this.pendingDir = newDir;
        this.target = { x: next + (newDir > 0 ? -LANE_OFFSET : LANE_OFFSET), z: this.road.at + (this.dir > 0 ? LANE_OFFSET : -LANE_OFFSET) };
      }
    } else {
      this.pendingRoad = null;
      this.target =
        this.road.axis === 'z'
          ? { x: this.road.at + (this.dir > 0 ? -LANE_OFFSET : LANE_OFFSET), z: next + this.dir * 14 }
          : { x: next + this.dir * 14, z: this.road.at + (this.dir > 0 ? LANE_OFFSET : -LANE_OFFSET) };
    }
  }

  update(dt, rng, blockers) {
    // Brake for anything solid ahead.
    const fwd = forwardOf(this.heading);
    let wanted = this.cruise;
    for (const b of blockers) {
      const dx = b.x - this.pos.x;
      const dz = b.z - this.pos.z;
      const ahead = dx * fwd.x + dz * fwd.z;
      const side = Math.abs(dx * fwd.z - dz * fwd.x);
      if (ahead > 0 && ahead < 8 && side < 1.7) wanted = Math.min(wanted, Math.max(0, (ahead - 4.5) * 1.6));
    }
    const accel = wanted > this.speed ? 5 : 14;
    this.speed += clamp(wanted - this.speed, -accel * dt, accel * dt);

    const toTarget = { x: this.target.x - this.pos.x, z: this.target.z - this.pos.z };
    const dist = Math.hypot(toTarget.x, toTarget.z);
    const desired = Math.atan2(toTarget.x, toTarget.z);
    const turnRate = this.speed > 1 ? clamp(2.4 - this.speed * 0.09, 0.9, 2.2) : 2.2;
    this.heading = turnToward(this.heading, desired, turnRate * dt);
    const nf = forwardOf(this.heading);
    this.pos.x += nf.x * this.speed * dt;
    this.pos.z += nf.z * this.speed * dt;

    if (dist < 5) {
      if (this.targetIsEnd) {
        // U-turn: swap direction and lane on the same road.
        this.dir = -this.dir;
        if (this.road.axis === 'z') this.pos.x = this.road.at + (this.dir > 0 ? -LANE_OFFSET : LANE_OFFSET);
        else this.pos.z = this.road.at + (this.dir > 0 ? LANE_OFFSET : -LANE_OFFSET);
      } else if (this.pendingRoad) {
        this.road = this.pendingRoad;
        this.dir = this.pendingDir;
        this.pendingRoad = null;
      }
      this.pickTarget(rng);
    }
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }
}

/** All the ambient traffic. Cars far from the player recycle to roads near them. */
export class Traffic {
  constructor(scene, rng, count = 12) {
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < count; i += 1) this.cars.push(new TrafficCar(scene, rng));
  }

  /** Dynamic blockers (player, police) are passed in; traffic adds its own cars'. */
  update(dt, playerPos, extraBlockers) {
    const blockers = [...extraBlockers];
    for (const car of this.cars) blockers.push({ x: car.pos.x, z: car.pos.z });
    for (const car of this.cars) {
      car.update(dt, this.rng, blockers.filter((b) => b.x !== car.pos.x || b.z !== car.pos.z));
      if (playerPos && groundDistance(car.pos, playerPos) > 320) car.place(this.rng, playerPos);
    }
  }

  /** Positions for collision and minimap. */
  positions() {
    return this.cars.map((car) => ({ x: car.pos.x, z: car.pos.z, heading: car.heading }));
  }
}
