// Vehicles — one factory, one arcade physics model, stats per variant row.
// Steering convention: D (+1) DECREASES the world heading, which turns the car toward its
// own right hand side. The test driver calibrates this live; the sign is asserted by probe.
import * as THREE from 'three';
import { VEHICLES, TRAFFIC_MIX, CITY } from './config.js';

let nextId = 1;

function buildMesh(variant, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const len = variant.len, wid = variant.wid;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.82, 0.62, len * 0.42), glassMat);
  cabin.position.set(0, 1.2, -len * 0.06); cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  // Headlights + taillights so cars read at golden hour.
  const hl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.7, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.62, len / 2 + 0.02); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.7, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xc22a1a }));
  tl.position.set(0, 0.62, -len / 2 - 0.02); g.add(tl);
  if (variant.kind === 'pursuit') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.6, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.62, 0); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.3, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0, 1.62, 0); g.add(bar2);
  }
  return { group: g, wheels };
}

export function createVehicles(G) {
  const list = [];
  G.vehicles = { list, owned: [] };

  function spawn(variantKey, x, z, heading, opts = {}) {
    const v = VEHICLES[variantKey];
    const { group, wheels } = buildMesh(v, opts.color ?? v.color);
    group.position.set(x, 0, z); group.rotation.y = heading;
    G.scene.add(group);
    const car = {
      id: nextId++, variant: variantKey, def: v, x, z, heading, speed: 0,
      hp: v.hp, maxHp: v.hp, mesh: group, wheels,
      isPlayer: false, isTraffic: !!opts.traffic, isPursuit: !!opts.pursuit,
      isParked: opts.parked !== false, target: !!opts.target, wrecked: false,
      route: opts.route || null, routeIdx: 0, wait: 0, color: opts.color ?? v.color,
      lastContact: 0, contactWith: new Set(),
    };
    list.push(car);
    return car;
  }

  function remove(car) {
    G.scene.remove(car.mesh);
    const i = list.indexOf(car); if (i >= 0) list.splice(i, 1);
  }

  // Drive a car toward (tx,tz) with arcade steering; returns distance left.
  function driveToward(car, tx, tz, dt, topMul = 1) {
    const dx = tx - car.x, dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let err = want - car.heading;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    const steer = Math.max(-1, Math.min(1, err * 1.6));
    const top = car.def.top * topMul;
    car.speed += car.def.accel * dt;
    if (car.speed > top) car.speed = top;
    // Heading INCREASES toward the target (err > 0 means the target sits at a higher
    // heading; increasing the heading turns the car toward its left, i.e. toward it).
    car.heading += steer * car.def.grip * Math.min(1, Math.abs(car.speed) / 12) * dt * (car.speed >= 0 ? 1 : -1);
    stepCar(car, dt);
    return dist;
  }

  function stepCar(car, dt) {
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = Math.max(-415, Math.min(415, car.x));
    car.z = Math.max(-415, Math.min(415, car.z));
    const before = { x: car.x, z: car.z };
    if (G.city.resolveCircle(car, 2.2)) {
      // Scraped a building: shed speed, take a little damage.
      if (Math.abs(car.speed) > 6) car.hp -= 2;
      car.speed *= 0.55;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true; car.speed = 0;
      car.mesh.rotation.z = 0.06; // listed, dead
    }
  }

  // Player driving: W/S throttle, A/D steer (D decreases heading = turn right).
  function updatePlayerCar(car, input, dt) {
    if (car.wrecked) { car.speed *= 0.9; stepCar(car, dt); return; }
    const th = input.throttle();
    if (th > 0) car.speed += car.def.accel * dt;
    else if (th < 0) car.speed -= car.def.accel * 1.4 * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    const top = car.def.top, rev = -9;
    car.speed = Math.max(rev, Math.min(top, car.speed));
    const steer = input.steer();
    const grip = car.def.grip * Math.min(1, Math.abs(car.speed) / 10);
    car.heading -= steer * grip * dt * (car.speed >= 0 ? 1 : -1);
    stepCar(car, dt);
  }

  // Traffic: follow the street grid one axis-aligned leg at a time, turn at intersections,
  // keep spacing. A leg always shares x or z with the last point, so cars never cut blocks.
  function updateTraffic(car, dt) {
    if (car.wrecked) return;
    if (!car.route || car.route.length === 0) {
      const cx = nearestStreet(car.x), cz = nearestStreet(car.z);
      const streets = CITY.streets;
      const s = streets[Math.floor(G.rng.next() * streets.length)];
      car.route = G.rng.chance(0.5) ? [[s, cz]] : [[cx, s]];
      // Never pick the spot we already stand on.
      if (Math.hypot(car.route[0][0] - car.x, car.route[0][1] - car.z) < 20) {
        car.route = [[cx === 360 ? -360 : 360, cz]];
      }
    }
    const [tx, tz] = car.route[0];
    const d = driveToward(car, tx, tz, dt, 0.42);
    if (d < 6) car.route.shift();
    // Gentle spacing: slow down if a car is right ahead.
    for (const other of list) {
      if (other === car || other.isParked) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 11 && side < 3) { car.speed = Math.min(car.speed, other.speed); break; }
    }
  }

  function nearestStreet(v) {
    let best = CITY.streets[0], bd = Infinity;
    for (const s of CITY.streets) { const d = Math.abs(s - v); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  function nearestCar(x, z, maxD, preferTargetId) {
    let best = null, bd = maxD;
    for (const c of list) {
      if (c.wrecked) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d > maxD) continue; // the mission target only wins INSIDE the interact radius
      if (c.id === preferTargetId) return c;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function nearestStorableCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of list) {
      if (c.wrecked || c.isPursuit || c.target || c.isPlayer) continue;
      if (G.vehicles.owned.some((o) => o.id === c.id)) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function update(dt, input) {
    for (const car of [...list]) {
      if (car.isPlayer) updatePlayerCar(car, input, dt);
      else if (car.isTraffic) updateTraffic(car, dt);
      // Pursuit cars are steered by police.js; parked cars do not move.
    }
    // Car-vs-car soft collisions: push apart, small speed trade.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2, nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.9; b.speed = avg * 0.9;
        }
      }
    }
  }

  return { spawn, remove, driveToward, stepCar, nearestCar, nearestStorableCar, update, list };
}
