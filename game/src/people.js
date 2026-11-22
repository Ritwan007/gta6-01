// people.js — the crowds of Port Meridian.
//
// Pedestrians are two InstancedMeshes (capsule bodies, sphere heads) with a
// per-instance splash of shirt colour. They stroll the sidewalks in both
// directions, hurry away from fast cars, and go down when shoved or clipped
// — then get up and run. All state lives in plain records; the crowd
// re-writes its matrices each frame.

import * as THREE from "three";
import { AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, ROAD_HALF } from "./logic.js";

const SHIRTS = [0xff5da2, 0x22d3ee, 0xffa726, 0x8aff5a, 0xe8e2d2, 0xc77dff, 0xff5252, 0x7fe7ff, 0xd8b4c2, 0x9fb4cc];
const SKIN = [0xf2c09a, 0xc68863, 0x8a5a3b, 0x6e4530, 0xffd9b3];

const bodyGeo = new THREE.CapsuleGeometry(0.30, 0.78, 3, 8);
const headGeo = new THREE.SphereGeometry(0.21, 8, 8);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

const SIDEWALK = ROAD_HALF + 1.7;

export class Crowd {
  constructor(scene, rng, count = 64) {
    this.rng = rng;
    this.peds = [];
    this.bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    this.heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    this.bodies.frustumCulled = false;
    this.heads.frustumCulled = false;
    scene.add(this.bodies, this.heads);
    for (let i = 0; i < count; i++) {
      const ped = this.spawn();
      if (!ped) break;
      ped.slot = i;
      this.peds.push(ped);
      this.bodies.setColorAt(i, _c.setHex(ped.shirt));
      this.heads.setColorAt(i, _c.setHex(ped.skin));
    }
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
  }

  spawn() {
    const rng = this.rng;
    const onAvenue = rng() < 0.5;
    const roadsX = [...AVENUES_X, OCEAN_DRIVE_X];
    const axis = onAvenue ? "NS" : "EW";
    const line = onAvenue ? roadsX[Math.floor(rng() * roadsX.length)] : STREETS_Z[Math.floor(rng() * STREETS_Z.length)];
    const side = rng() < 0.5 ? -SIDEWALK : SIDEWALK;
    return {
      slot: 0, axis, line, side,
      dir: rng() < 0.5 ? 1 : -1,
      along: -145 + rng() * 290,
      speed: 1.1 + rng() * 0.8,
      shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
      skin: SKIN[Math.floor(rng() * SKIN.length)],
      bob: rng() * Math.PI * 2,
      state: "walk", // walk | flee | down
      timer: 0,
      x: 0, z: 0, heading: 0,
      fleeX: 0, fleeZ: 0,
    };
  }

  place(ped) {
    if (ped.axis === "NS") {
      ped.x = ped.line + ped.side;
      ped.z = ped.along;
      ped.heading = ped.dir > 0 ? 0 : Math.PI;
    } else {
      ped.x = ped.along;
      ped.z = ped.line + ped.side;
      ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  /** Knock a pedestrian down (shove or car contact). */
  knockDown(ped, onCrime) {
    if (ped.state === "down") return;
    ped.state = "down";
    ped.timer = 2.6 + this.rng() * 1.6;
    if (onCrime) onCrime(ped);
  }

  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }

  update(dt, ctx) {
    const rng = this.rng;
    for (const ped of this.peds) {
      if (ped.state === "down") {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.state = "flee";
          ped.timer = 2.2;
          ped.fleeX = ped.x - ctx.playerX;
          ped.fleeZ = ped.z - ctx.playerZ;
          const len = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
          ped.fleeX /= len; ped.fleeZ /= len;
        }
      } else if (ped.state === "flee") {
        ped.timer -= dt;
        ped.x += ped.fleeX * 4.4 * dt;
        ped.z += ped.fleeZ * 4.4 * dt;
        ped.heading = Math.atan2(ped.fleeX, ped.fleeZ);
        ped.bob += dt * 13;
        if (ped.timer <= 0) {
          // Rejoin the nearest sidewalk flow.
          ped.state = "walk";
          const near = this.nearestFlow(ped.x, ped.z);
          Object.assign(ped, near);
        }
      } else {
        // Walk the sidewalk; scatter from a fast-approaching car.
        const dx = ped.x - ctx.playerX, dz = ped.z - ctx.playerZ;
        const dist = Math.hypot(dx, dz);
        if (ctx.playerSpeed > 7 && dist < 6.5) {
          ped.state = "flee";
          ped.timer = 1.6;
          ped.fleeX = dx / (dist || 1);
          ped.fleeZ = dz / (dist || 1);
        } else {
          ped.along += ped.dir * ped.speed * dt;
          ped.bob += dt * (4.4 + ped.speed);
          const limit = 152;
          if (ped.along > limit || ped.along < -limit) {
            ped.dir *= -1;
            ped.along = Math.max(-limit, Math.min(limit, ped.along));
            if (rng() < 0.4) ped.side = -ped.side;
          }
          this.place(ped);
        }
      }
      // Write the instance.
      const down = ped.state === "down";
      const bobY = down ? 0 : Math.abs(Math.sin(ped.bob)) * 0.07;
      _e.set(down ? Math.PI / 2 : 0, ped.heading, 0);
      _q.setFromEuler(_e);
      _p.set(ped.x, (down ? 0.32 : 0.86) + bobY, ped.z);
      _s.set(1, 1, 1);
      _m.compose(_p, _q, _s);
      this.bodies.setMatrixAt(ped.slot, _m);
      _e.set(0, ped.heading, 0);
      _q.setFromEuler(_e);
      _p.set(ped.x, down ? 0.36 : 1.62 + bobY, ped.z);
      _m.compose(_p, _q, _s);
      this.heads.setMatrixAt(ped.slot, _m);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }

  /** The nearest sidewalk flow line to a point, for peds rejoining a walk. */
  nearestFlow(x, z) {
    const rng = this.rng;
    let best = null, bestD = Infinity;
    for (const ax of [...AVENUES_X, OCEAN_DRIVE_X]) {
      const d = Math.abs(x - ax);
      if (d < bestD) { bestD = d; best = { axis: "NS", line: ax, along: z }; }
    }
    for (const sz of STREETS_Z) {
      const d = Math.abs(z - sz);
      if (d < bestD) { bestD = d; best = { axis: "EW", line: sz, along: x }; }
    }
    best.side = (best.axis === "NS" ? (x > best.line ? SIDEWALK : -SIDEWALK) : (z > best.line ? SIDEWALK : -SIDEWALK));
    best.dir = rng() < 0.5 ? 1 : -1;
    return best;
  }
}
