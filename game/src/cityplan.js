// cityplan.js — the pure layout of Port Meridian: no three.js, no DOM, so the
// test suite can prove the map's facts in Node (blocks never touch roads, every
// mission point is inside the world, lanes line up). city.js renders exactly
// what is declared here; vehicles.js drives on exactly these roads.
//
// The city is a grid island. Avenues run north–south (constant x), streets run
// east–west (constant z); +z is "south" on the fiction's compass. East of the
// last avenue is Ocean Drive's promenade, the beach, and Serena Bay.

export const ROAD_HALF = 8; // a road is 16 m wide, kerb to kerb
export const AVENUES = [-192, -128, -64, 0, 64, 128, 192];
export const STREETS = [-128, -64, 0, 64, 128];

export const CITY = { minX: -240, maxX: 240, minZ: -176, maxZ: 176 };
export const BEACH_X = 228; // sand starts here; water starts at WATER_X
export const WATER_X = 252;
export const WORLD = { minX: -320, maxX: 340, minZ: -260, maxZ: 260 };

const BLOCK_CENTRES_X = [-160, -96, -32, 32, 96, 160];
const BLOCK_CENTRES_Z = [-96, -32, 32, 96];
export const BLOCK_SIZE = 48;

// What each block is for. Everything not named here is ordinary buildings.
const SPECIAL_BLOCKS = new Map([
  ['160,32', 'hotel'], // the Palms Royale tower, facing Ocean Drive
  ['96,-96', 'casino'], // Casino Cielo
  ['-160,96', 'dockyard'], // marina warehouses, crates, the ledger job
  ['-32,96', 'safehouse'], // Zara's garage and the crew's yard
  ['32,-32', 'plaza'], // Meridian Plaza: palms and benches, no towers
  ['-96,-32', 'parking'], // a public car park, full of stealable cars
  ['96,96', 'parking'],
]);

export const BLOCKS = [];
for (const cx of BLOCK_CENTRES_X) {
  for (const cz of BLOCK_CENTRES_Z) {
    BLOCKS.push({ cx, cz, kind: SPECIAL_BLOCKS.get(`${cx},${cz}`) ?? 'buildings' });
  }
}

// Named places the story and the HUD talk about. Points the player must reach
// sit on roads or open ground, never inside a building lot.
export const LANDMARKS = {
  playerSpawn: { x: -24, z: 124 },
  zaraCoupe: { x: -40, z: 127 },
  hotelFront: { x: 190, z: 32 },
  marinaWarehouse: { x: -160, z: 118 },
  oceanGarage: { x: 190, z: -32 },
  safehouse: { x: -32, z: 126 },
  ledgerCrate: { x: -174, z: 82 },
  dockGate: { x: -136, z: 118 },
  casinoValet: { x: 100, z: -70 },
  zaraYard: { x: -32, z: 108 },
  pierMeet: { x: 224, z: -144 },
  boathouse: { x: 214, z: -150 },
  pierBase: { x: 240, z: -144 },
  lighthouse: { x: 298, z: -144 },
};

export const STAR_CACHE_POINTS = [
  { x: 192, z: -120 },
  { x: 196, z: 8 },
  { x: 188, z: 120 },
  { x: 64, z: 128 },
  { x: -64, z: -128 },
];

export const DAWN_RUN_GATES = [
  { x: 128, z: 128 },
  { x: 192, z: 0 },
  { x: 64, z: -128 },
  { x: -128, z: -64 },
  { x: -192, z: 64 },
  { x: 240, z: -144 },
];

/** True when (x, z) is on a road surface (avenue, street or their crossing). */
export function isOnRoad(x, z) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sz of STREETS) if (Math.abs(z - sz) <= ROAD_HALF) return true;
  return false;
}

/** The block whose square holds (x, z), or null on roads and open ground. */
export function blockAt(x, z) {
  for (const block of BLOCKS) {
    if (Math.abs(x - block.cx) <= BLOCK_SIZE / 2 && Math.abs(z - block.cz) <= BLOCK_SIZE / 2) return block;
  }
  return null;
}

/** True when (x, z) is inside the island's city ground (not the bay). */
export function isOnLand(x, z) {
  return x >= CITY.minX && x <= BEACH_X + 24 && z >= CITY.minZ && z <= CITY.maxZ;
}

/**
 * The lane offset for right-hand traffic: a car heading along +z keeps to the
 * lane 3.2 m to its right, and so on. Returns the offset to apply on the axis
 * across the direction of travel.
 */
export const LANE_OFFSET = 3.2;

/** The centre-line point of the nearest road, for snapping spawns onto roads. */
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestDist = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestDist) {
      bestDist = d;
      best = { x: ax, z };
    }
  }
  for (const sz of STREETS) {
    const d = Math.abs(z - sz);
    if (d < bestDist) {
      bestDist = d;
      best = { x, z: sz };
    }
  }
  return best;
}
