// VELORA HEAT — staged ?shot= scenes: real renders of the game's own code,
// state set directly (deterministic, seed 1), HUD on, then __shotReady.
import { WEAPONS } from './config.js';
import { spawnCar } from './vehicles.js';
import { enterCar } from './player.js';

export function stageShot(G, name) {
  const p = G.player;
  G.mode = 'play';
  if (name === 'foot') {
    // On foot in front of PelangiMart, pistol drawn, M2 active.
    p.x = 44; p.z = -108; p.angle = Math.PI / 2; p.inCar = null;
    p.weapon = 'pistol';
    p.weapons.pistol.unlocked = true; p.weapons.pistol.mag = 12; p.weapons.pistol.reserve = 48;
    p.cash = 875;
    G.mission.index = 1; G.mission.active = true; G.mission.step = 0;
    G.cam.x = p.x; G.cam.z = p.z;
    G.feed('M2 Kargo Panas: ambil Aruna Van di Pelabuhan Lama');
  } else if (name === 'chase') {
    // M3 4-star chase: player in a sedan, two VBPD Interceptors behind.
    const sedan = spawnCar(G, 'sedan', -100, 220, 0, { color: '#5a7fb8' });
    enterCar(G, sedan);
    sedan.speed = 24;
    p.cash = 1450;
    G.wanted = 4;
    G.mission.index = 2; G.mission.active = true; G.mission.step = 0;
    const c1 = spawnCar(G, 'police', -150, 214, 0, { driver: 'police' });
    const c2 = spawnCar(G, 'police', -165, 226, 0, { driver: 'police' });
    c1.speed = 22; c2.speed = 22;
    G.cam.x = sedan.x; G.cam.z = sedan.z;
    G.feed('M3 Lari Tiga Bintang: kabur ke Gudang Pelabuhan!');
  } else if (name === 'combat') {
    // M6 defence at the garage: SMG out, two crew enemies, tracer fire.
    p.x = -220; p.z = -30; p.angle = -Math.PI / 2; p.inCar = null;
    p.weapon = 'smg';
    p.weapons.smg.unlocked = true; p.weapons.smg.mag = 27; p.weapons.smg.reserve = 90;
    p.weapons.pistol.unlocked = true;
    p.cash = 3250; p.hp = 78;
    G.wanted = 2;
    G.mission.index = 5; G.mission.active = true; G.mission.step = 0; G.mission.wave = 1;
    G.enemies.push(
      { x: -196, z: -44, angle: 0, hp: 45, maxHp: 45, shootCd: 1, deadT: 0 },
      { x: -220, z: -12, angle: 0, hp: 38, maxHp: 45, shootCd: 1.5, deadT: 0 },
    );
    G.tracers.push({ x1: p.x, z1: p.z, x2: -196, z2: -44, life: 0.09 });
    G.cam.x = p.x; G.cam.z = p.z;
    G.feed('M6 Raja Pelabuhan: pertahankan Bengkel Sari — Gelombang 1');
  } else {
    // cover: M1, driving the red Falco GT, 2 stars, traffic around.
    const gt = spawnCar(G, 'gt', 150, 60, -0.4, { color: '#d02020' });
    enterCar(G, gt);
    gt.speed = 18;
    p.cash = 600;
    G.wanted = 2;
    G.mission.index = 0; G.mission.active = true; G.mission.step = 2;
    const t1 = spawnCar(G, 'sedan', 120, 44, 0, { driver: 'traffic' });
    const t2 = spawnCar(G, 'van', 180, 84, Math.PI, { driver: 'traffic' });
    t1.speed = 9; t2.speed = 8;
    const c1 = spawnCar(G, 'police', 110, 88, -0.4, { driver: 'police' });
    c1.speed = 16;
    G.cam.x = gt.x; G.cam.z = gt.z;
    G.feed('M1 Roda Pertama: antar Falco GT ke Bengkel Sari');
  }
  G.audio.ensure();
}
