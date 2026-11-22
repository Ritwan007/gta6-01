// police.js — the Port Meridian PD: cruisers that answer the wanted level,
// hunt the player down the road grid, ram to slow them, and pin them long
// enough to fill the bust meter.

import { AVENUES_X, OCEAN_DRIVE_X, STREETS_Z, policeCountFor } from "./logic.js";
import { resolveCollisions } from "./world.js";

const SPAWN_POINTS = [];
for (const ax of [...AVENUES_X, OCEAN_DRIVE_X]) for (const sz of STREETS_Z) SPAWN_POINTS.push({ x: ax, z: sz });

export class Police {
  constructor(fleet, colliders) {
    this.fleet = fleet;
    this.colliders = colliders;
    this.cruisers = [];
    this.bust = 0; // 0..1, full means busted
    this.seen = false; // is any cruiser close enough to see the player?
  }

  /** A spawn point on the grid, mid-distance from the player. */
  pickSpawn(px, pz) {
    let best = null, bestScore = -Infinity;
    for (const s of SPAWN_POINTS) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d < 55 || d > 150) continue;
      const score = -Math.abs(d - 95) + Math.random() * 12;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best ?? { x: px + 90, z: pz };
  }

  update(dt, ctx) {
    const want = policeCountFor(ctx.wanted);
    // Bring the force up to strength, or stand it down.
    while (this.cruisers.length < want) {
      const s = this.pickSpawn(ctx.playerX, ctx.playerZ);
      const car = this.fleet.addCar({ x: s.x, z: s.z, heading: 0, color: 0xe8ecf2, kind: "police" });
      if (!car) break;
      car.speed = 0;
      this.cruisers.push(car);
    }
    while (this.cruisers.length > want) {
      const car = this.cruisers.pop();
      this.fleet.removeCar(car);
    }

    this.seen = false;
    let pinning = false;

    for (const car of this.cruisers) {
      const dx = ctx.playerX - car.x, dz = ctx.playerZ - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 34) this.seen = true;
      // Despawn a cruiser left far behind while the heat is low.
      if (dist > 260 && ctx.wanted <= 1) {
        const s = this.pickSpawn(ctx.playerX, ctx.playerZ);
        car.x = s.x; car.z = s.z; car.speed = 0;
        continue;
      }
      // Aim at where the player is heading, not where they were.
      const lead = Math.min(0.85, dist / 60);
      const tx = ctx.playerX + ctx.playerVX * lead;
      const tz = ctx.playerZ + ctx.playerVZ * lead;
      const targetHeading = Math.atan2(tx - car.x, tz - car.z);
      let turn = targetHeading - car.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const maxTurn = 1.9 * dt;
      car.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
      // Speed: full chase pace, easing off as the nose comes around.
      const aligned = Math.max(0, Math.cos(turn));
      const chase = dist > 70 ? 30 : 25;
      const targetSpeed = chase * (0.35 + 0.65 * aligned);
      car.speed += Math.max(-16 * dt, Math.min(9 * dt, targetSpeed - car.speed));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const pos = resolveCollisions({ x: car.x, z: car.z }, 1.7, this.colliders);
      if (pos.x !== car.x || pos.z !== car.z) car.speed *= 0.55;
      car.x = pos.x; car.z = pos.z;
      // Contact: shove the player and count it toward the pin.
      if (dist < 3.4) {
        ctx.onRam?.(car, dx / (dist || 1), dz / (dist || 1));
        if (Math.abs(ctx.playerSpeed) < 2.4) pinning = true;
      }
    }

    if (pinning && ctx.wanted > 0) {
      this.bust = Math.min(1, this.bust + dt / 3.2);
      if (this.bust >= 1) {
        this.bust = 0;
        ctx.onBusted?.();
      }
    } else {
      this.bust = Math.max(0, this.bust - dt / 2.2);
    }
    return { seen: this.seen, bust: this.bust };
  }
}
