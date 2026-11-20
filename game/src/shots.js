// Staged deterministic screenshot scenes (?shot=cover|foot|chase|combat&seed=1).
// Every scene is a real state of the real game — positions, wanted level, mission banner,
// weapon — painted twice, then window.__shotReady. Nothing is composited or edited.
import { CITY } from './config.js';

function placeCamera(G, x, z, heading, dist, height) {
  G.camera.position.set(x - Math.sin(heading) * dist, height, z - Math.cos(heading) * dist);
  G.camera.lookAt(x, 1.4, z);
}

function setBanner(G, text) { G.hud.setObjective(text); }
function setWanted(G, n) { G.police.setWanted(n, 'shot'); }

export function stageShot(G, name) {
  const P = G.player;
  document.getElementById('title').hidden = true;
  document.getElementById('pause').hidden = true;
  document.getElementById('card').hidden = true;
  G.screen = 'play';

  if (name === 'cover') {
    // Golden-hour Neon Row: Milo driving the red Tempest GT, traffic around, 2 stars.
    const car = G.vehicles.spawn('gt', 0, 60, Math.PI, { parked: false });
    car.speed = 20; car.isPlayer = true;
    P.inCar = true; P.car = car; P.x = 0; P.z = 60; P.cash = 600;
    P.weapon = 'pistol'; P.unlocked = ['fists', 'pistol'];
    P.weapons.pistol = { ammo: 12, reserve: 48 };
    setWanted(G, 2);
    G.vehicles.spawn('sedan', -14, 20, Math.PI, { traffic: true, parked: false });
    G.vehicles.spawn('van', 14, 100, 0, { traffic: true, parked: false });
    setBanner(G, 'M1 · First Wheels — Deliver the Tempest GT to Sorren Motors');
    placeCamera(G, 0, 60, Math.PI, 13, 6.5);
  } else if (name === 'foot') {
    // On foot in front of SunMart, pistol drawn, a parked row ahead with the steal prompt.
    P.inCar = false; P.car = null;
    P.x = 120; P.z = -40; P.heading = Math.PI; P.camYaw = Math.PI;
    G.playerApi.place(120, -40, Math.PI);
    P.weapon = 'pistol'; P.unlocked = ['fists', 'pistol'];
    P.weapons.pistol = { ammo: 12, reserve: 48 };
    P.cash = 250;
    G.vehicles.spawn('sedan', 122, -52, Math.PI, { parked: true });
    G.vehicles.spawn('sedan', 110, -52, Math.PI, { parked: true });
    setBanner(G, 'M1 · First Wheels — Steal the Tempest GT at Marina Sol');
    placeCamera(G, 120, -40, Math.PI, 8.5, 4.5);
  } else if (name === 'chase') {
    // 4-star chase: Milo in a Comet, two Interceptors flanking, M3 escape banner.
    const car = G.vehicles.spawn('sedan', 0, 0, Math.PI, { parked: false });
    car.speed = 25; car.isPlayer = true;
    P.inCar = true; P.car = car; P.x = 0; P.z = 0; P.cash = 875;
    setWanted(G, 4);
    const u1 = G.vehicles.spawn('pursuit', -10, 24, Math.PI, { pursuit: true, parked: false });
    const u2 = G.vehicles.spawn('pursuit', 12, 30, Math.PI, { pursuit: true, parked: false });
    G.police.units.push(u1, u2);
    setBanner(G, 'M3 · Three-Star Run — Lose the heat, break line of sight');
    placeCamera(G, 0, 0, Math.PI, 14, 7);
  } else if (name === 'combat') {
    // M6 finale at the garage: Milo with the Hornet SMG, three crew enemies, low health.
    P.inCar = false; P.car = null;
    P.x = -300; P.z = 132; P.hp = 40; P.cash = 2900;
    G.playerApi.place(-300, 132, Math.PI);
    P.weapon = 'smg'; P.unlocked = ['fists', 'pistol', 'smg'];
    P.weapons.smg = { ammo: 27, reserve: 90 };
    P.camYaw = Math.PI;
    setWanted(G, 2);
    G.weapons.spawnEnemy(-312, 96, 60);
    G.weapons.spawnEnemy(-288, 96, 60);
    G.weapons.spawnEnemy(-300, 88, 60);
    // One real shot so the muzzle flash + tracer are in the frame.
    P.fireCooldown = 0;
    G.weapons.shoot();
    setBanner(G, 'M6 · Harbor King — Defend the garage · Wave 2');
    placeCamera(G, -300, 132, Math.PI, 9, 5);
  } else {
    // Unknown shot: plain spawn view.
    G.playerApi.place(CITY.points.spawn.x, CITY.points.spawn.z, 0);
    placeCamera(G, CITY.points.spawn.x, CITY.points.spawn.z, 0, 10, 6);
  }
  // One HUD refresh so the banner, stars and weapon line are painted with the frame.
  G.hud.update(0);
}
