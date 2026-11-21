// VELORA HEAT — staged ?shot= scenes for the four screenshots. Each scene
// sets real game state (mode play, live HUD) and deterministic positions, so
// the frame is a genuine render of the game's own code, never a composite.
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';

function clearTraffic(G) {
  // Keep only parked/mission cars; remove traffic + police from the frame.
  G.cars = G.cars.filter((c) => c.parked || c.mission);
  for (const car of G.cars) car.speed = 0;
}

export function stageShot(G, name) {
  G.mode = 'play';
  G.tracers = [];
  if (name === 'cover') {
    // M1: Reno in the red Falco GT on Neon Mile, 2 stars, traffic around.
    G.mission.index = 0; G.mission.active = true; G.mission.step = 2;
    const gt = G.cars.find((c) => c.mission === 'M1');
    G.player.enterCar(gt);
    G.wanted = 2; // set after entering: the theft witness check may add heat
    gt.x = 100; gt.z = -44; gt.angle = 0; gt.speed = 14;
    const t1 = createCar('sedan', 60, -48, 0, { parked: false, driver: true }); t1.speed = 10;
    const t2 = createCar('van', 150, -40, 0, { parked: false, driver: true }); t2.speed = 9;
    const t3 = createCar('truck', 40, 44, Math.PI, { parked: false, driver: true }); t3.speed = 8;
    G.cars.push(t1, t2, t3);
    G.player.cash = 600;
    G.feed('M1 First Wheels — Deliver the Falco GT to Karsa Auto Works');
    G.cam.x = gt.x; G.cam.z = gt.z;
  } else if (name === 'foot') {
    // On foot in front of PelangiMart, pistol drawn, peds + parked cars.
    G.mission.index = 1; G.mission.active = true; G.mission.step = 0;
    G.wanted = 0;
    G.player.x = 60; G.player.z = -132; G.player.angle = Math.PI / 2;
    G.player.weapon = 'pistol';
    G.player.weapons.pistol.unlocked = true;
    G.player.cash = 875;
    const s1 = createCar('sedan', 44, -120, Math.PI / 2, { parked: true });
    const s2 = createCar('sedan', 44, -104, Math.PI / 2, { parked: true });
    const s3 = createCar('bike', 44, -140, 0, { parked: true });
    G.cars.push(s1, s2, s3);
    for (let i = 0; i < 5; i += 1) {
      const ped = createPed(G, 30 + i * 8, -120 + (i % 2) * 12);
      ped.state = i === 2 ? 'flee' : 'walk';
      G.peds.push(ped);
    }
    G.feed('M2 Hot Cargo — Take the Kuda Van at Old Harbor');
    G.cam.x = G.player.x; G.cam.z = G.player.z;
  } else if (name === 'chase') {
    // M3: 4-star chase, VBPD Interceptors closing in.
    G.mission.index = 2; G.mission.active = true; G.mission.step = 0;
    G.wanted = 4;
    clearTraffic(G);
    const sedan = createCar('sedan', 0, 132, 0, { parked: false });
    sedan.wasDriven = true;
    G.cars.push(sedan);
    G.player.enterCar(sedan);
    sedan.speed = 20;
    const p1 = createCar('police', -32, 128, 0, { driver: true }); p1.speed = 24;
    const p2 = createCar('police', -52, 136, 0, { driver: true }); p2.speed = 24;
    const p3 = createCar('police', 64, 132, Math.PI, { driver: true }); p3.speed = 18;
    G.cars.push(p1, p2, p3);
    G.player.cash = 1450;
    G.feed('M3 Three-Star Run — Lose the heat, break line of sight');
    G.cam.x = sedan.x; G.cam.z = sedan.z;
  } else if (name === 'combat') {
    // M6: garage defence, Tawon SMG out, crew attacking, tracer in the air.
    G.mission.index = 5; G.mission.active = true; G.mission.step = 0;
    G.mission.wave = 1;
    G.wanted = 2;
    clearTraffic(G);
    G.player.x = -200; G.player.z = -44; G.player.angle = 0;
    G.player.weapon = 'smg';
    G.player.weapons.smg.unlocked = true;
    G.player.weapons.smg.mag = 27;
    G.player.weapons.smg.reserve = 90;
    G.player.hp = 78;
    G.player.cash = 3250;
    G.enemies.push(
      { x: -176, z: -44, hp: 45, speed: 3.4, fireT: 1 },
      { x: -220, z: -88, hp: 30, speed: 3.4, fireT: 0.5 },
      { x: -220, z: 4, hp: 45, speed: 3.4, fireT: 1.5 },
    );
    const gt = G.cars.find((c) => c.mission === 'M1');
    if (gt) { gt.x = -176; gt.z = -60; gt.angle = 0.4; }
    G.tracers.push({ x1: -200, z1: -44, x2: -176, z2: -44, t: 0.09, hit: true });
    G.muzzle = 0.06;
    G.feed('M6 Harbor King — Defend the garage · Wave 2');
    G.cam.x = G.player.x; G.cam.z = G.player.z;
  } else {
    // Unknown shot name: plain title backdrop.
    G.mode = 'title';
  }
  // Set the camera exactly on the subject for a stable frame.
  const pc = G.playerCar;
  if (pc) { G.cam.x = pc.x; G.cam.z = pc.z; }
}
