// VELORA HEAT — vehicles: factory from the variant table, arcade physics,
// traffic AI (street-following, avoids parked cars), police pursuit driving.
// Angle convention: atan2(dz, dx); forward = (cos a, sin a). D turns +angle.
import { MISSION_CARS, STREETS, VEHICLES } from './config.js';
import { pick } from './random.js';

let nextId = 1;
export function reserveId(id) { nextId = Math.max(nextId, id + 1); }

function nearMissionCar(x, z) {
  for (const mc of MISSION_CARS) if (Math.hypot(mc.x - x, mc.z - z) < 16) return true;
  return false;
}

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function spawnCar(G, kind, x, z, angle, opts = {}) {
  const v = VEHICLES[kind];
  const car = {
    id: nextId++, kind, x, z, angle: angle ?? 0, speed: 0,
    hp: v.hp, maxHp: v.hp, top: v.top, accel: v.accel,
    len: v.len, wid: v.wid, radius: Math.max(2.0, v.len / 2 - 0.4),
    color: opts.color || pick(G.rng, v.colors),
    parked: !!opts.parked, driver: opts.driver || null, // 'traffic' | 'police' | null
    mission: opts.mission || null, owned: !!opts.owned, slot: opts.slot ?? -1,
    target: false, ramCd: 0, stuckT: 0, reverseT: 0,
    route: null, routeT: 0, siren: kind === 'police',
  };
  G.cars.push(car);
  return car;
}

function nearestStreet(v) {
  return STREETS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}
function randomStreetPoint(G, exclude) {
  const horiz = G.rng() < 0.5;
  const s = pick(G.rng, STREETS);
  const t = STREETS[Math.floor(G.rng() * STREETS.length)];
  return horiz ? { x: t, z: s } : { x: s, z: t };
}

// Steer a car toward (tx, tz) at up to topSpeed. Returns nothing; mutates car.
// Shared by traffic, police pursuit and racers.
export function driveToward(G, car, tx, tz, topSpeed, dt, cautious) {
  const dx = tx - car.x, dz = tz - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 2) { car.speed = Math.max(0, car.speed - car.accel * dt); return; }
  const want = Math.atan2(dz, dx);
  const diff = angDiff(want, car.angle);
  const stuck = Math.abs(car.speed) < 0.6;
  car.stuckT = stuck ? car.stuckT + dt : 0;
  if (car.stuckT > 2.2 && car.reverseT <= 0) { car.reverseT = 0.9; car.stuckT = 0; }
  if (car.reverseT > 0) {
    car.reverseT -= dt;
    car.speed = Math.max(-6, car.speed - car.accel * 0.7 * dt);
    car.angle += (diff > 0 ? -1 : 1) * 1.4 * dt;
    return;
  }
  // Brake before a sharp turn at speed.
  if (Math.abs(diff) > 0.6 && Math.abs(car.speed) > 7) {
    car.speed = Math.max(0, car.speed - car.accel * 1.6 * dt);
  } else if (Math.abs(car.speed) < topSpeed) {
    car.speed = Math.min(topSpeed, car.speed + car.accel * dt);
  }
  const rate = 2.1 / (1 + Math.abs(car.speed) * 0.055);
  if (diff > 0.12) car.angle += rate * dt;
  else if (diff < -0.12) car.angle -= rate * dt;
  // Cautious drivers slow for obstacles ahead.
  if (cautious) {
    const ax = car.x + Math.cos(car.angle) * 9, az = car.z + Math.sin(car.angle) * 9;
    if (G.city.circleHitsBuilding(ax, az, 1.5)) car.speed = Math.max(0, car.speed - car.accel * 2 * dt);
    for (const o of G.cars) {
      if (o === car || o.hp <= 0) continue;
      if (Math.hypot(o.x - ax, o.z - az) < 4.5) { car.speed = Math.max(0, car.speed - car.accel * 2 * dt); break; }
    }
  }
}

function trafficStep(G, car, dt) {
  if (!car.route || Math.hypot(car.route.x - car.x, car.route.z - car.z) < 7) {
    car.route = randomStreetPoint(G);
    car.routeT = 0;
  }
  // Drive on the right side of the road: 4 m offset from the centreline.
  const legA = Math.atan2(car.route.z - car.z, car.route.x - car.x);
  const ox = -Math.sin(legA) * 4, oz = Math.cos(legA) * 4;
  driveToward(G, car, car.route.x + ox, car.route.z + oz, 10 + G.rng() * 2, dt, true);
}

function policeStep(G, car, dt) {
  const p = G.player;
  const pc = p.inCar != null ? G.cars.find((c) => c.id === p.inCar) : null;
  const tx = pc ? pc.x : p.x, tz = pc ? pc.z : p.z;
  const seen = G.police.seesPlayer;
  const gx = seen ? tx : G.police.lastSeen.x, gz = seen ? tz : G.police.lastSeen.z;
  // Hold ~7 m short of an on-foot player; ram a player car at 3 stars+.
  const d = Math.hypot(gx - car.x, gz - car.z);
  if (!pc && d < 8) { car.speed = Math.max(0, car.speed - car.accel * 2 * dt); return; }
  driveToward(G, car, gx, gz, Math.min(24, car.top - 2), dt, false);
  // Ram: one impact per cooldown, 3 dmg + shove.
  car.ramCd = Math.max(0, car.ramCd - dt);
  if (pc && G.wanted >= 3 && car.ramCd <= 0 && d < car.len / 2 + pc.len / 2 + 1.2) {
    pc.hp = Math.max(0, pc.hp - 3);
    car.ramCd = 1.5;
    const push = Math.atan2(pc.z - car.z, pc.x - car.x);
    pc.x += Math.cos(push) * 1.2; pc.z += Math.sin(push) * 1.2;
    pc.speed = Math.min(pc.speed, 6);
    G.audio.thud();
  }
}

export function updateCars(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.hp <= 0) continue;
    const isPlayer = p.inCar === car.id;
    if (!isPlayer && car.driver === 'traffic') trafficStep(G, car, dt);
    else if (!isPlayer && car.driver === 'police') policeStep(G, car, dt);
    else if (!isPlayer && car.driver === 'racer') {
      // Racers follow the race checkpoints at 0.6x top speed.
      const cp = G.mission.racerCp[car.racerIdx] || 0;
      const cps = G.mission.raceCps;
      if (cp < cps.length) driveToward(G, car, cps[cp][0], cps[cp][1], car.top * 0.6, dt, true);
    } else if (!isPlayer && !car.parked && car.driver == null) {
      // A shoved parked car coasts to a stop.
      car.speed = Math.max(0, car.speed - 6 * dt);
    }
    if (isPlayer) continue; // player-driven cars move in player.js
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z += Math.sin(car.angle) * car.speed * dt;
    // Building collision: push out, lose speed, damage on hard hits.
    const before = { x: car.x, z: car.z };
    const fixed = G.city.resolveCircle(car.x, car.z, car.radius);
    car.x = fixed.x; car.z = fixed.z;
    if (fixed.x !== before.x || fixed.z !== before.z) {
      if (Math.abs(car.speed) > 10) car.hp = Math.max(0, car.hp - (Math.abs(car.speed) - 10) * 1.2);
      car.speed *= 0.35;
    }
  }
  // Car-car collisions: push apart, damage on hard impact.
  for (let i = 0; i < G.cars.length; i++) {
    const a = G.cars[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < G.cars.length; j++) {
      const b = G.cars[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = a.radius + b.radius - 0.4;
      if (d > 0.01 && d < min) {
        const nx = dx / d, nz = dz / d;
        const push = (min - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 6) {
          a.hp = Math.max(0, a.hp - rel * 0.5);
          b.hp = Math.max(0, b.hp - rel * 0.5);
          a.speed *= 0.6; b.speed *= 0.6;
        }
      }
    }
  }
  // Wrecked cars become parked wrecks.
  for (const car of G.cars) {
    if (car.hp <= 0 && !car.parked) { car.parked = true; car.speed = 0; car.driver = null; }
  }
}

export function spawnTraffic(G, n) {
  const kinds = ['sedan', 'sedan', 'sedan', 'sedan', 'van', 'truck', 'gt', 'bike', 'sedan', 'van'];
  for (let i = 0; i < n; i++) {
    let pt = randomStreetPoint(G);
    for (let t = 0; t < 8 && nearMissionCar(pt.x, pt.z); t++) pt = randomStreetPoint(G);
    if (nearMissionCar(pt.x, pt.z)) continue;
    const horiz = G.rng() < 0.5;
    const angle = horiz ? (G.rng() < 0.5 ? 0 : Math.PI) : (G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = spawnCar(G, pick(G.rng, kinds), pt.x, pt.z, angle, { driver: 'traffic' });
    car.parked = false;
    car.speed = 6 + G.rng() * 4;
    car.route = randomStreetPoint(G);
  }
}

export function spawnParkedRow(G, n) {
  // Extra parked cars scattered on street edges, for stealing variety.
  for (let i = 0; i < n; i++) {
    const pt = randomStreetPoint(G);
    if (nearMissionCar(pt.x, pt.z)) continue;
    const horiz = G.rng() < 0.5;
    const angle = horiz ? (G.rng() < 0.5 ? 0 : Math.PI) : (G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const off = (G.rng() < 0.5 ? -6 : 6);
    const x = horiz ? pt.x : pt.x + off;
    const z = horiz ? pt.z + off : pt.z;
    const car = spawnCar(G, pick(G.rng, ['sedan', 'sedan', 'van', 'truck', 'bike']), x, z, angle, { parked: true });
    car.parked = true;
  }
}
