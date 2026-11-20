// Pedestrians — sidewalk walkers with a small state machine: walk, flee, cower, call.
// A witness who SEES a crime (line of sight, within 25 m) and finishes a 2 s call raises
// the heat. Officers within 12 m count without a witness.
import * as THREE from 'three';
import { CITY } from './config.js';

const SKINS = [0xd2a080, 0x8a5a3a, 0xe8c8a0, 0x6a4a30, 0xc2906a];
const SHIRTS = [0xc23c2a, 0x3c7ab2, 0x2ac28a, 0xd2c23c, 0x7a5ac2, 0xe8e8e8, 0x333333];

export function createPedestrians(G) {
  const list = [];
  G.peds = { list };

  function spawn(x, z) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: SKINS[Math.floor(G.rng.next() * SKINS.length)] });
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(G.rng.next() * SHIRTS.length)] });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x222226 }));
    legs.position.y = 0.4; g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
    torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.75; g.add(head);
    g.position.set(x, 0, z);
    G.scene.add(g);
    const ped = {
      x, z, heading: G.rng.next() * Math.PI * 2, speed: 1.2 + G.rng.next() * 0.8,
      state: 'walk', // walk | flee | cower | call
      mesh: g, callTimer: 0, callTarget: null, fleeFrom: null, stateT: 0,
      street: Math.random() < 0.5 ? 'x' : 'z',
    };
    list.push(ped);
    return ped;
  }

  function nearestStreet(v) {
    let best = CITY.streets[0], bd = Infinity;
    for (const s of CITY.streets) { const d = Math.abs(s - v); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  // Spawn 36 walkers on sidewalks (8 m off a street centreline, never inside a building).
  function populate() {
    for (let i = 0; i < 36; i++) {
      const s = CITY.streets[Math.floor(G.rng.next() * CITY.streets.length)];
      const along = G.rng.range(-390, 390);
      const side = G.rng.chance(0.5) ? -9 : 9;
      let x, z;
      if (G.rng.chance(0.5)) { x = s + side; z = along; } else { x = along; z = s + side; }
      if (G.city.collides(x, z, 1)) continue;
      spawn(x, z);
    }
  }

  function update(dt) {
    const P = G.player;
    for (const ped of list) {
      ped.stateT += dt;
      const pd = Math.hypot(ped.x - P.x, ped.z - P.z);
      // Threats: the player aiming/firing nearby, or a car speeding at the walker.
      const playerCar = P.car;
      const threat = (P.aiming && pd < 18) || (playerCar && Math.abs(playerCar.speed) > 8 && pd < 10);
      if (ped.state === 'walk' && threat) { ped.state = 'flee'; ped.fleeFrom = { x: P.x, z: P.z }; ped.stateT = 0; }
      if (ped.state === 'flee' && pd > 30) { ped.state = 'walk'; ped.stateT = 0; }
      if (ped.state === 'call' && ped.callTarget) {
        ped.callTimer += dt;
        if (ped.callTimer >= 2) {
          G.police.reportWitness(ped.callTarget);
          ped.callTarget = null; ped.state = 'walk'; ped.callTimer = 0;
        }
      }
      let vx = 0, vz = 0;
      if (ped.state === 'walk') {
        // Stroll along the sidewalk: keep to the street offset, turn at intersections.
        const s = nearestStreet(ped.street === 'x' ? ped.x : ped.z);
        if (ped.street === 'x') { vz = ped.speed * (Math.sin(ped.heading) >= 0 ? 1 : -1); ped.z += vz * dt; ped.x += (s + 9 * Math.sign(ped.x - s || 1) - ped.x) * dt * 0.5; }
        else { vx = ped.speed * (Math.sin(ped.heading) >= 0 ? 1 : -1); ped.x += vx * dt; ped.z += (s + 9 * Math.sign(ped.z - s || 1) - ped.z) * dt * 0.5; }
        if (Math.abs(ped.x) > 405 || Math.abs(ped.z) > 405 || G.rng.next() < dt * 0.02) {
          ped.heading += Math.PI / 2; ped.street = ped.street === 'x' ? 'z' : 'x';
        }
      } else if (ped.state === 'flee' && ped.fleeFrom) {
        const dx = ped.x - ped.fleeFrom.x, dz = ped.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.x += (dx / d) * 4.5 * dt; ped.z += (dz / d) * 4.5 * dt;
        ped.heading = Math.atan2(dx, dz);
      }
      // Cower/call stand still.
      G.city.resolveCircle(ped, 0.5);
      ped.x = Math.max(-410, Math.min(410, ped.x));
      ped.z = Math.max(-410, Math.min(410, ped.z));
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Simple walk bob.
      const bob = ped.state === 'walk' ? Math.sin(performance.now() / 180 + ped.x) * 0.03 : 0;
      ped.mesh.position.y = bob;
    }
  }

  // A crime happened at (x,z): find witnesses with line of sight within 25 m.
  function witnessCrime(crime) {
    let seen = false;
    for (const ped of list) {
      if (ped.state === 'call') continue;
      const d = Math.hypot(ped.x - crime.x, ped.z - crime.z);
      if (d < 25 && !G.city.losBlocked(ped.x, ped.z, crime.x, crime.z)) {
        ped.state = 'call'; ped.callTarget = crime; ped.callTimer = 0; seen = true;
      } else if (d < 12) {
        ped.state = 'flee'; ped.fleeFrom = { x: crime.x, z: crime.z }; ped.stateT = 0;
      }
    }
    return seen;
  }

  return { spawn, populate, update, witnessCrime, list };
}
