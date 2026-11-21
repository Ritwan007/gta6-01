// VELORA HEAT — boot, fixed-step loop, screen state machine, interactions,
// save/continue, and the debug state the play-test drivers read (window.__vh).
// Top-down 2D open world in Velora Bay: Reno Karsa, Sari Lestari, Damar Wibowo.
import {
  WORLD, GARAGE, GARAGE_SLOTS, SHOP, HIDEOUT,
  POLICE_STATION, CLINIC, VEHICLES, WEAPONS, WEAPON_ORDER, MISSIONS,
  SPRAY_PRICE, PLAYER_HP, RACE_CHECKPOINTS,
} from './config.js';
import { mulberry32, dist } from './random.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCar, resetCarIds, stepCars, nearestCar } from './vehicles.js';
import { createPed, stepPeds, witnessCrime } from './pedestrians.js';
import { createPlayer, stepPlayer, switchWeapon } from './player.js';
import { playerShoot, startReload, stepWeapons } from './weapons.js';
import { createPolice } from './police.js';
import { createMissionState, startNext, stepMissions, failMission } from './missions.js';
import { updateHUD, drawFullMap, currentObjective } from './hud.js';
import { saveGame, hasSave, loadSave, applySave } from './save.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function el(id) { return document.getElementById(id); }

const G = {
  rng: mulberry32(seed),
  city: null, input: null, audio: createAudio(), renderer: null,
  player: null, cars: [], peds: [], enemies: [],
  mission: createMissionState(),
  wanted: 0, searching: false,
  mode: 'title',
  owned: [],
  errors: [],
  cam: { x: -214, z: 52 },
  view: { w: 1280, h: 720 },
  feedItems: [], prompt: '',
  holdup: null, card: null,
  tracers: [], muzzle: 0, shake: 0,
  shotIncidentT: 0,
  time: 0,
  hideout: HIDEOUT,
  raceCheckpoints: RACE_CHECKPOINTS,
  playerCar: null,
  police: null,
  objective: null,
};
window.__vh = G;
window.addEventListener('error', (e) => G.errors.push('window: ' + e.message));
window.addEventListener('unhandledrejection', (e) => G.errors.push('promise: ' + String(e.reason)));

G.feed = (msg) => {
  G.feedItems.push(msg);
  if (G.feedItems.length > 6) G.feedItems.shift();
};
G.gameOver = (kind) => gameOver(kind);

function setupWorld() {
  G.rng = mulberry32(seed);
  resetCarIds();
  G.city = buildCity(G.rng);
  G.player = createPlayer(G);
  G.cars = [];
  G.peds = [];
  G.enemies = [];
  G.mission = createMissionState();
  G.wanted = 0; G.searching = false;
  G.owned = [];
  G.holdup = null; G.card = null;
  G.tracers = [];
  G.playerCar = null;
  G.cam.x = G.player.x; G.cam.z = G.player.z;
  G.police = createPolice(G);
  attachCarMethods();

  // Mission cars.
  const gt = createCar('gt', 220, 132, Math.PI / 2, { parked: true, mission: 'M1', target: true });
  const van = createCar('van', -44, 220, 0, { parked: true, mission: 'M2', target: true });
  G.cars.push(gt, van);
  // Parked cars at the remaining spots (deterministic kinds).
  const kinds = ['sedan', 'sedan', 'truck', 'sedan', 'van', 'sedan', 'bike', 'sedan', 'truck', 'sedan', 'van', 'bike', 'sedan', 'truck'];
  const spots = G.city.parkedSpots.filter((s) => !(s.x === 220 && s.z === 132) && !(s.x === -44 && s.z === 220));
  spots.forEach((s, i) => {
    const kind = kinds[i % kinds.length];
    const angle = (i % 2 === 0 ? 0 : Math.PI / 2) + (i % 3 === 0 ? Math.PI : 0);
    G.cars.push(createCar(kind, s.x, s.z, angle, { parked: true }));
  });
  // The two spawn sedans the missions use.
  const spawnSedan = G.cars.find((c) => c.x === -220 && c.z === 44);
  if (spawnSedan) spawnSedan.kind = 'sedan';
  // Traffic.
  for (let i = 0; i < 14; i += 1) {
    const s = G.city.parkedSpots[i % G.city.parkedSpots.length];
    const street = WORLD.streets[i % WORLD.streets.length];
    const horiz = i % 2 === 0;
    const x = horiz ? street : s.x;
    const z = horiz ? s.z : street;
    const kind = ['sedan', 'sedan', 'van', 'truck', 'sedan', 'gt'][i % 6];
    const car = createCar(kind, x, z, horiz ? 0 : Math.PI / 2, { parked: false, driver: true });
    car.navAxis = horiz ? 'H' : 'V';
    car.navDir = i % 4 < 2 ? 1 : -1;
    car.navX = x + (horiz ? 88 * car.navDir : 0);
    car.navZ = z + (horiz ? 0 : 88 * car.navDir);
    car.speed = 8 + (i % 4);
    G.cars.push(car);
  }
  // Pedestrians on sidewalks.
  for (let i = 0; i < 28; i += 1) {
    const s = G.city.pedSpots[i % G.city.pedSpots.length];
    const ped = createPed(G, s.x, s.z);
    ped.targetX = s.x + (G.rng() - 0.5) * 120;
    ped.targetZ = s.z + (G.rng() - 0.5) * 120;
    G.peds.push(ped);
  }
}

function attachCarMethods() {
  const p = G.player;
  p.enterCar = (car) => {
    if (car.hp <= 0) return;
    if (car.driver) {
      // Carjack a moving car: the driver flees on foot.
      const d = createPed(G, car.x + 2, car.z);
      d.state = 'flee'; d.fleeT = 4;
      d.targetX = d.x + 40; d.targetZ = d.z + 40;
      G.peds.push(d);
      G.police.addWanted(1, 'carjacking');
      G.feed('You pulled the driver out!');
    } else if (car.parked) {
      // Stealing a parked car: witnessed = heat.
      const near = G.peds.some((ped) => ped.hp > 0 && dist(ped.x, ped.z, car.x, car.z) < 25 && !G.city.segBlocked(ped.x, ped.z, car.x, car.z));
      if (near) {
        witnessCrime(G, car.x, car.z, 'theft');
        G.police.addWanted(1, 'car theft');
      }
    }
    if (car.police) G.police.setWanted(3, 'stole a VBPD Interceptor');
    // Taking an owned garage car out removes its stored record.
    const oi = G.owned.findIndex((o) => o.carId === car.id);
    if (oi >= 0) G.owned.splice(oi, 1);
    car.parked = false;
    car.driver = false;
    car.wasDriven = true;
    p.inCar = car.id;
    G.playerCar = car;
    G.audio.click();
  };
  p.exitCar = () => {
    const car = G.playerCar;
    if (!car) return;
    p.inCar = null;
    G.playerCar = null;
    car.speed = 0;
    car.parked = true;
    car.driver = false;
    // Step out on the right side of the car.
    p.x = car.x - Math.sin(car.angle) * 3.5;
    p.z = car.z + Math.cos(car.angle) * 3.5;
    const fixed = G.city.resolveCircle(p.x, p.z, 0.7);
    p.x = fixed.x; p.z = fixed.z;
  };
}

function storeCar(G, car) {
  const slot = GARAGE_SLOTS.findIndex((_, i) => !G.owned.some((o) => o.slot === i));
  if (slot < 0) { G.feed('Garage is full (4 slots).'); return; }
  // The car stays in the world, parked at its slot (owned) — it can be
  // taken out again, and it is what respawns there after a reload.
  car.x = GARAGE_SLOTS[slot].x;
  car.z = GARAGE_SLOTS[slot].z;
  car.angle = 0;
  car.speed = 0;
  car.parked = true;
  car.driver = false;
  car.hp = car.maxHp;
  G.owned.push({ carId: car.id, kind: car.kind, slot });
  G.feed(`Stored ${VEHICLES[car.kind].name} in your garage (slot ${slot}).`);
  G.audio.chaChing();
}

function interact() {
  const p = G.player;
  if (p.inCar) { p.exitCar(); return; }
  const dGarage = dist(p.x, p.z, GARAGE.x, GARAGE.z);
  // 1. Hold-up at PelangiMart (M4 step 1, gun drawn).
  if (G.mission.active && G.mission.index === 3 && G.mission.step === 1
    && dist(p.x, p.z, SHOP.x, SHOP.z) < 16 && p.weapon !== 'fists' && !G.holdup) {
    G.holdup = { t: 8, total: 8 };
    G.feed('Hold-up! Keep the gun on the clerk…');
    return;
  }
  // 2. Spray garage: clear heat for cash, only when unseen.
  if (G.wanted > 0 && dGarage < 22 && !G.police.anyOfficerSees(p.x, p.z, 80)) {
    if (p.cash >= SPRAY_PRICE) {
      p.cash -= SPRAY_PRICE;
      G.police.clearWanted('Spray job done — heat cleared.');
    } else G.feed(`Spray costs $${SPRAY_PRICE} — not enough cash.`);
    return;
  }
  // 3. Store a car at the garage (never an owned car, never a police car).
  // Only between missions: during an active mission E must never be
  // stolen by a store when the player means to take a car.
  if (dGarage < 22 && !G.mission.active) {
    const car = nearestCar(G, p.x, p.z, 8, (c) => !c.police && !c.wrecked && (c.parked || c.wasDriven)
      && !G.owned.some((o) => o.carId === c.id));
    if (car) { storeCar(G, car); return; }
  }
  // 4. Start the next mission at the garage marker.
  if (dGarage < 20 && !G.mission.active && G.mission.index < MISSIONS.length) {
    startNext(G);
    return;
  }
  // 5. Enter the nearest car — parked cars first (a passing traffic car
  // must never steal the E press meant for the car beside you).
  const parked = nearestCar(G, p.x, p.z, 5, (c) => c.parked);
  if (parked) { p.enterCar(parked); return; }
  const car = nearestCar(G, p.x, p.z, 5);
  if (car) p.enterCar(car);
}

function computePrompt() {
  const p = G.player;
  if (p.inCar) return 'E — Exit car';
  const dGarage = dist(p.x, p.z, GARAGE.x, GARAGE.z);
  if (G.mission.active && G.mission.index === 3 && G.mission.step === 1
    && dist(p.x, p.z, SHOP.x, SHOP.z) < 16 && p.weapon !== 'fists') return 'E — Hold up the till';
  if (G.wanted > 0 && dGarage < 22 && !G.police.anyOfficerSees(p.x, p.z, 80)) return `E — Spray $${SPRAY_PRICE} (clear heat)`;
  if (dGarage < 22 && !G.mission.active) {
    const car = nearestCar(G, p.x, p.z, 8, (c) => !c.police && !c.wrecked && (c.parked || c.wasDriven)
      && !G.owned.some((o) => o.carId === c.id));
    if (car) return `E — Store ${VEHICLES[car.kind].name} in garage`;
  }
  if (dGarage < 20 && !G.mission.active && G.mission.index < MISSIONS.length) {
    return `E — Start ${MISSIONS[G.mission.index].id} ${MISSIONS[G.mission.index].title}`;
  }
  const parked = nearestCar(G, p.x, p.z, 5, (c) => c.parked);
  if (parked) return `E — ${'Steal'} the ${VEHICLES[parked.kind].name}`;
  const car = nearestCar(G, p.x, p.z, 5);
  if (car) return `E — Take the ${VEHICLES[car.kind].name}`;
  return '';
}

function showCard(title, body, button, onDone) {
  G.card = { title, body, button, onDone };
  G.mode = 'card';
}

function gameOver(kind) {
  const p = G.player;
  G.mission.active = false;
  G.holdup = null;
  if (kind === 'wasted') {
    p.cash = Math.max(0, p.cash - 150);
    p.x = CLINIC.x; p.z = CLINIC.z;
    showCard('WASTED', `Reno Karsa wakes up at the clinic, $150 lighter. The job is still waiting at Karsa Auto Works.`, 'Back to the city', () => { G.mode = 'play'; });
  } else {
    p.cash = Math.max(0, p.cash - 250);
    p.x = POLICE_STATION.x; p.z = POLICE_STATION.z;
    showCard('BUSTED', `VBPD books Reno Karsa, $250 lighter. The job is still waiting at Karsa Auto Works.`, 'Back to the city', () => { G.mode = 'play'; });
  }
  p.hp = PLAYER_HP;
  p.inCar = null;
  G.playerCar = null;
  G.wanted = 0;
  G.searching = false;
  G.cars = G.cars.filter((c) => !c.police);
  G.police.state.officers.length = 0;
  G.audio.stingBad();
}

function newGame() {
  setupWorld();
  G.feedItems = [];
  G.feed('Velora Bay, golden hour. Reno Karsa owes Damar Wibowo — time to work.');
  startNext(G);
}

function step(dt) {
  G.time += dt;
  if (G.mode === 'play') {
    if (G.input.press('KeyE')) interact();
    if (G.input.press('KeyR')) startReload(G);
    for (let i = 0; i < 4; i += 1) {
      if (G.input.press('Digit' + (i + 1))) switchWeapon(G, WEAPON_ORDER[i]);
    }
    const def = WEAPONS[G.player.weapon];
    const click = G.input.takeClick();
    if (G.player.weapon === 'fists') {
      if (click || G.input.mouse().down) playerShoot(G, true);
    } else {
      playerShoot(G, def.auto ? G.input.mouse().down : click);
    }
    stepPlayer(G, dt);
    stepCars(G, dt);
    stepPeds(G, dt);
    G.police.step(dt);
    stepWeapons(G, dt);
    stepMissions(G, dt);
    // Hold-up breaks if the player walks away or lowers the gun.
    if (G.holdup && (dist(G.player.x, G.player.z, SHOP.x, SHOP.z) > 20 || G.player.weapon === 'fists')) {
      G.holdup = null;
      G.feed('Hold-up aborted.');
    }
    // Mission target car destroyed = mission failed.
    if (G.mission.active && G.mission.index === 0) {
      const gt = G.cars.find((c) => c.mission === 'M1');
      if (gt && gt.hp <= 0) failMission(G, 'The Falco GT was destroyed.');
    }
    if (G.mission.active && G.mission.index === 1) {
      const van = G.cars.find((c) => c.mission === 'M2');
      if (van && van.hp <= 0) failMission(G, 'The Kuda Van was destroyed.');
    }
    for (let i = G.tracers.length - 1; i >= 0; i -= 1) {
      G.tracers[i].t -= dt;
      if (G.tracers[i].t <= 0) G.tracers.splice(i, 1);
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2);
  } else if (G.mode === 'title') {
    stepCars(G, dt);
    stepPeds(G, dt);
  }
  const pc = G.playerCar;
  const tx = pc ? pc.x : G.player.x, tz = pc ? pc.z : G.player.z;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
  G.cam.z += (tz - G.cam.z) * Math.min(1, dt * 6);
  G.objective = currentObjective(G);
  G.prompt = G.mode === 'play' ? computePrompt() : '';
}

function syncOverlays() {
  const show = (id, on) => el(id).classList.toggle('hidden', !on);
  show('title', G.mode === 'title');
  show('card', G.mode === 'card');
  show('pause', G.mode === 'pause');
  show('map', G.mode === 'map');
  show('ending', G.mode === 'ending');
  show('howto', G.mode === 'howto');
  el('btn-continue').disabled = !hasSave();
  if (G.mode === 'card' && G.card) {
    el('card-title').textContent = G.card.title;
    el('card-body').textContent = G.card.body;
    el('card-btn').textContent = G.card.button;
  }
  if (G.mode === 'map') drawFullMap(G);
}

function onKey(code) {
  if (code === 'KeyM') {
    if (G.mode === 'play') { G.mode = 'map'; G.audio.click(); }
    else if (G.mode === 'map') { G.mode = 'play'; G.audio.click(); }
  } else if (code === 'Escape') {
    if (G.mode === 'play') { G.mode = 'pause'; G.audio.click(); }
    else if (G.mode === 'pause') { G.mode = 'play'; G.audio.click(); }
    else if (G.mode === 'map') { G.mode = 'play'; G.audio.click(); }
  }
}

function bindButtons() {
  el('btn-new').addEventListener('click', () => { G.audio.unlock(); G.audio.startMusic(); newGame(); });
  el('btn-continue').addEventListener('click', () => {
    const data = loadSave();
    if (!data) return;
    setupWorld();
    applySave(G, data);
    G.feed('Welcome back to Velora Bay.');
    G.mode = 'play';
  });
  el('btn-howto').addEventListener('click', () => { G.mode = 'howto'; });
  el('btn-howto-close').addEventListener('click', () => { G.mode = 'title'; });
  el('card-btn').addEventListener('click', () => {
    const done = G.card && G.card.onDone;
    G.card = null;
    if (done) done();
    else G.mode = 'play';
  });
  el('btn-resume').addEventListener('click', () => { G.mode = 'play'; });
  el('btn-save').addEventListener('click', () => {
    const ok = saveGame(G);
    el('save-note').textContent = ok ? `Saved — $${G.player.cash}, mission ${MISSIONS[Math.min(G.mission.index, 5)].id}.` : 'Save failed (storage unavailable).';
  });
  el('btn-restart').addEventListener('click', () => {
    G.mission.active = false;
    G.wanted = 0; G.searching = false;
    G.cars = G.cars.filter((c) => !c.police);
    G.enemies.length = 0;
    G.player.x = GARAGE.x; G.player.z = GARAGE.z + 8;
    if (G.player.inCar) G.player.exitCar();
    G.mode = 'play';
    G.feed('Mission restarted — back at the garage.');
  });
  el('btn-quit').addEventListener('click', () => {
    setupWorld();
    G.mode = 'title';
  });
  el('btn-map-close').addEventListener('click', () => { G.mode = 'play'; });
  el('btn-ending').addEventListener('click', () => {
    G.mode = 'play';
    G.feed('Free roam — Velora Bay is yours.');
  });
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  G.view.w = canvas.width;
  G.view.h = canvas.height;
}

function runGame() {
  G.input = createInput(canvas, onKey);
  G.renderer = createRenderer(canvas);
  setupWorld();
  bindButtons();
  resize();
  window.addEventListener('resize', resize);
  statusEl.textContent = 'VELORA HEAT. New Game or Continue.';

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let n = 0;
    while (accumulator >= STEP && n < 8) {
      step(STEP);
      accumulator -= STEP;
      n += 1;
    }
    if (n === 8) accumulator = 0;
    G.renderer.draw(G, G.time);
    if (G.mode === 'play' || G.mode === 'map') updateHUD(G);
    syncOverlays();
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  G.input = createInput(canvas, () => {});
  G.renderer = createRenderer(canvas);
  setupWorld();
  resize();
  stageShot(G, name);
  G.objective = currentObjective(G);
  G.prompt = computePrompt();
  G.renderer.draw(G, 0);
  updateHUD(G);
  syncOverlays();
  let painted = 0;
  function paint() {
    G.renderer.draw(G, 0.5);
    updateHUD(G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
