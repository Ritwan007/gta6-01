// VELORA HEAT — the player: on-foot controller, arcade driving, entering /
// stealing / storing cars, and the E interaction priority chain.
import { CASA_BIRU, GARAGE, GARAGE_SLOTS, HIDEOUT, MART, POLICE_STATION, VEHICLES, WEAPON_ORDER } from './config.js';
import { witnessCrime } from './pedestrians.js';

export function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

export function playerCar(G) {
  return G.player.inCar != null ? G.cars.find((c) => c.id === G.player.inCar) : null;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  const car = playerCar(G);
  if (car) {
    driveCar(G, car, dt);
    p.x = car.x; p.z = car.z; p.angle = car.angle;
    // Hit-and-run: a fast car knocks peds down.
    for (const ped of G.peds) {
      if (ped.hp <= 0) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2 && Math.abs(car.speed) > 3) {
        ped.hp = 0; ped.state = 'flee';
        if (witnessCrime(G, ped.x, ped.z)) G.pendingCrime = 1;
        else G.police.addHeat(1, 'hit-and-run');
        G.feed('Tabrak lari! Saksi melihatmu.');
      }
    }
  } else {
    // On foot: WASD, Shift to run. Aim follows the mouse when it is off-centre.
    const mx = input.axis('KeyA', 'KeyD');
    const mz = input.axis('KeyW', 'KeyS');
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 7 : 4;
    let nx = p.x, nz = p.z;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      nx = p.x + (mx / len) * speed * dt;
      nz = p.z + (mz / len) * speed * dt;
      p.angle = Math.atan2(mz, mx);
    }
    const mdx = input.mouse.x - window.innerWidth / 2;
    const mdy = input.mouse.y - window.innerHeight / 2;
    if (Math.hypot(mdx, mdy) > 30) p.angle = Math.atan2(mdy, mdx);
    const fixed = G.city.resolveCircle(nx, nz, 0.7);
    // Don't walk through cars.
    for (const c of G.cars) {
      if (c.hp <= 0) continue;
      const d = Math.hypot(fixed.x - c.x, fixed.z - c.z);
      if (d < c.radius + 0.5 && d > 0.01) {
        const push = (c.radius + 0.5 - d);
        fixed.x += ((fixed.x - c.x) / d) * push;
        fixed.z += ((fixed.z - c.z) / d) * push;
      }
    }
    p.x = Math.max(-348, Math.min(348, fixed.x));
    p.z = Math.max(-348, Math.min(348, fixed.z));
  }
  // Camera follows the player (or their car), eased.
  const tx = car ? car.x : p.x, tz = car ? car.z : p.z;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
  G.cam.z += (tz - G.cam.z) * Math.min(1, dt * 6);
  // BUSTED: a police car touching the player on foot for 3 s.
  if (!car && G.wanted > 0) {
    let touching = false;
    for (const c of G.cars) {
      if (c.driver === 'police' && c.hp > 0 && Math.hypot(c.x - p.x, c.z - p.z) < 3) { touching = true; break; }
    }
    if (touching) {
      G.bustedT += dt;
      if (G.bustedT >= 3) G.busted();
    } else G.bustedT = 0;
  } else G.bustedT = 0;
}

function driveCar(G, car, dt) {
  const input = G.input;
  const v = VEHICLES[car.kind];
  const fwd = input.down('KeyW');
  const back = input.down('KeyS');
  const steer = input.axis('KeyA', 'KeyD'); // D = +1 (turns angle up)
  const brake = input.down('Space');
  if (fwd) car.speed = Math.min(car.top, car.speed + car.accel * dt);
  if (back) {
    if (car.speed > 0.5) car.speed = Math.max(0, car.speed - car.accel * 2 * dt);
    else car.speed = Math.max(-8, car.speed - car.accel * 0.8 * dt);
  }
  if (brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), car.accel * 2.4 * dt);
  if (!fwd && !back) car.speed *= Math.max(0, 1 - 0.35 * dt);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
  const rate = 2.1 / (1 + Math.abs(car.speed) * 0.055);
  const grip = Math.min(1, Math.abs(car.speed) / 5);
  car.angle += steer * rate * grip * dt * (car.speed >= 0 ? 1 : -1);
  const before = { x: car.x, z: car.z };
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.z += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(-350, Math.min(350, car.x));
  car.z = Math.max(-350, Math.min(350, car.z));
  const fixed = G.city.resolveCircle(car.x, car.z, car.radius);
  car.x = fixed.x; car.z = fixed.z;
  if (fixed.x !== before.x || fixed.z !== before.z) {
    if (Math.abs(car.speed) > 10) {
      car.hp = Math.max(0, car.hp - (Math.abs(car.speed) - 10) * 1.2);
      G.audio.thud();
    }
    car.speed *= 0.35;
  }
  G.audio.setEngine(car.speed, car.top);
}

function nearestCar(G, x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function nearestStorableCar(G) {
  const p = G.player;
  let best = null, bd = 8;
  for (const c of G.cars) {
    if (c.hp <= 0 || c.owned || c.kind === 'police' || c.driver === 'police' || c.driver === 'racer') continue;
    if (c.mission === 'M1' && G.mission.completed[0] === false && G.mission.index === 0 && G.mission.active) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  // Crime: stealing a parked civilian car, or carjacking a driven one.
  if (!car.owned && car.kind !== 'police') {
    const isMissionCar = !!car.mission;
    if (!isMissionCar) {
      if (witnessCrime(G, car.x, car.z)) G.pendingCrime = 1;
      else if (car.driver === 'traffic') G.police.addHeat(1, 'carjacking');
    }
  }
  if (car.kind === 'police' && !car.owned) {
    G.police.addHeat(3, 'stole interceptor');
    G.feed('Kau mencuri mobil VBPD! 3 bintang!');
  }
  if (car.driver === 'traffic') {
    // The driver flees on foot.
    G.peds.push({ x: car.x + 2, z: car.z, angle: 0, speed: 1.5, state: 'flee', stateT: 0, callT: 0, hp: 30, shirt: '#e8e86a', tx: car.x + 40, tz: car.z });
    car.driver = null;
  }
  car.parked = false;
  p.inCar = car.id;
  p.x = car.x; p.z = car.z; p.angle = car.angle;
  G.audio.ensure();
}

export function exitCar(G) {
  const p = G.player;
  const car = playerCar(G);
  if (!car) return;
  car.parked = true;
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 3;
  p.z = car.z + Math.sin(car.angle + Math.PI / 2) * 3;
  const fixed = G.city.resolveCircle(p.x, p.z, 0.7);
  p.x = fixed.x; p.z = fixed.z;
  p.angle = car.angle;
}

export function storeCar(G, car) {
  const slotIdx = G.owned.length;
  if (slotIdx >= GARAGE_SLOTS.length) { G.feed('Garasi penuh!'); return false; }
  const [sx, sz] = GARAGE_SLOTS[slotIdx];
  car.x = sx; car.z = sz; car.angle = Math.PI / 2; car.speed = 0;
  car.parked = true; car.driver = null; car.owned = true; car.slot = slotIdx;
  car.hp = car.maxHp; // storing repairs the car
  G.owned.push({ carId: car.id, kind: car.kind, slot: slotIdx });
  G.feed(`${VEHICLES[car.kind].name} disimpan di garasi (slot ${slotIdx + 1}).`);
  return true;
}

export function interact(G) {
  const p = G.player;
  if (G.mode !== 'play') return;
  if (p.inCar != null) { exitCar(G); return; }
  // 1. Hold-up at PelangiMart (mission M4 step 1, or free-roam robbery).
  const nearMart = dist(p.x, p.z, MART.x, MART.z) <= 12;
  if (nearMart && p.weapon !== 'fists' && !G.holdup) {
    const m4 = G.mission.index === 3 && G.mission.active && G.mission.step === 1;
    if (m4 || !G.mission.active) {
      G.holdup = { t: 0, dur: 8, x: MART.x, z: MART.z, freeroam: !m4 };
      G.feed('Tahan kasir... jangan bergerak!');
      return;
    }
  }
  // 2. Store a car at the garage (never an already-owned car).
  const nearGarage = dist(p.x, p.z, GARAGE.x, GARAGE.z) <= 14;
  if (nearGarage) {
    const storable = nearestStorableCar(G);
    if (storable) { storeCar(G, storable); return; }
  }
  // 3. Start the next mission at the garage.
  if (nearGarage && !G.mission.active && G.mission.index < 6) {
    G.missions.startMission(G, G.mission.index);
    return;
  }
  // 4. Enter the nearest car.
  const car = nearestCar(G, p.x, p.z, 5);
  if (car) enterCar(G, car);
}

export function switchWeapon(G, idx) {
  const p = G.player;
  const key = WEAPON_ORDER[idx];
  if (!key) return;
  if (key !== 'fists' && !p.weapons[key].unlocked) { G.feed(`${p.weapons[key].name} belum terbuka.`); return; }
  p.weapon = key;
  G.audio.click();
}

export function refillAmmo(G) {
  const p = G.player;
  for (const k of WEAPON_ORDER) {
    const w = p.weapons[k];
    if (w.unlocked && w.mag !== Infinity) { w.mag = w.magMax; w.reserve = w.reserveMax; }
  }
}
