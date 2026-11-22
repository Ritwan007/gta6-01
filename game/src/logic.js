// logic.js — the rules of LEONIDA AFTER DARK, with no browser in them.
//
// The map grid, the money, the mission table, the wanted rules and the
// save format live here as pure data and pure functions, so the headless
// suite in tests/ can hold every one of them to account. Anything that
// touches the DOM, the renderer or the clock belongs to another module.

export const SAVE_KEY = "leonida-after-dark/save/v1";

// ---------------------------------------------------------------------------
// Money. Jax starts the night with bus fare and a five-figure problem; the
// nine jobs on Marta Venn's books pay more than the debt between them —
// but only just, and only if he finishes the arc.
// ---------------------------------------------------------------------------

export const DEBT = 25000;
export const START_CASH = 600;

// ---------------------------------------------------------------------------
// The map of Port Meridian. Five avenues run north–south and eight streets
// run east–west; Ocean Drive closes the grid along the beach. Everything
// else in the game — traffic, crowds, the minimap, the world builder —
// reads the street plan from here, so the map can never disagree with
// itself.
// ---------------------------------------------------------------------------

export const AVENUES_X = [-88, -44, 0, 44, 88];
export const STREETS_Z = [-150, -110, -70, -30, 10, 50, 90, 130];
export const OCEAN_DRIVE_X = 132;
export const ROAD_HALF = 6;

export const BEACH_X = 142; // where the promenade gives up and sand begins
export const WATER_X = 172; // where the sand gives up and the sea begins
export const PIER_Z = 44;   // the lighthouse pier runs east along this line

export const WORLD = { minX: -248, maxX: 248, minZ: -152, maxZ: 164 };

// The two open yards: no street grid, just tarmac, fences and business.
export const DOCKYARD = { minX: -248, maxX: -128, minZ: 58, maxZ: 152 };
export const IMPOUND = { minX: -196, maxX: -118, minZ: -152, maxZ: -108 };

export const LANDMARKS = {
  spawn: { x: 125, z: -10, heading: 0 },
  loans: { x: -14, z: 30 },        // Venn Loans, just west of Avenue 3
  hotel: { x: 114, z: -50 },       // the Palms Royale, on Ocean Drive
  casino: { x: 112, z: 30 },       // Casino Cielo, on Ocean Drive
  docks: { x: -208, z: 108 },      // the dockyard cranes
  impound: { x: -158, z: -130 },   // the municipal impound
  lighthouse: { x: 240, z: PIER_Z },
};

function inRect(x, z, r) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** Is this point on tarmac a car is meant to be on? */
export function isRoad(x, z) {
  for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  if (Math.abs(x - OCEAN_DRIVE_X) <= ROAD_HALF) return true;
  for (const sz of STREETS_Z) if (Math.abs(z - sz) <= ROAD_HALF) return true;
  // The pier deck: a drivable boardwalk over the water to the lighthouse.
  if (x >= BEACH_X - 4 && x <= WORLD.maxX && Math.abs(z - PIER_Z) <= 7) return true;
  return false;
}

/** Is this point inside one of the open yards (dockyard or impound)? */
export function isYard(x, z) {
  return inRect(x, z, DOCKYARD) || inRect(x, z, IMPOUND);
}

/** Is this point out on the water, east of the sand line? */
export function isWater(x, z) {
  return x > WATER_X && !isRoad(x, z);
}

/** The centre of every city block the grid cuts out — 5 across, 7 deep. */
export function blockCenters() {
  const roadsX = [...AVENUES_X, OCEAN_DRIVE_X];
  const out = [];
  for (let i = 0; i + 1 < roadsX.length; i++) {
    for (let j = 0; j + 1 < STREETS_Z.length; j++) {
      out.push({
        x: (roadsX[i] + roadsX[i + 1]) / 2,
        z: (STREETS_Z[j] + STREETS_Z[j + 1]) / 2,
      });
    }
  }
  return out;
}

/** Keep a point inside the playable world, sea walls and all. */
export function clampToWorld(p) {
  return {
    x: Math.max(WORLD.minX, Math.min(WORLD.maxX, p.x)),
    z: Math.max(WORLD.minZ, Math.min(WORLD.maxZ, p.z)),
  };
}

// ---------------------------------------------------------------------------
// The mission table: nine jobs between Jax and a clean ledger. Points are
// driven in order; points[0] is where the offer light burns. Rewards sum
// to $31,600 against the $25,000 debt.
// ---------------------------------------------------------------------------

export const MISSIONS = [
  {
    id: "first-fare",
    kind: "fare",
    title: "First Fare",
    brief: "A dancer from the Cielo floor needs a ride across town and pays cash. Pick her up on Ocean Drive, drop her at Avenue 4 — no questions, no shortcuts through the flowerbeds.",
    reward: 1800,
    points: [
      { x: 132, z: -30, label: "Pick up your fare on Ocean Drive" },
      { x: 44, z: 10, label: "Drop her at Avenue 4 & 6th" },
    ],
  },
  {
    id: "hot-package",
    kind: "timed",
    title: "Hot Package",
    brief: "A courier on Avenue 2 is holding a package that gets heavier by the minute — legally speaking. Grab it and get it across town before the clock eats the fee.",
    reward: 2400,
    timeLimit: 120,
    points: [
      { x: -44, z: -70, label: "Collect the package on Avenue 2" },
      { x: 88, z: 50, label: "Deliver it to Avenue 5 & 8th" },
    ],
  },
  {
    id: "envelope-run",
    kind: "collect",
    title: "Envelope Run",
    brief: "Five envelopes, five corners, one nervous bookkeeper who wants them all in hand before he will even talk numbers. Sweep the city and pick up every one.",
    reward: 2600,
    points: [
      { x: 0, z: -110, label: "Envelope — Avenue 3 & 2nd" },
      { x: -88, z: 10, label: "Envelope — Avenue 1 & 6th" },
      { x: 44, z: -30, label: "Envelope — Avenue 4 & 4th" },
      { x: 88, z: 90, label: "Envelope — Avenue 5 & 11th" },
      { x: 0, z: 130, label: "Envelope — Avenue 3 & 13th" },
    ],
  },
  {
    id: "cielo-dash",
    kind: "checkpoints",
    title: "Cielo Dash",
    brief: "The Casino Cielo is timing a new courier route and the floor manager bets it cannot be done in one clean run. Prove him wrong — hit every checkpoint in order.",
    reward: 3200,
    timeLimit: 180,
    points: [
      { x: 132, z: -110, label: "Checkpoint — Ocean Drive & 2nd" },
      { x: 44, z: -110, label: "Checkpoint — Avenue 4 & 2nd" },
      { x: 44, z: -30, label: "Checkpoint — Avenue 4 & 4th" },
      { x: -44, z: -30, label: "Checkpoint — Avenue 2 & 4th" },
      { x: -44, z: 50, label: "Checkpoint — Avenue 2 & 8th" },
      { x: 132, z: 50, label: "Checkpoint — Ocean Drive & 8th" },
    ],
  },
  {
    id: "quiet-tail",
    kind: "follow",
    title: "Quiet Tail",
    brief: "A grey sedan is moving something for somebody, and Marta wants to know where it sleeps. Stay on its tail — close enough to keep it, far enough to stay a rumour.",
    reward: 3400,
    points: [
      { x: 0, z: 130, label: "Pick up the courier's tail at Avenue 3 & 13th" },
    ],
    follow: { from: { x: 0, z: 130 }, to: { x: -88, z: -70 }, minDist: 9, maxDist: 26 },
  },
  {
    id: "red-sportster",
    kind: "steal",
    title: "Red Sportster",
    brief: "A red sportster sits on 11th Street with the keys in it and a very trusting owner. The dockyard chop crew will pay well for it — delivered, not discussed.",
    reward: 3800,
    heatOnSteal: 2,
    points: [
      { x: -30, z: 90, label: "Steal the red sportster on 11th Street" },
      { x: -190, z: 100, label: "Get it to the dockyard chop crew" },
    ],
  },
  {
    id: "night-courier",
    kind: "timed",
    title: "Night Courier",
    brief: "One end of Port Meridian to the other, against the clock, with a trunk full of somebody else's urgency. The fee shrinks every second you admire the view.",
    reward: 4200,
    timeLimit: 150,
    points: [
      { x: 132, z: 130, label: "Collect on Ocean Drive & 13th" },
      { x: -88, z: -150, label: "Deliver to Avenue 1 & 1st" },
    ],
  },
  {
    id: "impound-special",
    kind: "steal",
    title: "Impound Special",
    brief: "A collector's coupe got towed to the municipal impound and the paperwork is a tragedy. Take it back off the row and lose it where the PD keeps its own secrets.",
    reward: 4600,
    heatOnSteal: 3,
    points: [
      { x: 60, z: -110, label: "Steal the coupe on 2nd Street" },
      { x: -160, z: -128, label: "Lose it in the impound rows" },
    ],
  },
  {
    id: "martas-gold",
    kind: "escape",
    title: "Marta's Gold",
    brief: "The last job is personal: Marta Venn's own gold coupe, sitting in the impound under a tarp. Take it, run it to the lighthouse pier, and let the tide take the evidence.",
    reward: 5600,
    heatOnSteal: 4,
    points: [
      { x: -166, z: -124, label: "Take Marta's gold coupe from the impound" },
      { x: 210, z: 44, label: "Dump it off the lighthouse pier" },
    ],
  },
];

export function totalRewards() {
  return MISSIONS.reduce((sum, m) => sum + m.reward, 0);
}

export function missionByIndex(i) {
  return Number.isInteger(i) && i >= 0 && i < MISSIONS.length ? MISSIONS[i] : null;
}

// ---------------------------------------------------------------------------
// The wanted rules. Crimes add heat; scripted heat (a mission going loud)
// sets a floor; an unseen minute sheds stars one at a time.
// ---------------------------------------------------------------------------

export const MAX_WANTED = 5;

// Heat per crime. Anything not on the list — scripted "mission" noise
// included — is the mission's own business and moves nothing here.
export const CRIME_HEAT = {
  theft: 1,
  assault: 1,
  vandalism: 1,
  reckless: 1,
  hitAndRun: 2,
};

export function raiseWanted(level, crime) {
  const heat = CRIME_HEAT[crime] ?? 0;
  return Math.max(0, Math.min(MAX_WANTED, level + heat));
}

export function setWantedAtLeast(level, floor) {
  return Math.max(0, Math.min(MAX_WANTED, Math.max(level, floor)));
}

export function policeCountFor(wanted) {
  return Math.max(0, Math.min(MAX_WANTED, Math.floor(wanted)));
}

const COOL_SECONDS_PER_STAR = 20;

/** Shed stars for clean, unseen seconds — never while a cruiser watches. */
export function coolWanted(level, unseenSeconds, seen) {
  if (seen || level <= 0) return Math.max(0, level);
  const shed = Math.floor(Math.max(0, unseenSeconds) / COOL_SECONDS_PER_STAR);
  return Math.max(0, level - shed);
}

/** A bust costs a flat booking fee plus a slice of the cash on hand. */
export function bustFine(cash) {
  const onHand = Math.max(0, Math.floor(cash));
  return Math.min(onHand, 150 + Math.floor(onHand * 0.12));
}

// ---------------------------------------------------------------------------
// The save: cash, what's been paid off the ledger, which jobs are done.
// parseSave trusts nothing — a tampered or rotten save is cleaned, and
// junk is refused outright.
// ---------------------------------------------------------------------------

export function createSave() {
  return { cash: START_CASH, debtPaid: 0, missionsDone: [], finished: false, startedAt: 0 };
}

export function serializeSave(save) {
  return JSON.stringify({
    cash: save.cash,
    debtPaid: save.debtPaid,
    missionsDone: [...save.missionsDone],
    finished: save.finished,
    startedAt: save.startedAt,
  });
}

export function parseSave(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const known = new Set(MISSIONS.map((m) => m.id));
  const done = [];
  if (Array.isArray(data.missionsDone)) {
    for (const id of data.missionsDone) {
      if (typeof id === "string" && known.has(id) && !done.includes(id)) done.push(id);
    }
  }
  const cash = Number(data.cash);
  const paid = Number(data.debtPaid);
  const started = Number(data.startedAt);
  return {
    cash: Number.isFinite(cash) ? Math.max(0, Math.floor(cash)) : START_CASH,
    debtPaid: Number.isFinite(paid) ? Math.max(0, Math.min(DEBT, Math.floor(paid))) : 0,
    missionsDone: done,
    finished: Boolean(data.finished),
    startedAt: Number.isFinite(started) ? started : 0,
  };
}

/** The next job on the books, or null when the arc is fully worked. */
export function nextMission(save) {
  return MISSIONS.find((m) => !save.missionsDone.includes(m.id)) ?? null;
}

/** Bank a mission's reward — once, however often the call is replayed. */
export function completeMission(save, mission) {
  if (!mission) return save.cash;
  if (!save.missionsDone.includes(mission.id)) {
    save.missionsDone.push(mission.id);
    save.cash += mission.reward;
  }
  return save.cash;
}

export function debtRemaining(save) {
  return Math.max(0, DEBT - save.debtPaid);
}

/** The ledger can only be closed in full when the cash covers what's left. */
export function canPayDebt(save) {
  return debtRemaining(save) > 0 && save.cash >= debtRemaining(save);
}

/** Pay what's owed — in full if the cash covers it, else everything there is. */
export function payDebt(save) {
  const due = debtRemaining(save);
  const paid = Math.min(save.cash, due);
  save.cash -= paid;
  save.debtPaid += paid;
  if (debtRemaining(save) === 0 && paid > 0) save.finished = true;
  return paid;
}
