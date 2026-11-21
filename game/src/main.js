// VELORA HEAT — boot, fixed-step loop, top-down 2D rendering, screen state
// machine (title / play / pause / map / card / shop / wasted / busted / ending).
// ?shot=cover|foot|chase|combat&seed=1 stages a deterministic screenshot scene.
import { STEP, POINTS, COINS, SHOPS, DISTRICTS, districtAt, MISSIONS, GARAGE_SLOTS } from './config.js';
import { createRandom, dist, clamp } from './random.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createPolice } from './police.js';
import { createMission } from './missions.js';
import { createSave } from './save.js';
import { newPlayerState, updatePlayer, tryInteract, updateHoldup } from './player.js';
import { spawnWorldCars, updateCars, playerCar, nearestCar, nearestStorableCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { switchWeapon, tryFire, updateWeapons, updateEnemies, reloadWeapon } from './weapons.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const ZOOM = 14; // px per metre
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- game state ------------------------------------------------------------
const G = {
  mode: 'title', time: 0, seed, rng: createRandom(seed),
  city: null, player: newPlayerState(),
  cars: [], peds: [], enemies: [],
  wanted: 0, searching: false, unseenT: 0, lastSeen: { x: 0, z: 0 },
  crimeCooldown: 0, gunfireT: 0, muzzle: 0, meleeFlash: 0,
  tracers: [], particles: [], shake: 0,
  owned: [], coinsTaken: new Set(), flags: {},
  events: { busted: false, wasted: false },
  aim: { x: 0, z: 0 }, cam: { x: 0, z: 0 },
  holdup: null, input: null, audio: null, hud: null, police: null, mission: null, save: null,
  errors: [], stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0 },
};
window.__vh = G; // debug / test handle (read-only use by the play-test driver)

G.city = createCity(G.rng);
G.audio = createAudio();
G.hud = createHud(G);
G.police = createPolice(G);
G.mission = createMission(G);
G.save = createSave(G);
G.input = createInput(canvas, {
  onMap: () => {
    if (G.mode === 'play') { G.mode = 'map'; document.getElementById('mapov').classList.remove('hidden'); G.hud.drawBigMap(); }
    else if (G.mode === 'map') { G.mode = 'play'; document.getElementById('mapov').classList.add('hidden'); }
  },
  onEscape: () => {
    if (G.mode === 'play') { G.mode = 'pause'; document.getElementById('pause').classList.remove('hidden'); }
    else if (G.mode === 'pause') { G.mode = 'play'; document.getElementById('pause').classList.add('hidden'); }
    else if (G.mode === 'map') { G.mode = 'play'; document.getElementById('mapov').classList.add('hidden'); }
    else if (G.mode === 'shop') { document.getElementById('shopov').classList.add('hidden'); G.mode = 'play'; }
  },
  onInteract: () => { if (G.mode === 'play') { G.audio.unlock(); tryInteract(G); } },
  onReload: () => { if (G.mode === 'play') reloadWeapon(G); },
  onWeapon: (i) => { if (G.mode === 'play') switchWeapon(G, i); },
});
window.addEventListener('error', (e) => { G.errors.push(String(e.message || e.error)); });
window.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });

spawnWorldCars(G, G.rng);
spawnPeds(G, G.rng, 30);

// ---- screens ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function showTitle() {
  G.mode = 'title';
  $('title').classList.remove('hidden');
  $('pause').classList.add('hidden');
  $('mapov').classList.add('hidden');
  $('over').classList.add('hidden');
  $('ending').classList.add('hidden');
  $('card').classList.add('hidden');
  G.hud.showHud(false);
  $('btn-continue').classList.toggle('hidden', !G.save.hasSave());
}
function resetWorld() {
  G.rng = createRandom(seed);
  G.city = createCity(G.rng);
  G.player = newPlayerState();
  G.cars = []; G.peds = []; G.enemies = [];
  G.wanted = 0; G.searching = false; G.unseenT = 0;
  G.crimeCooldown = 0; G.gunfireT = 0; G.tracers = []; G.particles = [];
  G.owned = []; G.coinsTaken = new Set(); G.flags = {};
  G.events.busted = false; G.events.wasted = false;
  G.holdup = null; G.time = 0;
  G.mission.index = 0; G.mission.active = false; G.mission.step = 0;
  G.mission.completed = [false, false, false, false, false, false];
  spawnWorldCars(G, G.rng);
  spawnPeds(G, G.rng, 30);
}
function newGame() {
  resetWorld();
  G.audio.unlock();
  $('title').classList.add('hidden');
  G.hud.showHud(true);
  G.mode = 'play';
  G.hud.feed('Sari: "Reno. Falco GT, Marina Azul. Don\'t get seen."', 'good');
  G.mission.startNext(); // M1 auto-starts; the card pauses the game until closed
}
function continueGame() {
  resetWorld();
  if (!G.save.load()) { G.hud.toast('No save found.'); return; }
  $('title').classList.add('hidden');
  G.hud.showHud(true);
  G.mode = 'play';
  G.hud.feed('Welcome back to Velora Bay.', 'good');
  G.hud.updateStars();
}
$('btn-new').addEventListener('click', () => { G.audio.unlock(); newGame(); });
$('btn-continue').addEventListener('click', () => { G.audio.unlock(); continueGame(); });
$('btn-how').addEventListener('click', () => { $('howto').classList.toggle('hidden'); $('credits').classList.add('hidden'); });
$('btn-credits').addEventListener('click', () => { $('credits').classList.toggle('hidden'); $('howto').classList.add('hidden'); });
$('btn-resume').addEventListener('click', () => { G.mode = 'play'; $('pause').classList.add('hidden'); });
$('btn-save').addEventListener('click', () => {
  const ok = G.save.save();
  $('save-note').textContent = ok ? 'Saved. Continue is available on the title screen.' : 'Save failed (storage unavailable).';
});
$('btn-restart-mission').addEventListener('click', () => {
  $('pause').classList.add('hidden');
  G.mission.active = false;
  G.mode = 'play';
  G.mission.startNext();
});
$('btn-quit').addEventListener('click', () => { $('pause').classList.add('hidden'); showTitle(); });
$('btn-retry').addEventListener('click', () => {
  $('over').classList.add('hidden');
  const p = G.player;
  p.hp = p.maxHp; p.inCar = null;
  if (G.events.busted) { p.x = POINTS.station.x; p.z = POINTS.station.z + 20; p.cash = Math.max(0, p.cash - 250); }
  else { p.x = POINTS.casa.x; p.z = POINTS.casa.z; p.cash = Math.max(0, p.cash - 150); }
  G.wanted = 0; G.searching = false; G.unseenT = 0;
  G.cars = G.cars.filter((c) => c.driver !== 'police');
  G.police.officers.length = 0;
  G.events.busted = false; G.events.wasted = false;
  if (G.mission.active) { G.mission.active = false; }
  G.mode = 'play';
  G.hud.feed('Back on the streets of Velora Bay.', 'good');
});
$('btn-over-title').addEventListener('click', () => { $('over').classList.add('hidden'); showTitle(); });
$('btn-ending').addEventListener('click', () => { $('ending').classList.add('hidden'); G.mode = 'play'; });

// ---- per-frame update ------------------------------------------------------
function updateAim() {
  const r = canvas.getBoundingClientRect();
  const sx = G.input.mouse.x * (canvas.width / r.width);
  const sy = G.input.mouse.y * (canvas.height / r.height);
  G.aim.x = G.cam.x + (sx - canvas.width / 2) / ZOOM;
  G.aim.z = G.cam.z + (sy - canvas.height / 2) / ZOOM;
}
function step(dt) {
  G.time += dt;
  if (G.crimeCooldown > 0) G.crimeCooldown -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2);
  updateAim();
  // Firing: hold for auto weapons, click edge for the rest. A quick click's
  // mouseup can land before the next fixed step, so the edge alone must fire
  // a semi-auto weapon — never require mouse.down to still be held for it.
  if (G.mode === 'play') {
    const clicked = G.input.takeClick();
    const w = G.player.weapons[G.player.weapon];
    if ((w.auto && G.input.mouse.down) || clicked) tryFire(G);
  } else G.input.takeClick();
  if (G.mode === 'play' || G.mode === 'title') {
    updatePlayer(G, dt);
    updateCars(G, dt);
    updatePeds(G, dt);
    updateWeapons(G, dt);
    updateEnemies(G, dt);
    updateHoldup(G, dt);
    if (G.mode === 'play') {
      G.mission.update(dt);
      G.police.update(dt);
      collectCoins();
      updatePrompt();
      checkDeath();
    }
  }
  // Audio follows the world.
  const pc = playerCar(G);
  G.audio.engine(pc ? Math.abs(pc.speed) / 34 : 0, !!pc);
  G.audio.siren(G.wanted > 0, dt);
}
function collectCoins() {
  const p = G.player;
  const pc = playerCar(G);
  const x = pc ? pc.x : p.x, z = pc ? pc.z : p.z;
  COINS.forEach((c, i) => {
    if (G.coinsTaken.has(i)) return;
    if (dist(x, z, c.x, c.z) < 2.6) {
      G.coinsTaken.add(i);
      p.cash += 25;
      G.audio.chaChing();
      G.hud.toast('Sun coin +$25');
    }
  });
}
function updatePrompt() {
  const p = G.player;
  if (p.inCar != null) { G.hud.setPrompt('<b>E</b> — Exit car'); return; }
  const dGarage = dist(p.x, p.z, POINTS.garage.x, POINTS.garage.z);
  const car = nearestCar(G, p.x, p.z, 5);
  if (car) {
    const isOwned = G.owned.some((o) => o.carId === car.id);
    const missionWaiting = dGarage < 20 && G.mission.index < 6 && !G.mission.active;
    if (isOwned && missionWaiting) {
      const d = MISSIONS[G.mission.index];
      G.hud.setPrompt(`<b>E</b> — Start ${d.id} ${d.title}`);
      return;
    }
    const freshAtGarage = dGarage < 20 && !isOwned;
    if (freshAtGarage && car.kind !== 'police' && !car.target) { G.hud.setPrompt(`<b>E</b> — Store the ${car.name} in your garage`); return; }
    const tag = car.target ? ' ★' : '';
    const verb = car.parked || car.driver === 'traffic' ? 'Steal' : 'Enter';
    G.hud.setPrompt(`<b>E</b> — ${verb} the ${car.name}${tag}`);
    return;
  }
  if (dGarage < 20) {
    const storable = nearestStorableCar(G, p.x, p.z, 8);
    if (storable) { G.hud.setPrompt(`<b>E</b> — Store the ${storable.name} in your garage`); return; }
    if (G.wanted > 0 && !G.police.anySeesPlayer() && p.cash >= 300) { G.hud.setPrompt('<b>E</b> — Spray garage ($300) — clear your heat'); return; }
    if (G.mission.index < 6 && !G.mission.active) { const d = MISSIONS[G.mission.index]; G.hud.setPrompt(`<b>E</b> — Start ${d.id} ${d.title}`); return; }
  }
  for (const s of SHOPS) {
    if (dist(p.x, p.z, s.x, s.z) < s.r) {
      if (s.kind === 'rob') { G.hud.setPrompt('<b>E</b> — Rob PelangiMart (aim your weapon, 8s)'); return; }
      G.hud.setPrompt(`<b>E</b> — Enter ${s.name}`);
      return;
    }
  }
  G.hud.setPrompt(null);
}
function checkDeath() {
  const p = G.player;
  if (p.hp <= 0 && !G.events.wasted) {
    G.events.wasted = true;
    if (G.mission.active) G.mission.active = false;
    G.mode = 'wasted';
    $('over-title').textContent = 'WASTED';
    $('over-text').textContent = 'Reno wakes up at Casa Biru, $150 lighter. The job is still waiting.';
    $('over').classList.remove('hidden');
    G.audio.stingBad();
  }
  if (G.events.busted) {
    G.events.busted = false;
    if (G.mission.active) G.mission.active = false;
    G.mode = 'busted';
    $('over-title').textContent = 'BUSTED';
    $('over-text').textContent = 'VBPD takes Reno in. $250 bail, and the job is still waiting.';
    $('over').classList.remove('hidden');
    G.audio.busted();
  }
}

// ---- top-down rendering ----------------------------------------------------
function draw() {
  const W = canvas.width, H = canvas.height;
  const p = G.player;
  const pc = playerCar(G);
  const fx = pc ? pc.x : p.x, fz = pc ? pc.z : p.z;
  if (G.mode === 'title') {
    G.cam.x = Math.sin(G.time * 0.05) * 120;
    G.cam.z = Math.cos(G.time * 0.04) * 120;
  } else {
    G.cam.x += (fx - G.cam.x) * 0.12;
    G.cam.z += (fz - G.cam.z) * 0.12;
  }
  const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 22 : 0;
  const shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 22 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14100c';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-G.cam.x, -G.cam.z);
  const vx0 = G.cam.x - W / 2 / ZOOM - 4, vx1 = G.cam.x + W / 2 / ZOOM + 4;
  const vz0 = G.cam.z - H / 2 / ZOOM - 4, vz1 = G.cam.z + H / 2 / ZOOM + 4;
  drawGround(vx0, vz0, vx1, vz1);
  drawStreets(vx0, vz0, vx1, vz1);
  drawBuildings(vx0, vz0, vx1, vz1);
  drawLandmarks();
  drawCoins();
  drawObjectiveBeacon();
  drawRaceCps();
  for (const c of G.cars) drawCar(c);
  for (const ped of G.peds) drawPed(ped);
  for (const e of G.enemies) drawEnemy(e);
  for (const o of G.police.officers) drawOfficer(o);
  drawPlayer();
  drawTracers();
  drawParticles();
  ctx.restore();
  if (G.mode === 'play' || G.mode === 'pause' || G.mode === 'map' || G.mode === 'card') {
    G.hud.updateVitals();
    G.hud.updateObjective();
    G.hud.drawMinimap();
  }
  if (G.mode === 'map') G.hud.drawBigMap();
}
function inView(x, z, vx0, vz0, vx1, vz1, m = 10) {
  return x > vx0 - m && x < vx1 + m && z > vz0 - m && z < vz1 + m;
}
function drawGround(vx0, vz0, vx1, vz1) {
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(vx0, vz0, vx1 - vx0, vz1 - vz0);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(Math.max(d.x0, vx0), Math.max(d.z0, vz0), Math.min(d.x1, vx1) - Math.max(d.x0, vx0), Math.min(d.z1, vz1) - Math.max(d.z0, vz0));
  }
}
function drawStreets(vx0, vz0, vx1, vz1) {
  ctx.fillStyle = '#33363e';
  for (let i = 0; i <= 7; i++) {
    const s = -308 + i * 88;
    if (s > vz0 - 9 && s < vz1 + 9) ctx.fillRect(vx0, s - 9, vx1 - vx0, 18);
    if (s > vx0 - 9 && s < vx1 + 9) ctx.fillRect(s - 9, vz0, 18, vz1 - vz0);
  }
  // Centre dashes (golden-hour roads).
  ctx.fillStyle = '#c9a13d';
  for (let i = 0; i <= 7; i++) {
    const s = -308 + i * 88;
    for (let t = -308; t < 308; t += 12) {
      if (t > vz0 && t < vz1) ctx.fillRect(s - 0.3, t, 0.6, 5);
      if (t > vx0 && t < vx1) ctx.fillRect(t, s - 0.3, 5, 0.6);
    }
  }
  // Sidewalk edge lines.
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 0.4;
  for (let i = 0; i <= 7; i++) {
    const s = -308 + i * 88;
    ctx.beginPath(); ctx.moveTo(vx0, s - 9); ctx.lineTo(vx1, s - 9); ctx.moveTo(vx0, s + 9); ctx.lineTo(vx1, s + 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s - 9, vz0); ctx.lineTo(s - 9, vz1); ctx.moveTo(s + 9, vz0); ctx.lineTo(s + 9, vz1); ctx.stroke();
  }
}
function drawBuildings(vx0, vz0, vx1, vz1) {
  for (const b of G.city.buildings) {
    if (!inView((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, vx0, vz0, vx1, vz1, 30)) continue;
    // Golden-hour shadow to the north-east.
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(b.x0 + 1.2, b.z0 + 1.2, b.x1 - b.x0, b.z1 - b.z0);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(b.x0 + 1, b.z0 + 1, b.x1 - b.x0 - 2, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(b.x0 + 2, b.z0 + 2, 3, 3);
    ctx.fillRect(b.x1 - 5, b.z1 - 5, 3, 3);
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 2.6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 + 1);
    }
  }
  // Palms + lamps (visual).
  for (const pr of G.city.props) {
    if (!inView(pr.x, pr.z, vx0, vz0, vx1, vz1, 4)) continue;
    if (pr.kind === 'palm') {
      ctx.fillStyle = '#2f7a3d';
      ctx.beginPath(); ctx.arc(pr.x, pr.z, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5c3e'; ctx.fillRect(pr.x - 0.3, pr.z - 0.3, 0.6, 0.6);
    } else {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(pr.x, pr.z, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawLandmarks() {
  // Garage slots + big V.
  ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 0.5;
  for (const s of GARAGE_SLOTS) ctx.strokeRect(s.x - 2.4, s.z - 1.4, 4.8, 2.8);
  ctx.fillStyle = '#7dff9a';
  ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('V', POINTS.garage.x, POINTS.garage.z - 3);
  // Hideouts.
  for (const h of [POINTS.hideout1, POINTS.hideout2]) {
    ctx.strokeStyle = '#c59bff'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(h.x, h.z, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c59bff'; ctx.font = 'bold 4px sans-serif';
    ctx.fillText('H', h.x, h.z - 15);
  }
  // Shops.
  for (const s of SHOPS) {
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.z, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 2.8px sans-serif';
    ctx.fillText(s.name.toUpperCase(), s.x, s.z - 4);
  }
}
function drawCoins() {
  COINS.forEach((c, i) => {
    if (G.coinsTaken.has(i)) return;
    const bob = Math.sin(G.time * 3 + i) * 0.3;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(c.x, c.z + bob, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b3541e'; ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.arc(c.x, c.z + bob, 1.1, 0, Math.PI * 2); ctx.stroke();
  });
}
function drawObjectiveBeacon() {
  const obj = objectivePoint();
  if (!obj) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(obj.x, obj.z, 6 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffcf5c';
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.z - 9); ctx.lineTo(obj.x + 4, obj.z - 3); ctx.lineTo(obj.x, obj.z + 1); ctx.lineTo(obj.x - 4, obj.z - 3);
  ctx.closePath(); ctx.fill();
}
function objectivePoint() {
  if (G.mission.active) {
    const s = G.mission.stepDef();
    if (!s) return null;
    if (s.t === 'race') return G.mission.raceCps ? G.mission.raceCps[G.mission.playerCp] : null;
    if (s.x != null) return { x: s.x, z: s.z };
    if (s.t === 'steal') return { x: 220, z: 132 };
    if (s.t === 'enter') return { x: -44, z: 220 };
    if (s.t === 'defend') return { x: POINTS.garage.x, z: POINTS.garage.z };
    return null;
  }
  if (G.mission.index < 6) return { x: POINTS.garage.x, z: POINTS.garage.z };
  return null;
}
function drawRaceCps() {
  if (!G.mission.active || !G.mission.raceCps) return;
  const s = G.mission.stepDef();
  if (!s || s.t !== 'race') return;
  G.mission.raceCps.forEach((cp, i) => {
    const done = i < G.mission.playerCp;
    const next = i === G.mission.playerCp;
    ctx.fillStyle = done ? 'rgba(125,255,154,.5)' : next ? '#ffcf5c' : 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.arc(cp.x, cp.z, next ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    if (next) {
      ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(cp.x, cp.z, 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#111'; ctx.font = 'bold 3px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), cp.x, cp.z + 1);
  });
}
function drawCar(c) {
  const v = { len: 4.4, wid: 2.0 };
  const spec = { sedan: [4.4, 2.0], gt: [4.2, 1.9], truck: [5.6, 2.3], van: [5.0, 2.2], bike: [2.4, 0.9], police: [4.6, 2.0] }[c.kind] || [4.4, 2.0];
  const L = spec[0], Wd = spec[1];
  ctx.save();
  ctx.translate(c.x, c.z);
  ctx.rotate(c.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-L / 2 + 0.5, -Wd / 2 + 0.5, L, Wd);
  // Mission-target ring.
  if (c.target) {
    ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.arc(0, 0, L * 0.75, 0, Math.PI * 2); ctx.stroke();
  }
  // Body.
  ctx.fillStyle = c.hp <= 0 ? '#3a3a3a' : c.color;
  roundRect(-L / 2, -Wd / 2, L, Wd, 0.7);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(180,220,255,.85)';
  ctx.fillRect(L * 0.18, -Wd / 2 + 0.25, L * 0.16, Wd - 0.5);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(-L * 0.1, -Wd / 2 + 0.3, L * 0.28, Wd - 0.6);
  // Headlights.
  if (c.driver === 'player' || c.driver === 'traffic' || c.driver === 'police') {
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(L / 2 - 0.15, -Wd / 2 + 0.2, 0.15, 0.4);
    ctx.fillRect(L / 2 - 0.15, Wd / 2 - 0.6, 0.15, 0.4);
  }
  // Brake lights.
  if (c.brakeLight) {
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-L / 2, -Wd / 2 + 0.2, 0.15, 0.4);
    ctx.fillRect(-L / 2, Wd / 2 - 0.6, 0.15, 0.4);
  }
  // Police light bar (flashing).
  if (c.kind === 'police') {
    const on = Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-0.4, -Wd / 2 + 0.3, 0.8, Wd - 0.6);
  }
  // Damage smoke.
  if (c.smoke) {
    ctx.fillStyle = 'rgba(120,120,120,.6)';
    ctx.beginPath(); ctx.arc(-L * 0.2, 0, 0.8 + Math.sin(G.time * 9) * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Health bar for the player's car.
  if (c.driver === 'player' && c.hp < c.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(c.x - 3, c.z - 4, 6, 0.8);
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(c.x - 3, c.z - 4, 6 * (c.hp / c.maxHp), 0.8);
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawPed(ped) {
  if (ped.hp <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.z, 1.1, 0.6, ped.angle, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.arc(ped.x + 0.4, ped.z + 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(ped.x, ped.z, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 0.2, ped.z + Math.sin(ped.angle) * 0.2, 0.35, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'call') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 2.4px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.z - 1.6);
  }
  if (ped.state === 'cower') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 2.2px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('…', ped.x, ped.z - 1.6);
  }
}
function drawEnemy(e) {
  if (e.hp <= 0) return;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(e.x + 0.4, e.z + 0.4, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a1e2b';
  ctx.beginPath(); ctx.arc(e.x, e.z, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(e.x, e.z, 0.4, 0, Math.PI * 2); ctx.fill();
  // Gun barrel.
  ctx.strokeStyle = '#222'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(e.x, e.z); ctx.lineTo(e.x + Math.cos(e.angle) * 1.6, e.z + Math.sin(e.angle) * 1.6); ctx.stroke();
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(e.x - 1.6, e.z - 2, 3.2, 0.5);
  ctx.fillStyle = '#ff5c5c';
  ctx.fillRect(e.x - 1.6, e.z - 2, 3.2 * (e.hp / 60), 0.5);
}
function drawOfficer(o) {
  if (o.hp <= 0) return;
  ctx.fillStyle = '#1e2b4a';
  ctx.beginPath(); ctx.arc(o.x, o.z, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8c49a';
  ctx.beginPath(); ctx.arc(o.x, o.z, 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e2b4a';
  ctx.fillRect(o.x - 0.4, o.z - 0.7, 0.8, 0.35);
}
function drawPlayer() {
  const p = G.player;
  if (p.inCar != null) return;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(p.x + 0.4, p.z + 0.4, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff9a3c';
  ctx.beginPath(); ctx.arc(p.x, p.z, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 0.2, p.z + Math.sin(p.angle) * 0.2, 0.38, 0, Math.PI * 2); ctx.fill();
  // Gun barrel + muzzle flash.
  if (p.weapon > 0) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(p.x, p.z);
    ctx.lineTo(p.x + Math.cos(p.angle) * 1.7, p.z + Math.sin(p.angle) * 1.7); ctx.stroke();
    if (G.muzzle > 0) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 2, p.z + Math.sin(p.angle) * 2, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (G.meleeFlash > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(p.x, p.z, 2.2, p.angle - 1, p.angle + 1); ctx.stroke();
  }
}
function drawTracers() {
  for (const t of G.tracers) {
    ctx.strokeStyle = t.enemy ? 'rgba(255,120,90,.9)' : 'rgba(255,240,160,.95)';
    ctx.lineWidth = 0.28;
    ctx.beginPath(); ctx.moveTo(t.x1, t.z1); ctx.lineTo(t.x2, t.z2); ctx.stroke();
  }
}
function drawParticles() {
  for (const pt of G.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.t / 0.3);
    ctx.beginPath(); ctx.arc(pt.x, pt.z, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---- main loop ---------------------------------------------------------------
let accumulator = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (G.mode === 'play' || G.mode === 'title' || G.mode === 'map') {
    while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
  } else accumulator = 0;
  draw();
  if (G.mode === 'card' || G.mode === 'pause' || G.mode === 'shop' || G.mode === 'wasted' || G.mode === 'busted' || G.mode === 'ending') {
    // Keep the world painted behind overlays; sim is paused.
  }
  for (const pt of G.particles) pt.t -= 1 / 60;
  G.particles = G.particles.filter((pt) => pt.t > 0);
}

if (shot) {
  // Screenshot mode: stage the scene, paint twice, signal readiness.
  showTitle();
  stageShot(G, shot);
  document.getElementById('title').classList.add('hidden'); // staged scenes play, they are not the title screen
  G.hud.showHud(true);
  let painted = 0;
  function paint() {
    draw();
    painted++;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
