// VELORA HEAT — vehicles: one factory, arcade top-down physics, traffic AI,
// police pursuit driving and car-vs-car / car-vs-building collisions.
// Angle convention: angle = atan2(dz, dx); 0 = east (+x), PI/2 = south (+z).
import { VEHICLES, WORLD } from './config.js';
import { clamp, angDiff, dist } from './random.js';

let nextId = 1;

export function createCar(kind, x, z, angle, opts = {}) {
  const v = VEHICLES[kind];
  const car = {
    id: nextId, kind, x, z, angle, speed: 0,
    hp: v.hp, maxHp: v.hp,
    parked: opts.parked ?? false,
    driver: opts.driver ?? false, // a traffic car with a driver inside
    mission: opts.mission ?? null, // 'M1' etc: this car is a mission target
    target: opts.target ?? false, // minimap gold marker on this car
    wasDriven: false,
    police: kind === 'police',
    racer: opts.racer ?? false,
    racerCp: 0,
    lane: opts.lane ?? 3.5,
    navX: null, navZ: null, navAxis: 'H', navDir: 1,
    stuck: 0, ramCd: 0, overtake: 0, brakeLight: false,
  };
  nextId += 1;
  return car;
}
export function resetCarIds() { nextId = 1; }
export function ensureCarId(n) { if (n >= nextId) nextId = n + 1; }

function carRadius(car) { return Math.max(1.6, VEHICLES[car.kind].len / 2 - 0.6); }

// Manhattan waypoint routing on the street grid (same rule a driver uses):
// hop onto the nearest street, drive along it, then turn onto the target.
function nextWaypoint(car, tx, tz) {
  const sx = WORLD.streets.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
  const sz = WORLD.streets.reduce((a, b) => Math.abs(b - car.z) < Math.abs(a - car.z) ? b : a);
  const offX = Math.abs(car.x - sx), offZ = Math.abs(car.z - sz);
  if (offX > 3 && offZ > 3) {
    // Off-street: hop onto the nearer street line first.
    return offZ <= offX ? { x: car.x, z: sz } : { x: sx, z: car.z };
  }
  if (offZ <= offX) {
    // On (or near) a horizontal street: run along it to the target's x.
    if (Math.abs(tx - car.x) > 6) return { x: tx, z: sz };
    return { x: tx, z: tz };
  }
  if (Math.abs(tz - car.z) > 6) return { x: sx, z: tz };
  return { x: tx, z: tz };
}

// Steer + accelerate a car toward a point. Returns true when within `arrive` m.
export function driveToward(G, car, tx, tz, topSpeed, dt, arrive = 6) {
  const wp = nextWaypoint(car, tx, tz);
  // Right-hand lane offset: aim 3.5 m to the right of the travel direction.
  const legA = Math.atan2(wp.z - car.z, wp.x - car.x);
  const ox = -Math.sin(legA) * car.lane, oz = Math.cos(legA) * car.lane;
  const ax = wp.x + ox, az = wp.z + oz;
  const want = Math.atan2(az - car.z, ax - car.x);
  const diff = angDiff(want, car.angle);
  const v = VEHICLES[car.kind];
  const dir = car.speed >= 0 ? 1 : -1;
  const turnRate = v.turn * clamp(Math.abs(car.speed) / 6, 0.3, 1) * dir;
  car.angle += clamp(diff, -turnRate * dt, turnRate * dt);
  const aligned = Math.abs(diff) < 0.6;
  if (aligned) car.speed = Math.min(topSpeed, car.speed + v.accel * dt);
  else car.speed = Math.max(4, car.speed - v.accel * 0.8 * dt);
  if (Math.abs(diff) > 1.2) car.speed = Math.max(2, car.speed - v.accel * dt);
  return dist(car.x, car.z, tx, tz) < arrive;
}

function moveCar(G, car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.z += Math.sin(car.angle) * car.speed * dt;
  const H = WORLD.half;
  car.x = clamp(car.x, -H, H);
  car.z = clamp(car.z, -H, H);
  // Buildings: slide out, lose speed, take damage on a hard hit.
  const before = { x: car.x, z: car.z };
  const fixed = G.city.resolveCircle(car.x, car.z, carRadius(car));
  car.x = fixed.x; car.z = fixed.z;
  const hit = Math.hypot(car.x - before.x, car.z - before.z) > 0.01;
  if (hit) {
    if (Math.abs(car.speed) > 10) {
      car.hp -= (Math.abs(car.speed) - 10) * 0.6;
      if (car === G.playerCar) G.audio.melee();
    }
    car.speed *= 0.35;
  }
}

function stepPlayerCar(G, dt) {
  const car = G.playerCar;
  if (!car) return;
  const v = VEHICLES[car.kind];
  const d = G.input.drive();
  if (d.fwd) car.speed = Math.min(v.top, car.speed + v.accel * dt);
  else if (d.back) car.speed = Math.max(-8, car.speed - v.accel * 0.9 * dt);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (d.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  const dir = car.speed >= 0 ? 1 : -1;
  const turnRate = v.turn * clamp(Math.abs(car.speed) / 6, 0.25, 1) * dir;
  car.angle += d.steer * turnRate * dt;
  car.brakeLight = d.brake || d.back;
  moveCar(G, car, dt);
  G.audio.engine(Math.abs(car.speed) / v.top);
}

function stepTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.police || car.racer || car.parked || car.hp <= 0) continue;
    if (car === G.playerCar) continue;
    // Pick a new navigation target at intersections.
    const sx = G.city.nearestStreet(car.x), sz = G.city.nearestStreet(car.z);
    const atX = Math.abs(car.x - sx) < 8, atZ = Math.abs(car.z - sz) < 8;
    if ((car.navX == null || dist(car.x, car.z, car.navX, car.navZ) < 9) && atX && atZ) {
      const r = G.rng();
      const axis = car.navAxis;
      if (axis === 'H') {
        const dir = Math.sign(car.navDir) || 1;
        const nx = sx + dir * 88;
        if (r < 0.6 && nx >= -308 && nx <= 308) { car.navX = nx; car.navZ = sz; car.navAxis = 'H'; }
        else { car.navX = sx; car.navZ = sz + (r < 0.8 ? 88 : -88); car.navAxis = 'V'; car.navDir = car.navZ > car.z ? 1 : -1; }
      } else {
        const dir = Math.sign(car.navDir) || 1;
        const nz = sz + dir * 88;
        if (r < 0.6 && nz >= -308 && nz <= 308) { car.navX = sx; car.navZ = nz; car.navAxis = 'V'; }
        else { car.navX = sx + (r < 0.8 ? 88 : -88); car.navZ = sz; car.navAxis = 'H'; car.navDir = car.navX > car.x ? 1 : -1; }
      }
      car.navX = clamp(car.navX, -308, 308);
      car.navZ = clamp(car.navZ, -308, 308);
    }
    if (car.navX == null) { car.navX = car.x + 88; car.navZ = sz; car.navAxis = 'H'; car.navDir = 1; }
    // Slow for a car ahead in the same lane; overtake a stopped one.
    let ahead = null;
    for (const other of G.cars) {
      if (other === car || other.hp <= 0) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const fwd = dx * Math.cos(car.angle) + dz * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dz * Math.cos(car.angle));
      if (fwd > 0 && fwd < 12 && side < 3) { ahead = other; break; }
    }
    let top = 9 + (car.id % 4);
    if (ahead) {
      if (ahead.speed < 1 && Math.abs(ahead.speed) < 0.5) {
        car.overtake += dt;
        if (car.overtake > 2) car.lane = -car.lane, car.overtake = 0;
        top = 6;
      } else {
        top = Math.min(top, Math.max(0, ahead.speed));
        car.overtake = 0;
      }
    }
    driveToward(G, car, car.navX, car.navZ, top, dt, 8);
    moveCar(G, car, dt);
  }
}

function stepPoliceCars(G, dt) {
  const p = G.player;
  const pc = G.playerCar;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  const inHideout = dist(px, pz, G.hideout.x, G.hideout.z) < G.hideout.r;
  for (const car of [...G.cars]) {
    if (!car.police || car.hp <= 0 || car === G.playerCar) continue;
    car.ramCd = Math.max(0, car.ramCd - dt);
    const d = dist(car.x, car.z, px, pz);
    const top = VEHICLES.police.top * (0.8 + 0.06 * G.wanted);
    if (G.wanted === 0) {
      // Heat gone: drive back to VBPD HQ and despawn there.
      driveToward(G, car, 220, -220, 14, dt, 15);
      if (dist(car.x, car.z, 220, -220) < 15) {
        const i = G.cars.indexOf(car);
        if (i >= 0) G.cars.splice(i, 1);
        continue;
      }
    } else if (inHideout) {
      // Hold a perimeter outside the hideout; never enter it.
      const ang = Math.atan2(car.z - G.hideout.z, car.x - G.hideout.x);
      driveToward(G, car, G.hideout.x + Math.cos(ang) * 30, G.hideout.z + Math.sin(ang) * 30, 12, dt, 6);
    } else if (pc && d < 9) {
      // Player in a car and close: hold off a little, rams happen on approach.
      if (d > 8) driveToward(G, car, px, pz, top, dt, 8);
      else car.speed = Math.max(0, car.speed - 20 * dt);
    } else if (!pc && d < 8) {
      // Player on foot: hold ~7 m short and let the foot officers close in.
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      driveToward(G, car, px, pz, top, dt, 5);
    }
    moveCar(G, car, dt);
    // Ram: one impact per cooldown, only when the player is in a car.
    if (pc && G.wanted >= 3 && d < 4.2 && car.ramCd <= 0 && Math.abs(car.speed) > 4) {
      pc.hp -= 3;
      const push = Math.atan2(pc.z - car.z, pc.x - car.x);
      pc.x += Math.cos(push) * 1.5; pc.z += Math.sin(push) * 1.5;
      car.speed *= 0.4;
      car.ramCd = 2;
      G.shake = Math.max(G.shake, 0.25);
    }
  }
}

function stepRacers(G, dt) {
  if (!G.mission.active || G.mission.index !== 4) return;
  for (const car of G.cars) {
    if (!car.racer || car.hp <= 0) continue;
    const cp = G.raceCheckpoints[car.racerCp];
    if (!cp) continue;
    const arrived = driveToward(G, car, cp[0], cp[1], VEHICLES.gt.top * 0.6, dt, 9);
    if (arrived || dist(car.x, car.z, cp[0], cp[1]) < 9) car.racerCp += 1;
    moveCar(G, car, dt);
  }
}

function collideCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = carRadius(a) + carRadius(b) - 0.4;
      if (d < min && d > 0.001) {
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        const aParked = a.parked, bParked = b.parked;
        if (!aParked) { a.x -= nx * push; a.z -= nz * push; }
        if (!bParked) { b.x += nx * push; b.z += nz * push; }
        const closing = Math.abs(a.speed - b.speed);
        if (closing > 8) {
          a.hp -= closing * 0.25; b.hp -= closing * 0.25;
          if (a === G.playerCar || b === G.playerCar) G.shake = Math.max(G.shake, 0.2);
        }
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
}

function hitAndRun(G, dt) {
  const pc = G.playerCar;
  if (!pc || Math.abs(pc.speed) < 8) return;
  for (const ped of G.peds) {
    if (ped.hp <= 0) continue;
    if (dist(pc.x, pc.z, ped.x, ped.z) < carRadius(pc) + 0.8) {
      ped.hp = 0;
      ped.dead = true;
      pc.speed *= 0.85;
      G.police.addWanted(1, 'hit-and-run');
      G.feed('Hit-and-run! A witness may have seen it.');
      G.audio.melee();
    }
  }
}

export function stepCars(G, dt) {
  stepPlayerCar(G, dt);
  stepTraffic(G, dt);
  stepPoliceCars(G, dt);
  stepRacers(G, dt);
  collideCars(G);
  hitAndRun(G, dt);
  // Wrecked cars: smoke, stay as obstacles, never enterable.
  for (const car of G.cars) {
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      car.parked = true;
      if (car === G.playerCar) G.player.exitCar(true);
    }
  }
}

export function nearestCar(G, x, z, r, filter) {
  let best = null, bd = r;
  for (const car of G.cars) {
    if (car.hp <= 0) continue;
    if (filter && !filter(car)) continue;
    const d = dist(x, z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
