// main.js — LEONIDA AFTER DARK, tied together.
//
// Builds the renderer and the city, owns the save and the wanted level,
// feeds every system its slice of the frame (player, traffic, police,
// crowds, missions, HUD), and runs the start / pause / ending flow.

import * as THREE from "three";
import {
  SAVE_KEY, createSave, parseSave, serializeSave, completeMission,
  nextMission, debtRemaining, canPayDebt, payDebt, raiseWanted,
  setWantedAtLeast, coolWanted, bustFine, LANDMARKS,
} from "./logic.js";
import { buildWorld } from "./world.js";
import { CarFleet, Traffic, parkCars } from "./vehicles.js";
import { Crowd } from "./people.js";
import { Police } from "./police.js";
import { MissionRunner } from "./missions.js";
import { Player, FollowCamera } from "./player.js";
import { Hud } from "./hud.js";
import { AudioSys } from "./audio.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(99173);

// ---------------------------------------------------------------------------
// Renderer, scene, camera.
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById("game").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.set(124, 6, -44);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// The world and its people.
// ---------------------------------------------------------------------------

const world = buildWorld(scene);
const fleet = new CarFleet(scene, 76);
const traffic = new Traffic(fleet, rng);
for (let i = 0; i < 15; i++) traffic.spawnOne();
parkCars(fleet, rng);
const crowd = new Crowd(scene, rng, 64);
const police = new Police(fleet, world.colliders);
const audio = new AudioSys();

const hud = new Hud({
  cash: document.getElementById("cash"),
  debt: document.getElementById("debt"),
  stars: document.getElementById("stars"),
  objective: document.getElementById("objective"),
  clock: document.getElementById("clock"),
  speed: document.getElementById("speed"),
  bustWrap: document.getElementById("bust-wrap"),
  bustFill: document.getElementById("bust-fill"),
  hint: document.getElementById("hint"),
  banner: document.getElementById("banner"),
  bannerTitle: document.getElementById("banner-title"),
  bannerSub: document.getElementById("banner-sub"),
  toast: document.getElementById("toast"),
  minimap: document.getElementById("minimap"),
  bigmap: document.getElementById("bigmap"),
});

// ---------------------------------------------------------------------------
// Save, wanted, and the rules that bind them.
// ---------------------------------------------------------------------------

function loadSave() {
  try {
    return parseSave(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function persistSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, serializeSave(save));
  } catch { /* private mode: the night goes unsaved */ }
}

let save = loadSave() ?? createSave();
let wanted = 0;
let unseenTime = 0;
let crimeFlash = 0;

function applyCrime(kind) {
  const before = wanted;
  wanted = raiseWanted(wanted, kind);
  unseenTime = 0;
  crimeFlash = 5;
  if (wanted > before) hud.toast(`Wanted level ${wanted} — the PD has your scent`);
}

const player = new Player(scene, fleet, world.colliders, {
  onCrime: (kind) => applyCrime(kind),
  onCrash: (speed) => {
    audio.thud(Math.min(1, speed / 18));
    if (speed > 13) hud.toast("That's going to leave a mark");
  },
  onStoleCar: (car) => {
    const i = traffic.cars.indexOf(car);
    if (i >= 0) traffic.cars.splice(i, 1);
  },
  audio,
});
const followCam = new FollowCamera(camera);

const runner = new MissionRunner(scene, fleet, save, {
  getPlayer: () => ({ x: player.x, z: player.z, car: player.mode === "car" ? player.car : null }),
  banner: (t, s) => hud.banner(t, s),
  toast: (m) => hud.toast(m),
  blip: (f, d) => audio.blip(f, d),
  jingle: () => audio.jingle(),
  crime: (kind) => applyCrime(kind),
  setHeat: (n) => { wanted = setWantedAtLeast(wanted, n); unseenTime = 0; },
  completeMission: (m) => {
    completeMission(save, m);
    hud.setCash(save.cash, save.debtPaid);
    audio.cash();
    persistSave();
    if (!nextMission(save) && debtRemaining(save) > 0) {
      setTimeout(() => hud.banner("The night's work is done", "Take the money to Venn Loans on Avenue 5 and close the ledger."), 4600);
    }
  },
});

// The Venn Loans payoff light: green, patient, always hungry.
const payoffMarker = new THREE.Group();
{
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 13, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x51ff7a, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 6.5;
  payoffMarker.add(pillar);
  payoffMarker.position.set(-7.5, 0, LANDMARKS.loans.z);
  scene.add(payoffMarker);
}
const PAYOFF = { x: -7.5, z: LANDMARKS.loans.z };

// ---------------------------------------------------------------------------
// Input.
// ---------------------------------------------------------------------------

const input = { forward: false, back: false, left: false, right: false, sprint: false, handbrake: false, camYaw: 0 };
const KEYMAP = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  ShiftLeft: "sprint", ShiftRight: "sprint",
  Space: "handbrake",
};
let started = false;
let paused = false;
let bigMapOpen = false;
let endingShown = false;

window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = true;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (e.code === "Space" && started && !paused && player.mode === "foot") player.shove(crowd);
  }
  if (!started) return;
  if (e.code === "KeyE") interact();
  if (e.code === "KeyM") toggleBigMap();
  if (e.code === "Escape") {
    if (bigMapOpen) toggleBigMap();
    else togglePause();
  }
});
window.addEventListener("keyup", (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});

let dragging = false;
renderer.domElement.addEventListener("pointerdown", (e) => { dragging = true; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener("pointerup", () => { dragging = false; });
renderer.domElement.addEventListener("pointermove", (e) => {
  if (dragging) followCam.orbit(e.movementX, e.movementY);
});
renderer.domElement.addEventListener("wheel", (e) => { followCam.zoom(e.deltaY); }, { passive: true });

function interact() {
  if (paused) return;
  if (player.mode === "car") {
    if (Math.abs(player.speed) < 3) player.exitCar();
    return;
  }
  // Paying the debt beats stealing a car when standing at the loans office.
  if (Math.hypot(player.x - PAYOFF.x, player.z - PAYOFF.z) < 4.6 && canPayDebt(save)) {
    const paid = payDebt(save);
    hud.setCash(save.cash, save.debtPaid);
    audio.cash();
    persistSave();
    if (save.finished && !endingShown) {
      endingShown = true;
      document.getElementById("ending").style.display = "flex";
    } else {
      hud.banner("Payment made", `$${paid.toLocaleString()} off the ledger — $${debtRemaining(save).toLocaleString()} to go`);
    }
    return;
  }
  const car = player.nearestCar();
  if (car) player.enterCar(car);
}

function togglePause() {
  paused = !paused;
  document.getElementById("pause").style.display = paused ? "flex" : "none";
}

function toggleBigMap() {
  bigMapOpen = !bigMapOpen;
  document.getElementById("bigmap-wrap").style.display = bigMapOpen ? "flex" : "none";
}

// ---------------------------------------------------------------------------
// Busted: the law settles up and the night goes on, poorer.
// ---------------------------------------------------------------------------

function onBusted() {
  const fine = bustFine(save.cash);
  save.cash -= fine;
  wanted = 0;
  unseenTime = 0;
  if (player.mode === "car") player.exitCar();
  player.x = LANDMARKS.spawn.x;
  player.z = LANDMARKS.spawn.z;
  player.heading = LANDMARKS.spawn.heading;
  hud.setCash(save.cash, save.debtPaid);
  hud.banner("BUSTED", fine > 0 ? `The PD impounds your ride and fines you $${fine.toLocaleString()}.` : "The PD takes your ride. You're broke, so the fine is the walk home.");
  audio.thud(1);
  if (runner.phase === "active") runner.fail("the law caught up with you");
  persistSave();
}

// ---------------------------------------------------------------------------
// The frame.
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  if (!started) {
    // The menu backdrop: a slow orbit over the lit city, alive behind glass.
    const a = elapsed * 0.045;
    camera.position.set(40 + Math.cos(a) * 128, 52 + Math.sin(elapsed * 0.11) * 7, Math.sin(a) * 128);
    camera.lookAt(30, 2, 0);
    world.update(dt, elapsed);
    traffic.update(dt, fleet.cars);
    crowd.update(dt, { playerX: -999, playerZ: -999, playerSpeed: 0 });
    fleet.update(dt);
    renderer.render(scene, camera);
    return;
  }
  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  input.camYaw = followCam.moveYaw;
  player.update(dt, input);

  // Cars are heavy and pedestrians are soft: settle any meeting.
  if (player.mode === "car" && Math.abs(player.speed) > 3.5) {
    const ped = crowd.nearest(player.x + Math.sin(player.heading) * 2, player.z + Math.cos(player.heading) * 2, 2.1);
    if (ped && ped.state !== "down") {
      const hard = Math.abs(player.speed) > 7.5;
      crowd.knockDown(ped, hard ? () => applyCrime("hitAndRun") : null);
      if (hard) audio.thud(0.8);
    }
  }

  traffic.update(dt, fleet.cars);
  const policeState = police.update(dt, {
    wanted,
    playerX: player.x, playerZ: player.z,
    playerVX: player.vx, playerVZ: player.vz,
    playerSpeed: player.speed,
    onRam: (car, nx, nz) => {
      if (player.mode === "car" && player.car) {
        player.car.x += nx * 1.1;
        player.car.z += nz * 1.1;
        player.speed *= 0.82;
        player.car.speed = player.speed;
      } else {
        player.x += nx * 1.6;
        player.z += nz * 1.6;
      }
      audio.thud(0.7);
    },
    onBusted,
  });

  // Heat cools while no cruiser can see Jax and no fresh crime lands.
  if (crimeFlash > 0) crimeFlash -= dt;
  if (!policeState.seen && crimeFlash <= 0) {
    unseenTime += dt;
    const cooled = coolWanted(wanted, unseenTime, false);
    if (cooled < wanted) { wanted = cooled; unseenTime = 0; }
  } else {
    unseenTime = 0;
  }

  crowd.update(dt, { playerX: player.x, playerZ: player.z, playerSpeed: player.mode === "car" ? Math.abs(player.speed) : 0 });
  runner.update(dt, elapsed);
  world.update(dt, elapsed);
  fleet.update(dt);
  followCam.update(dt, player);
  audio.engine(player.mode === "car" ? player.speed : 0, input.forward && player.mode === "car");
  audio.siren(policeState.seen && wanted > 0, elapsed);

  // HUD.
  hud.setWanted(wanted);
  hud.setObjective(runner.objectiveText);
  hud.setClock(runner.clockLeft);
  hud.setSpeed(player.speed, player.mode === "car");
  hud.setBust(policeState.bust);
  hud.update(dt);
  const nearCar = player.mode === "foot" ? player.nearestCar() : null;
  if (player.mode === "car") hud.setHint(Math.abs(player.speed) < 3 ? "E — get out" : "");
  else if (Math.hypot(player.x - PAYOFF.x, player.z - PAYOFF.z) < 4.6 && canPayDebt(save)) {
    hud.setHint(`E — pay Venn Loans $${Math.min(save.cash, debtRemaining(save)).toLocaleString()}`);
  } else if (nearCar) hud.setHint(nearCar.stolenBefore ? "E — get in" : "E — steal the car");
  else hud.setHint("");
  payoffMarker.visible = debtRemaining(save) > 0;

  const mapView = {
    player: { x: player.x, z: player.z, heading: player.heading },
    markers: runner.markerPositions(),
    police: police.cruisers,
    traffic: fleet.cars.filter((c) => !c.dead && c.kind !== "police"),
    pulse: elapsed * 2,
  };
  hud.renderMinimap(mapView);
  if (bigMapOpen) hud.renderBigMap(mapView);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// ---------------------------------------------------------------------------
// The flow: menu, continue, restart, free roam.
// ---------------------------------------------------------------------------

const continueBtn = document.getElementById("btn-continue");
if (loadSave()) continueBtn.hidden = false;

function startGame(fresh) {
  if (fresh) {
    save = createSave();
    save.startedAt = Date.now();
    runner.save = save;
    runner.refreshOffer();
    persistSave();
  }
  audio.init();
  started = true;
  document.getElementById("menu").style.display = "none";
  document.getElementById("hud").classList.add("on");
  hud.setCash(save.cash, save.debtPaid);
  const m = nextMission(save);
  if (m) hud.banner(m.title, m.brief, 6);
  else if (!save.finished) hud.banner("One last errand", "Take the money to Venn Loans and close the ledger.", 6);
}

document.getElementById("btn-new").addEventListener("click", () => startGame(true));
continueBtn.addEventListener("click", () => startGame(false));
document.getElementById("btn-resume").addEventListener("click", togglePause);
document.getElementById("btn-restart").addEventListener("click", () => {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  window.location.reload();
});
document.getElementById("btn-free").addEventListener("click", () => {
  document.getElementById("ending").style.display = "none";
});

// A handle for the maker's own play-test: read the game's state, nothing more.
window.LEONIDA = {
  state: () => ({
    started, paused,
    mode: player.mode,
    cash: save.cash,
    debtPaid: save.debtPaid,
    missionsDone: [...save.missionsDone],
    wanted,
    missionPhase: runner.phase,
    missionTitle: runner.mission?.title ?? null,
    objective: runner.objectiveText,
    player: { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 },
    heading: Math.round(player.heading * 1000) / 1000,
    speed: Math.round(player.speed * 10) / 10,
    speedKmh: Math.round(Math.abs(player.speed) * 3.6),
    policeOut: police.cruisers.length,
    bust: Math.round(police.bust * 100) / 100,
  }),
};
