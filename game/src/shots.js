// VELORA HEAT — staged screenshot scenes behind ?shot=cover|foot|chase|combat.
// Each scene sets real game state (real cars, real HUD, real mission banner) and
// paints it; nothing is composited or edited afterwards.
import { POINTS } from './config.js';
import { makeCar, enterCar } from './vehicles.js';
import { spawnEnemy } from './weapons.js';

function base(G) {
  // Fresh world, HUD on, camera on the player.
  G.mode = 'play';
  G.hud.showHud(true);
  G.cam.x = G.player.x;
  G.cam.z = G.player.z;
}
function nearTraffic(G, cx, cz) {
  // Pull a few traffic cars into frame around (cx,cz) so the street feels alive.
  const traffic = G.cars.filter((c) => c.driver === 'traffic');
  const spots = [
    [cx - 14, cz - 6, 0], [cx + 10, cz + 6, Math.PI], [cx + 22, cz - 6, 0],
    [cx - 26, cz + 6, Math.PI], [cx + 4, cz - 8, Math.PI / 2],
  ];
  traffic.slice(0, 5).forEach((c, i) => {
    const s = spots[i];
    c.x = s[0]; c.z = s[1]; c.angle = s[2]; c.speed = 6;
  });
}
function setMission(G, index, step) {
  G.mission.index = index;
  G.mission.active = true;
  G.mission.step = step;
  G.mission.stepT = 0;
  G.mission.timer = 0;
}
function setPolice(G, n, cx, cz) {
  G.wanted = n;
  G.unseenT = 0;
  G.searching = false;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.5;
    const c = makeCar('police', cx + Math.cos(a) * 26, cz + Math.sin(a) * 26, a + Math.PI, { driver: 'police' });
    c.speed = 12;
    G.cars.push(c);
  }
  G.hud.updateStars();
}

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'foot') {
    // On foot in front of PelangiMart, pistol drawn, parked row + prompt.
    base(G);
    p.x = 44; p.z = -118; p.angle = -Math.PI / 2;
    p.weapons[1].owned = true; p.weapons[1].mag = 12; p.weapons[1].reserve = 48;
    p.weapon = 1;
    p.cash = 875;
    setMission(G, 1, 0); // M2 banner: reach the Aruna Van
    G.mission.timer = 0;
    // Parked row in front of the player.
    const row = G.cars.filter((c) => c.parked && c.kind === 'sedan').slice(0, 3);
    row.forEach((c, i) => { c.x = 30 + i * 12; c.z = -132; c.angle = 0; });
    G.hud.setPrompt('<b>E</b> — Steal the Lumba Sedan');
    G.cam.x = p.x; G.cam.z = p.z;
    return;
  }
  if (name === 'chase') {
    // 4-star chase: player in a sedan, Interceptors flanking, M3 banner.
    base(G);
    const car = G.cars.find((c) => c.kind === 'sedan' && c.parked);
    car.x = 132; car.z = -44; car.angle = 0; car.speed = 24;
    p.x = car.x; p.z = car.z;
    enterCar(G, car);
    setMission(G, 2, 0); // M3 banner
    setPolice(G, 4, 132, -44);
    p.cash = 1450;
    G.cam.x = car.x; G.cam.z = car.z;
    nearTraffic(G, 132, -44);
    return;
  }
  if (name === 'combat') {
    // M6 finale at the garage: SMG, muzzle flash, crew enemies, low health.
    base(G);
    p.x = -212; p.z = -30; p.angle = Math.PI;
    p.hp = 42;
    p.weapons[2].owned = true; p.weapons[2].mag = 27; p.weapons[2].reserve = 90;
    p.weapon = 2;
    p.cash = 3250;
    setMission(G, 5, 0); // M6 banner, wave 2
    G.mission.wave = 2;
    spawnEnemy(G, -196, -52, 'smg');
    spawnEnemy(G, -236, -60, 'pistol');
    spawnEnemy(G, -206, -66, 'smg');
    G.enemies.forEach((e) => { e.angle = Math.atan2(p.z - e.z, p.x - e.x); });
    setPolice(G, 2, -212, -30);
    G.muzzle = 0.07;
    G.tracers.push({ x1: p.x, z1: p.z, x2: -196, z2: -52, t: 0.09 });
    G.tracers.push({ x1: -196, z1: -52, x2: p.x + 2, z2: p.z - 1, t: 0.09, enemy: true });
    G.cam.x = p.x; G.cam.z = p.z;
    nearTraffic(G, -212, -30);
    return;
  }
  // cover (default): golden-hour Neon Row, red Falco GT driving, 2 stars, M1 banner.
  base(G);
  const gt = G.cars.find((c) => c.mission === 'M1');
  gt.x = 44; gt.z = -132; gt.angle = 0; gt.speed = 22;
  p.x = gt.x; p.z = gt.z;
  enterCar(G, gt);
  setMission(G, 0, 2); // M1 deliver step
  setPolice(G, 2, 44, -132);
  p.cash = 600;
  G.cam.x = gt.x; G.cam.z = gt.z;
  nearTraffic(G, 44, -132);
}
