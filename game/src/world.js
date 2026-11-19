// NEON COAST: UNDERWORLD — city layout data (gta6-01, round 12).
// One source of truth for buildings, roads, shops, shards, garage and
// parked cars. Every interact/deliver/pickup point is placed OUTSIDE every
// building footprint with >=3m clearance; reachabilityReport() proves it.
export const STREET_X = [-380, -300, -150, 0, 150, 300, 380];
export const STREET_Z = [-380, -300, -150, 0, 150, 300, 380];
export const ROAD_W = 14;
export const SPAWN = { x: -300, y: 0, z: 60 };
export const CITY_BOUND = 420;

// Garage building lives in the block between streets x=-300 and x=-150,
// z=150..300. Its south face is z=185; the garage point sits 13m in front
// of that face, on open ground — never at the building centre.
export const GARAGE = {
  building: { x1: -272, z1: 185, x2: -228, z2: 215, h: 10, district: 'The Undertow' },
  point: { x: -250, z: 172, radius: 12 },
  storeRadius: 10,
};
export const HIDEOUT = { x: -250, z: 292, radius: 10 };
export const HQ_POINT = { x: 200, z: -200, radius: 10 }; // Civic Center, Det. Ilves
export const PORT_POINT = { x: 60, z: -330, radius: 12 }; // M8 finale, Portside
export const AERO_POINT = { x: -330, z: 330, radius: 12 }; // M2 delivery, Aero Field
export const WAREHOUSE_POINT = { x: -200, z: -330, radius: 14 }; // M7 defence

export const SHOPS = [
  { id: 'ammo', name: 'Ironworks Ammo & Armor', x: -125, z: 155, radius: 8,
    bldg: { x1: -140, z1: 160, x2: -110, z2: 185, h: 8 } },
  { id: 'jewel', name: 'Coral Row Jewellers', x: 125, z: 155, radius: 8,
    bldg: { x1: 110, z1: 160, x2: 140, z2: 185, h: 9 } },
  { id: 'clinic', name: 'Neon Clinic', x: -125, z: -155, radius: 8,
    bldg: { x1: -140, z1: -185, x2: -110, z2: -160, h: 8 } },
  { id: 'diner', name: 'Sunset Diner', x: 275, z: -8, radius: 8,
    bldg: { x1: 260, z1: -40, x2: 290, z2: -15, h: 7 } },
];

// 20 neon shards — all on roads / open plazas, never inside a building.
export const SHARDS = [
  [-300, -300], [-150, -300], [0, -300], [150, -300], [300, -300],
  [-300, -150], [0, -150], [300, -150], [-380, 0], [-150, 0],
  [150, 0], [380, 0], [-300, 150], [0, 150], [300, 150],
  [-150, 300], [0, 300], [150, 300], [380, -300], [-380, 300],
].map(([x, z], i) => ({ id: 'shard' + (i + 1), x, z, radius: 4 }));

// Parked steal targets at fixed spots (on road edges, clear of buildings).
export const PARKED = [
  { id: 'sedan1', kind: 'sedan', x: -298, z: 42, heading: 0 },
  { id: 'gt', kind: 'gt', x: 143, z: -60, heading: Math.PI, mission: 'M1' },
  { id: 'van1', kind: 'van', x: 307, z: 200, heading: Math.PI / 2 },
  { id: 'bike1', kind: 'bike', x: -157, z: 280, heading: 0 },
  { id: 'truck1', kind: 'truck', x: -7, z: -280, heading: Math.PI },
  { id: 'sedan2', kind: 'sedan', x: 293, z: -140, heading: -Math.PI / 2 },
];

export const DISTRICTS = [
  { name: 'Downtown', x1: -160, z1: -160, x2: 160, z2: 160 },
  { name: 'Marina Luxe', x1: 300, z1: -300, x2: 420, z2: 300 },
  { name: 'Portside', x1: -160, z1: -420, x2: 420, z2: -160 },
  { name: 'The Undertow', x1: -420, z1: 160, x2: -160, z2: 420 },
  { name: 'Aero Field', x1: -420, z1: 300, x2: -160, z2: 420 },
  { name: 'Sierra Ridge', x1: -420, z1: -160, x2: -300, z2: 160 },
  { name: 'Coral Row', x1: -160, z1: 120, x2: 160, z2: 200 },
  { name: 'Civic Center', x1: 160, z1: -300, x2: 420, z2: -160 },
  { name: 'Marina Luxe', x1: 160, z1: 160, x2: 420, z2: 420 },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x1 && x <= d.x2 && z >= d.z1 && z <= d.z2) return d.name;
  return 'Neon Coast';
}

// Deterministic pseudo-random (mulberry32) for generated buildings.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generated buildings: one per street block, inset 14m from street lines,
// so no building ever sits on a street line. Blocks holding a special
// building (garage / shops) are skipped.
export function genBuildings() {
  const rand = mulberry32(20261119);
  const special = [GARAGE.building, ...SHOPS.map((s) => s.bldg)];
  const out = [];
  const xs = [-300, -150, 0, 150, 300];
  const zs = [-300, -150, 0, 150, 300];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const bx1 = xs[i] + 14, bx2 = xs[i + 1] - 14;
      const bz1 = zs[j] + 14, bz2 = zs[j + 1] - 14;
      if (rand() < 0.18) continue; // plaza / park block
      // Two buildings per block (west/east halves) for a denser skyline.
      for (let half = 0; half < 2; half++) {
        const hx1 = bx1 + half * (bx2 - bx1) / 2 + 2, hx2 = bx1 + (half + 1) * (bx2 - bx1) / 2 - 2;
        const w = 20 + rand() * Math.max(8, (hx2 - hx1) - 24), d = 26 + rand() * 34;
        const cx = hx1 + (hx2 - hx1 - w) / 2 + rand() * 6 - 3;
        const cz = bz1 + (bz2 - bz1 - d) / 2 + rand() * 8 - 4;
        const b = { x1: cx, z1: cz, x2: cx + w, z2: cz + d, h: 8 + rand() * 42,
          district: districtAt(cx + w / 2, cz + d / 2) };
        if (special.some((s) => b.x1 < s.x2 + 4 && b.x2 > s.x1 - 4 && b.z1 < s.z2 + 4 && b.z2 > s.z1 - 4)) continue;
        out.push(b);
      }
    }
  }
  return [...special.map((s) => ({ ...s, h: s.h ?? 9, district: districtAt((s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2) })), ...out];
}

export function allBuildings() { return genBuildings(); }

// Distance from a point to an AABB (0 when inside).
export function distToAABB(x, z, b) {
  const dx = Math.max(b.x1 - x, 0, x - b.x2);
  const dz = Math.max(b.z1 - z, 0, z - b.z2);
  return Math.hypot(dx, dz);
}

// Static reachability check: every named interact/deliver/pickup point must
// sit outside every building with >=3m clearance, and its interact radius
// must be >= the closest collision-capped approach distance (0 in open
// ground, since the player can stand on the point itself).
export function reachabilityReport() {
  const buildings = allBuildings();
  const points = [
    { name: 'garage', x: GARAGE.point.x, z: GARAGE.point.z, radius: GARAGE.point.radius },
    { name: 'hideout', x: HIDEOUT.x, z: HIDEOUT.z, radius: HIDEOUT.radius },
    { name: 'hq-ilves', x: HQ_POINT.x, z: HQ_POINT.z, radius: HQ_POINT.radius },
    { name: 'port-finale', x: PORT_POINT.x, z: PORT_POINT.z, radius: PORT_POINT.radius },
    { name: 'aero-delivery', x: AERO_POINT.x, z: AERO_POINT.z, radius: AERO_POINT.radius },
    { name: 'warehouse', x: WAREHOUSE_POINT.x, z: WAREHOUSE_POINT.z, radius: WAREHOUSE_POINT.radius },
    ...SHOPS.map((s) => ({ name: 'shop-' + s.id, x: s.x, z: s.z, radius: s.radius })),
    ...SHARDS.map((s) => ({ name: s.id, x: s.x, z: s.z, radius: s.radius })),
    { name: 'spawn', x: SPAWN.x, z: SPAWN.z, radius: 2 },
    ...PARKED.map((p) => ({ name: 'parked-' + p.id, x: p.x, z: p.z, radius: 5 })),
  ];
  const results = points.map((p) => {
    let minD = Infinity;
    for (const b of buildings) minD = Math.min(minD, distToAABB(p.x, p.z, b));
    const pass = minD >= 3;
    return { ...p, clearance: +minD.toFixed(2), approach: 0, pass };
  });
  return { total: results.length, passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass), results };
}
