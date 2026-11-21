// VELORA HEAT — pedestrians: sidewalk walkers with walk / flee / cower / call
// states. A witness who finishes a 2 s call with line of sight to a crime feeds
// the wanted system (police.js asks for witnesses, this file only owns states).
import { street } from './config.js';
import { pick, range, dist, clamp } from './random.js';

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6e4a2f'];
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'];

export function spawnPeds(G, rng, n = 30) {
  G.peds = [];
  for (let i = 0; i < n; i++) {
    const p = randomStreetPointPed(rng);
    G.peds.push({
      x: p.x, z: p.z, angle: rng() * Math.PI * 2, speed: range(rng, 1.0, 1.8),
      hp: 100, state: 'walk', callT: 0, tx: p.x, tz: p.z, wait: range(rng, 0, 4),
      skin: pick(rng, SKINS), shirt: pick(rng, SHIRTS), deadT: 0, fleeT: 0,
    });
  }
}
function randomStreetPointPed(rng) {
  // Sidewalk: on a street, offset 6-8 m to one side.
  const i = Math.floor(rng() * 8);
  const s = street(i);
  const t = -300 + rng() * 600;
  const off = (rng() < 0.5 ? -1 : 1) * range(rng, 5, 8);
  return rng() < 0.5 ? { x: s + off, z: t } : { x: t, z: s + off };
}

export function updatePeds(G, dt) {
  const p = G.player;
  const pc = G.cars.find((c) => c.id === p.inCar);
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  const gunOut = p.weapon > 0;
  for (const ped of G.peds) {
    if (ped.hp <= 0) { ped.deadT += dt; continue; }
    const d = dist(ped.x, ped.z, px, pz);
    const threat = (gunOut && d < 22) || (pc && Math.abs(pc.speed) > 6 && d < 10) || G.gunfireT > 0 && d < 26;
    if (threat && ped.state !== 'flee') { ped.state = 'flee'; ped.fleeT = 5; }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      // Run away from the player.
      const a = Math.atan2(ped.z - pz, ped.x - px);
      ped.x += Math.cos(a) * 4.2 * dt;
      ped.z += Math.sin(a) * 4.2 * dt;
      ped.angle = a;
      G.city.pushOutCircle(ped, 0.5);
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else if (ped.state === 'cower') {
      ped.callT -= dt;
      if (ped.callT <= 0) ped.state = 'walk';
    } else if (ped.state === 'call') {
      // Phoning the police: 2 s to complete, needs line of sight to the player.
      ped.callT -= dt;
      if (ped.callT <= 0) {
        ped.state = 'walk';
        if (!G.city.segHitsBuilding(ped.x, ped.z, px, pz)) G.police.witnessCall(ped);
      }
    } else {
      // Walk the sidewalks: pick a new nearby street point when arrived / after a wait.
      if (ped.wait > 0) { ped.wait -= dt; continue; }
      const dd = dist(ped.x, ped.z, ped.tx, ped.tz);
      if (dd < 2) {
        const np = randomStreetPointPed(G.rng);
        ped.tx = np.x; ped.tz = np.z; ped.wait = range(G.rng, 0, 5);
        continue;
      }
      const a = Math.atan2(ped.tz - ped.z, ped.tx - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.z += Math.sin(a) * ped.speed * dt;
      G.city.pushOutCircle(ped, 0.5);
    }
  }
}

// A pedestrian saw a crime and starts calling it in (2 s, visible phone icon).
export function startWitnessCall(G, ped) {
  if (ped.hp <= 0 || ped.state === 'call') return;
  ped.state = 'call'; ped.callT = 2;
}
// Witnesses for a crime at (x,z): peds/officers with line of sight within 25 m.
export function witnessesAt(G, x, z) {
  const out = [];
  for (const ped of G.peds) {
    if (ped.hp <= 0) continue;
    if (dist(ped.x, ped.z, x, z) < 25 && !G.city.segHitsBuilding(ped.x, ped.z, x, z)) out.push(ped);
  }
  for (const o of G.police.officers) {
    if (dist(o.x, o.z, x, z) < 25 && !G.city.segHitsBuilding(o.x, o.z, x, z)) out.push(o);
  }
  return out;
}
export function officerNear(G, x, z, r = 12) {
  return G.police.officers.some((o) => dist(o.x, o.z, x, z) < r);
}
