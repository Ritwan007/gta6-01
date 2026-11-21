// VELORA HEAT — config: every data table the game runs on.
// Top-down 2D open-world crime game in Velora Bay. No network, no assets.
export const STREETS = [-308, -220, -132, -44, 44, 132, 220, 308];
export const CITY_HALF = 352;
export const ROAD_HALF = 9; // road spans centreline +/- 9 m
export const SPAWN = { x: 0, z: 44 };
export const START_CASH = 250;

export const DISTRICTS = [
  { name: 'Pelabuhan Lama', x0: -352, z0: -352, x1: 0, z1: 0, roof: '#7d5a3c', wall: '#8a6a4a' },
  { name: 'Neon Mile', x0: 0, z0: -352, x1: 352, z1: 0, roof: '#3c4a6e', wall: '#4a5a7d' },
  { name: 'The Flats', x0: -352, z0: 0, x1: 0, z1: 352, roof: '#5c6e4a', wall: '#6b7d58' },
  { name: 'Marina Verde', x0: 0, z0: 0, x1: 352, z1: 352, roof: '#6e3c4a', wall: '#7d4a58' },
];

export const VEHICLES = {
  sedan: { name: 'Lumba Sedan', top: 20, accel: 10, hp: 100, len: 4.4, wid: 2.0, colors: ['#c8c8d0', '#5a7fb8', '#b85a5a', '#d0c060'] },
  gt: { name: 'Falco GT', top: 27, accel: 14, hp: 120, len: 4.2, wid: 1.9, colors: ['#d02020', '#202020', '#e8a020'] },
  van: { name: 'Aruna Van', top: 16, accel: 6.5, hp: 140, len: 5.4, wid: 2.3, colors: ['#e8e8e8', '#7a5a9e'] },
  truck: { name: 'Bison Hauler', top: 15, accel: 5.5, hp: 170, len: 5.8, wid: 2.4, colors: ['#8a6a3c', '#3c5a6e'] },
  bike: { name: 'Zippy 125', top: 25, accel: 16, hp: 55, len: 2.3, wid: 0.9, colors: ['#e82060', '#20a8e8'] },
  police: { name: 'VBPD Interceptor', top: 28, accel: 13, hp: 150, len: 4.6, wid: 2.0, colors: ['#20242c'] },
};

export const WEAPONS = {
  fists: { name: 'Tangan Kosong', dmg: 14, rate: 0.45, range: 2.4, mag: Infinity, reserve: Infinity, auto: false, spread: 0, pellets: 1, sound: 'thud' },
  pistol: { name: 'Lestari 9', dmg: 22, rate: 0.22, range: 65, mag: 12, reserve: 48, auto: false, spread: 0.02, pellets: 1, sound: 'pistol' },
  smg: { name: 'Tawon SMG', dmg: 11, rate: 0.09, range: 48, mag: 30, reserve: 90, auto: true, spread: 0.07, pellets: 1, sound: 'smg' },
  shotgun: { name: 'Breaker 12', dmg: 9, rate: 0.9, range: 30, mag: 6, reserve: 24, auto: false, spread: 0.13, pellets: 6, sound: 'shotgun' },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const GARAGE = { x: -220, z: -44, name: 'Bengkel Sari' };
export const GARAGE_SLOTS = [[-244, -44], [-264, -44], [-284, -44], [-244, -64]];
export const HIDEOUT = { x: -308, z: 220, r: 13, name: 'Gudang Pelabuhan' };
export const CASA_BIRU = { x: 132, z: -220, name: 'Casa Biru' };
export const MART = { x: 44, z: -132, name: 'PelangiMart' };
export const DROP = { x: -132, z: 308, name: 'Titik Drop' };
export const MARINA = { x: 308, z: 308, name: 'Marina Verde' };
export const POLICE_STATION = { x: 308, z: -308, name: 'Markas VBPD' };

export const SHOPS = [
  { x: 44, z: -132, name: 'PelangiMart', rob: true },
  { x: -132, z: 132, name: 'Toko Berkah', rob: false },
  { x: 132, z: 44, name: 'Noodle Bahari', rob: false },
  { x: 220, z: -220, name: 'Warung Kopi Damar', rob: false },
];

export const MISSION_CARS = [
  { kind: 'sedan', x: -220, z: 44, mission: null, note: 'sedan1' },
  { kind: 'sedan', x: -132, z: -44, mission: null, note: 'sedan2' },
  { kind: 'gt', x: 220, z: 132, mission: 'M1', color: '#d02020', note: 'gt' },
  { kind: 'van', x: -44, z: 220, mission: 'M2', color: '#e8e8e8', note: 'van' },
];

export const RACE_CPS = [
  [-44, -220], [132, -220], [132, -44], [308, -44], [308, 132], [220, 132],
  [220, 308], [44, 308], [44, 132], [-132, 132], [-132, -44], [-44, -44],
];

export const MISSIONS = [
  {
    id: 'M1', title: 'Roda Pertama',
    intro: 'Reno Karsa butuh mobil cepat. Sari Lestari menunjuk sebuah Falco GT merah yang terparkir di Marina Verde. Curi, lalu antar ke Bengkel Sari.',
    brief: 'Curi Falco GT di Marina Verde, antar ke Bengkel Sari',
    reward: 600, unlock: 'pistol', timer: 240,
    complete: 'Falco GT sudah di tangan Sari. Reno kini punya pistol Lestari 9.',
  },
  {
    id: 'M2', title: 'Kargo Panas',
    intro: 'Paket Damar Wibowo harus sampai ke Casa Biru sebelum dingin. Ambil Aruna Van di Pelabuhan Lama dan antar tepat waktu.',
    brief: 'Ambil Aruna Van, antar paket ke Casa Biru',
    reward: 900, unlock: 'smg', timer: 200,
    complete: 'Paket sampai. Sari menghadiahimu Tawon SMG.',
  },
  {
    id: 'M3', title: 'Lari Tiga Bintang',
    intro: 'Pengiriman gagal — VBPD mengepungmu dengan 3 bintang. Kabur ke Gudang Pelabuhan dan bersembunyi sampai panasnya reda.',
    brief: 'Kabur dari VBPD 3 bintang, sembunyi di Gudang Pelabuhan',
    reward: 1200, unlock: 'shotgun', timer: 0,
    complete: 'Panas reda. Damar memberimu Breaker 12.',
  },
  {
    id: 'M4', title: 'Kasir Pelangi',
    intro: 'PelangiMart di Neon Mile menyimpan uang tunai. Todong kasir dengan senjata, ambil uangnya, lalu kabur ke Titik Drop di selatan.',
    brief: 'Rampok PelangiMart, kabur ke Titik Drop',
    reward: 1800, unlock: null, timer: 0,
    complete: 'Uang kasir di tangan. VBPD masih mencarimu di Neon Mile.',
  },
  {
    id: 'M5', title: 'Balap Neon Mile',
    intro: 'Balapan jalanan 12 checkpoint melintasi tiga distrik melawan dua pembalap Damar. Menang, dan Falco GT itu jadi milikmu.',
    brief: 'Menangi balapan 12 checkpoint melawan 2 pembalap',
    reward: 2000, unlock: null, timer: 0,
    complete: 'Juara Neon Mile! Falco GT kini terparkir di garasimu.',
  },
  {
    id: 'M6', title: 'Raja Pelabuhan',
    intro: 'Damar Wibowo datang menagih — anak buahnya menyerbu Bengkel Sari. Pertahankan markas, lalu kabur ke Marina Verde. Ini akhirnya.',
    brief: 'Pertahankan Bengkel Sari, lalu kabur ke Marina Verde',
    reward: 5000, unlock: null, timer: 0,
    complete: 'Velora Bay bebas. Reno Karsa kini legenda jalanan.',
  },
];

// Points the reachability check must prove clear (named + race + shops + slots).
export function reachPoints() {
  const pts = [
    ['garage', GARAGE.x, GARAGE.z],
    ['spawn', SPAWN.x, SPAWN.z],
    ['hideout', HIDEOUT.x, HIDEOUT.z],
    ['casa', CASA_BIRU.x, CASA_BIRU.z],
    ['mart', MART.x, MART.z],
    ['drop', DROP.x, DROP.z],
    ['marina', MARINA.x, MARINA.z],
    ['station', POLICE_STATION.x, POLICE_STATION.z],
  ];
  GARAGE_SLOTS.forEach((s, i) => pts.push(['slot' + i, s[0], s[1]]));
  MISSION_CARS.forEach((c) => pts.push([c.note, c.x, c.z]));
  SHOPS.forEach((s) => pts.push(['shop-' + s.name, s.x, s.z]));
  RACE_CPS.forEach((c, i) => pts.push(['race' + (i + 1), c[0], c[1]]));
  return pts;
}
