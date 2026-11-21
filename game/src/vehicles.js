// VELORA HEAT — vehicles: factory from the variant table, arcade physics,
// traffic AI (street-grid routing), pursuit/racer steering, enter/exit/steal.
import { VEHICLES, TRAFFIC_MIX, street } from './config.js';
import { pick, range, clamp, angDiff, dist } from './random.js';

let nextId = 1;

export function makeCar(kind, x, z, angle, opts = {}) {
  const v = VEHICLES[kind];
  const id = opts.id != null ? opts.id : nextId++;
  if (opts.id != null) nextId = Math.max(nextId, opts.id + 1);
  const c = {
    id, kind, name: v.name, x, z, angle, speed: 0,
    hp: v.hp, maxHp: v.hp, color: opts.color || pickColor(kind),
    driver: opts.driver || 'none', target: !!opts.target, parked: !!opts.parked,
    mission: opts.mission || null, ramT: 0, brakeLight: false, smoke: 0,
    ai: null, cp: 0, finished: false, finishTime: 0,
  };
  if (c.driver === 'traffic') c.ai = { tx: x, tz: z, wait: 0, lane: (Math.random() < 0.5 ? 2.5 : -2.5) };
  return c;
}
function pickColor(kind) {
  const cols = VEHICLES[kind].colors;
  return cols[Math.floor(Math.random() * cols.length)];
}

export function nearestStreetPoint(x, z) {
  // Nearest street centreline point to (x,z): snap to the closest street line.
  let best = null, bd = Infinity;
  for (let i = 0; i <= 7; i++) {
    const s = street(i);
    const d1 = Math.abs(x - s), d2 = Math.abs(z - s);
    if (d1 < bd) { bd = d1; best = { x: s, z }; }
    if (d2 < bd) { bd = d2; best = { x, z: s }; }
  }
  return best;
}
export function randomStreetPoint(rng) {
  const i = Math.floor(rng() * 8), j = Math.floor(rng() * 8);
  return rng() < 0.5 ? { x: street(i), z: -300 + rng() * 600 } : { x: -300 + rng() * 600, z: street(j) };
}

export function spawnWorldCars(G, rng) {
  G.cars = [];
  // Mission target cars (parked, marked).
  G.cars.push(makeCar('gt', 220, 132, Math.PI / 2, { parked: true, target: true, mission: 'M1', color: '#e01e2b' }));
  G.cars.push(makeCar('van', -44, 220, 0, { parked: true, target: true, mission: 'M2', color: '#e8e4da' }));
  // Parked cars along streets.
  const parkedSpots = [
    [-220, 44, 'sedan'], [-132, -44, 'sedan'], [44, 44, 'truck'], [132, -44, 'bike'],
    [-44, -132, 'sedan'], [220, 44, 'sedan'], [-308, -44, 'van'], [44, 220, 'sedan'],
    [-132, 220, 'truck'], [308, 44, 'sedan'], [132, 220, 'bike'], [-44, -308, 'sedan'],
    [220, -220, 'sedan'], [-220, -220, 'van'], [44, -220, 'truck'], [308, -132, 'sedan'],
  ];
  for (const [x, z, kind] of parkedSpots) {
    G.cars.push(makeCar(kind, x, z, rng() < 0.5 ? 0 : Math.PI / 2, { parked: true }));
  }
  // Parked VBPD Interceptor at the station (stealing it = instant 3 stars).
  G.cars.push(makeCar('police', 132, 116, Math.PI, { parked: true }));
  // Moving traffic.
  for (let i = 0; i < 14; i++) {
    const p = randomStreetPoint(rng);
    const kind = pick(rng, TRAFFIC_MIX);
    const c = makeCar(kind, p.x, p.z, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), { driver: 'traffic' });
    c.speed = range(rng, 6, 10);
    G.cars.push(c);
  }
}

// --- steering helper: turn toward (tx,tz), accelerate toward top speed --------
export function driveToward(G, c, tx, tz, dt, topMul = 1, accelMul = 1) {
  const v = VEHICLES[c.kind];
  const want = Math.atan2(tz - c.z, tx - c.x);
  const d = angDiff(want, c.angle);
  const steer = clamp(d * 2.2, -1, 1);
  c.angle += steer * 2.4 * dt * clamp(Math.abs(c.speed) / 4 + 0.3, 0, 1);
  const top = v.top * topMul;
  if (c.speed < top) c.speed += v.accel * accelMul * dt;
  else c.speed = Math.max(top, c.speed - v.brake * dt);
  return dist(c.x, c.z, tx, tz);
}

function collideCarWithBuildings(G, c) {
  const v = VEHICLES[c.kind];
  const fx = Math.cos(c.angle), fz = Math.sin(c.angle);
  const half = v.len / 2 - 0.6;
  for (const s of [-1, 1]) {
    const p = { x: c.x + fx * half * s, z: c.z + fz * half * s };
    const ox = p.x, oz = p.z;
    G.city.pushOutCircle(p, v.wid / 2 + 0.3);
    c.x += p.x - ox; c.z += p.z - oz;
  }
  // Recompute heading from the two circle positions is overkill; angle stays.
}

export function updateCars(G, dt) {
  const input = G.input;
  for (const c of G.cars) {
    if (c.ramT > 0) c.ramT -= dt;
    if (c.driver === 'player') updatePlayerCar(G, c, dt);
    else if (c.driver === 'traffic') updateTraffic(G, c, dt);
    else if (c.driver === 'police') updatePoliceCar(G, c, dt);
    else if (c.driver === 'racer') updateRacer(G, c, dt);
    else if (Math.abs(c.speed) > 0.1) { c.speed = approach(c.speed, 0, 8 * dt); }
    if (Math.abs(c.speed) > 0.01) {
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.z += Math.sin(c.angle) * c.speed * dt;
      collideCarWithBuildings(G, c);
    }
    c.smoke = c.hp < c.maxHp * 0.4 ? 1 : c.hp < c.maxHp * 0.7 ? 0.5 : 0;
  }
  // Car-car separation + ram damage (one-time per contact, per-car cooldown).
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = (VEHICLES[a.kind].len + VEHICLES[b.kind].len) / 2 * 0.72;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        // Police-vs-player contact is owned by the pursuit ram system — the
        // car-car block must not double-dip on the same hit (14 dmg/contact
        // wrecked the GT in seconds during the M4 escape).
        const policePlayer = (a.driver === 'police' && b.driver === 'player') ||
          (a.driver === 'player' && b.driver === 'police');
        if (rel > 6 && a.ramT <= 0 && b.ramT <= 0 && !policePlayer) {
          const dmg = Math.min(10, (rel - 6) * 1.0);
          a.hp -= dmg; b.hp -= dmg; a.ramT = 0.6; b.ramT = 0.6;
          a.speed *= 0.55; b.speed *= 0.55;
          G.audio.crash();
          if (a.driver === 'player' || b.driver === 'player') G.shake = Math.max(G.shake, 0.35);
        }
      }
    }
  }
  // Hit-and-run: player car (or police car) at speed over a pedestrian.
  const pc = playerCar(G);
  if (pc && Math.abs(pc.speed) > 8) {
    for (const p of G.peds) {
      if (p.hp > 0 && dist(pc.x, pc.z, p.x, p.z) < 2.4) {
        p.hp = 0; p.state = 'dead'; p.deadT = 0;
        if (G.crimeCooldown <= 0) { G.police.commitCrime('hitAndRun'); G.crimeCooldown = 5; }
        G.audio.crash();
      }
    }
  }
  // Wrecked cars: burn out, stop.
  for (const c of G.cars) {
    if (c.hp <= 0 && c.speed !== 0) {
      c.speed = 0;
      if (c.driver === 'player') { G.player.inCar = null; G.hud.toast('Your car is wrecked!'); }
      c.driver = 'none';
    }
  }
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

function updatePlayerCar(G, c, dt) {
  const v = VEHICLES[c.kind];
  const ax = G.input.axis();
  // ax.x = steering (A/D), ax.z = throttle (W/S: z=-1 is forward/up)
  const throttle = -ax.z;
  if (throttle > 0) c.speed += v.accel * dt;
  else if (throttle < 0) c.speed -= (c.speed > 0 ? v.brake : v.accel * 0.7) * dt;
  else c.speed = approach(c.speed, 0, 6 * dt);
  if (G.input.brake()) c.speed = approach(c.speed, 0, 22 * dt);
  c.speed = clamp(c.speed, -v.top * 0.4, v.top);
  const steer = ax.x * clamp(Math.abs(c.speed) / 8, 0, 1);
  c.angle += steer * v.grip * 0.55 * dt * (c.speed >= 0 ? 1 : -1);
  c.brakeLight = throttle < 0 || G.input.brake();
  G.audio.engine(Math.abs(c.speed) / v.top, true);
}

function updateTraffic(G, c, dt) {
  const v = VEHICLES[c.kind];
  const ai = c.ai;
  // Stop for a car ahead on the same street — but OVERTAKE a parked car
  // instead of waiting behind it forever (a parked car never moves, so a
  // waiter would camp on it and block the player from stealing it).
  let blocked = false, parkedAhead = null;
  for (const o of G.cars) {
    if (o === c || o.driver === 'player') continue;
    const dx = o.x - c.x, dz = o.z - c.z;
    const ahead = dx * Math.cos(c.angle) + dz * Math.sin(c.angle);
    const side = Math.abs(-dx * Math.sin(c.angle) + dz * Math.cos(c.angle));
    if (ahead > 0 && ahead < 9 && side < 2.6) {
      if (o.parked) parkedAhead = o;
      else { blocked = true; break; }
    }
  }
  if (blocked) { c.speed = approach(c.speed, 0, 14 * dt); return; }
  const d = dist(c.x, c.z, ai.tx, ai.tz);
  if (d < 4) {
    // Pick a new neighbouring intersection on the grid.
    const si = Math.round((c.x + 308) / 88), sj = Math.round((c.z + 308) / 88);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => si + a >= 0 && si + a <= 7 && sj + b >= 0 && sj + b <= 7);
    const [a, b] = pick(G.rng, dirs);
    ai.tx = street(si + a); ai.tz = street(sj + b);
    ai.ox = 0;
    return;
  }
  // Overtake: steer around the parked car on the far side (6 m lateral —
  // the street is 18 m wide, so the car stays on the road).
  let tx = ai.tx, tz = ai.tz;
  if (parkedAhead) {
    const dx = parkedAhead.x - c.x, dz = parkedAhead.z - c.z;
    const side = -dx * Math.sin(c.angle) + dz * Math.cos(c.angle);
    if (ai.ox == null || ai.ox === 0) ai.ox = (side >= 0 ? -1 : 1) * 6;
    tx += -Math.sin(c.angle) * ai.ox;
    tz += Math.cos(c.angle) * ai.ox;
  } else ai.ox = 0;
  driveToward(G, c, tx, tz, dt, 0.42, 0.8);
}

function updatePoliceCar(G, c, dt) {
  const target = G.police.pursuitTarget(c);
  if (!target) { c.speed = approach(c.speed, 0, 10 * dt); return; }
  // Pursuit top speed is capped BELOW the fastest player car so escape is possible.
  const cap = Math.min(30, 18 + G.wanted * 2.2);
  driveToward(G, c, target.x, target.z, dt, cap / VEHICLES.police.top, 1);
  // Ram: one-time impact on contact transition; the rammer bounces OFF (its
  // speed is cut) so it cannot sit glued and re-ram every cooldown.
  const p = G.player;
  const pc = playerCar(G);
  const tx = pc ? pc.x : p.x, tz = pc ? pc.z : p.z;
  if (dist(c.x, c.z, tx, tz) < 3.4 && c.ramT <= 0 && Math.abs(c.speed) > 8) {
    c.ramT = 1.5;
    c.speed *= 0.35; // bounce off after the hit
    if (pc) { pc.hp -= 3; pc.speed *= 0.5; }
    else { p.hp -= 5; }
    G.shake = Math.max(G.shake, 0.5);
    G.audio.crash();
  }
}

function updateRacer(G, c, dt) {
  if (c.finished) { c.speed = approach(c.speed, 0, 10 * dt); return; }
  const cps = G.mission.raceCps || [];
  const cp = cps[c.cp];
  if (!cp) return;
  const d = driveToward(G, c, cp.x, cp.z, dt, 0.6, 1);
  if (d < 8) {
    c.cp++;
    if (c.cp >= cps.length) { c.finished = true; c.finishTime = G.time; }
  }
}

export function playerCar(G) {
  const id = G.player.inCar;
  if (id == null) return null;
  return G.cars.find((c) => c.id === id) || null;
}

export function nearestCar(G, x, z, maxR) {
  let best = null, bd = maxR;
  for (const c of G.cars) {
    if (c.hp <= 0) continue;
    const d = dist(x, z, c.x, c.z);
    // Mission-target cars win the E press when reasonably near (r13 lesson).
    const eff = c.target ? d - 4 : d;
    if (eff < bd) { bd = eff; best = c; }
  }
  return best;
}
export function nearestStorableCar(G, x, z, maxR) {
  // Garage store takes the nearest NON-police, non-mission-target car (r10 F3).
  // A car already owned is already stored — never return it (re-storing would
  // duplicate its owned record and shuffle it to another slot).
  let best = null, bd = maxR;
  for (const c of G.cars) {
    if (c.hp <= 0 || c.kind === 'police' || c.target) continue;
    if (G.owned.some((o) => o.carId === c.id)) continue;
    const d = dist(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(G, c) {
  const p = G.player;
  p.inCar = c.id;
  c.driver = 'player'; c.parked = false;
  p.x = c.x; p.z = c.z; p.angle = c.angle;
  G.audio.engine(0, true);
}
export function exitCar(G) {
  const p = G.player;
  const c = playerCar(G);
  if (!c) return;
  p.inCar = null;
  c.driver = 'none'; c.parked = true; c.speed = 0;
  // Step out to the left side of the car.
  p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 2.2;
  p.z = c.z + Math.sin(c.angle + Math.PI / 2) * 2.2;
  p.angle = c.angle;
  G.city.pushOutCircle(p, 0.6);
  G.audio.engine(0, false);
}
