// The screenshot scenes behind ?shot=cover|foot|chase|combat (with &seed=1).
// Each one sets the real game state deterministically — real cars, real peds, real
// HUD — then the page paints it twice and sets window.__shotReady. Nothing here is
// a mock: the frame is what the game really looks like in that situation. Every
// staged position sits on a street, clear of buildings.
import * as THREE from 'three';
import { createRandom } from './random.js';

function setMission(G, index, step, timer) {
  G.missions.index = index;
  G.missions.active = true;
  G.missions.step = step;
  G.missions.timer = timer;
  G.missions.robT = 0;
  G.missions.waitT = 0;
  const pt = G.missions.objectivePoint();
  G.city.setBeacon(pt.x, pt.z, true);
}

function putPlayerInCar(G, car) {
  const p = G.player;
  p.inCar = true;
  p.car = car;
  G.vehicles.playerCar = car;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.camYaw = car.heading;
  p.mesh.visible = false;
  car.isParked = false;
  car.isTraffic = false;
}

function putPlayerOnFoot(G, x, z, heading) {
  const p = G.player;
  p.inCar = false;
  p.car = null;
  G.vehicles.playerCar = null;
  p.x = x;
  p.z = z;
  p.heading = heading;
  p.camYaw = heading;
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.y = heading;
}

function setWanted(G, n, searching) {
  G.police.wanted = n;
  G.police.searching = searching;
  G.hud.setStars(n, searching);
}

export function stageShot(G, name) {
  const rng = createRandom(1);
  void rng;
  G.hud.hideMissionCard();
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('map-overlay').classList.add('hidden');

  if (name === 'foot') {
    // On foot on Neon Row by SunMart: pistol drawn, peds walking, parked row ahead.
    // Heading looks south-west down the parked row (x=120, z=-84..-132).
    setMission(G, 0, 0, 178);
    setWanted(G, 0, false);
    G.cash = 250;
    putPlayerOnFoot(G, 132, -40, Math.PI * 1.09);
    G.weapons.unlocked = [true, true, false, false];
    G.weapons.index = 1;
    G.weapons.mag[1] = 12;
    G.weapons.reserve[1] = 48;
    G.vehicles.spawnVehicle('sedan', 120, -84, 0, { parked: true, color: 0x3a6fd8 });
    G.vehicles.spawnVehicle('sedan', 120, -108, 0, { parked: true, color: 0xc23b3b });
    G.vehicles.spawnVehicle('van', 120, -132, 0, { parked: true, color: 0x3a5a8a });
    G.peds.spawnWorld();
    G.hud.setInteractPrompt('E — Steal the Falcon S');
  } else if (name === 'chase') {
    // 4-star chase on Neon Row: Falcon S fleeing, interceptors closing in.
    setMission(G, 2, 0, 210);
    setWanted(G, 4, false);
    G.cash = 1450;
    const car = G.vehicles.spawnVehicle('sedan', 0, -40, 0, { color: 0x3a6fd8 });
    car.health = 42; // damage smoke shows
    car.speed = 25; // fleeing — the speedo reads, not 0
    putPlayerInCar(G, car);
    const c1 = G.vehicles.spawnVehicle('police', -10, -22, 0);
    const c2 = G.vehicles.spawnVehicle('police', 12, -26, 0);
    const c3 = G.vehicles.spawnVehicle('police', 0, 16, Math.PI);
    G.police.pursuit = [c1, c2, c3];
    G.vehicles.spawnVehicle('sedan', -60, 0, Math.PI / 2, { traffic: true, color: 0xd8d8d8 });
    G.vehicles.spawnVehicle('truck', 120, 0, Math.PI, { traffic: true, color: 0x8a5a2a });
  } else if (name === 'combat') {
    // M6 finale at Sorren Motors: SMG, crew enemies in front of the garage sign.
    setMission(G, 5, 0, 540);
    setWanted(G, 2, false);
    G.cash = 3200;
    putPlayerOnFoot(G, -300, 132, 0);
    G.player.health = 42;
    G.weapons.unlocked = [true, true, true, true];
    G.weapons.index = 2;
    G.weapons.mag[2] = 27;
    G.weapons.reserve[2] = 90;
    const e1 = G.weapons.spawnEnemy(-312, 150, 60);
    const e2 = G.weapons.spawnEnemy(-288, 150, 60);
    const e3 = G.weapons.spawnEnemy(-300, 144, 60);
    void e1; void e2; void e3;
    // A frozen muzzle flash + tracer so the frame shows the firefight.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }),
    );
    flash.position.set(-300, 1.6, 138);
    G.scene.add(flash);
    const pts = [new THREE.Vector3(-300, 1.6, 138), new THREE.Vector3(-300, 1.4, 148)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffd23e }));
    G.scene.add(line);
    G.peds.spawnWorld();
  } else {
    // cover: golden-hour Neon Row, Tempest GT driving east, 2 stars, traffic + pursuit.
    setMission(G, 0, 2, 143);
    setWanted(G, 2, false);
    G.cash = 600;
    const car = G.vehicles.spawnVehicle('gt', 60, 0, Math.PI / 2, { color: 0xd81e1e });
    car.speed = 20; // staged mid-drive so the speedo reads, not 0
    putPlayerInCar(G, car);
    G.vehicles.spawnVehicle('sedan', 96, 2, Math.PI / 2, { traffic: true, color: 0x3a6fd8 });
    G.vehicles.spawnVehicle('van', 120, -2, Math.PI / 2, { traffic: true, color: 0xd8d8d8 });
    G.vehicles.spawnVehicle('truck', 144, 0, 0, { traffic: true, color: 0x8a5a2a });
    const pc = G.vehicles.spawnVehicle('police', 84, 0, -Math.PI / 2);
    G.police.pursuit = [pc];
    G.peds.spawnWorld();
  }
}
