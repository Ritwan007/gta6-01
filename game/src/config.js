// SUNSET HEIST: CALDERA BAY — every data table in one place.
// New original IP: city, people, vehicles, weapons, shops and story are invented here.
// Nothing from Rockstar Games or any other commercial game.
export const WORLD = {
  size: 840,                 // world spans -420..420 on x and z
  streets: [-360, -240, -120, 0, 120, 240, 360],
  roadHalf: 9,               // half-width of a road
  block: 102,                // block pitch between street centrelines (120) minus road (18)
  spawn: { x: -240, z: 60, heading: Math.PI },  // on street x=-240, facing north toward the garage
  startCash: 250,
  shardCount: 12,
  shardValue: 25,
};

export const DISTRICTS = [
  { id: 'pier',     name: 'Old Pier',     test: (x, z) => x < -240,                 palette: ['#7a8a99', '#5d6b7a', '#8b7d6b'], tall: [8, 16],  ground: '#6b7a72' },
  { id: 'marina',   name: 'Marina Sol',   test: (x, z) => x > 240,                  palette: ['#e8e0cc', '#cfe0e8', '#f2e8d5'], tall: [10, 26], ground: '#7fa3a8' },
  { id: 'hill',     name: 'Crown Hill',   test: (x, z) => z < -240,                 palette: ['#d9b48a', '#c99a6b', '#e8cfa8'], tall: [9, 20],  ground: '#8a7a5a' },
  { id: 'terrace',  name: 'The Terraces', test: (x, z) => z > 240,                  palette: ['#b0785a', '#a86a4e', '#c08a6a'], tall: [7, 14],  ground: '#7a6a58' },
  { id: 'neon',     name: 'Neon Row',     test: () => true,                         palette: ['#3a3f5c', '#4a3a5c', '#2e3a4a'], tall: [16, 42], ground: '#4a4a58' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d;
  return DISTRICTS[4];
}

// Vehicles: one factory, one physics model, variety from this table.
export const VEHICLES = {
  sedan:  { name: 'Falcon S',     kind: 'sedan',  topSpeed: 34, accel: 16, brake: 30, grip: 2.6, health: 100, len: 4.4, wid: 2.0, colors: [0x3a6fd8, 0xc23b3b, 0xd8d8d8, 0x2a2a2a, 0x3a8a5a], traffic: 0.62 },
  gt:     { name: 'Tempest GT',   kind: 'gt',     topSpeed: 48, accel: 24, brake: 34, grip: 2.1, health: 80,  len: 4.2, wid: 1.9, colors: [0xd81e1e, 0xffb300, 0x1e90d8], traffic: 0.06 },
  truck:  { name: 'Rhino Hauler', kind: 'truck',  topSpeed: 26, accel: 11, brake: 24, grip: 3.0, health: 160, len: 5.6, wid: 2.3, colors: [0x8a5a2a, 0x5a6b7a, 0x4a7a3a], traffic: 0.10 },
  van:    { name: 'Mule Van',     kind: 'van',    topSpeed: 29, accel: 12, brake: 26, grip: 2.8, health: 140, len: 5.0, wid: 2.2, colors: [0xd8d8d8, 0x3a5a8a, 0xc9a227], traffic: 0.14 },
  bike:   { name: 'Wasp 125',     kind: 'bike',   topSpeed: 44, accel: 26, brake: 36, grip: 2.4, health: 50,  len: 2.2, wid: 0.9, colors: [0xd81e5a, 0x1e1e1e, 0x2ad8c9], traffic: 0.08 },
  police: { name: 'CBPD Pursuit', kind: 'police', topSpeed: 46, accel: 22, brake: 34, grip: 3.0, health: 160, len: 4.4, wid: 2.0, colors: [0x1a1a1a], traffic: 0 },
};
export const TRAFFIC_COUNT = 14;

// Weapons: one combat system, feel from this table.
export const WEAPONS = [
  { id: 'fists',   name: 'Fists & Tire Iron', slot: 1, damage: 18, rate: 0.45, range: 2.6, mag: Infinity, reload: 0,   spread: 0,    pellets: 1, auto: false, sound: 'thud',  unlock: 0 },
  { id: 'pistol',  name: 'Sorren 9',         slot: 2, damage: 22, rate: 0.28, range: 55,  mag: 12,      reload: 1.1, spread: 0.012, pellets: 1, auto: false, sound: 'pistol', unlock: 1 },
  { id: 'smg',     name: 'Hornet SMG',       slot: 3, damage: 13, rate: 0.10, range: 42,  mag: 30,      reload: 1.6, spread: 0.05,  pellets: 1, auto: true,  sound: 'smg',   unlock: 2 },
  { id: 'shotgun', name: 'Thunder 12',       slot: 4, damage: 14, rate: 0.90, range: 26,  mag: 6,       reload: 2.4, spread: 0.11,  pellets: 6, auto: false, sound: 'shotgun', unlock: 3 },
];
export const AMMO_PRICE = { pistol: 40, smg: 60, shotgun: 80 };

// Crime -> heat. Every crime feeds the same wanted system.
export const CRIME = {
  stealUnseen: 0, stealSeen: 1, carjack: 1, robbery: 2, assaultSeen: 1,
  hitAndRun: 1, hitOfficer: 1, shotsFired: 1, hitPoliceCar: 1, stealPoliceCar: 3,
};
export const HEAT = {
  maxStars: 5,
  coolUnseenSeconds: 6,   // no officer line of sight -> SEARCHING
  clearSeconds: 8,        // SEARCHING unseen -> heat clears
  sprayPrice: 300,
  bustedFine: 250,
  wastedFine: 150,
  policeTopSpeed: (w) => Math.min(30 + w * 2.5, 40), // capped below the Interceptor (46) and GT (48): a fast car can always outrun the law on a straight, so an escape is possible at any star level (round-13 fix: at 5 stars pursuit matched the Interceptor at 46 and the escape was a death sentence)
  policeCount: (w) => Math.min(w, 5),
};

// Shops. Points are set by city.js in OPEN ground (never inside a building).
export const SHOPS = [
  { id: 'sunmart',  name: 'SunMart',       kind: 'rob',   x: 120,  z: -60,  price: 0,  robSeconds: 8,  robCash: 450 },
  { id: 'noodle',   name: 'Noodle House',  kind: 'food',  x: -120, z: 180,  price: 25, heal: 40 },
  { id: 'ammo',     name: 'Ammo Depot',    kind: 'ammo',  x: 240,  z: 180,  price: 0 },
  { id: 'clinic',   name: 'Casa Palma',    kind: 'heal',  x: -240, z: -180, price: 60, heal: 100 },
];

// Points that must sit in open ground. Streets run at x/z in {-360,-240,-120,0,120,240,360};
// every point below sits ON a street centreline, never inside a block. city.js verifies clearance.
export const POINTS = {
  garage:      { x: -300, z: 120, radius: 14 },  // street in front of Sorren Motors (block -300,180)
  garageStore: { x: -300, z: 120, radius: 12 },
  hideout1:    { x: -360, z: 300, radius: 10 },  // Old Pier container yard (street corner)
  hideout2:    { x: 360,  z: -300, radius: 10 }, // Crown Hill service lane (street corner)
  missionCar:  { x: 360,  z: 180,  radius: 12 }, // the Tempest GT for M1, parked on Marina Sol street
  vanSpot:     { x: -360, z: -120, radius: 12 }, // Mule Van for M2, Old Pier street
  dropCasa:    { x: -240, z: -180, radius: 12 }, // M2 delivery, Casa Palma street front
  robDrop:     { x: -120, z: 300,  radius: 12 }, // M4 getaway drop, The Terraces street
  finale:      { x: -360, z: 240,  radius: 14 }, // M6 getaway end, Old Pier marina street
};

// The 6-mission story chain. Objectives are data; missions.js runs them.
export const MISSIONS = [
  { id: 'M1', title: 'First Wheels', reward: 600, time: 180,
    intro: 'Ivy needs a Tempest GT, and the one parked at Marina Sol has no owner watching.\nSteal it. Bring it to Sorren Motors. Don\'t get seen — or don\'t get caught.',
    steps: [
      { type: 'goto',   point: 'missionCar', text: 'Reach the Tempest GT at Marina Sol' },
      { type: 'steal',  point: 'missionCar', text: 'Steal the Tempest GT' },
      { type: 'deliver', point: 'garage',    text: 'Deliver the Tempest GT to Sorren Motors' },
    ] },
  { id: 'M2', title: 'Hot Cargo', reward: 900, time: 150,
    intro: 'A crate at the Old Pier docks needs to reach Casa Palma before the tide turns.\nTake the Mule Van. Drive like the cargo matters — because it does.',
    steps: [
      { type: 'goto',   point: 'vanSpot',  text: 'Reach the Mule Van at Old Pier' },
      { type: 'steal',  point: 'vanSpot',  text: 'Take the Mule Van' },
      { type: 'deliver', point: 'dropCasa', text: 'Deliver the cargo to Casa Palma' },
    ] },
  { id: 'M3', title: 'Three-Star Run', reward: 1200, time: 240,
    intro: 'A drop went wrong and the whole CBPD is on you — 3 stars, sirens everywhere.\nBreak line of sight. Reach the Old Pier hideout and wait the heat out.',
    steps: [
      { type: 'escape', point: 'hideout1', text: 'Reach the Old Pier hideout — break line of sight' },
      { type: 'wait',   point: 'hideout1', text: 'Stay hidden until the heat clears', seconds: 8 },
    ] },
  { id: 'M4', title: 'Till Trouble', reward: 1800, time: 300,
    intro: 'SunMart on Neon Row keeps its till full on a Friday night.\nHold the clerk at aim for 8 seconds, grab the bag, and lose the 2-star response.',
    steps: [
      { type: 'goto',    point: 'sunmart', text: 'Reach SunMart on Neon Row' },
      { type: 'rob',     point: 'sunmart', text: 'Hold up the clerk — keep aiming for 8 seconds' },
      { type: 'deliver', point: 'robDrop', text: 'Escape to the drop point in The Terraces' },
    ] },
  { id: 'M5', title: 'Neon Row Run', reward: 2000, time: 240,
    intro: 'Two of Hale\'s racers are running the strip tonight and the whole Row is watching.\n16 checkpoints. Beat them both. First across the line takes $2,000.',
    steps: [
      { type: 'race', point: 'race', text: 'Race the checkpoints — finish 1st' },
    ] },
  { id: 'M6', title: 'Dock King', reward: 5000, time: 600,
    intro: 'Hale is coming for the garage himself. Three waves of his crew, then a run for the marina.\nHold Sorren Motors. Then drive like the city is on fire.',
    steps: [
      { type: 'defend', point: 'garage', text: 'Defend Sorren Motors — wave 1 of 3' },
      { type: 'defend', point: 'garage', text: 'Defend Sorren Motors — wave 2 of 3' },
      { type: 'defend', point: 'garage', text: 'Defend Sorren Motors — wave 3 of 3' },
      { type: 'deliver', point: 'finale', text: 'Getaway to the Old Pier marina' },
    ] },
];

export const STORY = {
  hero: 'Milo Voss',
  fixer: 'Ivy Sorren',
  villain: 'Viktor Hale',
  radio: 'Officer Nadia Ferro',
  ending: 'Hale\'s crew scatters into the night. The garage is yours, the debt is burned, and Caldera Bay is wide open.\nFree roam continues — every job, shop and street is still yours.',
};
