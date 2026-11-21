// VELORA HEAT — pedestrians: sidewalk walkers with a small state machine
// (walk -> flee -> cower -> call the police). Witnesses feed the wanted system.
import { WORLD } from './config.js';
import { pick, range, dist } from './random.js';

const SHIRTS = ['#e8d44d', '#4da3e8', '#e87a4d', '#7ae84d', '#c94de8', '#e84d6f', '#4de8c9'];

export function createPed(G, x, z) {
  return {
    x, z, angle: G.rng() * Math.PI * 2, speed: 0,
    hp: 100, state: 'walk', // walk | flee | cower | call
    shirt: pick(G.rng, SHIRTS),
    walkSpeed: range(G.rng, 1.0, 1.8),
    targetX: x, targetZ: z, callT: 0, fleeT: 0, dead: false,
  };
}

function pickWalkTarget(G, ped) {
  // Walk along a sidewalk: pick a nearby street and a point along it.
  const s = G.city.nearestStreet(ped.x + (G.rng() - 0.5) * 60);
  const horiz = G.rng() < 0.5;
  const off = (G.rng() < 0.5 ? -1 : 1) * range(G.rng, 9.5, 11);
  if (horiz) { ped.targetX = ped.x + range(G.rng, -80, 80); ped.targetZ = s + off; }
  else { ped.targetX = s + off; ped.targetZ = ped.z + range(G.rng, -80, 80); }
  ped.targetX = Math.max(-340, Math.min(340, ped.targetX));
  ped.targetZ = Math.max(-340, Math.min(340, ped.targetZ));
}

export function stepPeds(G, dt) {
  const p = G.player;
  const pc = G.playerCar;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  for (const ped of G.peds) {
    if (ped.hp <= 0) continue;
    // A fast car bearing down: run away from the road.
    if (pc && Math.abs(pc.speed) > 6) {
      const d = dist(pc.x, pc.z, ped.x, ped.z);
      const closing = (ped.x - pc.x) * Math.cos(pc.angle) + (ped.z - pc.z) * Math.sin(pc.angle);
      if (d < 11 && closing > -2) {
        ped.state = 'flee';
        ped.fleeT = 1.5;
        ped.targetX = ped.x + (ped.x - pc.x) * 2;
        ped.targetZ = ped.z + (ped.z - pc.z) * 2;
      }
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
    }
    if (ped.state === 'call') {
      ped.callT -= dt;
      if (ped.callT <= 0) {
        ped.state = 'walk';
        if (G.police.anyOfficerSees(px, pz, 80)) {
          G.police.addWanted(1, 'witness call');
          G.feed('A witness called the VBPD!');
        }
      }
      continue; // calling peds stand still
    }
    if (ped.state === 'cower') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      continue;
    }
    // Walk toward the target; pick a new one on arrival.
    const dx = ped.targetX - ped.x, dz = ped.targetZ - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { pickWalkTarget(G, ped); continue; }
    const sp = ped.state === 'flee' ? ped.walkSpeed * 3.2 : ped.walkSpeed;
    ped.angle = Math.atan2(dz, dx);
    ped.x += (dx / d) * sp * dt;
    ped.z += (dz / d) * sp * dt;
    const fixed = G.city.resolveCircle(ped.x, ped.z, 0.6);
    ped.x = fixed.x; ped.z = fixed.z;
  }
}

// A crime happened at (x,z): nearby peds react — most flee, some call.
export function witnessCrime(G, x, z, kind) {
  for (const ped of G.peds) {
    if (ped.hp <= 0) continue;
    const d = dist(x, z, ped.x, ped.z);
    if (d > 25) continue;
    if (G.city.segBlocked(x, z, ped.x, ped.z)) continue;
    if (kind === 'shot' && G.rng() < 0.45) {
      ped.state = 'call'; ped.callT = 2;
    } else if (kind === 'theft' && G.rng() < 0.35) {
      ped.state = 'call'; ped.callT = 2;
    } else {
      ped.state = 'flee'; ped.fleeT = 2.5;
      ped.targetX = ped.x + (ped.x - x) * 2;
      ped.targetZ = ped.z + (ped.z - z) * 2;
    }
  }
}
