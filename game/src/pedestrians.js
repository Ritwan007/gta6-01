// VELORA HEAT — pedestrians: sidewalk walkers with a simple state machine
// (walk -> flee -> cower -> call police). Witnesses feed the wanted system.
import { STREETS } from './config.js';
import { pick } from './random.js';

const SHIRTS = ['#e8e86a', '#6ad0e8', '#e86a9a', '#9ae86a', '#e8a86a', '#b06ae8'];

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const horiz = G.rng() < 0.5;
    const s = pick(G.rng, STREETS);
    const t = STREETS[Math.floor(G.rng() * STREETS.length)];
    const off = (G.rng() < 0.5 ? -12 : 12);
    const ped = {
      x: horiz ? t : s + off, z: horiz ? s + off : t,
      angle: G.rng() * Math.PI * 2, speed: 1.1 + G.rng() * 0.7,
      state: 'walk', stateT: 0, callT: 0, hp: 30,
      shirt: pick(G.rng, SHIRTS), tx: 0, tz: 0,
    };
    // Walk target: further along the same sidewalk.
    ped.tx = ped.x + Math.cos(ped.angle) * 60;
    ped.tz = ped.z + Math.sin(ped.angle) * 60;
    G.peds.push(ped);
  }
}

function nearestStreet(v) {
  return STREETS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

export function updatePeds(G, dt) {
  const p = G.player;
  const pc = p.inCar != null ? G.cars.find((c) => c.id === p.inCar) : null;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  const playerSpeed = pc ? Math.abs(pc.speed) : 0;
  const aimingGun = p.weapon !== 'fists' && p.inCar == null;
  for (const ped of G.peds) {
    if (ped.hp <= 0) continue;
    const d = Math.hypot(ped.x - px, ped.z - pz);
    ped.stateT += dt;
    if (ped.state === 'walk') {
      // Flee: gun aimed, shots nearby, or a fast car bearing down.
      if ((aimingGun && d < 18) || (playerSpeed > 8 && d < 10) || G.shotsFiredNear > 0 && d < 25) {
        ped.state = 'flee'; ped.stateT = 0;
        ped.angle = Math.atan2(ped.z - pz, ped.x - px);
      }
    } else if (ped.state === 'flee') {
      if (ped.stateT > 4 && d > 25) { ped.state = 'walk'; ped.stateT = 0; }
    } else if (ped.state === 'call') {
      ped.callT += dt;
      if (ped.callT >= 2) {
        // The call completes: the witness reports the crime.
        ped.state = 'flee'; ped.stateT = 0; ped.callT = 0;
        if (G.pendingCrime) {
          G.police.addHeat(G.pendingCrime, 'witness');
          G.pendingCrime = 0;
        }
      }
    }
    let speed = 0;
    if (ped.state === 'walk') {
      speed = ped.speed;
      const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
      if (Math.hypot(dx, dz) < 3) {
        // New sidewalk target: pick a nearby street, walk along it.
        const ns = nearestStreet(ped.x);
        const horiz = Math.abs(ped.z - nearestStreet(ped.z)) < Math.abs(ped.x - ns);
        const s = pick(G.rng, STREETS);
        const off = (G.rng() < 0.5 ? -12 : 12);
        if (horiz) { ped.tx = s; ped.tz = ped.z; }
        else { ped.tx = ped.x; ped.tz = s; }
        ped.angle = Math.atan2(ped.tz - ped.z, ped.tx - ped.x);
      } else {
        ped.angle = Math.atan2(dz, dx);
      }
    } else if (ped.state === 'flee') {
      speed = 3.4;
      ped.angle = Math.atan2(ped.z - pz, ped.x - px);
    }
    if (speed > 0) {
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const nz = ped.z + Math.sin(ped.angle) * speed * dt;
      const fixed = G.city.resolveCircle(nx, nz, 0.7);
      ped.x = fixed.x; ped.z = fixed.z;
    }
  }
  G.shotsFiredNear = 0;
}

// A crime happened at (x, z): the nearest pedestrian with line of sight
// within 25 m starts calling the police. Returns true if witnessed.
export function witnessCrime(G, x, z) {
  for (const ped of G.peds) {
    if (ped.hp <= 0 || ped.state === 'call') continue;
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < 25 && !G.city.segmentBlocked(ped.x, ped.z, x, z)) {
      ped.state = 'call'; ped.callT = 0;
      return true;
    }
  }
  return false;
}
