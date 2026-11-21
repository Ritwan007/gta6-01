// VELORA HEAT — boot, fixed-step loop, screen state machine, window.__vh.
// ?seed=N fixes the world. ?shot=cover|foot|chase|combat stages a screenshot.
import {
  CASA_BIRU, GARAGE, MART, MISSIONS, MISSION_CARS, POLICE_STATION, RACE_CPS, SPAWN, START_CASH, WEAPONS,
} from './config.js';
import { mulberry32 } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createCity } from './city.js';
import { spawnCar, spawnParkedRow, spawnTraffic, updateCars } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { interact, playerCar, switchWeapon, updatePlayer } from './player.js';
import { meleeSwing, reload, tryFire, updateEnemies } from './weapons.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { applySave, loadSave, saveGame } from './save.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const G = {
  mode: 'title',
  time: 0,
  seed,
  rng: mulberry32(seed),
  city: null,
  player: null,
  cars: [],
  peds: [],
  enemies: [],
  tracers: [],
  wanted: 0,
  searching: false,
  mission: { index: 0, active: false, step: 0, completed: [false, false, false, false, false, false], playerCp: 0, racerCp: [0, 0], raceCps: RACE_CPS, timer: 0, wave: 0, racers: [] },
  owned: [],
  cam: { x: SPAWN.x, z: SPAWN.z },
  holdup: null,
  errors: [],
  input: new Input(),
  audio: new AudioSys(),
  feedItems: [],
  shotsFiredNear: 0,
  pendingCrime: 0,
  shotsReported: false,
  bustedT: 0,
  muzzle: 0,
  prompt: null,
};
G.police = createPolice(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.city = createCity(seed);
const renderer = createRenderer(canvas);

G.feed = (text) => { G.feedItems.push(text); if (G.feedItems.length > 20) G.feedItems.shift(); };
window.addEventListener('error', (e) => G.errors.push('error: ' + (e.message || 'unknown')));
window.addEventListener('unhandledrejection', (e) => G.errors.push('rejection: ' + (e.reason && e.reason.message ? e.reason.message : 'unknown')));

function freshWeapons() {
  const w = {};
  for (const k of Object.keys(WEAPONS)) {
    const d = WEAPONS[k];
    w[k] = {
      name: d.name, unlocked: k === 'fists',
      mag: d.mag, reserve: d.reserve, magMax: d.mag, reserveMax: d.reserve,
    };
  }
  return w;
}

function resetWorld(save) {
  G.rng = mulberry32(seed);
  G.cars = [];
  G.peds = [];
  G.enemies = [];
  G.tracers = [];
  G.owned = [];
  G.wanted = 0; G.searching = false;
  G.holdup = null; G.pendingCrime = 0; G.bustedT = 0;
  G.mission = { index: 0, active: false, step: 0, completed: [false, false, false, false, false, false], playerCp: 0, racerCp: [0, 0], raceCps: RACE_CPS, timer: 0, wave: 0, racers: [] };
  G.missions = createMissions(G);
  G.player = {
    x: SPAWN.x, z: SPAWN.z, angle: -Math.PI / 2, hp: 100, cash: START_CASH,
    inCar: null, weapon: 'fists', weapons: freshWeapons(), fireCd: 0, mouseWasDown: false,
  };
  G.cam.x = SPAWN.x; G.cam.z = SPAWN.z;
  G.feedItems = [];
  // Mission cars (skip a kind the save already owns — it respawns at its slot).
  const ownedKinds = save ? new Set((save.owned || []).map((o) => o.kind)) : new Set();
  for (const mc of MISSION_CARS) {
    if (mc.mission === 'M1' && ownedKinds.has('gt')) continue;
    if (mc.mission === 'M2' && ownedKinds.has('van')) continue;
    spawnCar(G, mc.kind, mc.x, mc.z, 0, { parked: true, mission: mc.mission, color: mc.color });
  }
  spawnTraffic(G, 35);
  spawnParkedRow(G, 12);
  spawnPeds(G, 30);
  if (save) applySave(G, save);
}

// --- overlays ---
function show(id, on) { document.getElementById(id).classList.toggle('hidden', !on); }
function showOnly(id) {
  for (const o of ['title', 'card', 'pause', 'map', 'ending', 'wasted', 'busted']) show(o, o === id);
  show('hud', id !== 'title');
}
G.showCard = (title, text, cb) => {
  document.getElementById('card-title').textContent = title;
  document.getElementById('card-text').textContent = text;
  G.cardCb = cb;
  G.mode = 'card';
  showOnly('card');
};
G.showEnding = () => {
  G.mode = 'ending';
  showOnly('ending');
};
function failMissionSilent() {
  const M = G.mission;
  if (!M.active) return;
  M.active = false; M.step = 0;
  G.wanted = 0; G.searching = false;
  G.audio.siren(false);
  for (const c of G.cars) if (c.driver === 'racer') { c.driver = null; c.parked = true; }
  G.enemies.length = 0;
  G.holdup = null;
}
G.wasted = () => {
  if (G.mode === 'wasted' || G.mode === 'busted') return;
  failMissionSilent();
  const p = G.player;
  p.inCar = null;
  p.cash = Math.max(0, p.cash - 150);
  G.mode = 'wasted';
  showOnly('wasted');
  document.getElementById('wasted-text').textContent = `Reno tumbang di jalanan Velora Bay. -$150. Bangkit di Casa Biru.`;
  G.audio.sting(false);
};
G.busted = () => {
  if (G.mode === 'wasted' || G.mode === 'busted') return;
  failMissionSilent();
  const p = G.player;
  p.inCar = null;
  p.cash = Math.max(0, p.cash - 250);
  G.mode = 'busted';
  showOnly('busted');
  document.getElementById('busted-text').textContent = `VBPD menangkapmu. -$250. Dibebaskan di Markas VBPD.`;
  G.audio.sting(false);
};

function newGame() {
  resetWorld(null);
  G.audio.ensure();
  G.mode = 'play';
  showOnly('hud');
  G.missions.startMission(0);
}
function continueGame() {
  const save = loadSave();
  if (!save) return;
  resetWorld(save);
  G.audio.ensure();
  G.mode = 'play';
  showOnly('hud');
  G.feed('Lanjutkan permainan — selamat datang kembali di Velora Bay.');
}

// --- buttons ---
document.getElementById('btn-new').addEventListener('click', () => { G.audio.ensure(); newGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { G.audio.ensure(); continueGame(); });
document.getElementById('btn-how').addEventListener('click', () => {
  const h = document.getElementById('how');
  h.classList.toggle('hidden');
});
document.getElementById('btn-card').addEventListener('click', () => {
  const cb = G.cardCb; G.cardCb = null;
  showOnly('hud');
  if (G.mode === 'card') G.mode = 'play';
  if (cb) cb();
  if (G.mode === 'card') G.mode = 'play';
});
document.getElementById('btn-resume').addEventListener('click', () => { G.mode = 'play'; showOnly('hud'); });
document.getElementById('btn-save').addEventListener('click', () => {
  const ok = saveGame(G);
  document.getElementById('save-note').textContent = ok
    ? `Saved — $${Math.floor(G.player.cash)} · ${G.mission.completed.filter(Boolean).length}/6 misi · ${new Date().toLocaleTimeString()}`
    : 'Save gagal — storage tidak tersedia.';
  document.getElementById('btn-continue').disabled = false;
});
document.getElementById('btn-restart').addEventListener('click', () => {
  failMissionSilent();
  G.mode = 'play';
  showOnly('hud');
  G.feed('Misi dibatalkan. Kembali ke Bengkel Sari untuk memulai lagi.');
});
document.getElementById('btn-quit').addEventListener('click', () => {
  failMissionSilent();
  G.mode = 'title';
  refreshTitle();
  showOnly('title');
});
document.getElementById('btn-ending').addEventListener('click', () => { G.mode = 'play'; showOnly('hud'); });
document.getElementById('btn-wasted').addEventListener('click', () => {
  const p = G.player;
  p.x = CASA_BIRU.x; p.z = CASA_BIRU.z + 12; p.hp = 100; p.angle = 0;
  G.cam.x = p.x; G.cam.z = p.z;
  G.mode = 'play'; showOnly('hud');
});
document.getElementById('btn-busted').addEventListener('click', () => {
  const p = G.player;
  p.x = POLICE_STATION.x; p.z = POLICE_STATION.z + 12; p.hp = 100; p.angle = 0;
  G.cam.x = p.x; G.cam.z = p.z;
  G.mode = 'play'; showOnly('hud');
});

// --- keys ---
G.input.on('KeyE', () => interact(G));
G.input.on('KeyM', () => {
  if (G.mode === 'play') { G.mode = 'map'; showOnly('map'); }
  else if (G.mode === 'map') { G.mode = 'play'; showOnly('hud'); }
});
G.input.on('Escape', () => {
  if (G.mode === 'play') { G.mode = 'pause'; showOnly('pause'); }
  else if (G.mode === 'pause') { G.mode = 'play'; showOnly('hud'); }
  else if (G.mode === 'map') { G.mode = 'play'; showOnly('hud'); }
});
G.input.on('Digit1', () => switchWeapon(G, 0));
G.input.on('Digit2', () => switchWeapon(G, 1));
G.input.on('Digit3', () => switchWeapon(G, 2));
G.input.on('Digit4', () => switchWeapon(G, 3));
G.input.on('KeyR', () => reload(G));

function refreshTitle() {
  document.getElementById('btn-continue').disabled = !loadSave();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'play') { G.mode = 'pause'; showOnly('pause'); }
});

function computePrompt() {
  const p = G.player;
  if (p.inCar != null) { G.prompt = 'E — Keluar dari mobil'; return; }
  const nearMart = Math.hypot(p.x - MART.x, p.z - MART.z) <= 12;
  if (nearMart && p.weapon !== 'fists' && !G.holdup) { G.prompt = 'E — Rampok PelangiMart'; return; }
  const nearGarage = Math.hypot(p.x - GARAGE.x, p.z - GARAGE.z) <= 14;
  if (nearGarage) {
    let storable = null;
    for (const c of G.cars) {
      if (c.hp <= 0 || c.owned || c.kind === 'police' || c.driver === 'police' || c.driver === 'racer') continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 8) { storable = c; break; }
    }
    if (storable) { G.prompt = 'E — Simpan mobil di garasi'; return; }
    if (!G.mission.active && G.mission.index < 6) {
      G.prompt = `E — Mulai ${MISSIONS[G.mission.index].id} ${MISSIONS[G.mission.index].title}`;
      return;
    }
  }
  let best = null, bd = 5;
  for (const c of G.cars) {
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) {
    const name = best.kind === 'gt' ? 'Falco GT' : best.kind === 'van' ? 'Aruna Van' : best.kind === 'sedan' ? 'Lumba Sedan' : best.kind;
    G.prompt = best.owned ? `E — Naik ${name} (milikmu)` : best.parked ? `E — Curi ${name}` : `E — Naik ${name}`;
    return;
  }
  G.prompt = null;
}

function step(dt) {
  G.time += dt;
  if (G.mode === 'play') {
    updatePlayer(G, dt);
    updateCars(G, dt);
    updatePeds(G, dt);
    updateEnemies(G, dt);
    updatePolice(G, dt);
    G.missions.update(dt);
    if (G.player.weapon === 'fists') meleeSwing(G);
    else tryFire(G, dt);
    for (const t of G.tracers) t.life -= dt;
    G.tracers = G.tracers.filter((t) => t.life > 0);
    G.muzzle = Math.max(0, G.muzzle - dt);
    computePrompt();
    if (G.player.hp <= 0) G.wasted();
  } else if (G.mode === 'title') {
    updateCars(G, dt);
    updatePeds(G, dt);
    G.audio.music(dt);
  }
  G.input.endFrame();
}

// --- window.__vh: the read-only test/debug view (live getters) ---
Object.defineProperty(window, '__vh', {
  value: {
    get mode() { return G.mode; },
    get player() { return G.player; },
    get cars() { return G.cars; },
    get peds() { return G.peds; },
    get enemies() { return G.enemies; },
    get wanted() { return G.wanted; },
    get searching() { return G.searching; },
    get mission() { return G.mission; },
    get owned() { return G.owned; },
    get cam() { return G.cam; },
    get city() { return G.city; },
    get holdup() { return G.holdup; },
    get errors() { return G.errors; },
  },
});

// --- boot ---
resetWorld(null);
refreshTitle();
showOnly('title');

if (shot) {
  stageShot(G, shot);
  G.hud.update();
  let painted = 0;
  (function paint() {
    renderer.draw(G);
    G.hud.update();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    let n = 0;
    while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    renderer.draw(G);
    G.hud.update();
  }
  requestAnimationFrame(frame);
}
