// Sunset Heist: Caldera Bay — boot and the one loop.
// Input is read every frame; the world advances in fixed 1/60 s steps. Screens: title,
// play, pause, map (M), card (mission intro/complete/fail, WASTED/BUSTED, ending).
// ?shot=cover|foot|chase|combat&seed=1 stages a deterministic scene, paints it twice,
// and sets window.__shotReady for screenshots.
import * as THREE from 'three';
import { CITY, START_CASH, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { makeTextures } from './textures.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createWeapons } from './weapons.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const G = {
  seed, rng: createRandom(seed), scene: null, camera: null, renderer: null,
  screen: 'title', time: 0, frames: 0,
};

// --- Renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// ?lowfx=1 disables shadows for the automated play-test (SwiftShader is slow); the
// submitted game always runs with full shadows. Game logic is identical either way.
if (params.get('lowfx') === '1') renderer.shadowMap.enabled = false;
G.renderer = renderer;
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
G.camera = camera;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff9a4a);
scene.fog = new THREE.Fog(0xe8a06a, 180, 700);
G.scene = scene;
// Golden-hour sun + hemisphere fill.
const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
sun.position.set(180, 260, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 900;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a6a9a, 0x4a3428, 0.9));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Subsystems (in dependency order) ---------------------------------------
G.textures = makeTextures(G.rng);
G.audio = createAudio();
G.input = createInput(canvas);
buildCity(G);
G.vehicles = createVehicles(G);
G.peds = createPedestrians(G);
G.playerApi = createPlayer(G);
G.weapons = createWeapons(G);
G.police = createPolice(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.save = createSave(G);

// --- Screens ----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const screens = {
  title: $('title'), pause: $('pause'), card: $('card'),
  showCard(title, body, onDone) {
    $('card-title').textContent = title;
    $('card-body').textContent = body;
    screens.card.hidden = false;
    G.screen = 'card';
    $('btn-card').onclick = () => {
      screens.card.hidden = true;
      G.screen = 'play';
      if (onDone) onDone();
    };
    G.audio.sting('go');
  },
  showTitle() {
    G.screen = 'title';
    screens.title.hidden = false; screens.pause.hidden = true; screens.card.hidden = true;
    $('btn-continue').style.opacity = G.save.hasSave() ? '1' : '0.4';
    G.hud.showHud(false);
  },
  showPause() {
    G.screen = 'pause';
    screens.pause.hidden = false;
  },
  hidePause() { screens.pause.hidden = true; G.screen = 'play'; },
  toggleMap() {
    if (G.screen !== 'play' && G.screen !== 'map') return;
    if (G.screen === 'play') { G.screen = 'map'; $('mapwrap').hidden = false; }
    else { G.screen = 'play'; $('mapwrap').hidden = true; }
  },
};
G.screens = screens;

// M / Escape are handled SYNCHRONOUSLY in the DOM keydown handler, never via the
// fixed-step loop (a press between frames must toggle exactly once, at once).
G.input.onEdge('KeyM', () => screens.toggleMap());
G.input.onEdge('Escape', () => {
  if (G.screen === 'map') screens.toggleMap();
  else if (G.screen === 'play') screens.showPause();
  else if (G.screen === 'pause') screens.hidePause();
});

// --- World setup ------------------------------------------------------------
function spawnWorld() {
  G.peds.populate();
  const r = G.rng;
  // Parked cars across the districts, on street edges.
  const parkedSpots = [
    ['sedan', -240, 69, 0], ['sedan', -228, 60, Math.PI], ['truck', -120, -51, Math.PI / 2],
    ['van', 60, -111, 0], ['sedan', 120, 51, Math.PI], ['bike', 240, -51, Math.PI / 2],
    ['gt', 0, 129, 0], ['sedan', -60, 249, Math.PI], ['truck', 180, 231, Math.PI / 2],
    ['sedan', 300, 129, 0], ['van', -300, -231, Math.PI], ['bike', 60, 351, 0],
    ['sedan', -180, -129, Math.PI / 2], ['gt', 360, 249, Math.PI], ['sedan', 120, -249, 0],
    ['van', -360, 171, Math.PI / 2],
  ];
  for (const [v, x, z, h] of parkedSpots) G.vehicles.spawn(v, x, z, h, { parked: true });
  // Traffic: 14 AI cars on the grid.
  for (let i = 0; i < 14; i++) {
    const s = CITY.streets[Math.floor(r.next() * CITY.streets.length)];
    const along = r.range(-390, 390);
    const x = r.chance(0.5) ? s : along;
    const z = r.chance(0.5) ? along : s;
    const variant = ['sedan', 'sedan', 'sedan', 'van', 'truck', 'gt'][Math.floor(r.next() * 6)];
    const car = G.vehicles.spawn(variant, x, z, r.next() * Math.PI * 2, { traffic: true, parked: false });
    car.speed = 8 + r.next() * 5;
  }
  // The CBPD Interceptor parked at the station (stealing it is instant 3 stars).
  G.vehicles.spawn('pursuit', 360, -60, Math.PI / 2, { parked: true });
}

function startNewGame() {
  spawnWorld();
  G.playerApi.place(CITY.points.spawn.x, CITY.points.spawn.z, 0);
  G.player.cash = START_CASH;
  G.player.hp = 100;
  screens.title.hidden = true;
  G.hud.showHud(true);
  G.screen = 'play';
  G.audio.unlock();
  G.audio.startMusic();
  G.hud.feed('New game — Milo Voss, Caldera Bay. M1 starts at Sorren Motors.');
  G.missions.start();
  announce('Playing. Mission 1: First Wheels.');
}

function continueGame() {
  const data = G.save.read();
  if (!data) { startNewGame(); return; }
  spawnWorld();
  G.save.apply(data);
  screens.title.hidden = true;
  G.hud.showHud(true);
  G.screen = 'play';
  G.audio.unlock();
  G.audio.startMusic();
  G.hud.setObjective(`Next job: ${MISSIONS[G.missions.state.index]?.title || 'free roam'} — start at Sorren Motors.`);
  announce('Continuing.');
}

$('btn-new').onclick = () => { G.audio.unlock(); startNewGame(); };
$('btn-continue').onclick = () => { G.audio.unlock(); continueGame(); };
$('btn-how').onclick = () => { $('how').hidden = !$('how').hidden; G.audio.click(); };
$('btn-resume').onclick = () => { screens.hidePause(); G.audio.click(); };
$('btn-save').onclick = () => { G.save.write(); G.hud.feed('Game saved.'); G.audio.chaChing(); };
$('btn-restart-mission').onclick = () => {
  G.missions.state.active = false; G.missions.state.stepIdx = 0;
  screens.hidePause(); G.hud.feed('Mission reset — start it again at Sorren Motors.');
};
$('btn-quit').onclick = () => { G.save.write(); screens.showTitle(); };

function announce(msg) { statusEl.textContent = msg; }

// --- Test interface ---------------------------------------------------------
// Read-only state for the automated play-test (no teleport, no cheats).
window.__CB = {
  booted: false,
  state() {
    const P = G.player;
    const m = G.missions.current();
    const car = P.car;
    return {
      screen: G.screen, time: G.time, frames: G.frames,
      cash: P.cash, hp: Math.round(P.hp), wanted: G.police.wanted, searching: G.police.searching,
      x: Math.round(P.x * 10) / 10, z: Math.round(P.z * 10) / 10, y: Math.round(P.y * 100) / 100,
      inCar: P.inCar, carVariant: car ? car.variant : null,
      carHp: car ? Math.round(car.hp) : null, carSpeed: car ? Math.round(car.speed * 10) / 10 : null,
      heading: Math.round(P.heading * 100) / 100, camYaw: Math.round(P.camYaw * 100) / 100,
      weapon: P.weapon, ammo: P.weapons[P.weapon]?.ammo ?? null,
      missionId: m ? m.def.id : null, missionActive: m ? m.active : false,
      stepIdx: m ? m.stepIdx : null, stepLabel: m && m.step ? m.step.label : null,
      objective: (() => { const o = document.getElementById('objective'); return o && !o.hidden ? o.textContent : null; })(),
      timer: m ? Math.round(G.missions.state.timer) : null,
      owned: P.owned.map((o) => o.variant), completed: [...P.completed],
      prompt: G.playerApi.interactTarget()?.label ?? null,
      interactCalls: P.interactCalls,
      crimeLog: G.police.crimeLog.slice(-12),
      shardsTaken: G.city.shards.filter((s) => s.taken).length,
      enemies: G.weapons.enemies.map((e) => ({ x: Math.round(e.x), z: Math.round(e.z), hp: Math.round(e.hp) })),
      racers: G.missions.state.racers.map((r) => ({ cp: r.cp, finished: r.finished, x: Math.round(r.car.x), z: Math.round(r.car.z) })),
      raceCp: G.missions.state.raceCp,
      clerk: G.missions.state.clerk ? { x: Math.round(G.missions.state.clerk.x), z: Math.round(G.missions.state.clerk.z) } : null,
      targetCar: G.missions.state.targetCar ? { x: Math.round(G.missions.state.targetCar.x), z: Math.round(G.missions.state.targetCar.z), id: G.missions.state.targetCar.id } : null,
      pursuit: G.police.units.map((u) => ({ x: Math.round(u.x), z: Math.round(u.z) })),
      waveLeft: G.missions.state.waveLeft, wave: G.missions.state.wave,
      errors: G.errors || 0,
    };
  },
  roadReport() { return G.city.roadReport(); },
  reachability() { return G.city.reachability(); },
};

// --- The loop ----------------------------------------------------------------
let accumulator = 0, last = performance.now();
G.errors = 0;
window.addEventListener('error', () => { G.errors++; });

function stepWorld(dt) {
  G.time += dt;
  // Sun-coin pickup.
  const P = G.player;
  for (const s of G.city.shards) {
    if (!s.taken && Math.hypot(P.x - s.x, P.z - s.z) < 3) {
      s.taken = true; s.mesh.visible = false;
      P.cash += 25; G.audio.chaChing();
      G.hud.feed('Sun coin +$25.');
    }
    if (!s.taken) { s.mesh.rotation.z += dt * 1.5; }
  }
  // E / digits / R are gameplay edges: safe to consume in the loop.
  for (const code of G.input.takeEdges()) {
    if (code === 'KeyE') G.playerApi.doInteract();
    else if (code === 'Digit1') G.weapons.switchTo('fists');
    else if (code === 'Digit2') G.weapons.switchTo('pistol');
    else if (code === 'Digit3') G.weapons.switchTo('smg');
    else if (code === 'Digit4') G.weapons.switchTo('shotgun');
  }
  const wheel = G.input.takeWheel();
  if (wheel !== 0) G.weapons.cycle(wheel > 0 ? 1 : -1);
  G.playerApi.update(dt);
  G.vehicles.update(dt, G.input);
  G.peds.update(dt);
  G.weapons.update(dt);
  G.police.update(dt);
  G.missions.update(dt);
  G.hud.update(dt);
  G.audio.setEngine(P.inCar && P.car ? Math.abs(P.car.speed) / (P.car.def.top || 1) : 0, !!P.inCar);
}

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (G.screen === 'play') {
    let n = 0;
    while (accumulator >= STEP && n < 8) { stepWorld(STEP); accumulator -= STEP; n++; }
    if (n === 8) accumulator = 0;
  } else {
    accumulator = 0;
    // Title screen: slow ambient orbit so the city reads behind the menu.
    if (G.screen === 'title') {
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 260, 150, Math.cos(t * 0.05) * 260);
      camera.lookAt(0, 0, 0);
    }
  }
  G.frames++;
  renderer.render(scene, camera);
  if (!window.__CB.booted) window.__CB.booted = true;
}

if (shotName) {
  // Staged deterministic screenshot scene: paint twice, then signal readiness.
  spawnWorld();
  stageShot(G, shotName);
  G.hud.showHud(true);
  let painted = 0;
  (function paint() {
    G.hud.update(0);
    renderer.render(scene, camera);
    painted++;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  screens.showTitle();
  announce('Sunset Heist: Caldera Bay. New Game or Continue.');
  requestAnimationFrame(frame);
}
