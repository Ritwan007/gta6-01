// VELORA HEAT — the city of Velora Bay. A 7x7 block grid between 8 streets on
// each axis. Buildings are inset from every street centreline by construction,
// so every street (and every mission point, which sits on a street) is clear.
// Collision is circle-vs-rect; line of sight is segment-vs-rect.
import { WORLD, LANDMARKS, GARAGE, HIDEOUT, SHOP, CASA_BIRU, DROP_POINT, MARINA, POLICE_STATION, CLINIC } from './config.js';
import { pick, range } from './random.js';

// Blocks between the roads: [street+7, nextStreet-7] on each axis.
const BLOCKS = [[-301, -227], [-213, -139], [-125, -51], [-37, 37], [51, 125], [139, 213], [227, 301]];
const PALETTES = [
  { color: '#b8a88a', roof: '#8a7a5e' }, { color: '#9aa7b8', roof: '#6e7d90' },
  { color: '#c2b49a', roof: '#93835f' }, { color: '#a89a8a', roof: '#7d6f60' },
  { color: '#b09880', roof: '#826e54' }, { color: '#8fa3a0', roof: '#677873' },
];

function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

export function buildCity(rng) {
  const buildings = [];
  // Landmarks first (fixed rects, named).
  for (const lm of LANDMARKS) {
    buildings.push({ x0: lm.x0, z0: lm.z0, x1: lm.x1, z1: lm.z1, name: lm.name, color: lm.color, roof: lm.roof, landmark: true });
  }
  // One building per remaining block, inset 6 m inside the block so no wall
  // ever touches a road. Landmark blocks are skipped.
  const landmarkBlocks = new Set(LANDMARKS.map((lm) => {
    const cx = (lm.x0 + lm.x1) / 2, cz = (lm.z0 + lm.z1) / 2;
    const bx = BLOCKS.findIndex(([a, b]) => cx >= a && cx < b);
    const bz = BLOCKS.findIndex(([a, b]) => cz >= a && cz < b);
    return `${bx},${bz}`;
  }));
  for (let bx = 0; bx < 7; bx += 1) {
    for (let bz = 0; bz < 7; bz += 1) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const bx0 = BLOCKS[bx][0] + 6, bx1 = BLOCKS[bx][1] - 6;
      const bz0 = BLOCKS[bz][0] + 6, bz1 = BLOCKS[bz][1] - 6;
      const w = range(rng, 30, bx1 - bx0);
      const h = range(rng, 30, bz1 - bz0);
      const x0 = bx0 + range(rng, 0, Math.max(0, (bx1 - bx0) - w));
      const z0 = bz0 + range(rng, 0, Math.max(0, (bz1 - bz0) - h));
      const pal = pick(rng, PALETTES);
      buildings.push({ x0, z0, x1: x0 + w, z1: z0 + h, name: '', color: pal.color, roof: pal.roof, landmark: false });
    }
  }
  // Palm trees on sidewalks (decor, no collision).
  const palms = [];
  for (let i = 0; i < 90; i += 1) {
    const s = pick(rng, WORLD.streets);
    const t = range(rng, -300, 300);
    const horiz = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * range(rng, 9.5, 11.5);
    palms.push({ x: horiz ? t : s + off, z: horiz ? s + off : t });
  }
  // Parked-car spots: on streets, offset to the road edge, never on an intersection.
  const parkedSpots = [];
  const PARKED = [
    [-220, 44], [-132, -44], [220, 132], [-44, 220], [44, 308], [-308, 44],
    [132, 44], [-44, -308], [308, -132], [-132, 132], [220, -308], [44, 220],
    [-220, -220], [308, 220], [-44, 132], [132, -132],
  ];
  for (const [x, z] of PARKED) parkedSpots.push({ x, z });
  // Sidewalk spawn points for pedestrians.
  const pedSpots = [];
  for (let i = 0; i < 60; i += 1) {
    const s = pick(rng, WORLD.streets);
    const t = range(rng, -300, 300);
    const horiz = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * range(rng, 9.5, 11);
    pedSpots.push({ x: horiz ? t : s + off, z: horiz ? s + off : t });
  }

  function circleHitsBuilding(x, z, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return b;
    }
    return null;
  }
  function resolveCircle(x, z, r) {
    // Push a circle out of every building it overlaps; returns corrected pos.
    let nx = x, nz = z;
    for (let iter = 0; iter < 3; iter += 1) {
      const b = circleHitsBuilding(nx, nz, r);
      if (!b) break;
      const cx = Math.max(b.x0, Math.min(nx, b.x1));
      const cz = Math.max(b.z0, Math.min(nz, b.z1));
      let dx = nx - cx, dz = nz - cz;
      let d = Math.hypot(dx, dz);
      if (d < 0.001) {
        // Centre inside the rect: push out along the smallest penetration axis.
        const pl = nx - b.x0, pr = b.x1 - nx, pt = nz - b.z0, pb = b.z1 - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.x0 - r;
        else if (m === pr) nx = b.x1 + r;
        else if (m === pt) nz = b.z0 - r;
        else nz = b.z1 + r;
        continue;
      }
      dx /= d; dz /= d;
      nx = cx + dx * r; nz = cz + dz * r;
    }
    return { x: nx, z: nz };
  }
  function segBlocked(ax, az, bx, bz) {
    // Segment vs every building rect (slab test).
    for (const b of buildings) {
      const dx = bx - ax, dz = bz - az;
      let t0 = 0, t1 = 1;
      let ok = true;
      for (const [p, q] of [[-dx, ax - b.x0], [dx, b.x1 - ax], [-dz, az - b.z0], [dz, b.z1 - az]]) {
        if (Math.abs(p) < 1e-9) { if (q < 0) { ok = false; break; } }
        else {
          const t = q / p;
          if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
          else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
        }
      }
      if (ok && t0 <= t1) return true;
    }
    return false;
  }
  function nearestStreet(v) {
    return WORLD.streets.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  }
  function isOnStreet(x, z) {
    return WORLD.streets.some((s) => Math.abs(x - s) <= WORLD.roadHalf + 1)
      || WORLD.streets.some((s) => Math.abs(z - s) <= WORLD.roadHalf + 1);
  }
  function clearance(x, z) {
    let best = Infinity;
    for (const b of buildings) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      best = Math.min(best, Math.hypot(x - cx, z - cz));
    }
    return best;
  }

  const POINTS = [
    { name: 'garage', x: GARAGE.x, z: GARAGE.z },
    { name: 'garage slot 0', x: -244, z: -44 },
    { name: 'garage slot 1', x: -262, z: -44 },
    { name: 'garage slot 2', x: -280, z: -44 },
    { name: 'garage slot 3', x: -298, z: -44 },
    { name: 'spawn sedan', x: -220, z: 44 },
    { name: 'M1 GT', x: 220, z: 132 },
    { name: 'M2 van', x: -44, z: 220 },
    { name: 'Casa Biru', x: CASA_BIRU.x, z: CASA_BIRU.z },
    { name: 'hideout', x: HIDEOUT.x, z: HIDEOUT.z },
    { name: 'PelangiMart', x: SHOP.x, z: SHOP.z },
    { name: 'drop point', x: DROP_POINT.x, z: DROP_POINT.z },
    { name: 'marina', x: MARINA.x, z: MARINA.z },
    { name: 'VBPD HQ', x: POLICE_STATION.x, z: POLICE_STATION.z },
    { name: 'clinic', x: CLINIC.x, z: CLINIC.z },
    { name: 'sedan 2', x: -132, z: -44 },
    { name: 'race cp 1', x: -44, z: -220 },
    { name: 'race cp 2', x: 132, z: -220 },
    { name: 'race cp 3', x: 132, z: -44 },
    { name: 'race cp 4', x: 308, z: -44 },
    { name: 'race cp 5', x: 308, z: 132 },
    { name: 'race cp 6', x: 220, z: 132 },
    { name: 'race cp 7', x: 220, z: 308 },
    { name: 'race cp 8', x: 44, z: 308 },
    { name: 'race cp 9', x: 44, z: 132 },
    { name: 'race cp 10', x: -132, z: 132 },
    { name: 'race cp 11', x: -132, z: -44 },
    { name: 'race cp 12', x: -44, z: -44 },
  ];
  function reachabilityReport() {
    return POINTS.map((p) => {
      const c = clearance(p.x, p.z);
      const onStreet = isOnStreet(p.x, p.z);
      return { name: p.name, x: p.x, z: p.z, clearance: +c.toFixed(2), onStreet, pass: c >= 3 && onStreet };
    });
  }
  function roadsClearReport() {
    const bad = [];
    for (const s of WORLD.streets) {
      for (const b of buildings) {
        if (b.z0 < s + WORLD.roadHalf && b.z1 > s - WORLD.roadHalf) {
          bad.push(`H street z=${s} blocked by ${b.name || 'building'} [${b.x0},${b.z0}..${b.x1},${b.z1}]`);
        }
        if (b.x0 < s + WORLD.roadHalf && b.x1 > s - WORLD.roadHalf) {
          bad.push(`V street x=${s} blocked by ${b.name || 'building'} [${b.x0},${b.z0}..${b.x1},${b.z1}]`);
        }
      }
    }
    return [...new Set(bad)];
  }

  return {
    buildings, palms, parkedSpots, pedSpots, points: POINTS,
    circleHitsBuilding, resolveCircle, segBlocked, nearestStreet, isOnStreet, clearance,
    reachabilityReport, roadsClearReport,
  };
}
