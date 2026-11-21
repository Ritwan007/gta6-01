// VELORA HEAT — wanted system: heat stars 1-5, police pursuit spawning,
// line-of-sight SEARCHING cool-down, hideouts, spray garage, BUSTED/WASTED.
import { HIDEOUT, POLICE_STATION, STREETS } from './config.js';
import { pick } from './random.js';
import { spawnCar } from './vehicles.js';

export function createPolice(G) {
  return {
    seesPlayer: false,
    lastSeen: { x: 0, z: 44 },
    unseenT: 0,
    addHeat(n, reason) {
      if (G.mode !== 'play' && G.mode !== 'card') return;
      const before = G.wanted;
      G.wanted = Math.min(5, Math.max(0, G.wanted + n));
      if (G.wanted > before) {
        G.feed(`Kejahatan terlihat (${reason}): ${G.wanted} bintang!`);
        G.audio.siren(G.wanted > 0);
      }
    },
    setHeat(n, reason) {
      G.wanted = Math.min(5, Math.max(0, n));
      G.feed(`${reason}: ${G.wanted} bintang!`);
      G.audio.siren(G.wanted > 0);
    },
  };
}

function officerSeesPlayer(G) {
  const p = G.player;
  const pc = p.inCar != null ? G.cars.find((c) => c.id === p.inCar) : null;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  // Inside the hideout you are invisible.
  if (Math.hypot(px - HIDEOUT.x, pz - HIDEOUT.z) < HIDEOUT.r) return false;
  for (const c of G.cars) {
    if (c.driver !== 'police' || c.hp <= 0) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < 120 && !G.city.segmentBlocked(c.x, c.z, px, pz)) return true;
  }
  // A foot officer near the station spots you at close range.
  if (Math.hypot(px - POLICE_STATION.x, pz - POLICE_STATION.z) < 30) return true;
  return false;
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  const pc = p.inCar != null ? G.cars.find((c) => c.id === p.inCar) : null;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  const seen = officerSeesPlayer(G);
  pol.seesPlayer = seen;
  if (seen) {
    pol.lastSeen.x = px; pol.lastSeen.z = pz;
    pol.unseenT = 0;
    G.searching = false;
  } else if (G.wanted > 0) {
    pol.unseenT += dt;
    if (pol.unseenT > 6) G.searching = true;
    if (pol.unseenT > 14) {
      G.wanted = 0; G.searching = false; pol.unseenT = 0;
      G.feed('Panas reda. VBPD kehilangan jejakmu.');
      G.audio.siren(false);
    }
  }
  // Spawn police cars to match the wanted level (max 5).
  const cops = G.cars.filter((c) => c.driver === 'police' && c.hp > 0);
  if (G.wanted > 0 && cops.length < G.wanted) {
    const s = pick(G.rng, STREETS);
    const t = pick(G.rng, STREETS);
    // Spawn on a street 60-100 m from the player.
    let sx = s, sz = t;
    for (let tries = 0; tries < 12; tries++) {
      const horiz = G.rng() < 0.5;
      sx = horiz ? t : s;
      sz = horiz ? s : t;
      const d = Math.hypot(sx - px, sz - pz);
      if (d > 60 && d < 140) break;
    }
    const angle = Math.atan2(pz - sz, px - sx);
    spawnCar(G, 'police', sx, sz, angle, { driver: 'police' });
  }
  // Despawn far cops once the heat is gone.
  if (G.wanted === 0) {
    for (const c of G.cars) {
      if (c.driver === 'police' && Math.hypot(c.x - px, c.z - pz) > 150) {
        c.hp = 0; c.parked = true; c.driver = null;
      }
    }
  }
}
