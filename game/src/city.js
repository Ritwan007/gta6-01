// VELORA HEAT — city generation, collision, line-of-sight, reachability.
// Buildings are generated INSIDE blocks only, inset >= 8 m from every block edge,
// so street centrelines (where every gameplay point lives) are always clear.
import { BLOCK, NBLK, STREET, blockC, districtAt, POINTS, SHOPS, GARAGE_SLOTS, RACE_CPS, COINS } from './config.js';
import { pick, range } from './random.js';

export function createCity(rng) {
  const buildings = [];
  const props = []; // palms, lamps, crates — visual only, no collision
  for (let bi = 0; bi < NBLK; bi++) {
    for (let bj = 0; bj < NBLK; bj++) {
      const cx = blockC(bi), cz = blockC(bj);
      const d = districtAt(cx, cz);
      const two = rng() < 0.45;
      const spots = two ? [[-13, -13], [13, 13]] : [[0, 0]];
      for (const [ox, oz] of spots) {
        const w = two ? range(rng, 16, 24) : range(rng, 26, 44);
        const h = two ? range(rng, 14, 20) : range(rng, 22, 36);
        const x0 = cx + ox - w / 2, z0 = cz + oz - h / 2;
        buildings.push({
          x0, z0, x1: x0 + w, z1: z0 + h, h: range(rng, 8, 26),
          color: d.roof, district: d.name, kind: 'block',
        });
      }
      // Palms on block corners (visual).
      for (let k = 0; k < 2; k++) {
        props.push({ kind: 'palm', x: cx + pick(rng, [-30, 30]), z: cz + pick(rng, [-30, 30]) });
      }
    }
  }
  // Landmark buildings (named, drawn with signs) — inside blocks, never on streets.
  function landmark(x0, z0, x1, z1, kind, label, color) {
    buildings.push({ x0, z0, x1, z1, h: 10, color, district: '', kind, label });
  }
  landmark(-245, -80, -229, -56, 'garage', 'LESTARI MOTORS', '#c96a1e');   // NE corner of block (0,2)
  landmark(141, 141, 165, 165, 'station', 'VBPD', '#2b3a55');              // SW corner of block (5,5)
  landmark(11, -165, 35, -141, 'shop', 'PELANGIMART', '#ff9a3c');         // SE corner of block (3,1)
  landmark(-165, 11, -141, 35, 'shop', 'MIE SAMUDRA', '#ffd76a');         // SE corner of block (1,3)
  landmark(187, -77, 211, -53, 'shop', 'TOKO JAYA', '#7db8ff');           // NE corner of block (5,2)
  landmark(-253, 187, -229, 211, 'shop', 'CASA BIRU', '#7dff9a');          // NE corner of block (0,5)
  // Street lamps along every street, every 44 m.
  for (let i = 0; i <= 7; i++) {
    for (let s = -300; s <= 300; s += 44) {
      props.push({ kind: 'lamp', x: streetX(i) + 7, z: s });
      props.push({ kind: 'lamp', x: s, z: streetX(i) - 7 });
    }
  }
  function streetX(i) { return -308 + i * 88; }

  // --- collision -----------------------------------------------------------
  function pushOutCircle(p, r) {
    // p = {x, z}; moves it out of every building AABB it overlaps.
    for (const b of buildings) {
      const nx = Math.max(b.x0, Math.min(p.x, b.x1));
      const nz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * r; p.z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const pl = p.x - b.x0, pr = b.x1 - p.x, pt = p.z - b.z0, pb = b.z1 - p.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) p.x = b.x0 - r; else if (m === pr) p.x = b.x1 + r;
          else if (m === pt) p.z = b.z0 - r; else p.z = b.z1 + r;
        }
      }
    }
    p.x = Math.max(-315, Math.min(315, p.x));
    p.z = Math.max(-315, Math.min(315, p.z));
  }
  function segHitsBuilding(ax, az, bx, bz) {
    // Slab test: does segment AB cross any building AABB?
    const dx = bx - ax, dz = bz - az;
    for (const b of buildings) {
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-9) { if (ax < b.x0 || ax > b.x1) continue; }
      else {
        let t1 = (b.x0 - ax) / dx, t2 = (b.x1 - ax) / dx;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (az < b.z0 || az > b.z1) continue; }
      else {
        let t1 = (b.z0 - az) / dz, t2 = (b.z1 - az) / dz;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      return true;
    }
    return false;
  }
  function clearance(x, z) {
    let best = Infinity;
    for (const b of buildings) {
      const nx = Math.max(b.x0, Math.min(x, b.x1));
      const nz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - nx, dz = z - nz;
      best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
    }
    return best;
  }
  function isOnStreet(x, z) {
    for (let i = 0; i <= 7; i++) {
      if (Math.abs(x - (-308 + i * 88)) <= STREET / 2 + 2) return true;
      if (Math.abs(z - (-308 + i * 88)) <= STREET / 2 + 2) return true;
    }
    return false;
  }
  // Reachability table for every gameplay point: clearance >= 3 m and on a street.
  function reachabilityReport() {
    const rows = [];
    const named = { ...POINTS };
    for (const s of SHOPS) named['shop-' + s.id] = { x: s.x, z: s.z };
    GARAGE_SLOTS.forEach((s, i) => { named['slot' + i] = s; });
    RACE_CPS.forEach((c, i) => { named['race' + i] = c; });
    COINS.forEach((c, i) => { named['coin' + i] = c; });
    for (const [name, p] of Object.entries(named)) {
      const c = clearance(p.x, p.z);
      rows.push({ name, x: p.x, z: p.z, clearance: +c.toFixed(2), onStreet: isOnStreet(p.x, p.z), pass: c >= 3 && isOnStreet(p.x, p.z) });
    }
    return rows;
  }
  function roadsClearReport() {
    // Every street centreline must be free of buildings.
    const bad = [];
    for (let i = 0; i <= 7; i++) {
      const s = -308 + i * 88;
      for (let t = -300; t <= 300; t += 10) {
        if (clearance(s, t) < 2) bad.push(`vertical street ${s} at z=${t}`);
        if (clearance(t, s) < 2) bad.push(`horizontal street ${s} at x=${t}`);
      }
    }
    return bad;
  }
  return { buildings, props, pushOutCircle, segHitsBuilding, clearance, isOnStreet, reachabilityReport, roadsClearReport };
}
