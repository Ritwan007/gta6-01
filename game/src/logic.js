// logic.js — the pure rules of LEONIDA AFTER DARK.
//
// Nothing in this file touches the DOM, three.js or the clock: it is the
// city's map data, the story's mission table, the economy, the wanted
// rules and the save format, written so the Node test suite can hold every
// rule to account without opening a browser.

// ---------------------------------------------------------------------------
// The map of Port Meridian. Avenues run north-south (constant x), streets
// run east-west (constant z). Blocks sit between them; the beach, the
// dockyard and the pier break the grid on purpose.
// ---------------------------------------------------------------------------

export const AVENUES_X = [-176, -132, -88, -44, 0, 44, 88];
export const OCEAN_DRIVE_X = 132;
export const STREETS_Z = [-110, -66, -22, 22, 66, 110];
export const ROAD_HALF = 6; // half the width of a road, in metres
export const BLOCK_PITCH = 44;

export const BEACH_X = 150; // sand starts here
export const WATER_X = 180; // open water starts here
export const PIER_Z = 44;
export const PIER_END_X = 240;

export const DOCKYARD = { minX: -232, maxX: -188, minZ: 58, maxZ: 152 };
export const IMPOUND = { minX: -182, maxX: -96, minZ: -146, maxZ: -118 };

export const LANDMARKS = {
  hotel: { x: 110, z: -44, name: "Palms Royale" },
  casino: { x: 110, z: 44, name: "Casino Cielo" },
  loans: { x: -22, z: 0, name: "Venn Loans" },
  chopShop: { x: -208, z: 128, name: "Salvage & Sons" },
  lighthouse: { x: PIER_END_X, z: PIER_Z, name: "Meridian Light" },
  spawn: { x: 124, z: -30, heading: Math.PI },
};

/** Block centres between the avenues (west..east) and streets (north..south). */
export function blockCenters() {
  const xs = [];
  const roadsX = [...AVENUES_X, OCEAN_DRIVE_X];
  for (let i = 0; i + 1 < roadsX.length; i++) xs.push((roadsX[i] + roadsX[i + 1]) / 2);
  const zs = [];
  for (let i = 0; i + 1 < STREETS_Z.length; i++) zs.push((STREETS_Z[i] + STREETS_Z[i + 1]) / 2);
  const out = [];
  for (const x of xs) for (const z of zs) out.push({ x, z });
  return out;
}

/** Is the point on a road (avenue, street or Ocean Drive)? */
export function isRoad(x, z) {
  for (const ax of [...AVENUES_X, OCEAN_DRIVE_X]) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sz of STREETS_Z) if (Math.abs(z - sz) <= ROAD_HALF) return true;
  // The pier is drivable decking.
  if (x >= WATER_X && x <= PIER_END_X + 6 && Math.abs(z - PIER_Z) <= 5) return true;
  return false;
}

/** Is the point inside the dockyard or the impound lot (open yards, no blocks)? */
export function isYard(x, z) {
  const inRect = (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  return inRect(DOCKYARD) || inRect(IMPOUND);
}

/** Clamp a world position to the playable ground. */
export function clampToWorld(p) {
  p.x = Math.max(-238, Math.min(248, p.x));
  p.z = Math.max(-152, Math.min(158, p.z));
  return p;
}

// ---------------------------------------------------------------------------
// The story. Jax Marlowe owes Venn Loans DEBT dollars. Nine missions, worked
// in order from glowing markers, pay more than the debt between them.
// ---------------------------------------------------------------------------

export const DEBT = 25_000;
export const START_CASH = 120;

export const MISSIONS = [
  {
    id: "first-fare",
    title: "First Fare",
    giver: "Desk clerk, Palms Royale",
    kind: "fare",
    reward: 1600,
    brief: "A guest at the Palms Royale needs a ride to Casino Cielo. Pick her up at the hotel doors, drop her at the casino steps.",
    points: [
      { x: 131, z: -44, label: "Pick up the guest" },
      { x: 131, z: 44, label: "Drop her at Casino Cielo" },
    ],
  },
  {
    id: "hot-package",
    title: "Hot Package",
    giver: "Dockhand, Pier 9",
    kind: "timed",
    reward: 2200,
    timeLimit: 110,
    brief: "A crate came off the night boat that nobody signed for. Take it from the dockyard to the condo tower on Ocean Drive — quickly, and don't stop to chat.",
    points: [
      { x: -206, z: 96, label: "Collect the crate" },
      { x: 128, z: -88, label: "Deliver to the condo tower" },
    ],
  },
  {
    id: "three-drops",
    title: "Three Drops",
    giver: "Vera, by phone",
    kind: "collect",
    reward: 2600,
    brief: "Three envelopes, three doorsteps across the city. Collect every envelope and Vera squares a slice of your tab.",
    points: [
      { x: -48, z: -88, label: "Envelope: north-west block" },
      { x: 40, z: 88, label: "Envelope: south market" },
      { x: -136, z: 44, label: "Envelope: west garages" },
    ],
  },
  {
    id: "checkpoint-dash",
    title: "Checkpoint Dash",
    giver: "Street racers, underpass",
    kind: "checkpoints",
    reward: 3000,
    timeLimit: 105,
    brief: "The underpass crew runs a midnight dash: six checkpoints across Port Meridian against the clock. Beat it and the pot is yours.",
    points: [
      { x: 0, z: -110, label: "Checkpoint 1" },
      { x: 88, z: -22, label: "Checkpoint 2" },
      { x: 132, z: 66, label: "Checkpoint 3" },
      { x: -44, z: 110, label: "Checkpoint 4" },
      { x: -132, z: 22, label: "Checkpoint 5" },
      { x: -22, z: -66, label: "Checkpoint 6 — finish" },
    ],
  },
  {
    id: "tail-money",
    title: "Tail Money",
    giver: "Vera, by phone",
    kind: "follow",
    reward: 3400,
    brief: "A courier is moving Venn money in a grey sedan. Follow him to the drop — stay close enough to see, far enough not to spook him.",
    points: [{ x: 44, z: -110, label: "Find the grey sedan" }],
    follow: { from: { x: 44, z: -110 }, to: { x: -88, z: 66 }, minDist: 11, maxDist: 48 },
  },
  {
    id: "beach-run",
    title: "Beach Run",
    giver: "Lifeguard, Ocean Drive",
    kind: "timed",
    reward: 3800,
    timeLimit: 95,
    brief: "Medicine for the lighthouse keeper, and the fog is coming in. Down Ocean Drive and out the pier — the harbour patrol will take an interest.",
    points: [
      { x: 132, z: -110, label: "Collect the medicine" },
      { x: 232, z: 44, label: "Reach the lighthouse" },
    ],
    heatOnStart: 2,
  },
  {
    id: "tow-job",
    title: "Tow Job",
    giver: "Sal, Salvage & Sons",
    kind: "steal",
    reward: 4400,
    brief: "The city impounded Sal's best coupe. It's sitting in the north impound lot under a floodlight. Take it back and bring it home to the yard.",
    points: [
      { x: -140, z: -132, label: "Steal the coupe from the impound" },
      { x: -208, z: 128, label: "Deliver it to Salvage & Sons" },
    ],
    heatOnSteal: 2,
  },
  {
    id: "night-fare",
    title: "Night Fare",
    giver: "Concierge, Casino Cielo",
    kind: "fare",
    reward: 5000,
    brief: "A high roller at Casino Cielo wants the scenic route to the north marina lookout, and pays like time is nothing. It is not nothing: don't keep him waiting at the kerb.",
    points: [
      { x: 131, z: 44, label: "Pick up the high roller" },
      { x: 132, z: -132, label: "Drop him at the marina lookout" },
    ],
  },
  {
    id: "final-ledger",
    title: "The Final Ledger",
    giver: "Marta Venn, in person",
    kind: "escape",
    reward: 6600,
    brief: "Marta Venn keeps the original ledger in her valeted car at the Palms Royale. Take the car, shake the heat, and bring it to the lighthouse pier. The debt dies with the ledger.",
    points: [
      { x: 131, z: -52, label: "Take the valeted car" },
      { x: 232, z: 44, label: "Bring it to the lighthouse pier" },
    ],
    heatOnSteal: 3,
  },
];

export function totalRewards(missions = MISSIONS) {
  return missions.reduce((sum, m) => sum + m.reward, 0);
}

export function missionByIndex(i) {
  return MISSIONS[i] ?? null;
}

// ---------------------------------------------------------------------------
// The wanted rules. Crimes raise the level; time and distance cool it.
// ---------------------------------------------------------------------------

export const MAX_WANTED = 5;
export const CRIME_HEAT = {
  theft: 1, // stealing a car
  assault: 1, // shoving a pedestrian
  hitAndRun: 1, // running a pedestrian down
  policeHit: 1, // ramming a police car
  mission: 0, // scripted heat is applied by the mission itself
};

export function raiseWanted(level, crime) {
  const add = CRIME_HEAT[crime] ?? 0;
  return Math.max(0, Math.min(MAX_WANTED, level + add));
}

export function setWantedAtLeast(level, floor) {
  return Math.max(0, Math.min(MAX_WANTED, Math.max(level, floor)));
}

/** Police the player must expect at a given wanted level. */
export function policeCountFor(level) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(MAX_WANTED, level))] ?? 0;
}

/**
 * Cool the wanted level down. `seconds` of clean time pass; cooling only
 * bites while no police car is close enough to see the player.
 */
export function coolWanted(level, seconds, policeNear) {
  if (level <= 0 || policeNear) return level;
  const steps = Math.floor(seconds / 22);
  return Math.max(0, level - steps);
}

/** What being busted costs: a slice of the cash on hand, never below zero. */
export function bustFine(cash) {
  return Math.min(cash, 150 + Math.floor(cash * 0.12));
}

// ---------------------------------------------------------------------------
// The save. A small plain object in localStorage; serialise/parse are pure
// so the round trip can be tested headlessly.
// ---------------------------------------------------------------------------

export const SAVE_KEY = "leonida-after-dark-save-v1";

export function createSave() {
  return {
    cash: START_CASH,
    debtPaid: 0,
    missionsDone: [],
    startedAt: 0,
    finished: false,
  };
}

export function serializeSave(save) {
  return JSON.stringify({
    cash: Math.floor(save.cash),
    debtPaid: Math.floor(save.debtPaid),
    missionsDone: [...save.missionsDone],
    startedAt: Math.floor(save.startedAt),
    finished: !!save.finished,
  });
}

export function parseSave(text) {
  if (!text) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const save = createSave();
  if (Number.isFinite(raw.cash)) save.cash = Math.max(0, Math.floor(raw.cash));
  if (Number.isFinite(raw.debtPaid)) save.debtPaid = Math.max(0, Math.min(DEBT, Math.floor(raw.debtPaid)));
  if (Array.isArray(raw.missionsDone)) {
    const ids = new Set(MISSIONS.map((m) => m.id));
    save.missionsDone = raw.missionsDone.filter((id) => ids.has(id));
  }
  if (Number.isFinite(raw.startedAt)) save.startedAt = Math.floor(raw.startedAt);
  save.finished = !!raw.finished;
  return save;
}

/** The next mission the story offers, or null when the arc is complete. */
export function nextMission(save) {
  return MISSIONS.find((m) => !save.missionsDone.includes(m.id)) ?? null;
}

/** Record a finished mission and its reward. Returns the new cash total. */
export function completeMission(save, mission) {
  if (!save.missionsDone.includes(mission.id)) save.missionsDone.push(mission.id);
  save.cash += mission.reward;
  return save.cash;
}

export function debtRemaining(save) {
  return Math.max(0, DEBT - save.debtPaid);
}

export function canPayDebt(save) {
  return save.cash >= debtRemaining(save) && debtRemaining(save) > 0;
}

/** Pay the debt down as far as the cash reaches. Returns the amount paid. */
export function payDebt(save) {
  const due = debtRemaining(save);
  const paid = Math.min(due, save.cash);
  save.cash -= paid;
  save.debtPaid += paid;
  if (debtRemaining(save) === 0) save.finished = true;
  return paid;
}
