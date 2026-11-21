// VELORA HEAT — city generation: 8x8 street grid, 4 districts, buildings inset
// from every street centreline by construction, so roads and all named points
// are clear. Collision helpers + the two self-check reports the tests use.
import { DISTRICTS, GARAGE_SLOTS, HIDEOUT, MART, SHOPS, STREETS, reachPoints } from './config.js';
import { mulberry32, range, rangeInt } from './random.js';

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[1];
}

export function createCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  // The garage lot block (streets x -308..-220, z -132..-44) stays empty: it is
  // the mission hub and the parking slots live there.
  for (let i = 0; i < STREETS.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const x0 = STREETS[i] + 11, x1 = STREETS[i + 1] - 11;
      const z0 = STREETS[j] + 11, z1 = STREETS[j + 1] - 11;
      const isGarageBlock = STREETS[i] === -308 && STREETS[j] === -132;
      if (isGarageBlock) continue;
      const count = rangeInt(rng, 1, 2);
      const placed = [];
      for (let k = 0; k < count; k++) {
        const w = range(rng, 22, 42), d = range(rng, 22, 42);
        let bx, bz, tries = 0;
        do {
          bx = range(rng, x0, x1 - w);
          bz = range(rng, z0, z1 - d);
          tries++;
        } while (tries < 8 && placed.some((p) => bx < p.x + p.w + 6 && bx + w + 6 > p.x && bz < p.z + p.d + 6 && bz + d + 6 > p.z));
        placed.push({ x: bx, z: bz, w, d });
        const cx = bx + w / 2, cz = bz + d / 2;
        const dist = districtAt(cx, cz);
        buildings.push({
          x: bx, z: bz, w, d, h: rangeInt(rng, 8, 26),
          roof: dist.roof, wall: dist.wall, district: dist.name,
          windows: rangeInt(rng, 4, 12),
        });
      }
    }
  }
  // Landmark props (non-colliding except shops, which sit inside their block
  // with the shop front on the street; the marker point itself stays clear).
  const landmarks = SHOPS.map((s) => ({ ...s, w: 18, d: 12 }));

  function circleHitsBuilding(x, z, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cz = Math.max(b.z, Math.min(z, b.z + b.d));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return b;
    }
    return null;
  }
  function resolveCircle(x, z, r) {
    // Push a circle out of every overlapping building; returns corrected pos.
    let px = x, pz = z;
    for (let iter = 0; iter < 3; iter++) {
      const b = circleHitsBuilding(px, pz, r);
      if (!b) break;
      const cx = Math.max(b.x, Math.min(px, b.x + b.w));
      const cz = Math.max(b.z, Math.min(pz, b.z + b.d));
      let dx = px - cx, dz = pz - cz;
      let len = Math.hypot(dx, dz);
      if (len < 0.001) {
        // Centre inside the building: push out along the smallest penetration axis.
        const pl = px - b.x, pr = b.x + b.w - px, pt = pz - b.z, pb = b.z + b.d - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = b.x - r;
        else if (m === pr) px = b.x + b.w + r;
        else if (m === pt) pz = b.z - r;
        else pz = b.z + b.d + r;
        continue;
      }
      dx /= len; dz /= len;
      px = cx + dx * r; pz = cz + dz * r;
    }
    return { x: px, z: pz };
  }
  function segmentBlocked(x1, z1, x2, z2) {
    // Sampled segment vs building AABBs (true = blocked).
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 2);
    for (let i = 0; i <= steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const z = z1 + ((z2 - z1) * i) / steps;
      if (circleHitsBuilding(x, z, 0.5)) return true;
    }
    return false;
  }
  function clearance(x, z) {
    let best = Infinity;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cz = Math.max(b.z, Math.min(z, b.z + b.d));
      const d = Math.hypot(x - cx, z - cz);
      if (d < best) best = d;
    }
    return best;
  }
  function onStreet(x, z) {
    for (const s of STREETS) if (Math.abs(x - s) <= 10 || Math.abs(z - s) <= 10) return true;
    return false;
  }
  function reachabilityReport() {
    return reachPoints().map(([name, x, z]) => {
      const c = clearance(x, z);
      const street = onStreet(x, z) || (x >= -308 && x <= -220 && z >= -132 && z <= -44);
      return { name, x, z, clearance: +c.toFixed(1), onStreet: street, pass: c >= 3 && street };
    });
  }
  function roadsClearReport() {
    const bad = [];
    for (const s of STREETS) {
      for (const b of buildings) {
        const vOverlap = b.x < s + 10 && b.x + b.w > s - 10;
        const hOverlap = b.z < s + 10 && b.z + b.d > s - 10;
        if (vOverlap && b.z >= -352 && b.z <= 352) bad.push(`building at (${b.x.toFixed(0)},${b.z.toFixed(0)}) crosses vertical street ${s}`);
        if (hOverlap && b.x >= -352 && b.x <= 352) bad.push(`building at (${b.x.toFixed(0)},${b.z.toFixed(0)}) crosses horizontal street ${s}`);
      }
    }
    return bad;
  }
  return {
    buildings, landmarks, rng,
    circleHitsBuilding, resolveCircle, segmentBlocked, clearance, onStreet,
    reachabilityReport, roadsClearReport,
  };
}
