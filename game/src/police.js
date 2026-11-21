// police.js — Meridian PD. A small pool of cruisers that wake as the wanted
// stars rise, spawn on roads out of sight, and hunt by steering at the
// player's last seen position. They ram, they block, and — through wanted.js,
// which game.js feeds with the distances reported here — they bust a player
// who lets them sit close for too long.

import * as THREE from 'three';
import { AVENUES, STREETS } from './cityplan.js';
import { createCarMesh, forwardOf } from './vehicles.js';
import { clamp, groundDistance, turnToward } from './rng.js';
import { glowTexture } from './textures.js';

const CRUISERS_BY_STARS = [0, 1, 2, 3, 4, 4];
const SIGHT_RANGE = 68;

class Cruiser {
  constructor(scene) {
    this.mesh = createCarMesh(0xe8e8ec, { police: true });
    this.mesh.userData.paint.color.set(0x1c1e26);
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2038, transparent: true, depthWrite: false, opacity: 0.85 }),
    );
    this.glow.scale.setScalar(7);
    this.glow.position.y = 1.8;
    this.mesh.add(this.glow);
    scene.add(this.mesh);
    this.active = false;
    this.leaving = false;
    this.pos = { x: 0, z: -400 };
    this.heading = 0;
    this.speed = 0;
    this.lastSeenPos = null;
    this.stuckFor = 0;
    this.reverseFor = 0;
    this.syncMesh();
  }

  spawnAt(x, z, heading) {
    this.pos = { x, z };
    this.heading = heading;
    this.speed = 6;
    this.active = true;
    this.leaving = false;
    this.lastSeenPos = null;
    this.syncMesh();
  }

  deactivate() {
    this.active = false;
    this.pos = { x: 0, z: -400 };
    this.speed = 0;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = this.active;
  }
}

export class Police {
  constructor(scene) {
    this.cruisers = [new Cruiser(scene), new Cruiser(scene), new Cruiser(scene), new Cruiser(scene)];
    this.spawnTimer = 0;
    this.flashPhase = 0;
  }

  activeCount() {
    return this.cruisers.filter((c) => c.active).length;
  }

  /** A road point 70–105 m from the player, for spawning out of sight. */
  spawnPoint(rng, playerPos) {
    const avenue = rng.pick(AVENUES);
    const street = rng.pick(STREETS);
    const candidates = [
      { x: avenue, z: playerPos.z + rng.pick([-95, 95]) },
      { x: playerPos.x + rng.pick([-95, 95]), z: street },
      { x: avenue, z: street },
    ];
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      const d = groundDistance(c, playerPos);
      const score = -Math.abs(d - 85);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /**
   * Advance the hunt. `player` is {pos, speed}; `rng` a seeded stream;
   * `pushOut` resolves a position against building colliders (game.js owns it).
   * Returns { seen, nearest } for the wanted rules.
   */
  update(dt, player, stars, rng, pushOut) {
    this.flashPhase += dt * 7;
    const wanted = CRUISERS_BY_STARS[Math.min(stars, 5)];

    if (stars === 0) {
      for (const c of this.cruisers) if (c.active) c.leaving = true;
    }

    const active = this.cruisers.filter((c) => c.active && !c.leaving);
    if (active.length < wanted) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const idle = this.cruisers.find((c) => !c.active);
        if (idle) {
          const point = this.spawnPoint(rng, player.pos);
          const heading = Math.atan2(player.pos.x - point.x, player.pos.z - point.z);
          idle.spawnAt(point.x, point.z, heading);
          this.spawnTimer = 2.2;
        }
      }
    }

    let seen = false;
    let nearest = Infinity;

    for (const c of this.cruisers) {
      if (!c.active) continue;
      const dist = groundDistance(c.pos, player.pos);
      if (c.leaving) {
        c.speed = Math.min(c.speed + 8 * dt, 13);
        const f = forwardOf(c.heading);
        c.pos.x += f.x * c.speed * dt;
        c.pos.z += f.z * c.speed * dt;
        if (dist > 130) c.deactivate();
        c.syncMesh();
        continue;
      }
      if (dist < nearest) nearest = dist;
      if (dist < SIGHT_RANGE) {
        seen = true;
        c.lastSeenPos = { x: player.pos.x, z: player.pos.z };
      }
      const target = c.lastSeenPos ?? player.pos;
      // Recycle a cruiser that fell hopelessly behind.
      if (dist > 240) {
        const point = this.spawnPoint(rng, player.pos);
        c.spawnAt(point.x, point.z, Math.atan2(player.pos.x - point.x, player.pos.z - point.z));
        continue;
      }
      const desired = Math.atan2(target.x - c.pos.x, target.z - c.pos.z);
      const topSpeed = stars >= 4 ? 19.5 : 17.5;
      let wantedSpeed = topSpeed;
      const angle = Math.abs(Math.atan2(Math.sin(desired - c.heading), Math.cos(desired - c.heading)));
      if (angle > 1.9) wantedSpeed = 4; // turning around
      else if (angle > 0.8) wantedSpeed = 9;
      if (dist < 7) wantedSpeed = Math.min(wantedSpeed, player.speed + 2);

      if (c.reverseFor > 0) {
        c.reverseFor -= dt;
        c.speed = -5;
      } else {
        const accel = wantedSpeed > c.speed ? 8.5 : 18;
        c.speed += clamp(wantedSpeed - c.speed, -accel * dt, accel * dt);
        c.heading = turnToward(c.heading, desired, (c.speed > 1 ? 1.7 : 2.4) * dt);
        if (Math.abs(c.speed) < 0.6 && dist > 10) {
          c.stuckFor += dt;
          if (c.stuckFor > 1.4) {
            c.reverseFor = 0.7;
            c.stuckFor = 0;
          }
        } else {
          c.stuckFor = 0;
        }
      }
      const f = forwardOf(c.heading);
      c.pos.x += f.x * c.speed * dt;
      c.pos.z += f.z * c.speed * dt;
      pushOut(c.pos, 1.7);
      c.syncMesh();

      // Light bar: alternate the lamps and the halo colour.
      const phase = Math.floor(this.flashPhase + (c === this.cruisers[1] || c === this.cruisers[3] ? 0.5 : 0)) % 2 === 0;
      c.mesh.userData.redLamp.material.color.set(phase ? 0xff2038 : 0x57101c);
      c.mesh.userData.blueLamp.material.color.set(phase ? 0x0e2a66 : 0x2266ff);
      c.glow.material.color.set(phase ? 0xff2038 : 0x2266ff);
    }

    return { seen, nearest: nearest === Infinity ? null : nearest };
  }

  /** Active cruisers' positions, for collisions and the minimap. */
  positions() {
    return this.cruisers
      .filter((c) => c.active)
      .map((c) => ({ x: c.pos.x, z: c.pos.z, heading: c.heading, speed: c.speed, cruiser: c }));
  }
}
