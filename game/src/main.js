// Boot and the one loop: input every frame, the world in fixed 1/60 s steps, and the
// renderer paints what is there. Screens: title, play, paused, map, wasted, busted.
// M and Escape are handled here, synchronously in a DOM keydown listener — never as
// fixed-step edges — so a map toggle can never be re-consumed by a later step
// (the round-10 bug where M would not close the map).
import * as THREE from 'three';
import { WORLD, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicleSys } from './vehicles.js';
import { createPedSys } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createWeaponSys } from './weapons.js';
import { createPoliceSys } from './police.js';
import { createMissionSys } from './missions.js';
import { createHud } from './hud.js';
import { saveGame as persistSave, loadSave, hasSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

// --- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-240, 40, 200);

// --- Game context -----------------------------------------------------------
const G = {
  scene, camera, renderer,
  time: 0,
  cash: WORLD.startCash,
  shardsTaken: 0,
  ownedVehicles: [],   // { kind, color, slot, car? }
  screen: 'title',
  missionCardOpen: false,
  errors: [],
  version: 'r13-caldera-bay',
  interactCalls: 0,   // debug counter: how many times doInteract() ran
};
window.addEventListener('error', (e) => { G.errors.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', (e) => { G.errors.push(String(e.reason)); });

const input = createInput(canvas);
const audio = createAudio();
G.input = input;
G.audio = audio;

const city = buildCity(scene, seed);
G.city = city;
G.vehicles = createVehicleSys(G);
G.peds = createPedSys(G);
G.player = createPlayer(G);
G.weapons = createWeaponSys(G);
G.police = createPoliceSys(G);
G.missions = createMissionSys(G);
G.hud = createHud(G);

G.vehicles.spawnWorld();
G.peds.spawnWorld();

// Garage parking slots (on the street in front of Sorren Motors).
const GARAGE_SLOTS = [
  { x: -330, z: 120, heading: Math.PI / 2 },
  { x: -312, z: 120, heading: Math.PI / 2 },
  { x: -288, z: 120, heading: Math.PI / 2 },
  { x: -270, z: 120, heading: Math.PI / 2 },
];

function respawnOwnedVehicles() {
  for (const rec of G.ownedVehicles) {
    const slot = GARAGE_SLOTS[rec.slot % GARAGE_SLOTS.length];
    const car = G.vehicles.spawnVehicle(rec.kind, slot.x, slot.z, slot.heading, { parked: true, owner: 'player', color: rec.color });
    rec.car = car;
  }
}

function storeVehicle(car) {
  if (!car || car.isPolice || car.target) return false;
  const slotIndex = G.ownedVehicles.length % GARAGE_SLOTS.length;
  const slot = GARAGE_SLOTS[slotIndex];
  car.owner = 'player';
  car.isParked = true;
  car.x = slot.x;
  car.z = slot.z;
  car.heading = slot.heading;
  car.speed = 0;
  car.mesh.position.set(slot.x, 0, slot.z);
  car.mesh.rotation.y = slot.heading;
  G.ownedVehicles.push({ kind: car.kind, color: car.color, slot: slotIndex, car });
  G.hud.toast(`Stored the ${car.name} in your garage.`);
  G.hud.feed(`Stored the ${car.name} in your garage.`, 'good');
  G.audio.chaChing();
  persistSave(G);
  return true;
}

// --- Save / Continue ----------------------------------------------------------
G.saveGame = () => persistSave(G);

function applySave(data) {
  G.cash = data.cash;
  G.shardsTaken = data.shardsTaken || 0;
  for (const id of data.shardIds || []) {
    const s = G.city.shards[id];
    if (s) { s.taken = true; s.mesh.visible = false; }
  }
  G.player.reset(data.player.x, data.player.z, data.player.heading);
  G.player.health = data.player.health ?? 100;
  G.weapons.index = data.weapons.index ?? 0;
  G.weapons.mag = data.weapons.mag ?? G.weapons.mag;
  G.weapons.reserve = data.weapons.reserve ?? G.weapons.reserve;
  G.weapons.unlocked = data.weapons.unlocked ?? G.weapons.unlocked;
  G.missions.loadState(data.missions);
  G.ownedVehicles = (data.ownedVehicles || []).map((v) => ({ ...v }));
  respawnOwnedVehicles();
  G.police.setWanted(0);
  G.city.setBeacon(G.city.points.garage.x, G.city.points.garage.z, true);
}

// --- WASTED / BUSTED ----------------------------------------------------------
G.onWasted = (source) => {
  if (G.screen !== 'play') return;
  G.cash = Math.max(0, G.cash - 150);
  G.missions.failMission('You got wasted.');
  G.screen = 'wasted';
  document.getElementById('gameover-title').textContent = 'WASTED';
  document.getElementById('gameover-body').textContent = `Milo got taken out${source ? ` by ${source}` : ''}. The clinic patched him up — $150.`;
  document.getElementById('gameover').classList.remove('hidden');
  G.hud.hide();
  audio.sting('busted');
};

G.onBusted = () => {
  if (G.screen !== 'play') return;
  G.cash = Math.max(0, G.cash - 250);
  G.missions.failMission('The CBPD busted you.');
  G.screen = 'busted';
  document.getElementById('gameover-title').textContent = 'BUSTED';
  document.getElementById('gameover-body').textContent = 'The CBPD hauled Milo in. Bail cost $250, and the job is blown.';
  document.getElementById('gameover').classList.remove('hidden');
  G.hud.hide();
  audio.sting('busted');
};

function respawnAfterGameOver() {
  document.getElementById('gameover').classList.add('hidden');
  const atClinic = G.screen === 'wasted';
  G.player.reset(atClinic ? -240 : 120, atClinic ? -180 : 60, Math.PI / 2);
  G.player.health = 100;
  G.police.setWanted(0);
  G.police.despawnPursuit();
  G.screen = 'play';
  G.hud.show();
  G.city.setBeacon(G.city.points.garage.x, G.city.points.garage.z, true);
  persistSave(G);
}

// --- Screens ------------------------------------------------------------------
function announce(message) {
  status.textContent = message;
}

function showTitle() {
  G.screen = 'title';
  document.getElementById('title-screen').classList.remove('hidden');
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('map-overlay').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('ending-card').classList.add('hidden');
  G.hud.hide();
  document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';
  announce('SUNSET HEIST: CALDERA BAY. New Game or Continue.');
}

function startPlay(fresh) {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('map-overlay').classList.add('hidden');
  G.screen = 'play';
  G.hud.show();
  audio.unlock();
  audio.startMusic();
  if (fresh) {
    G.cash = WORLD.startCash;
    G.shardsTaken = 0;
    G.ownedVehicles = [];
    G.player.reset(WORLD.spawn.x, WORLD.spawn.z, WORLD.spawn.heading);
    G.missions.loadState({ index: 0, done: [false, false, false, false, false, false], finishedAll: false });
    G.police.setWanted(0);
    G.city.setBeacon(G.city.points.garage.x, G.city.points.garage.z, true);
    G.missions.startMission(0);
    announce('Playing. M1 First Wheels: steal the Tempest GT at Marina Sol.');
  } else {
    const data = loadSave();
    if (data) {
      applySave(data);
      announce('Continued. Welcome back to Caldera Bay.');
    } else {
      startPlay(true);
      return;
    }
  }
  persistSave(G);
}

function pauseGame() {
  if (G.screen !== 'play') return;
  G.screen = 'paused';
  document.getElementById('pause-menu').classList.remove('hidden');
  announce('Paused.');
}

function resumeGame() {
  if (G.screen !== 'paused') return;
  G.screen = 'play';
  document.getElementById('pause-menu').classList.add('hidden');
  announce('Playing.');
}

function openMap() {
  if (G.screen !== 'play') return;
  G.screen = 'map';
  G.hud.drawBigMap();
  document.getElementById('map-overlay').classList.remove('hidden');
  announce('Map open. M or Escape closes it.');
}

function closeMap() {
  if (G.screen !== 'map') return;
  G.screen = 'play';
  document.getElementById('map-overlay').classList.add('hidden');
  announce('Playing.');
}

// M / Escape: synchronous, here — never a fixed-step edge.
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyM') {
    input.discard('KeyM');
    if (G.screen === 'play') openMap();
    else if (G.screen === 'map') closeMap();
  } else if (event.code === 'Escape') {
    input.discard('Escape');
    if (G.screen === 'map') closeMap();
    else if (G.screen === 'paused') resumeGame();
    else if (G.screen === 'play' && !G.missionCardOpen) pauseGame();
  }
});

// --- Buttons ------------------------------------------------------------------
document.getElementById('btn-new-game').addEventListener('click', () => { audio.unlock(); startPlay(true); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); startPlay(false); });
document.getElementById('btn-howto').addEventListener('click', () => {
  document.getElementById('title-howto').classList.toggle('hidden');
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => {
  if (persistSave(G)) G.hud.toast('Game saved.');
  else G.hud.toast('Save failed — storage unavailable.');
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  document.getElementById('pause-menu').classList.add('hidden');
  G.screen = 'play';
  G.missions.restartMission();
});
document.getElementById('btn-quit-title').addEventListener('click', showTitle);
document.getElementById('btn-respawn').addEventListener('click', respawnAfterGameOver);
document.getElementById('btn-go-title').addEventListener('click', () => {
  document.getElementById('gameover').classList.add('hidden');
  showTitle();
});
document.getElementById('mission-card-btn').addEventListener('click', () => {
  G.hud.hideMissionCard();
  audio.click();
});
document.getElementById('btn-ending-continue').addEventListener('click', () => {
  document.getElementById('ending-card').classList.add('hidden');
  audio.click();
});
document.getElementById('map-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'map-overlay') closeMap();
});

// --- Interaction (E) ------------------------------------------------------------
// Priority, on foot: start mission > spray (no active mission) > store vehicle >
// shop > enter car. In a car, E always exits (no spray trap — round-10 lesson).
function nearestShop(x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const s of G.city.points.shops) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// The mission id whose target car the player is currently meant to steal
// (M1's Tempest GT, M2's van) — null when no steal step is active.
function stealTargetId() {
  if (!G.missions.isActive()) return null;
  const s = G.missions.currentStep();
  if (!s || s.type !== 'steal') return null;
  return G.missions.mission().id;
}

function interactPrompt() {
  const p = G.player;
  if (G.screen !== 'play' || G.missionCardOpen) return '';
  const g = G.city.points.garage;
  const dGarage = Math.hypot(p.x - g.x, p.z - g.z);
  if (!p.inCar && dGarage < g.radius) {
    if (!G.missions.isActive() && G.missions.hasNext()) {
      const m = G.missions.mission();
      return `E — Start ${m.id} ${m.title} at Sorren Motors`;
    }
    if (!G.missions.isActive() && G.police.wanted > 0) return 'E — Spray job $300 (clear heat)';
    const car = G.vehicles.nearestStorableCar(p.x, p.z, 10);
    if (car) return `E — Store the ${car.name} in the garage`;
  }
  const shop = nearestShop(p.x, p.z, 8);
  if (shop && !p.inCar) {
    if (shop.id === 'sunmart') {
      if (G.missions.isActive() && G.missions.mission().id === 'M4') return 'E — Rob SunMart (hold the till)';
      if (G.missions.done[3]) return 'E — Rob SunMart ($450)';
      return 'SunMart — come back when Ivy has a job for you';
    }
    if (shop.id === 'noodle') return 'E — Noodle House: eat $25 (+40 health)';
    if (shop.id === 'ammo') return 'E — Ammo Depot: buy ammo for your weapon';
    if (shop.id === 'clinic') return 'E — Casa Palma: rest $60 (full health)';
  }
  if (!p.inCar) {
    const car = G.vehicles.nearestCar(p.x, p.z, 5, stealTargetId());
    if (car) return car.owner === 'player' ? `E — Enter your ${car.name}` : `E — Steal the ${car.name}`;
  }
  if (p.inCar) return 'E — Exit car';
  return '';
}

function doInteract() {
  G.interactCalls += 1;
  const p = G.player;
  if (G.screen !== 'play' || G.missionCardOpen) return;
  const g = G.city.points.garage;
  const dGarage = Math.hypot(p.x - g.x, p.z - g.z);
  if (p.inCar) { p.exitCar(); return; }
  if (dGarage < g.radius) {
    if (!G.missions.isActive() && G.missions.hasNext()) {
      G.missions.startNextMission();
      return;
    }
    if (!G.missions.isActive() && G.police.wanted > 0) {
      G.police.trySpray();
      return;
    }
    const car = G.vehicles.nearestStorableCar(p.x, p.z, 10);
    if (car) {
      storeVehicle(car);
      return;
    }
  }
  const shop = nearestShop(p.x, p.z, 8);
  if (shop) {
    if (shop.id === 'sunmart') {
      if (G.missions.isActive() && G.missions.mission().id === 'M4') {
        G.hud.toast('Stay at the counter — the till is filling…');
      } else if (G.missions.done[3]) {
        if (G.missions.startFreeRob()) G.hud.toast('Hold the till — stay at the counter!');
      } else {
        G.hud.toast('SunMart — Ivy will have a job for this place soon.');
      }
      return;
    }
    if (shop.id === 'noodle') {
      if (G.cash >= 25 && p.health < p.maxHealth) {
        G.cash -= 25;
        p.heal(40);
        G.audio.chaChing();
        G.hud.toast('Ate at Noodle House: +40 health.');
      } else if (p.health >= p.maxHealth) G.hud.toast('Already full health.');
      else G.hud.toast('Not enough cash ($25).');
      return;
    }
    if (shop.id === 'ammo') {
      const w = G.weapons.weapon();
      const prices = { pistol: 40, smg: 60, shotgun: 80 };
      if (w.id === 'fists') { G.hud.toast('Buy a gun first — Ivy unlocks them through jobs.'); return; }
      const price = prices[w.id];
      if (G.cash >= price) {
        G.cash -= price;
        G.weapons.reserve[G.weapons.index] += w.mag * 2;
        G.audio.chaChing();
        G.hud.toast(`Bought ${w.name} ammo (+${w.mag * 2}).`);
      } else G.hud.toast(`Not enough cash ($${price}).`);
      return;
    }
    if (shop.id === 'clinic') {
      if (G.cash >= 60 && p.health < p.maxHealth) {
        G.cash -= 60;
        p.heal(100);
        G.audio.chaChing();
        G.hud.toast('Rested at Casa Palma: full health.');
      } else if (p.health >= p.maxHealth) G.hud.toast('Already full health.');
      else G.hud.toast('Not enough cash ($60).');
      return;
    }
  }
  const car = G.vehicles.nearestCar(p.x, p.z, 5, stealTargetId());
  if (car) p.enterCar(car);
}

// --- Fixed-step simulation ------------------------------------------------------
function step(dt) {
  G.time += dt;
  if (G.screen !== 'play') return;
  if (G.missionCardOpen) return; // intro/complete cards pause the sim (timer included)
  if (input.take('KeyE')) doInteract();
  G.player.update(dt, input);
  if (G.player.inCar) G.vehicles.stepPlayerCar(dt, input);
  G.vehicles.update(dt);
  G.peds.update(dt);
  G.weapons.update(dt, input);
  G.police.update(dt);
  G.missions.update(dt);
  // Sun coins: walk or drive over one to collect it.
  for (const s of G.city.shards) {
    if (s.taken) continue;
    if (Math.hypot(G.player.x - s.x, G.player.z - s.z) < 2.8) {
      s.taken = true;
      s.mesh.visible = false;
      G.shardsTaken += 1;
      G.cash += 25;
      G.audio.pickup();
      G.hud.toast(`Sun coin +$25 (${G.shardsTaken}/12)`);
    }
  }
  G.hud.update();
  G.hud.setInteractPrompt(interactPrompt());
}

// --- Frame loop -----------------------------------------------------------------
let accumulator = 0;
let last = performance.now();
let titleAngle = 0;

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  // Camera + render.
  const shake = G.hud.shakeOffset();
  if (G.screen === 'title') {
    titleAngle += 0.0004;
    camera.position.set(Math.sin(titleAngle) * 260, 90, Math.cos(titleAngle) * 260);
    camera.lookAt(0, 10, 0);
  } else {
    G.player.updateCamera(camera, STEP);
  }
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  G.city.sun.position.set(G.player.x - 180, 260, G.player.z + 120);
  G.city.sun.target.position.set(G.player.x, 0, G.player.z);
  G.city.sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}

// --- Shot mode ------------------------------------------------------------------
function runShot(name) {
  G.screen = 'play';
  G.hud.show();
  stageShot(G, name);
  G.hud.update();
  let painted = 0;
  function paint() {
    G.player.updateCamera(camera, STEP);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- Debug API (read-only state for the play-test driver) -----------------------
window.__CB = {
  version: G.version,
  state() {
    const p = G.player;
    return {
      screen: G.screen,
      time: Math.round(G.time * 10) / 10,
      cash: G.cash,
      health: Math.round(p.health),
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      y: Math.round(p.y * 100) / 100,
      heading: Math.round(p.heading * 100) / 100,
      camYaw: Math.round(p.camYaw * 100) / 100,
      inCar: p.inCar,
      carKind: p.car ? p.car.kind : null,
      carName: p.car ? p.car.name : null,
      carHealth: p.car ? Math.round(p.car.health) : null,
      speed: Math.round((p.inCar && p.car ? Math.abs(p.car.speed) : p.speed) * 10) / 10,
      wanted: G.police.wanted,
      searching: G.police.searching,
      policeCars: G.police.pursuit.length,
      officers: G.police.officers.filter((o) => !o.dead).length,
      mission: G.missions.isActive() ? G.missions.mission().id : null,
      missionIndex: G.missions.index,
      missionStep: G.missions.step,
      missionTimer: Math.round(G.missions.timer),
      missionDone: G.missions.done.slice(),
      finishedAll: G.missions.finishedAll,
      objective: G.missions.objectiveText(),
      objectivePoint: G.missions.objectivePoint(),
      weapon: G.weapons.weapon().name,
      mag: G.weapons.mag[G.weapons.index],
      reserve: G.weapons.reserve[G.weapons.index],
      owned: G.ownedVehicles.map((v) => v.kind),
      shardsTaken: G.shardsTaken,
      pedsAlive: G.peds.countAlive(),
      traffic: G.vehicles.traffic.length,
      enemies: G.weapons.enemies.filter((e) => !e.dead).length,
      errors: G.errors.slice(),
      prompt: document.getElementById('interact-prompt').textContent,
      missionCardOpen: G.missionCardOpen,
      eEdge: G.input.hasEdge('KeyE'),
      interactCalls: G.interactCalls,
      crimeLog: (G.crimeLog || []).slice(-30),
      reachability: G.city.reachabilityReport(),
    };
  },
  reachability() { return G.city.reachabilityReport(); },
  roadReport() { return G.city.roadReport(); },
};

// --- Go -------------------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play') pauseGame();
});

if (shotName) {
  runShot(shotName);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
