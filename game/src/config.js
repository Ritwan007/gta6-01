// VELORA HEAT — all data tables: city geometry, vehicles, weapons, missions.
// City: 7x7 blocks, BLOCK=70m, STREET=18m, HALF=317m. Streets are the grid lines;
// every mission/shop/hideout point sits ON a street centreline, so no point can
// ever land inside a building collider (buildings live inset inside blocks).
export const BLOCK = 70, STREET = 18, NBLK = 7, HALF = 317;
export const STEP = 1 / 60;
export const street = (i) => -308 + i * 88;          // street centreline, i = 0..7
export const blockC = (i) => -264 + i * 88;          // block centre, i = 0..6
export const WORLD = { min: -HALF, max: HALF };

export const DISTRICTS = [
  { name: 'Old Pier', x0: -317, z0: -317, x1: -44, z1: -44, ground: '#8a6f4d', roof: '#7a5c3e' },
  { name: 'Neon Row', x0: -44, z0: -317, x1: 317, z1: -44, ground: '#5d4a6e', roof: '#4a3a5c' },
  { name: 'The Terraces', x0: -317, z0: -44, x1: -44, z1: 220, ground: '#4d6e52', roof: '#3e5c44' },
  { name: 'Marina Azul', x0: -44, z0: -44, x1: 317, z1: 220, ground: '#3f5f7a', roof: '#33506a' },
  { name: 'Crown Hill', x0: -317, z0: 220, x1: 317, z1: 317, ground: '#6e5a4d', roof: '#5c4a3e' },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[3];
}

// Landmark / mission points — ALL on street centrelines (see header comment).
export const POINTS = {
  spawn:      { x: -220, z: 44,  label: 'Spawn' },
  garage:     { x: -220, z: -44, label: 'Lestari Motors (garage)' },
  gtSpot:     { x: 220,  z: 132, label: 'Falco GT' },
  vanSpot:    { x: -44,  z: 220, label: 'Aruna Van' },
  casaDrop:   { x: 132,  z: -220, label: 'Casa Biru' },
  hideout1:   { x: -308, z: 220, label: 'Harbor hideout' },
  hideout2:   { x: 308,  z: -220, label: 'Hill hideout' },
  pelangi:    { x: 44,   z: -132, label: 'PelangiMart' },
  robDrop:    { x: -132, z: 308, label: 'Drop point' },
  marina:     { x: 308,  z: 308, label: 'Marina' },
  mie:        { x: -132, z: 44,  label: 'Mie Samudra' },
  toko:       { x: 220,  z: -44, label: 'Toko Jaya (ammo)' },
  casa:       { x: -220, z: 220, label: 'Casa Biru clinic' },
  station:    { x: 132,  z: 132, label: 'VBPD station' },
  raceStart:  { x: -44,  z: -44, label: 'Race start' },
};
// Garage parking slots (on the street beside the garage, clear of buildings).
export const GARAGE_SLOTS = [
  { x: -244, z: -44 }, { x: -232, z: -44 }, { x: -208, z: -44 }, { x: -196, z: -44 },
];
// Street-aligned race route (12 checkpoints, all on centrelines).
export const RACE_CPS = [
  { x: -44, z: -220 }, { x: 132, z: -220 }, { x: 132, z: -44 }, { x: 308, z: -44 },
  { x: 308, z: 132 }, { x: 220, z: 132 }, { x: 220, z: 308 }, { x: 44, z: 308 },
  { x: 44, z: 132 }, { x: -132, z: 132 }, { x: -132, z: -44 }, { x: -44, z: -44 },
];
export const COINS = [
  { x: -308, z: -132 }, { x: -132, z: -308 }, { x: 44, z: -308 }, { x: 220, z: -308 },
  { x: 308, z: -44 }, { x: 308, z: 220 }, { x: 132, z: 308 }, { x: -44, z: 308 },
  { x: -308, z: 44 }, { x: -220, z: -220 }, { x: 0, z: -44 }, { x: 132, z: 44 },
];

export const VEHICLES = {
  sedan:  { name: 'Lumba Sedan',    top: 26, accel: 15, brake: 26, grip: 3.2, hp: 100, len: 4.4, wid: 2.0, colors: ['#c94f3d', '#3d7ac9', '#c9a13d', '#7a7a7a'] },
  gt:     { name: 'Falco GT',       top: 34, accel: 19, brake: 30, grip: 2.6, hp: 80,  len: 4.2, wid: 1.9, colors: ['#e01e2b', '#ffb020', '#1ec8e0'] },
  truck:  { name: 'Banteng Hauler', top: 22, accel: 11, brake: 22, grip: 3.6, hp: 170, len: 5.6, wid: 2.3, colors: ['#5a7a3d', '#8a5a2b'] },
  van:    { name: 'Aruna Van',      top: 23, accel: 12, brake: 22, grip: 3.4, hp: 140, len: 5.0, wid: 2.2, colors: ['#e8e4da', '#3d5a7a'] },
  bike:   { name: 'Lebah 125',      top: 32, accel: 21, brake: 30, grip: 3.0, hp: 50,  len: 2.4, wid: 0.9, colors: ['#f5d020', '#20c8a0'] },
  police: { name: 'VBPD Interceptor', top: 31, accel: 18, brake: 30, grip: 3.4, hp: 170, len: 4.6, wid: 2.0, colors: ['#20242c'] },
};
export const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'van', 'van', 'truck', 'gt', 'bike'];

export const WEAPONS = [
  { key: '1', name: 'Fists',       short: 'Fists',      dmg: 25, rate: 0.45, mag: Infinity, reload: 0,   range: 2.4, spread: 0,    pellets: 1, auto: false, sound: 'thud' },
  { key: '2', name: 'Lestari 9',   short: 'Lestari 9',  dmg: 22, rate: 0.28, mag: 12, reload: 1.1, range: 60,  spread: 0.02, pellets: 1, auto: false, sound: 'pistol' },
  { key: '3', name: 'Tawon SMG',   short: 'Tawon SMG',  dmg: 12, rate: 0.10, mag: 30, reload: 1.6, range: 45,  spread: 0.09, pellets: 1, auto: true,  sound: 'smg' },
  { key: '4', name: 'Guntur 12',   short: 'Guntur 12',  dmg: 8,  rate: 0.9,  mag: 6,  reload: 2.4, range: 28,  spread: 0.16, pellets: 6, auto: false, sound: 'shotgun' },
];

export const CRIME = {
  stealParked: 1, carjack: 1, robbery: 2, assault: 1, hitAndRun: 1, shotsFired: 1, hitPolice: 1, stealPolice: 3,
};
export const SPRAY_COST = 300;
export const HIDEOUT_R = 14;
export const SEARCH_DELAY = 6;   // seconds unseen before SEARCHING
export const CLEAR_DELAY = 8;    // more unseen seconds before heat clears (half in hideouts)

// The 6-mission story chain. Steps are interpreted by missions.js.
export const MISSIONS = [
  {
    id: 'M1', title: 'First Wheels', reward: 600, unlock: 1,
    intro: 'Sari needs a Falco GT from Marina Azul. Take it — quietly if you can — and bring it to Lestari Motors. You have 3 minutes.',
    steps: [
      { t: 'goto',   x: 220, z: 132, r: 12, text: 'Reach the Falco GT in Marina Azul' },
      { t: 'steal',  car: 'gt', text: 'Steal the Falco GT (E)' },
      { t: 'deliver', x: -220, z: -44, r: 14, car: 'gt', text: 'Deliver the Falco GT to Lestari Motors' },
    ],
    timer: 180, complete: 'GT delivered. Sari hands you a Lestari 9 — welcome to the job.',
  },
  {
    id: 'M2', title: 'Hot Cargo', reward: 900, unlock: 2,
    intro: 'A package is waiting in an Aruna Van at Old Pier. Take the van, deliver it to Casa Biru. 2 minutes 30 — traffic will not wait.',
    steps: [
      { t: 'goto',  x: -44, z: 220, r: 12, text: 'Reach the Aruna Van at Old Pier' },
      { t: 'enter', car: 'van', text: 'Take the Aruna Van (E)' },
      { t: 'deliver', x: 132, z: -220, r: 14, car: 'van', text: 'Deliver the package to Casa Biru' },
    ],
    timer: 150, complete: 'Package delivered. A Tawon SMG joins your arsenal.',
  },
  {
    id: 'M3', title: 'Three-Star Run', reward: 1200, unlock: 3,
    intro: 'The drop went wrong — you start at 3 HEAT with VBPD inbound. Break line of sight, reach the harbor hideout, and wait until the heat dies.',
    steps: [
      { t: 'reach', x: -308, z: 220, r: 14, text: 'Reach the harbor hideout — break line of sight' },
      { t: 'wait',  x: -308, z: 220, r: 14, secs: 3, needClear: true, text: 'Lay low in the hideout until the heat clears' },
    ],
    timer: 0, startWanted: 3, complete: 'Clean. The Guntur 12 shotgun is yours.',
  },
  {
    id: 'M4', title: 'Till Trouble', reward: 1800, unlock: -1,
    intro: 'PelangiMart on Neon Row. Hold the clerk at aim for 8 seconds, grab the cash bag, then lose the 2-star response at the drop point.',
    steps: [
      { t: 'goto',   x: 44, z: -132, r: 10, text: 'Reach PelangiMart on Neon Row' },
      { t: 'holdup', x: 44, z: -132, r: 10, secs: 8, text: 'Hold up the clerk — stay in the shop, keep your aim up (8s)' },
      { t: 'reach',  x: -132, z: 308, r: 14, text: 'Escape to the drop point behind The Terraces' },
    ],
    timer: 0, complete: 'Cash bag secured. Every PelangiMart is now marked on your map.',
  },
  {
    id: 'M5', title: 'Neon Row Run', reward: 2000, unlock: -2,
    intro: 'Street race: 12 checkpoints across 3 districts against two AI racers in Falco GTs. Finish first. Sari lends you a GT for the run.',
    steps: [ { t: 'race', cps: RACE_CPS, text: 'Race the checkpoints — finish 1st' } ],
    timer: 0, complete: 'First across the line. A Falco GT now waits at your garage.',
  },
  {
    id: 'M6', title: 'Pier King', reward: 5000, unlock: -3,
    intro: "Damar Wibowo comes for the garage. Defend Lestari Motors from 3 waves of his crew, then run for the marina as the city watches.",
    steps: [
      { t: 'defend', x: -220, z: -44, r: 26, waves: [2, 3, 4], text: "Defend Lestari Motors — waves of Damar's crew" },
      { t: 'getaway', x: 308, z: 308, r: 14, text: 'Getaway to the marina' },
    ],
    timer: 0, complete: 'The Pier King falls. The debt is paid — in full.',
  },
];

export const SHOPS = [
  { id: 'pelangi', x: 44, z: -132, r: 10, name: 'PelangiMart', kind: 'rob', color: '#ff9a3c' },
  { id: 'mie', x: -132, z: 44, r: 10, name: 'Mie Samudra', kind: 'food', color: '#ffd76a', items: [{ name: 'Noodle bowl (+40 HP)', price: 30, hp: 40 }] },
  { id: 'toko', x: 220, z: -44, r: 10, name: 'Toko Jaya', kind: 'ammo', color: '#7db8ff', items: [
    { name: 'Lestari 9 ammo (12)', price: 40, w: 1, ammo: 12 },
    { name: 'Tawon SMG ammo (30)', price: 60, w: 2, ammo: 30 },
    { name: 'Guntur 12 shells (6)', price: 50, w: 3, ammo: 6 },
  ] },
  { id: 'casa', x: -220, z: 220, r: 10, name: 'Casa Biru', kind: 'clinic', color: '#7dff9a', items: [{ name: 'Full heal', price: 50, hp: 100 }] },
];
