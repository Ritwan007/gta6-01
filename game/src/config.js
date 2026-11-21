// VELORA HEAT — data tables. All names, stats and mission data for the game.
// Top-down 2D open-world crime game set in Velora Bay. Original IP only.

export const WORLD = {
  half: 352, // world spans -352..352 on both axes
  streets: [-308, -220, -132, -44, 44, 132, 220, 308],
  roadHalf: 7, // road half-width in metres
  camScale: 14, // pixels per metre on the main canvas
};

export const GARAGE = { x: -220, z: -44, label: 'KARSA AUTO WORKS' };
export const GARAGE_SLOTS = [
  { x: -244, z: -44 },
  { x: -262, z: -44 },
  { x: -280, z: -44 },
  { x: -298, z: -44 },
];
export const HIDEOUT = { x: -308, z: 220, r: 12, label: 'Dermaga Hideout' };
export const MARINA = { x: 308, z: 308, r: 12, label: 'Marina Velora' };
export const SHOP = { x: 48, z: -128, label: 'PELANGIMART' }; // hold-up point
export const CASA_BIRU = { x: 132, z: -220, label: 'CASA BIRU' };
export const DROP_POINT = { x: -132, z: 308, label: 'Drop Point' };
export const POLICE_STATION = { x: 220, z: -220, label: 'VBPD HQ' };
export const CLINIC = { x: 132, z: -220, label: 'Klinik Casa Biru' };

// Landmark buildings: rect in metres, placed inside their street block.
export const LANDMARKS = [
  { x0: -208, z0: -28, x1: -150, z1: 28, name: 'KARSA AUTO WORKS', color: '#c96f2e', roof: '#8a4a1d' },
  { x0: 56, z0: -120, x1: 110, z1: -70, name: 'PELANGIMART', color: '#e8a13c', roof: '#b97a24' },
  { x0: 145, z0: -205, x1: 200, z1: -150, name: 'CASA BIRU', color: '#3f7fb8', roof: '#2a5a86' },
  { x0: 145, z0: -120, x1: 185, z1: -80, name: 'VBPD HQ', color: '#2e4a6b', roof: '#1d3249' },
  { x0: -120, z0: 140, x1: -60, z1: 190, name: 'NOODLE BAHARI', color: '#b8453f', roof: '#7e2c28' },
  { x0: -30, z0: -300, x1: 30, z1: -240, name: 'AMMO DEPOT', color: '#5a6b3f', roof: '#3d4a2a' },
  { x0: 235, z0: 55, x1: 295, z1: 115, name: 'HOTEL MARINA', color: '#7a5a9e', roof: '#543d70' },
  { x0: -295, z0: -120, x1: -235, z1: -60, name: 'DERMAGA', color: '#4a7a6b', roof: '#2f5247' },
];

// Vehicle variants: one shared system, stats per row.
export const VEHICLES = {
  sedan: { name: 'Lumba Sedan', top: 26, accel: 14, turn: 2.3, hp: 100, len: 4.6, wid: 2.0, color: '#7fa3c7', roof: '#5d7ea3' },
  gt: { name: 'Falco GT', top: 34, accel: 19, turn: 2.6, hp: 90, len: 4.4, wid: 1.9, color: '#c22f2f', roof: '#8f1f1f' },
  truck: { name: 'Bison Hauler', top: 20, accel: 9, turn: 1.8, hp: 160, len: 6.2, wid: 2.4, color: '#c78a3a', roof: '#9a6a28' },
  van: { name: 'Kuda Van', top: 22, accel: 10, turn: 1.9, hp: 140, len: 5.4, wid: 2.3, color: '#e8e3d3', roof: '#b8b2a0' },
  bike: { name: 'Zippy 125', top: 30, accel: 21, turn: 3.0, hp: 50, len: 2.2, wid: 0.9, color: '#3fc7a5', roof: '#2a8f77' },
  police: { name: 'VBPD Interceptor', top: 32, accel: 17, turn: 2.5, hp: 120, len: 4.8, wid: 2.0, color: '#1d2f4a', roof: '#142238' },
};

// Weapons: one shared combat system, feel per row.
export const WEAPONS = {
  fists: { name: 'Fists', dmg: 15, rate: 0.45, mag: Infinity, reserve: Infinity, reload: 0, auto: false, range: 2.6, spread: 0, pellets: 1, unlock: 0 },
  pistol: { name: 'Lestari 9', dmg: 22, rate: 0.28, mag: 12, reserve: 48, reload: 1.1, auto: false, range: 55, spread: 0.015, pellets: 1, unlock: 1 },
  smg: { name: 'Tawon SMG', dmg: 11, rate: 0.1, mag: 30, reserve: 90, reload: 1.6, auto: true, range: 42, spread: 0.06, pellets: 1, unlock: 2 },
  shotgun: { name: 'Badak 12', dmg: 9, rate: 0.9, mag: 6, reserve: 24, reload: 2.4, auto: false, range: 26, spread: 0.12, pellets: 6, unlock: 3 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

// Mission chain. steps are shown in the HUD objective banner.
export const MISSIONS = [
  {
    id: 'M1', title: 'First Wheels', reward: 600, unlock: 'pistol',
    intro: 'Reno Karsa owes Damar Wibowo big. Sari Lestari has a job: steal the red Falco GT parked at Neon Mile and bring it to Karsa Auto Works. Any wheels will do for the trip there.',
    steps: ['Steal a car', 'Steal the Falco GT at Neon Mile', 'Deliver the Falco GT to Karsa Auto Works'],
    complete: 'GT delivered. Sari hands you the Lestari 9 pistol. One debt down, five jobs to go.',
  },
  {
    id: 'M2', title: 'Hot Cargo', reward: 900, unlock: 'smg',
    intro: 'A package waits in the Kuda Van at Old Harbor. Drive it to Casa Biru across town. Do not stop for anyone — and try not to scratch the van.',
    steps: ['Take the Kuda Van at Old Harbor', 'Drive the van to Casa Biru', 'Deliver the package'],
    complete: 'Package delivered. Sari unlocks the Tawon SMG from the back room.',
  },
  {
    id: 'M3', title: 'Three-Star Run', reward: 1200, unlock: 'shotgun',
    intro: 'The drop went wrong. VBPD is all over you — THREE stars. Break line of sight and hide at the Dermaga hideout until the heat dies.',
    steps: ['Reach the Dermaga hideout', 'Stay hidden until the heat clears'],
    complete: 'Heat cleared. The Badak 12 shotgun is yours — Sari says you will need it.',
  },
  {
    id: 'M4', title: 'Till Trouble', reward: 1800, unlock: null,
    intro: 'PelangiMart on Neon Mile keeps its cash in a till, not a vault. Hold the clerk up with your gun drawn, grab the bag, then vanish to the drop point.',
    steps: ['Go to PelangiMart', 'Hold up the till (gun drawn, press E)', 'Escape to the drop point'],
    complete: 'Clean getaway. The till money is yours — and the whole city heard about it.',
  },
  {
    id: 'M5', title: 'Neon Mile Run', reward: 2000, unlock: null,
    intro: 'Street race, 12 checkpoints across Velora Bay, against two of Damar\'s best drivers. Win it and the Falco GT is yours to keep.',
    steps: ['Race! Hit all 12 checkpoints first'],
    complete: 'First across the line. The Falco GT now spawns at your garage.',
  },
  {
    id: 'M6', title: 'Harbor King', reward: 5000, unlock: null,
    intro: 'Damar Wibowo is coming for the garage himself. Hold the line at Karsa Auto Works — three waves — then run for the marina and do not look back.',
    steps: ['Defend Karsa Auto Works', 'Getaway to the Marina Velora'],
    complete: 'Damar\'s crew is broken. Reno Karsa is free — and Velora Bay is yours.',
  },
];

export const RACE_CHECKPOINTS = [
  [-44, -220], [132, -220], [132, -44], [308, -44], [308, 132], [220, 132],
  [220, 308], [44, 308], [44, 132], [-132, 132], [-132, -44], [-44, -44],
];

export const SPRAY_PRICE = 300;
export const START_CASH = 250;
export const PLAYER_HP = 100;
export const SAVE_KEY = 'velora-heat-save-v1';
export const AMMO_PRICES = { pistol: 40, smg: 60, shotgun: 80 };
