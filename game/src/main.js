// NEON COAST: UNDERWORLD — open-world crime game (gta6-01, round 12).
// Three.js, static files only, no network at runtime. One fixed-step loop
// (1/60 s), DOM HUD + canvas minimap, localStorage saves, 8 missions.
import * as THREE from 'three';
import { Input } from './input.js';
import { GARAGE, HIDEOUT, HQ_POINT, PORT_POINT, AERO_POINT, WAREHOUSE_POINT,
  SHOPS, SHARDS, PARKED, SPAWN, STREET_X, STREET_Z, ROAD_W, CITY_BOUND,
  allBuildings, districtAt } from './world.js';
import { MISSIONS, WEAPONS, UPGRADES, SHOP_ITEMS } from './missions.js';
import { Sfx } from './audio.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'neoncoast-save-v1';
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const sfx = new Sfx();
const input = new Input();
input.attach();

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1026);
scene.fog = new THREE.Fog(0x0b1026, 120, 700);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0x8fb7ff, 0x1a2028, 0.55);
scene.add(hemi);
const amb = new THREE.AmbientLight(0x404060, 0.55); // floor: night stays bright enough
scene.add(amb);
const sun = new THREE.DirectionalLight(0xffe0b0, 1.0);
sun.position.set(200, 300, 100);
scene.add(sun);
const moon = new THREE.DirectionalLight(0x8899ff, 0.35);
moon.position.set(-150, 220, -80);
scene.add(moon);

// ---------- procedural textures (canvas only, zero assets) ----------
function windowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#232833'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) for (let x = 8; x < 120; x += 16) {
    const lit = Math.random() < 0.45;
    g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffd166' : '#7df9ff') : '#0e1420';
    g.fillRect(x, y, 10, 12);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const facadeTex = windowTexture();
function neonTexture(color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = color; g.font = 'bold 11px sans-serif'; g.fillText('NEON', 8, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- city ----------
const BUILDINGS = allBuildings();
const buildingMeshes = [];
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const palette = { Downtown: 0x3a4a6b, 'Marina Luxe': 0x6b4a5a, Portside: 0x4a4a42, 'The Undertow': 0x2e2a3e, 'Aero Field': 0x3e4a4a, 'Sierra Ridge': 0x4a3e34, 'Coral Row': 0x5a4a6b, 'Civic Center': 0x4a5a6b, 'Neon Coast': 0x3a3a4a };
  for (const b of BUILDINGS) {
    const mat = new THREE.MeshLambertMaterial({ color: palette[b.district] ?? 0x3a3a4a, map: facadeTex, emissive: 0x222233, emissiveMap: facadeTex, emissiveIntensity: 0.7 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set((b.x1 + b.x2) / 2, b.h / 2, (b.z1 + b.z2) / 2);
    m.scale.set(b.x2 - b.x1, b.h, b.z2 - b.z1);
    scene.add(m); buildingMeshes.push(m);
    // Neon sign strip on the roof edge (lit windows on all four faces come
    // from the facade texture, which wraps the whole box).
    const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(14, b.x2 - b.x1 - 2), 1.2, 0.4),
      new THREE.MeshBasicMaterial({ map: neonTexture(['#ff2d78', '#00e5ff', '#ffd166', '#7dff6a'][BUILDINGS.indexOf(b) % 4]) }));
    sign.position.set((b.x1 + b.x2) / 2, b.h - 0.8, b.z1 + 0.2);
    scene.add(sign);
  }
}
// Ground, roads, sidewalks, beach, ocean, mountains.
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshLambertMaterial({ color: 0x46543f }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x23262e });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x3d4149 });
  for (const x of STREET_X) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 900), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0, 0); scene.add(r);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 8, 900), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(x, -0.02, 0); scene.add(w);
  }
  for (const z of STREET_Z) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(900, ROAD_W), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.01, z); scene.add(r);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 900), new THREE.MeshLambertMaterial({ color: 0xc2a878 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(470, 0, 0); scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 1000), new THREE.MeshLambertMaterial({ color: 0x0a3a5c }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(620, -0.1, 0); scene.add(sea);
  const mtnMat = new THREE.MeshLambertMaterial({ color: 0x2c3a2c });
  for (let i = 0; i < 9; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(55, 90 + (i % 3) * 40, 7), mtnMat);
    cone.position.set(-470 - (i % 2) * 30, 40, -360 + i * 90); scene.add(cone);
  }
  // Trees along sidewalks + lamps.
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  const leafG = new THREE.ConeGeometry(2.2, 5, 7);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  const leafM = new THREE.MeshLambertMaterial({ color: 0x1e5c2e });
  for (let i = 0; i < 70; i++) {
    const sx = STREET_X[i % STREET_X.length], sz = STREET_Z[Math.floor(i / STREET_X.length) % STREET_Z.length];
    const tx = sx + (i % 2 ? 11 : -11), tz = sz + ((i * 37) % 300) - 150;
    if (Math.abs(tx) > CITY_BOUND || Math.abs(tz) > CITY_BOUND) continue;
    const trunk = new THREE.Mesh(trunkG, trunkM); trunk.position.set(tx, 1.2, tz); scene.add(trunk);
    const leaf = new THREE.Mesh(leafG, leafM); leaf.position.set(tx, 4.6, tz); scene.add(leaf);
  }
  const poleG = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
  const poleM = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of STREET_X) for (const z of STREET_Z) {
    const pole = new THREE.Mesh(poleG, poleM); pole.position.set(x + 9, 3.5, z + 9); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampM); lamp.position.set(x + 9, 7.1, z + 9); scene.add(lamp);
  }
  // Traffic lights at intersections (visual, cycle red/green).
  window.__trafficLights = [];
  for (const x of [-150, 0, 150]) for (const z of [-150, 0, 150]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), poleM);
    pole.position.set(x + 8, 2.5, z + 8); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bulb.position.set(x + 8, 5.2, z + 8); scene.add(bulb);
    window.__trafficLights.push(bulb);
  }
}
// Rain particles (hidden unless raining).
const RAIN_N = 900;
const rainGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) { pos[i * 3] = (Math.random() - 0.5) * 300; pos[i * 3 + 1] = Math.random() * 60; pos[i * 3 + 2] = (Math.random() - 0.5) * 300; }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.35 }));
rain.visible = false; scene.add(rain);

// ---------- vehicles ----------
const VEHICLE_SPECS = {
  sedan: { color: 0x4a7dd6, top: 26, accel: 14, len: 4.4, wid: 1.9 },
  gt: { color: 0xd63a2e, top: 38, accel: 20, len: 4.2, wid: 1.9 },
  van: { color: 0xd8d8d8, top: 22, accel: 11, len: 5.2, wid: 2.1 },
  truck: { color: 0xd68a2e, top: 20, accel: 10, len: 6.4, wid: 2.3 },
  bike: { color: 0x2ed68a, top: 34, accel: 18, len: 2.2, wid: 0.8 },
  police: { color: 0x1a1a2e, top: 34, accel: 19, len: 4.4, wid: 1.9 },
};
function buildVehicleMesh(kind) {
  const spec = VEHICLE_SPECS[kind];
  const g = new THREE.Group();
  const bodyM = new THREE.MeshLambertMaterial({ color: spec.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.7, spec.len), bodyM);
  body.position.y = 0.55; g.add(body);
  if (kind !== 'bike') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.85, 0.6, spec.len * 0.45),
      new THREE.MeshLambertMaterial({ color: 0x101418 }));
    cabin.position.set(0, 1.15, -spec.len * 0.05); g.add(cabin);
  }
  const wheelG = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelM = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-spec.wid / 2, spec.len / 3], [spec.wid / 2, spec.len / 3], [-spec.wid / 2, -spec.len / 3], [spec.wid / 2, -spec.len / 3]]) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w);
  }
  const lightM = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-spec.wid / 3, spec.wid / 3]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lightM);
    h.position.set(hx, 0.6, -spec.len / 2 - 0.05); g.add(h);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.55, 0); g.add(bar);
  }
  return g;
}
const headlight = new THREE.SpotLight(0xfff2c0, 60, 60, 0.6, 0.4);
scene.add(headlight); scene.add(headlight.target);

// ---------- player ----------
const playerMesh = new THREE.Group();
{
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a1f2d });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1e2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), jacket); body.position.y = 1.25; playerMesh.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin); head.position.y = 1.95; playerMesh.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.26), pants); legL.position.set(-0.18, 0.4, 0); legL.name = 'legL'; playerMesh.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; legR.name = 'legR'; playerMesh.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), jacket); armL.position.set(-0.48, 1.25, 0); playerMesh.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48; playerMesh.add(armR);
}
scene.add(playerMesh);

// ---------- state ----------
const G = {
  screen: 'title', // title | play | paused | map | shop | dialogue | complete | over | choice
  cash: 250, health: 100, armor: 0, stamina: 100,
  wanted: 0, lastKnown: null, searchTimer: 0, bustedTimer: 0,
  missionIndex: 0, stepIndex: 0, missionTimer: 0, choiceTarget: null,
  shards: new Set(), owned: [], stolen: new Set(),
  upgrades: { engine: 0, armor: 0, stamina: 0, charm: 0 },
  ammo: { pistol: 60, smg: 120, shotgun: 24 },
  weapon: 1, // index into WEAPONS
  time: 0.62, // 0..1 day cycle; 0.62 = dusk, heading into night
  raining: false, weatherTimer: 40,
  camYaw: 0, camPitch: -0.22,
  kills: 0, enemiesLeft: 0, raceCp: 0, raceTimer: 0,
  dialogueQueue: [],
  _eConsumed: false, fireCd: 0, shardFlash: 0,
};
const player = { x: SPAWN.x, y: 0, z: SPAWN.z, vy: 0, yaw: Math.PI, onGround: true, speed: 0, walkPhase: 0 };
let currentVehicle = null; // vehicle object the player drives, or null

function makeVehicle(kind, x, z, heading, opts = {}) {
  const mesh = buildVehicleMesh(kind);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  scene.add(mesh);
  const v = { id: opts.id || ('v' + Math.random().toString(36).slice(2, 8)), kind, x, z, heading,
    speed: 0, mesh, owned: !!opts.owned, parked: !!opts.parked, traffic: !!opts.traffic,
    street: opts.street || null, axis: opts.axis || null, dir: opts.dir || 1, mission: opts.mission || null };
  return v;
}
const vehicles = [];
for (const p of PARKED) vehicles.push(makeVehicle(p.kind, p.x, p.z, p.heading, { id: p.id, parked: true, mission: p.mission }));
// Traffic: 12 cars, ONE per street, alternating axes.
{
  const streets = [];
  for (const x of STREET_X) streets.push({ axis: 'z', line: x });
  for (const z of STREET_Z.slice(0, 5)) streets.push({ axis: 'x', line: z });
  const kinds = ['sedan', 'sedan', 'gt', 'van', 'truck', 'sedan', 'gt', 'van', 'sedan', 'truck', 'sedan', 'gt'];
  streets.forEach((s, i) => {
    const pos = -350 + i * 61;
    const v = makeVehicle(kinds[i], s.axis === 'z' ? s.line + (i % 2 ? 3 : -3) : pos,
      s.axis === 'z' ? pos : s.line + (i % 2 ? 3 : -3),
      s.axis === 'z' ? (i % 2 ? Math.PI : 0) : (i % 2 ? Math.PI / 2 : -Math.PI / 2),
      { traffic: true, street: s, axis: s.axis, dir: i % 2 ? 1 : -1 });
    v.speed = 9 + (i % 3) * 2;
    vehicles.push(v);
  });
}
const trafficCars = vehicles.filter((v) => v.traffic);
const policeCars = [];
function spawnPolice() {
  if (policeCars.length >= Math.min(5, G.wanted + 1)) return;
  const kind = 'police';
  const px = player.x + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40);
  const pz = player.z + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40);
  const v = makeVehicle(kind, px, pz, Math.random() * Math.PI * 2, { id: 'police' + Date.now() + policeCars.length });
  v.speed = 16; vehicles.push(v); policeCars.push(v);
  sfx.siren();
}
function despawnPolice(v) {
  scene.remove(v.mesh);
  vehicles.splice(vehicles.indexOf(v), 1);
  policeCars.splice(policeCars.indexOf(v), 1);
}

// Pedestrians: 36 active, sidewalk walking, flee from danger.
const peds = [];
{
  const colors = [0xd6c06a, 0x6ad6a0, 0xd66a9a, 0x6a9ad6, 0xd6d6d6, 0x8a6ad6, 0xd68a2e, 0x5ad6d6];
  for (let i = 0; i < 36; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.35), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
    body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc98a5e }));
    head.position.y = 1.8; g.add(head);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    leg.position.y = 0.35; g.add(leg);
    const sx = STREET_X[i % STREET_X.length];
    const sz = -350 + ((i * 97) % 700);
    g.position.set(sx + 10, 0, sz);
    scene.add(g);
    peds.push({ mesh: g, x: sx + 10, z: sz, heading: (i % 2 ? 1 : -1) * Math.PI / 2, speed: 1.2 + (i % 5) * 0.3, flee: 0, phase: Math.random() * 6 });
  }
}
// Enemies (M7 defence + M8 finale guards).
const enemies = [];
function spawnEnemy(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  body.position.y = 1.25; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8a5e3e }));
  head.position.y = 1.9; g.add(head);
  g.position.set(x, 0, z); scene.add(g);
  const e = { mesh: g, x, z, hp: 60, alive: true };
  enemies.push(e); return e;
}
// Shard meshes (floating neon octahedrons).
const shardMeshes = new Map();
for (const s of SHARDS) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  m.position.set(s.x, 2, s.z); scene.add(m); shardMeshes.set(s.id, m);
}
// Mission marker (floating beacon).
const marker = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
scene.add(marker);

// ---------- collision (circle vs building AABB) ----------
function collideCircle(p, r) {
  for (const b of BUILDINGS) {
    const cx = Math.max(b.x1, Math.min(p.x, b.x2));
    const cz = Math.max(b.z1, Math.min(p.z, b.z2));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-6) { p.x = b.x2 + r; continue; }
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
      return true;
    }
  }
  return false;
}
function losBlocked(x1, z1, x2, z2) {
  for (const b of BUILDINGS) {
    // Segment vs AABB: sample 8 points.
    for (let i = 1; i < 8; i++) {
      const t = i / 8, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      if (x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2) return true;
    }
  }
  return false;
}

// ---------- damage / wanted ----------
function damagePlayer(amount) {
  const reduction = 1 - 0.08 * G.upgrades.armor; // armor upgrades: -8% / level
  const dealt = amount * reduction;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, dealt);
    G.armor -= absorbed;
    G.health -= (dealt - absorbed);
  } else G.health -= dealt;
  if (G.health <= 0) { G.health = 0; wasted(); }
}
function addWanted(n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.lastKnown = { x: player.x, z: player.z };
  G.searchTimer = 0;
}
function wantedStars() { return '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted); }
function wasted() {
  G.screen = 'over'; $('over-title').textContent = 'WASTED';
  $('over-text').textContent = 'Raka went down. The hospital patched him up — for a fee.';
  $('over-screen').style.display = 'flex';
  G.cash = Math.max(0, G.cash - 100); G.wanted = 0;
  sfx.fail();
}
function busted() {
  G.screen = 'over'; $('over-title').textContent = 'BUSTED';
  $('over-text').textContent = 'Det. Ilves has questions. Bail cost you $150.';
  $('over-screen').style.display = 'flex';
  G.cash = Math.max(0, G.cash - 150); G.wanted = 0;
  sfx.fail();
}
function respawn() {
  player.x = 0; player.z = -140; player.y = 0; player.vy = 0;
  G.health = 100; G.armor = Math.max(G.armor, 25);
  $('over-screen').style.display = 'none';
  G.screen = 'play';
}

// ---------- save / load (field names match exactly: shards, cash, ...) ----------
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, health: G.health, armor: G.armor,
      missionIndex: G.missionIndex, stepIndex: G.stepIndex,
      shards: [...G.shards], owned: G.owned, upgrades: G.upgrades,
      ammo: G.ammo, player: { x: player.x, z: player.z }, wanted: G.wanted,
    }));
  } catch { /* storage off: session-only */ }
}
function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function applySave(s) {
  G.cash = s.cash; G.health = s.health; G.armor = s.armor;
  G.missionIndex = s.missionIndex; G.stepIndex = s.stepIndex;
  G.shards = new Set(s.shards); G.owned = s.owned; G.upgrades = s.upgrades;
  G.ammo = s.ammo; G.wanted = s.wanted || 0;
  player.x = s.player.x; player.z = s.player.z; player.y = 0;
  for (const id of G.shards) { const m = shardMeshes.get(id); if (m) m.visible = false; }
}

// ---------- missions ----------
function missionPoint(name) {
  switch (name) {
    case 'garage': return GARAGE.point;
    case 'hideout': return HIDEOUT;
    case 'hq': return HQ_POINT;
    case 'port': return PORT_POINT;
    case 'aero': return AERO_POINT;
    case 'warehouse': return WAREHOUSE_POINT;
    case 'choice': return G.choiceTarget === 'ilves' ? HQ_POINT : GARAGE.point;
    default: return GARAGE.point;
  }
}
function currentMission() { return MISSIONS[G.missionIndex]; }
function currentStep() { const m = currentMission(); return m ? m.steps[G.stepIndex] : null; }
function objectiveText() {
  if (G._objOverride) return G._objOverride;
  const m = currentMission();
  if (!m) return 'Free roam — Neon Coast is yours. Find all 20 shards.';
  const s = currentStep();
  return `${m.id} ${m.name}: ${s ? s.text : 'Done'}`;
}
function markerTarget() {
  const m = currentMission(); if (!m) return null;
  const s = currentStep(); if (!s) return null;
  if (s.type === 'enterCar') { const v = vehicles.find((v) => v.id === s.carId); return v ? { x: v.x, z: v.z } : null; }
  if (s.type === 'deliver' || s.type === 'goto') return missionPoint(s.point);
  if (s.type === 'rob') { const sh = SHOPS.find((x) => x.id === s.shopId); return sh ? { x: sh.x, z: sh.z } : null; }
  if (s.type === 'race' && s.checkpoints) return { x: s.checkpoints[G.raceCp][0], z: s.checkpoints[G.raceCp][1] };
  if (s.type === 'defend') return WAREHOUSE_POINT;
  if (s.type === 'wanted') return HIDEOUT;
  return null;
}
function startMission(i) {
  G.missionIndex = i; G.stepIndex = 0; G.missionTimer = 0; G.raceCp = 0; G.enemiesLeft = 0;
  const m = MISSIONS[i];
  showDialogue(m.giver, m.intro, () => { G.screen = 'play'; });
}
function completeMission() {
  const m = currentMission();
  G.cash += m.reward;
  sfx.cash();
  $('complete-title').textContent = `${m.id} COMPLETE — ${m.name}`;
  $('complete-text').textContent = `Reward +$${m.reward}. Cash now $${G.cash}.`;
  $('complete-screen').style.display = 'flex';
  G.screen = 'complete';
  G.missionIndex = Math.min(MISSIONS.length, G.missionIndex + 1);
  G.stepIndex = 0;
  saveGame();
}
function advanceStep() { G.stepIndex++; G._defendSpawned = false; G._raceSpawned = false; }
function checkMissionStep(dt) {
  const m = currentMission(); if (!m) return;
  const s = currentStep(); if (!s) { completeMission(); return; }
  if (s.type === 'enterCar') {
    if (currentVehicle && currentVehicle.id === s.carId) advanceStep();
  } else if (s.type === 'deliver') {
    const p = missionPoint(s.point);
    const d = currentVehicle ? Math.hypot(player.x - p.x, player.z - p.z) : Infinity;
    if (d < p.radius) {
      if (s.timed && G.missionTimer > (m.timeLimit || 120)) { failMission('Out of time.'); return; }
      if (m.id === 'M1' && currentVehicle) { currentVehicle.owned = true; if (!G.owned.includes(currentVehicle.id)) G.owned.push(currentVehicle.id); }
      advanceStep();
    }
  } else if (s.type === 'goto') {
    const p = missionPoint(s.point);
    if (Math.hypot(player.x - p.x, player.z - p.z) < p.radius) advanceStep();
  } else if (s.type === 'wanted') {
    if (G.wanted >= s.level) advanceStep();
  } else if (s.type === 'race') {
    if (!G._raceSpawned) {
      G._raceSpawned = true; G.raceTimer = 0;
      G.rivals = [];
      for (let i = 0; i < 2; i++) {
        const rv = makeVehicle(i ? 'sedan' : 'gt', player.x + 10 + i * 6, player.z + 6, 0, { id: 'rival' + i });
        vehicles.push(rv); G.rivals.push(rv);
      }
    }
    const cp = s.checkpoints[G.raceCp];
    if (cp && Math.hypot(player.x - cp[0], player.z - cp[1]) < 14) {
      G.raceCp++;
      sfx.pickup();
      if (G.raceCp >= s.checkpoints.length) { for (const rv of G.rivals || []) { scene.remove(rv.mesh); vehicles.splice(vehicles.indexOf(rv), 1); } advanceStep(); }
    }
    G.raceTimer += dt;
    if (G.raceTimer > 150) failMission('The rivals took the ridge.');
  } else if (s.type === 'defend') {
    if (!G._defendSpawned) { startDefendWave(); G._defendSpawned = true; }
    else if (G.enemiesLeft <= 0 && enemies.every((e) => !e.alive)) advanceStep();
  } else if (s.type === 'choice') {
    openChoice('The Choice — the ledger', 'A ledger that can sink Dario Venn — or Vera. Who gets it?',
      'Give it to Vera', 'Give it to Det. Ilves', (pick) => {
        G.choiceTarget = pick === 'b' ? 'ilves' : 'vera';
        advanceStep();
      });
    G._choiceOpen = true;
  } else if (s.type === 'finale') {
    openChoice('Neon Reckoning — the ending', 'Dario is down. Neon Coast picks a side tonight. So do you.',
      'Side with Vera', 'Side with Det. Ilves', (pick) => {
        G.choiceTarget = pick === 'b' ? 'ilves' : 'vera';
        showDialogue(pick === 'b' ? 'Det. Mara Ilves' : 'Vera Kade',
          pick === 'b'
            ? 'Ilves cuffs Dario as dawn breaks over the port. "You did the right thing, Raka. Neon Coast owes you one."'
            : 'Vera lights a cigarette over the harbour. "The coast is ours now, Raka. You drive. I decide."',
          () => { advanceStep(); });
      });
    G._choiceOpen = true;
  }
  if (m.timeLimit && s.timed) {
    G.missionTimer += dt;
    if (G.missionTimer > m.timeLimit) failMission('Out of time.');
  }
}
function failMission(why) {
  $('over-title').textContent = 'MISSION FAILED';
  $('over-text').textContent = why + ' Press Continue to retry from the mission start.';
  $('over-screen').style.display = 'flex';
  G.screen = 'over';
  sfx.fail();
}
function startDefendWave() {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spawnEnemy(WAREHOUSE_POINT.x + Math.cos(a) * 30, WAREHOUSE_POINT.z + Math.sin(a) * 30);
  }
  G.enemiesLeft = 6;
}

// ---------- dialogue / shop / choice UI ----------
function showDialogue(who, text, onDone) {
  $('dialogue-who').textContent = who;
  $('dialogue-text').textContent = text;
  $('dialogue-screen').style.display = 'flex';
  document.body.classList.add('dialogue-open'); // hides top HUD boxes
  G.screen = 'dialogue';
  const btn = $('dialogue-next');
  btn.onclick = () => {
    $('dialogue-screen').style.display = 'none';
    document.body.classList.remove('dialogue-open');
    G.screen = 'play';
    if (onDone) onDone();
  };
}
function openChoice(title, text, aLabel, bLabel, onPick) {
  $('choice-title').textContent = title;
  $('choice-text').textContent = text;
  $('choice-a').textContent = aLabel;
  $('choice-b').textContent = bLabel;
  $('choice-screen').style.display = 'flex';
  G.screen = 'choice';
  $('choice-a').onclick = () => { $('choice-screen').style.display = 'none'; G.screen = 'play'; onPick('a'); };
  $('choice-b').onclick = () => { $('choice-screen').style.display = 'none'; G.screen = 'play'; onPick('b'); };
}
function openShop(shop) {
  G.screen = 'shop';
  $('shop-title').textContent = shop.name;
  const list = $('shop-list');
  list.innerHTML = '';
  const discount = 1 - 0.05 * G.upgrades.charm;
  const addRow = (label, cost, buy) => {
    const row = document.createElement('div'); row.className = 'shop-row';
    const price = Math.round(cost * discount);
    row.innerHTML = `<span>${label}</span><span>$${price}</span>`;
    const b = document.createElement('button'); b.textContent = 'Buy';
    b.onclick = () => {
      if (G.cash < price) { $('shop-msg').textContent = 'Not enough cash.'; return; }
      G.cash -= price; buy(); sfx.cash(); saveGame();
      $('shop-msg').textContent = `Bought ${label} for $${price}. Cash $${G.cash}.`;
      $('cash').textContent = '$' + G.cash;
    };
    row.appendChild(b); list.appendChild(row);
  };
  for (const it of SHOP_ITEMS) {
    addRow(it.name, it.cost, () => {
      if (it.id === 'health') G.health = Math.min(100, G.health + 50);
      if (it.id === 'armor') G.armor = Math.min(100, G.armor + 50);
      if (it.id === 'ammo-pistol') G.ammo.pistol += 60;
      if (it.id === 'ammo-smg') G.ammo.smg += 120;
      if (it.id === 'ammo-shotgun') G.ammo.shotgun += 24;
    });
  }
  for (const u of UPGRADES) {
    const lvl = G.upgrades[u.id];
    addRow(`${u.name} Lv${lvl}→Lv${lvl + 1} (${u.desc})`, u.cost * (lvl + 1), () => {
      if (lvl < u.max) G.upgrades[u.id] = lvl + 1;
    });
  }
  $('shop-msg').textContent = '';
  $('shop-screen').style.display = 'flex';
  $('shop-close').onclick = () => { $('shop-screen').style.display = 'none'; G.screen = 'play'; };
}

// ---------- interaction ----------
function nearestVehicle(maxD) {
  let best = null, bd = maxD;
  for (const v of vehicles) {
    if (v.traffic || policeCars.includes(v)) continue;
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function promptText() {
  if (G.screen !== 'play') return '';
  // Shop prompt wins over the vehicle re-enter prompt.
  for (const s of SHOPS) {
    if (Math.hypot(player.x - s.x, player.z - s.z) < s.radius) return `E — ${s.name}`;
  }
  if (!currentVehicle) {
    const v = nearestVehicle(5);
    if (v) return `E — Enter ${v.kind} (${v.owned ? 'owned' : 'steal it?'})`;
    const gd = Math.hypot(player.x - GARAGE.point.x, player.z - GARAGE.point.z);
    if (gd < GARAGE.point.radius) {
      const near = nearestVehicle(GARAGE.storeRadius);
      if (near) return 'E — Store vehicle in garage';
    }
  } else {
    return 'E — Exit vehicle';
  }
  const m = currentMission(); const s = currentStep();
  if (m && s && s.type === 'rob') {
    const sh = SHOPS.find((x) => x.id === s.shopId);
    if (sh && Math.hypot(player.x - sh.x, player.z - sh.z) < sh.radius) return 'E — Rob the shop';
  }
  return '';
}
function doInteract() {
  // Shops first (priority over vehicle re-enter).
  for (const s of SHOPS) {
    if (Math.hypot(player.x - s.x, player.z - s.z) < s.radius) {
      const m = currentMission(); const st = currentStep();
      if (m && st && st.type === 'rob' && st.shopId === s.id) {
        G.cash += 600; addWanted(2); sfx.cash();
        $('toast').textContent = 'Robbed the jeweller! +$600 — heat +2★';
        advanceStep(); saveGame();
        return;
      }
      openShop(s); return;
    }
  }
  if (currentVehicle) { exitVehicle(); return; }
  const gd = Math.hypot(player.x - GARAGE.point.x, player.z - GARAGE.point.z);
  if (gd < GARAGE.point.radius) {
    const near = nearestVehicle(GARAGE.storeRadius);
    if (near) {
      near.owned = true;
      if (!G.owned.includes(near.id)) G.owned.push(near.id);
      scene.remove(near.mesh);
      vehicles.splice(vehicles.indexOf(near), 1);
      $('toast').textContent = `${near.kind} stored in the garage.`;
      sfx.pickup(); saveGame();
      return;
    }
  }
  if (preferMissionCar()) return;
  const v = nearestVehicle(5);
  if (v) enterVehicle(v);
}
// Mission-car preference: when the current step is "enter this car", that
// car wins over any nearer car the player just exited.
function preferMissionCar() {
  const m = currentMission(); const s = currentStep();
  if (m && s && s.type === 'enterCar') {
    const mv = vehicles.find((v) => v.id === s.carId);
    if (mv && Math.hypot(mv.x - player.x, mv.z - player.z) < 6) { enterVehicle(mv); return true; }
  }
  return false;
}
function enterVehicle(v) {
  currentVehicle = v;
  v.parked = false;
  if (!v.owned && !G.stolen.has(v.id)) {
    G.stolen.add(v.id);
    addWanted(1);
    $('toast').textContent = `Stole the ${v.kind}! Wanted +1★`;
  } else $('toast').textContent = `Driving the ${v.kind}.`;
  playerMesh.visible = false;
  sfx.engine(true);
}
function exitVehicle() {
  if (!currentVehicle) return;
  const v = currentVehicle;
  player.x = v.x + Math.cos(v.heading) * 3;
  player.z = v.z + Math.sin(v.heading) * 3;
  player.y = 0; player.vy = 0;
  player.yaw = v.heading;
  v.speed = 0;
  currentVehicle = null;
  playerMesh.visible = true;
}

// ---------- combat ----------
function fireWeapon() {
  const w = WEAPONS[G.weapon];
  if (G.fireCd > 0) return;
  G.fireCd = 1 / w.rate;
  if (w.ammo !== Infinity) {
    const key = w.id === 'pistol' ? 'pistol' : w.id === 'smg' ? 'smg' : 'shotgun';
    if (G.ammo[key] <= 0) { $('toast').textContent = `${w.name} out of ammo — buy more at a shop.`; return; }
    G.ammo[key] -= 1;
  }
  sfx.shot();
  // Hitscan: nearest living enemy in a front cone of the camera.
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bd = w.range;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x, dz = e.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const dot = (dx * fx + dz * fz) / Math.max(d, 0.01);
    if (dot > 0.7 && d < bd) { bd = d; best = e; }
  }
  if (best) {
    const pellets = w.pellets || 1;
    best.hp -= w.damage * pellets;
    if (best.hp <= 0) {
      best.alive = false; best.mesh.visible = false;
      G.enemiesLeft = Math.max(0, G.enemiesLeft - 1);
      G.kills++;
      $('toast').textContent = `Target down. ${G.enemiesLeft} left.`;
      sfx.pickup();
    }
  }
  // Tracer flash: brief line from the player toward the aim direction.
  const tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(player.x, 1.5, player.z),
      new THREE.Vector3(player.x + fx * 20, 1.5, player.z + fz * 20),
    ]),
    new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 }));
  scene.add(tracer);
  setTimeout(() => scene.remove(tracer), 70);
}

// ---------- one fixed step ----------
// Day/night lighting with bright-enough floors. Called every frame, not
// just in step(), so staged scenes (dialogue open) show their staged time.
function applyLighting() {
  const day = Math.sin(G.time * Math.PI * 2); // 1 = noon, -1 = midnight
  const dl = Math.max(0.25, (day + 1) / 2);
  sun.intensity = 0.15 + dl * 1.1;
  hemi.intensity = 0.5 + dl * 0.35;
  amb.intensity = 0.6; // floor never below 0.6 — night stays readable
  moon.intensity = 0.35 - dl * 0.3;
  scene.background.setHSL(0.62, 0.6, 0.05 + dl * 0.45);
  scene.fog.color.copy(scene.background);
}
function step(dt) {
  if (G.screen !== 'play') return;
  G.time = (G.time + dt / 240) % 1; // full day in 4 minutes
  G.weatherTimer -= dt;
  if (G.weatherTimer <= 0) { G.raining = !G.raining; rain.visible = G.raining; G.weatherTimer = 45 + Math.random() * 45; }
  // Day/night lighting is applied per-frame (applyLighting, in the loop),
  // so staged dialogue scenes get their staged time of day too.
  if (G.raining) {
    const pos = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) {
      let y = pos.getY(i) - dt * 55;
      if (y < 0) y = 60;
      pos.setY(i, y);
      pos.setX(i, player.x + ((pos.getX(i) - player.x + 150) % 300) - 150);
      pos.setZ(i, player.z + ((pos.getZ(i) - player.z + 150) % 300) - 150);
    }
    pos.needsUpdate = true;
  }
  // Camera orbit (mouse drag) + arrow-key orbit.
  const m = input.consumeMouse();
  if (input.mouseDown) { G.camYaw -= m.dx * 0.004; G.camPitch = Math.max(-0.9, Math.min(0.4, G.camPitch - m.dy * 0.003)); }
  if (input.isHeld('ArrowLeft')) G.camYaw += dt * 1.6;
  if (input.isHeld('ArrowRight')) G.camYaw -= dt * 1.6;
  // Weapon select 1-4.
  for (let i = 0; i < 4; i++) if (input.take('Digit' + (i + 1))) { G.weapon = i; $('toast').textContent = WEAPONS[i].name + ' ready.'; }
  if (input.take('KeyM')) { G.screen = 'map'; $('map-screen').style.display = 'flex'; return; }
  if (input.take('Escape')) { G.screen = 'paused'; $('pause-screen').style.display = 'flex'; return; }
  if (input.take('KeyF')) sfx.muted = !sfx.muted;
  // Interact: EDGE_INTERACT queued first, held E as fallback. Consuming
  // the edge also marks the key consumed until release, so one press can
  // never enter AND immediately exit on the next fixed step.
  let interact = input.take('EDGE_INTERACT');
  if (interact) G._eConsumed = true;
  if (!interact && input.isHeld('KeyE') && !G._eConsumed) { interact = true; G._eConsumed = true; }
  if (!input.isHeld('KeyE')) G._eConsumed = false;
  if (interact) doInteract();
  // Fire.
  if (G.fireCd > 0) G.fireCd -= dt;
  const w = WEAPONS[G.weapon];
  if ((w.auto && input.mouseDown) || (!w.auto && input.take('Mouse0'))) fireWeapon();
  if (currentVehicle) stepDriving(dt);
  else stepOnFoot(dt);
  stepTraffic(dt);
  stepPeds(dt);
  stepPolice(dt);
  stepEnemies(dt);
  stepRivals(dt);
  checkMissionStep(dt);
  collectShards();
  // Traffic-light cycle.
  const green = Math.floor(performance.now() / 4000) % 2 === 0;
  for (const b of window.__trafficLights) b.material.color.setHex(green ? 0x22ff44 : 0xff2222);
  // Shard spin.
  for (const [id, mesh] of shardMeshes) { mesh.rotation.y += dt * 2; mesh.position.y = 2 + Math.sin(performance.now() / 400 + id.length) * 0.3; }
  // Wanted decay: out of sight long enough -> SEARCHING -> heat drops.
  if (G.wanted > 0) {
    const seen = policeCars.some((p) => Math.hypot(p.x - player.x, p.z - player.z) < 70 && !losBlocked(p.x, p.z, player.x, player.z));
    if (seen) { G.lastKnown = { x: player.x, z: player.z }; G.searchTimer = 0; }
    else {
      G.searchTimer += dt;
      if (G.searchTimer > 10) { G.wanted--; G.searchTimer = 0; if (G.wanted === 0) { for (const p of [...policeCars]) despawnPolice(p); $('toast').textContent = 'You lost them. Heat cleared.'; } }
    }
  }
  // Busted: on foot, slow, police close.
  if (G.wanted > 0 && !currentVehicle) {
    const near = policeCars.some((p) => Math.hypot(p.x - player.x, p.z - player.z) < 6);
    if (near && player.speed < 0.5) { G.bustedTimer += dt; if (G.bustedTimer > 3) { G.bustedTimer = 0; busted(); } }
    else G.bustedTimer = 0;
  }
  if (G.stamina < 100) G.stamina = Math.min(100 + G.upgrades.stamina * 25, G.stamina + dt * (input.isHeld('ShiftLeft') ? 0 : 14));
}
function stepOnFoot(dt) {
  const ax = input.axis();
  const sprint = input.isHeld('ShiftLeft') && G.stamina > 0;
  const speed = sprint ? 8.5 : 4.5;
  if (sprint && (ax.x || ax.z)) G.stamina = Math.max(0, G.stamina - dt * 18);
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  const mx = (ax.x * cos - ax.z * sin), mz = (ax.x * sin + ax.z * cos);
  const len = Math.hypot(mx, mz) || 1;
  player.speed = (ax.x || ax.z) ? speed : 0;
  player.x += (mx / len) * player.speed * dt;
  player.z += (mz / len) * player.speed * dt;
  if (ax.x || ax.z) player.yaw = Math.atan2(mx / len, mz / len);
  collideCircle(player, 0.7);
  player.x = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, player.x));
  player.z = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, player.z));
  // Jump: Space held; probe expects vy>0, y>0, then a landing.
  if (input.isHeld('Space') && player.onGround) { player.vy = 8.5; player.onGround = false; }
  player.vy -= 22 * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }
  player.walkPhase += player.speed * dt * 1.6;
  const swing = (ax.x || ax.z) ? Math.sin(player.walkPhase) * 0.5 : 0;
  playerMesh.getObjectByName('legL').rotation.x = swing;
  playerMesh.getObjectByName('legR').rotation.x = -swing;
  playerMesh.position.set(player.x, player.y, player.z);
  playerMesh.rotation.y = player.yaw;
}
function stepDriving(dt) {
  const v = currentVehicle;
  const spec = VEHICLE_SPECS[v.kind];
  const top = spec.top * (1 + 0.12 * G.upgrades.engine);
  const fwd = input.isHeld('KeyW') || input.isHeld('ArrowUp');
  const back = input.isHeld('KeyS') || input.isHeld('ArrowDown');
  if (fwd) v.speed = Math.min(top, v.speed + spec.accel * dt);
  else if (back) v.speed = Math.max(-10, v.speed - spec.accel * 0.8 * dt);
  else v.speed *= Math.max(0, 1 - 1.2 * dt);
  const steer = (input.isHeld('KeyA') || input.isHeld('ArrowLeft') ? 1 : 0) - (input.isHeld('KeyD') || input.isHeld('ArrowRight') ? 1 : 0);
  if (Math.abs(v.speed) > 0.5) v.heading += steer * 1.5 * dt * Math.sign(v.speed);
  const nx = v.x - Math.sin(v.heading) * v.speed * dt;
  const nz = v.z - Math.cos(v.heading) * v.speed * dt;
  const probe = { x: nx, z: nz };
  if (!collideCircle(probe, 1.6)) { v.x = nx; v.z = nz; }
  else v.speed *= 0.4;
  v.x = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, v.x));
  v.z = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, v.z));
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  player.x = v.x; player.z = v.z; player.y = 0;
  player.yaw = v.heading;
  player.speed = Math.abs(v.speed);
  headlight.position.set(v.x, 2, v.z);
  headlight.target.position.set(v.x - Math.sin(v.heading) * 30, 0, v.z - Math.cos(v.heading) * 30);
}
function stepTraffic(dt) {
  for (const v of trafficCars) {
    const s = v.street;
    if (v.axis === 'z') {
      v.z += v.dir * v.speed * dt;
      if (v.z > 420) v.z = -420; if (v.z < -420) v.z = 420;
      v.mesh.position.set(v.x, 0, v.z);
    } else {
      v.x += v.dir * v.speed * dt;
      if (v.x > 420) v.x = -420; if (v.x < -420) v.x = 420;
      v.mesh.position.set(v.x, 0, v.z);
    }
    // Simple avoidance: slow if a car is close ahead on the same street.
    for (const o of trafficCars) {
      if (o === v || o.axis !== v.axis || o.street.line !== s.line) continue;
      const d = v.axis === 'z' ? (o.z - v.z) * v.dir : (o.x - v.x) * v.dir;
      if (d > 0 && d < 14) { v.speed = Math.max(3, v.speed - dt * 8); }
    }
    v.speed = Math.min(14, v.speed + dt * 2);
  }
  // Parked / owned cars stay where they are; their meshes already match.
  for (const v of vehicles) if (!v.traffic && v !== currentVehicle) { v.mesh.position.set(v.x, 0, v.z); v.mesh.rotation.y = v.heading; }
}
function stepPeds(dt) {
  for (const p of peds) {
    const pd = Math.hypot(player.x - p.x, player.z - p.z);
    if (pd < 8 && player.speed > 6) p.flee = 2;
    if (p.flee > 0) { p.flee -= dt; p.speed = 5; } else p.speed = 1.2 + (p.phase % 1.5);
    // Walk along the sidewalk: keep x near a street line + 10, move in z.
    const dir = Math.sin(p.heading);
    p.z += dir * p.speed * dt;
    if (p.z > 400) p.z = -400; if (p.z < -400) p.z = 400;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.phase += dt;
    p.mesh.position.y = Math.abs(Math.sin(p.phase * 6)) * 0.06;
  }
}
function stepPolice(dt) {
  if (G.wanted > 0 && policeCars.length < Math.min(5, G.wanted + 1) && Math.random() < dt * 0.5) spawnPolice();
  const target = G.lastKnown || { x: player.x, z: player.z };
  for (const p of [...policeCars]) {
    const seen = Math.hypot(p.x - player.x, p.z - player.z) < 70 && !losBlocked(p.x, p.z, player.x, player.z);
    const tx = seen ? player.x : target.x, tz = seen ? player.z : target.z;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 4) {
      const want = Math.atan2(-dx, -dz);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, dh));
      p.speed = Math.min(30, p.speed + 12 * dt);
      const nx = p.x - Math.sin(p.heading) * p.speed * dt;
      const nz = p.z - Math.cos(p.heading) * p.speed * dt;
      const probe = { x: nx, z: nz };
      if (!collideCircle(probe, 1.6)) { p.x = nx; p.z = nz; } else p.speed *= 0.5;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
    // Ram only hurts the driver on foot; a police car nudging your car
    // just bumps it (no speed drain, no health drain while driving).
    if (d < 3 && G.wanted > 0 && !currentVehicle) damagePlayer(6 * dt);
  }
}
function stepRivals(dt) {
  if (!G.rivals || !G.rivals.length) return;
  const m = currentMission(); const s = currentStep();
  if (!m || !s || s.type !== 'race') return;
  const cp = s.checkpoints[G.raceCp]; if (!cp) return;
  for (const rv of G.rivals) {
    const dx = cp[0] - rv.x, dz = cp[1] - rv.z;
    const d = Math.hypot(dx, dz);
    if (d > 2) {
      rv.heading = Math.atan2(-dx, -dz);
      rv.x -= Math.sin(rv.heading) * 12 * dt;
      rv.z -= Math.cos(rv.heading) * 12 * dt;
      rv.mesh.position.set(rv.x, 0, rv.z);
      rv.mesh.rotation.y = rv.heading;
    }
  }
}
function stepEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = player.x - e.x, dz = player.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > 2 && d < 60) {
      e.x += (dx / d) * 3 * dt; e.z += (dz / d) * 3 * dt;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
    }
    if (d < 8 && Math.random() < dt * 0.5) damagePlayer(4);
  }
}
function collectShards() {
  for (const s of SHARDS) {
    if (G.shards.has(s.id)) continue;
    if (Math.hypot(player.x - s.x, player.z - s.z) < s.radius + 1) {
      G.shards.add(s.id);
      const m = shardMeshes.get(s.id); if (m) m.visible = false;
      G.cash += 25; sfx.pickup();
      $('toast').textContent = `Neon shard ${G.shards.size}/20 — +$25`;
      saveGame();
    }
  }
}

// ---------- HUD + minimap + map ----------
const minimap = $('minimap');
const mm = minimap.getContext('2d');
function drawMinimap(ctx, size, full) {
  const scale = size / 900;
  const ox = size / 2, oz = size / 2;
  const X = (x) => ox + x * scale, Z = (z) => oz + z * scale;
  ctx.fillStyle = 'rgba(8,12,24,0.85)'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#3a4a6b'; ctx.lineWidth = full ? 3 : 2;
  for (const x of STREET_X) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), size); ctx.stroke(); }
  for (const z of STREET_Z) { ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(size, Z(z)); ctx.stroke(); }
  ctx.fillStyle = '#5a6a8a';
  for (const b of BUILDINGS) ctx.fillRect(X(b.x1), Z(b.z1), (b.x2 - b.x1) * scale, (b.z2 - b.z1) * scale);
  ctx.fillStyle = '#00e5ff';
  for (const s of SHARDS) if (!G.shards.has(s.id)) { ctx.beginPath(); ctx.arc(X(s.x), Z(s.z), full ? 4 : 2.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffd166';
  const t = markerTarget();
  if (t) { ctx.beginPath(); ctx.arc(X(t.x), Z(t.z), full ? 7 : 5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ff2d78';
  for (const v of trafficCars) { ctx.beginPath(); ctx.arc(X(v.x), Z(v.z), 2, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#2266ff';
  for (const p of policeCars) { ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 3, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(X(player.x), Z(player.z), full ? 6 : 4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(player.x), Z(player.z));
  ctx.lineTo(X(player.x - Math.sin(player.yaw) * 14), Z(player.z - Math.cos(player.yaw) * 14)); ctx.stroke();
}
function updateHUD() {
  $('health-fill').style.width = G.health + '%';
  $('armor-fill').style.width = G.armor + '%';
  $('cash').textContent = '$' + G.cash;
  $('wanted').textContent = wantedStars();
  $('objective').textContent = objectiveText();
  $('district').textContent = districtAt(player.x, player.z);
  $('shards').textContent = `◆ ${G.shards.size}/20`;
  $('time').textContent = G.raining ? '🌧 Rain' : (G.time > 0.25 && G.time < 0.75 ? '☀ Day' : '🌙 Night');
  $('speed').textContent = currentVehicle ? `${Math.round(Math.abs(currentVehicle.speed) * 3.6)} km/h` : '';
  $('weapon').textContent = `${WEAPONS[G.weapon].name} · ${WEAPONS[G.weapon].ammo === Infinity ? '∞' : G.ammo[WEAPONS[G.weapon].id === 'pistol' ? 'pistol' : WEAPONS[G.weapon].id === 'smg' ? 'smg' : 'shotgun']}`;
  $('prompt').textContent = promptText();
  if (G.screen !== 'title') drawMinimap(mm, 180, false);
  if (G.screen === 'map') {
    const mc = $('map-canvas'); drawMinimap(mc.getContext('2d'), 640, true);
  }
  // Mission marker beacon.
  const t = markerTarget();
  if (t && G.screen === 'play') { marker.visible = true; marker.position.set(t.x, 15, t.z); }
  else marker.visible = false;
}
function updateCamera(dt) {
  const dist = currentVehicle ? 13.5 : 8; // ~13.5 in-car, ~8 on foot
  const lookX = player.x - Math.sin(player.yaw) * 3;
  const lookZ = player.z - Math.cos(player.yaw) * 3;
  const cx = player.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cz = player.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cy = 2.5 - Math.sin(G.camPitch) * dist;
  camera.position.set(cx, Math.max(1.2, cy), cz);
  camera.lookAt(lookX, 1.6, lookZ);
  // Chase-cam drift ONLY while driving (steering is heading-based there,
  // so it cannot fight the driver). The camera sits BEHIND the player,
  // so its yaw targets the player heading itself (offset (sin h, cos h)
  // is exactly -forward). On foot the camera stays exactly where the
  // player put it, so camera-relative walking is predictable.
  if (currentVehicle && player.speed > 1) {
    let dh = player.yaw - G.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    G.camYaw += dh * Math.min(1, dt * 1.2) * 0.15;
  }
  // Keep the meshes in sync even when no fixed step runs (dialogue open):
  // otherwise a staged scene shows the player at the origin.
  playerMesh.position.set(player.x, player.y, player.z);
  playerMesh.rotation.y = player.yaw;
  if (currentVehicle) { currentVehicle.mesh.position.set(currentVehicle.x, 0, currentVehicle.z); currentVehicle.mesh.rotation.y = currentVehicle.heading; }
  headlight.visible = !!currentVehicle;
}

// ---------- screens wiring ----------
function showTitle() {
  G.screen = 'title';
  $('title-screen').style.display = 'flex';
  $('hud').style.display = 'none';
  const save = loadSave();
  $('btn-continue').style.display = save ? 'block' : 'none';
  const sel = $('mission-select');
  sel.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = `${m.id} — ${m.name}${i <= (save ? save.missionIndex : 0) ? '' : ' (locked)'}`;
    b.disabled = i > (save ? save.missionIndex : 0);
    b.onclick = () => { newGame(); startMission(i); };
    sel.appendChild(b);
  });
}
function newGame() {
  G.cash = 250; G.health = 100; G.armor = 0; G.stamina = 100;
  G.wanted = 0; G.missionIndex = 0; G.stepIndex = 0; G.shards = new Set();
  G.owned = []; G.stolen = new Set();
  G.upgrades = { engine: 0, armor: 0, stamina: 0, charm: 0 };
  G.ammo = { pistol: 60, smg: 120, shotgun: 24 };
  player.x = SPAWN.x; player.z = SPAWN.z; player.y = 0; player.vy = 0;
  player.yaw = Math.PI; G.camYaw = 0;
  for (const [, m] of shardMeshes) m.visible = true;
  for (const e of enemies) { e.alive = false; e.mesh.visible = false; }
  $('title-screen').style.display = 'none';
  $('hud').style.display = 'block';
  G.screen = 'play';
  sfx.ensure();
  startMission(0); // M1 auto-starts on New Game
}
$('btn-new').onclick = () => { newGame(); };
$('btn-continue').onclick = () => {
  const s = loadSave();
  if (!s) return;
  applySave(s);
  $('title-screen').style.display = 'none';
  $('hud').style.display = 'block';
  G.screen = 'play';
  sfx.ensure();
  $('toast').textContent = `Welcome back, Raka. Cash $${G.cash}.`;
};
$('btn-how').onclick = () => {
  $('how-screen').style.display = $('how-screen').style.display === 'block' ? 'none' : 'block';
};
$('btn-resume').onclick = () => { $('pause-screen').style.display = 'none'; G.screen = 'play'; };
$('btn-save').onclick = () => { saveGame(); $('toast').textContent = 'Game saved.'; };
$('btn-quit').onclick = () => { saveGame(); $('pause-screen').style.display = 'none'; showTitle(); };
$('btn-mute').onclick = () => { sfx.muted = !sfx.muted; $('btn-mute').textContent = sfx.muted ? 'Unmute (F)' : 'Mute (F)'; };
$('map-close').onclick = () => { $('map-screen').style.display = 'none'; G.screen = 'play'; };
$('complete-next').onclick = () => {
  $('complete-screen').style.display = 'none';
  G.screen = 'play';
  const m = currentMission();
  if (m) startMission(G.missionIndex);
  else { $('toast').textContent = 'All 8 missions complete. Neon Coast is yours.'; }
};
$('over-continue').onclick = () => {
  $('over-screen').style.display = 'none';
  if ($('over-title').textContent === 'MISSION FAILED') { G.stepIndex = 0; G.missionTimer = 0; G.screen = 'play'; }
  else respawn();
};
window.addEventListener('keydown', (e) => {
  // Map close is handled ONLY here (step() does not run while the map is
  // open). This listener is on window, registered after input.attach(),
  // so it runs AFTER the input handler has queued the press — take()
  // can then consume the edge, or the next fixed step would take the
  // same M/Escape press and reopen the map / open pause.
  if (e.code === 'KeyM' && G.screen === 'map') { $('map-screen').style.display = 'none'; G.screen = 'play'; input.take('KeyM'); }
  if (e.code === 'Escape' && G.screen === 'map') { $('map-screen').style.display = 'none'; G.screen = 'play'; input.take('Escape'); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- staged screenshot API (used by shots.js) ----------
// Every helper the shot script calls exists here, on window.__NC.
window.__NC = {
  state: () => ({ screen: G.screen, cash: G.cash, health: G.health, wanted: G.wanted,
    mission: G.missionIndex, step: G.stepIndex, shards: G.shards.size,
    x: +player.x.toFixed(1), z: +player.z.toFixed(1), y: +player.y.toFixed(2),
    vy: +player.vy.toFixed(2), heading: +player.yaw.toFixed(2),
    inCar: !!currentVehicle, car: currentVehicle ? currentVehicle.kind : null,
    carId: currentVehicle ? currentVehicle.id : null, speed: +player.speed.toFixed(1) }),
  newGame,
  startMission,
  teleport(x, z) { player.x = x; player.z = z; if (currentVehicle) { currentVehicle.x = x; currentVehicle.z = z; } },
  setWanted(n) { G.wanted = n; G.lastKnown = { x: player.x, z: player.z }; for (let i = 0; i < n; i++) spawnPolice(); },
  setTime(t) { G.time = t; },
  setRain(r) { G.raining = r; rain.visible = r; },
  enterCarById(id) { const v = vehicles.find((v) => v.id === id); if (v) enterVehicle(v); return !!v; },
  setCash(n) { G.cash = n; },
  showDialogue,
  dismissDialogue() { $('dialogue-screen').style.display = 'none'; document.body.classList.remove('dialogue-open'); G.screen = 'play'; },
  showChoice(text, a, b, cb) { openChoice('The Choice', text, a, b, cb); },
  setObjective(t) { G._objOverride = t; $('objective').textContent = t; },
  setHeading(h) { player.yaw = h; if (currentVehicle) currentVehicle.heading = h; },
  setCamYaw(y) { G.camYaw = y; },
  clearHeat() { G.wanted = 0; G.lastKnown = null; for (const p of [...policeCars]) despawnPolice(p); },
  defend() { startDefendWave(); },
  spawnEnemies(n) { for (let i = 0; i < n; i++) spawnEnemy(player.x + 15 + i * 4, player.z + 10); G.enemiesLeft = n; },
  hideHUD(v) { $('hud').style.display = v ? 'none' : 'block'; },
  ready() { return true; },
};

// ---------- main loop ----------
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (G.screen === 'play') {
    while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
  } else accumulator = 0;
  if (G.screen === 'play' || G.screen === 'map' || G.screen === 'shop' || G.screen === 'dialogue' || G.screen === 'choice' || G.screen === 'complete') {
    updateCamera(1 / 60);
    updateHUD();
  }
  // Title backdrop: slow orbit over Downtown.
  if (G.screen === 'title') {
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 220, 90, Math.cos(t * 0.05) * 220);
    camera.lookAt(0, 10, 0);
    G.time = 0.62;
  }
  applyLighting();
  renderer.render(scene, camera);
  input.endFrame(); // pressed-edge set cleared ONLY here, after all fixed steps
}

if (SHOT) {
  // Staged scene mode: shots.js drives window.__NC, then sets __shotReady.
  import('./shots.js').then((m) => m.stageShot(SHOT));
  requestAnimationFrame(frame);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
