// Sunset Heist: Caldera Bay — every data table in one place.
// City geometry: streets run at -360,-240,-120,0,120,240,360 on both axes (120 m pitch,
// 14 m wide). Blocks sit between streets; buildings stay >=18 m from any street centreline,
// so every mission/garage/shop point below is reachable by car or on foot.
export const CITY = {
  half: 420,
  streets: [-360, -240, -120, 0, 120, 240, 360],
  roadHalf: 7,
  // Named places. x/z are world metres; r is the interact radius.
  points: {
    spawn:      { x: -240, z: 60,  r: 3 },
    garage:     { x: -300, z: 120, r: 14 },
    hideout1:   { x: -360, z: 300, r: 10 },
    hideout2:   { x: 360,  z: -300, r: 10 },
    missionCar: { x: 360,  z: 180, r: 12 },
    vanSpot:    { x: -360, z: -120, r: 12 },
    dropCasa:   { x: -240, z: -180, r: 12 },
    robDrop:    { x: -120, z: 300, r: 12 },
    finale:     { x: -360, z: 240, r: 14 },
    station:    { x: 300,  z: -60, r: 12 },
    sunmart:    { x: 120,  z: -60, r: 8 },
    noodle:     { x: -120, z: 180, r: 8 },
    ammo:       { x: 240,  z: 180, r: 8 },
    clinic:     { x: -240, z: -180, r: 8 },
  },
  // Sun coins (+$25 each) scattered across the map.
  shards: [
    [-360, 0], [-240, 240], [-120, -240], [0, 120], [120, 360], [240, -240],
    [360, -60], [0, -360], [-360, -300], [120, 0], [240, 300], [-120, 60],
  ],
  // M5 race route: 17 checkpoints, every leg runs along a street centreline.
  // (Streets are -360,-240,-120,0,120,240,360; -300/300 are BLOCK centres, never route points.)
  raceRoute: [
    [-360, 360], [-360, -360], [360, -360], [360, 360], [120, 360], [120, -120],
    [-120, -120], [-120, 120], [120, 120], [360, 120], [360, -120], [0, -120],
    [0, 360], [-360, 360], [-360, 0], [0, 0], [0, 360],
  ],
  districts: [
    { name: 'Old Pier',   x0: -420, z0: 180, x1: -120, z1: 420, palette: ['#7a5a44', '#8a6a52', '#6a4a3a'], height: [18, 34] },
    { name: 'Neon Row',   x0: -120, z0: -120, x1: 180, z1: 180, palette: ['#c25a7a', '#7a5ac2', '#3c8ab2'], height: [26, 60] },
    { name: 'The Terraces', x0: -420, z0: -420, x1: -120, z1: 180, palette: ['#b28a5a', '#a07a4a', '#c2a06a'], height: [14, 30] },
    { name: 'Marina Sol', x0: 180, z0: -120, x1: 420, z1: 420, palette: ['#5ab2c2', '#4a9ab2', '#6ac2d2'], height: [20, 44] },
    { name: 'Crown Hill', x0: -120, z0: -420, x1: 420, z1: -120, palette: ['#8a7ab2', '#7a6aa2', '#9a8ac2'], height: [30, 70] },
  ],
};

// Vehicle variants — one factory, one physics model, stats per row.
export const VEHICLES = {
  sedan:     { name: 'Falcon S',     kind: 'sedan',     top: 34, accel: 14, grip: 2.6, hp: 120, color: 0x3c7ab2, len: 4.4, wid: 1.9 },
  gt:        { name: 'Tempest GT',   kind: 'gt',        top: 48, accel: 20, grip: 2.1, hp: 100, color: 0xc23c2a, len: 4.2, wid: 1.8 },
  truck:     { name: 'Rhino Hauler', kind: 'truck',     top: 26, accel: 9,  grip: 3.2, hp: 220, color: 0x8a7a3c, len: 5.6, wid: 2.2 },
  van:       { name: 'Mule Van',     kind: 'van',       top: 28, accel: 10, grip: 3.0, hp: 200, color: 0xd2c2a0, len: 5.0, wid: 2.1 },
  bike:      { name: 'Wasp 125',     kind: 'bike',      top: 44, accel: 24, grip: 2.4, hp: 60,  color: 0x2ac28a, len: 2.2, wid: 0.8 },
  pursuit:   { name: 'CBPD Pursuit', kind: 'pursuit',   top: 46, accel: 19, grip: 3.0, hp: 160, color: 0x1a1a2a, len: 4.4, wid: 1.9 },
};
export const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'van', 'van', 'truck', 'gt'];

// Weapons — distinct feel per class, one shared combat system.
export const WEAPONS = {
  fists:   { name: 'Fists & Tire Iron', slot: 1, dmg: 18, rate: 0.45, mag: Infinity, reload: 0,   range: 2.6, spread: 0,    auto: false, sound: 'thud' },
  pistol:  { name: 'Sorren 9',   slot: 2, dmg: 22, rate: 0.28, mag: 12, reload: 1.1, range: 55, spread: 0.012, auto: false, sound: 'pistol' },
  smg:     { name: 'Hornet SMG', slot: 3, dmg: 12, rate: 0.10, mag: 30, reload: 1.6, range: 42, spread: 0.05,  auto: true,  sound: 'smg' },
  shotgun: { name: 'Thunder 12', slot: 4, dmg: 14, rate: 0.9,  mag: 6,  reload: 2.4, range: 26, spread: 0.11,  auto: false, sound: 'shotgun', pellets: 6 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

// Wanted / heat tuning (lessons from 12 real bugs in round 13 attempt 1).
export const HEAT = {
  pursuitTop: (w) => Math.min(30 + w * 2.5, 40), // capped BELOW the Interceptor (46) and GT (48)
  searchAfter: 6,    // seconds unseen -> SEARCHING
  clearAfter: 8,     // more unseen seconds -> heat clears (2x faster inside a hideout)
  bustSeconds: 3,    // officer contact on foot
  sprayCost: 300,
  maxStars: 5,
};

// The six-mission story chain. Steps are data: {type, ...}.
export const MISSIONS = [
  {
    id: 1, title: 'M1 · First Wheels',
    card: 'Ivy Sorren: "Milo — a Tempest GT is parked at Marina Sol. Bring it to my garage, no scratches, no witnesses."',
    reward: 600, unlock: 'pistol',
    steps: [
      { type: 'steal', target: 'missionCar', car: 'gt', label: 'Steal the Tempest GT at Marina Sol' },
      { type: 'deliver', point: 'garage', label: 'Deliver the Tempest GT to Sorren Motors' },
    ],
    timer: 180,
  },
  {
    id: 2, title: 'M2 · Hot Cargo',
    card: 'Ivy: "A Mule Van full of hot cargo waits at Old Pier. Casa Palma pays on delivery. Two and a half minutes — traffic is not an excuse."',
    reward: 900, unlock: 'smg',
    steps: [
      { type: 'take', point: 'vanSpot', car: 'van', label: 'Take the Mule Van at Old Pier' },
      { type: 'deliver', point: 'dropCasa', label: 'Deliver the cargo to Casa Palma' },
    ],
    timer: 150,
  },
  {
    id: 3, title: 'M3 · Three-Star Run',
    card: 'The drop went wrong. CBPD is all over you — THREE STARS. Break line of sight and vanish into the hideout at the far pier.',
    reward: 1200, unlock: 'shotgun',
    startWanted: 3,
    steps: [
      { type: 'escape', point: 'hideout2', label: 'Reach the hideout and lose the heat' },
    ],
    timer: 240,
  },
  {
    id: 4, title: 'M4 · Till Trouble',
    card: 'Ivy: "SunMart on Neon Row. Hold the clerk at gunpoint until the till is empty, then run for the drop behind The Terraces."',
    reward: 1800, unlock: null,
    steps: [
      { type: 'rob', point: 'sunmart', hold: 8, label: 'Hold up SunMart — keep the clerk covered' },
      { type: 'deliver', point: 'robDrop', label: 'Escape to the drop point' },
    ],
    timer: 210,
  },
  {
    id: 5, title: 'M5 · Neon Mile Run',
    card: 'Two of Hale\u2019s racers think they own Neon Row. Seventeen checkpoints, three cars, one winner. Finish first.',
    reward: 2000, unlock: 'gt-garage',
    steps: [
      { type: 'race', label: 'Win the Neon Mile Run — 17 checkpoints' },
    ],
    timer: 300,
  },
  {
    id: 6, title: 'M6 · Harbor King',
    card: 'Hale\u2019s crew is coming for the garage. Three waves. Hold the line, Milo — then run for the marina and don\u2019t look back.',
    reward: 5000, unlock: 'finale',
    steps: [
      { type: 'defend', point: 'garage', waves: 3, label: 'Defend Sorren Motors — wave 1 of 3' },
      { type: 'deliver', point: 'finale', label: 'Getaway to the marina' },
    ],
    timer: 420,
  },
];

export const SHOPS = [
  { id: 'sunmart', name: 'SunMart', point: 'sunmart', rob: true, price: 0 },
  { id: 'noodle', name: 'Noodle House', point: 'noodle', rob: false, price: 15 },
  { id: 'ammo', name: 'Ammo Depot', point: 'ammo', rob: false, price: 40 },
  { id: 'clinic', name: 'Casa Palma', point: 'clinic', rob: false, price: 25 },
];

export const SAVE_KEY = 'sunset-heist-caldera-bay-save-v1';
export const START_CASH = 250;
