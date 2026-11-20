// Vehicles: one factory builds every vehicle from the VEHICLES table (body proportions,
// colours, stats), one arcade physics model drives them all, and one traffic AI loops
// them around the street grid. Stealing, entering, exiting and damage live here too.
import * as THREE from 'three';
import { VEHICLES, WORLD, TRAFFIC_COUNT } from './config.js';
import { createRandom, pick, clamp, wrapAngle, dist2d } from './random.js';

let nextId = 1;

function buildCarMesh(kind, color) {
  const v = VEHICLES[kind];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const len = v.len;
  const wid = v.wid;
  const bodyH = kind === 'bike' ? 0.5 : kind === 'truck' || kind === 'van' ? 1.5 : 0.75;
  const bodyY = kind === 'bike' ? 0.55 : 0.75;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);

  if (kind !== 'bike') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.82, 0.62, len * 0.42), darkMat);
    cabin.position.set(0, bodyY + bodyH / 2 + 0.28, kind === 'truck' ? len * 0.22 : -len * 0.06);
    cabin.castShadow = true;
    group.add(cabin);
  }
  if (kind === 'truck' || kind === 'van') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.94, 1.1, len * 0.5), new THREE.MeshLambertMaterial({ color: 0x8a8a92 }));
    cargo.position.set(0, bodyY + bodyH / 2 + 0.5, -len * 0.2);
    cargo.castShadow = true;
    group.add(cargo);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.5, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, bodyY + bodyH + 0.55, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.24, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-wid * 0.13, bodyY + bodyH + 0.68, 0);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.24, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(wid * 0.13, bodyY + bodyH + 0.68, 0);
    group.add(blue);
    group.userData.lightBar = { red, blue };
  }
  // Headlights + taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), hl);
    h.position.set(s * wid * 0.32, bodyY, len / 2 + 0.02);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), tl);
    t.position.set(s * wid * 0.32, bodyY, -len / 2 - 0.02);
    group.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  const wheelZ = kind === 'bike' ? [len * 0.32, -len * 0.32] : [len * 0.32, -len * 0.32];
  for (const wz of wheelZ) {
    for (const s of kind === 'bike' ? [0] : [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(s * (wid / 2 - 0.05), 0.38, wz);
      w.castShadow = true;
      group.add(w);
      wheels.push(w);
    }
  }
  group.userData.wheels = wheels;
  // Damage smoke anchor.
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0 }));
  smoke.position.set(0, 1.6, len * 0.3);
  group.add(smoke);
  group.userData.smoke = smoke;
  return group;
}

export function createVehicleSys(G) {
  const sys = {
    list: [],
    traffic: [],
    parked: [],
    playerCar: null,
    rng: createRandom(1337),
  };

  function spawnVehicle(kind, x, z, heading, opts = {}) {
    const v = VEHICLES[kind];
    const color = opts.color ?? pick(sys.rng, v.colors);
    const mesh = buildCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    const car = {
      id: `v${nextId++}`,
      kind,
      name: v.name,
      mesh,
      x, z, heading,
      speed: 0,
      health: v.health,
      maxHealth: v.health,
      color,
      owner: opts.owner || null,       // 'player' for garage-owned cars
      isPolice: kind === 'police',
      isTraffic: !!opts.traffic,
      isParked: !!opts.parked,
      target: opts.target || null,     // mission target car
      ai: opts.traffic ? { street: pick(sys.rng, WORLD.streets), axis: sys.rng() < 0.5 ? 'x' : 'z', dir: sys.rng() < 0.5 ? 1 : -1, wait: 0 } : null,
      smoke: 0,
      dead: false,
    };
    sys.list.push(car);
    if (car.isTraffic) sys.traffic.push(car);
    if (car.isParked) sys.parked.push(car);
    return car;
  }

  function removeVehicle(car) {
    G.scene.remove(car.mesh);
    sys.list = sys.list.filter((c) => c !== car);
    sys.traffic = sys.traffic.filter((c) => c !== car);
    sys.parked = sys.parked.filter((c) => c !== car);
    if (sys.playerCar === car) sys.playerCar = null;
  }

  // --- Arcade physics: shared by the player car, traffic and police. ------
  function stepCar(car, dt, steer, throttle, brake) {
    const v = VEHICLES[car.kind];
    if (throttle > 0) car.speed += v.accel * throttle * dt;
    if (throttle < 0) car.speed += v.accel * 0.7 * throttle * dt;
    if (brake) car.speed = Math.max(0, car.speed - v.brake * dt);
    // Rolling drag + reverse cap.
    car.speed -= car.speed * 0.35 * dt;
    if (car.speed < -v.topSpeed * 0.35) car.speed = -v.topSpeed * 0.35;
    if (car.speed > v.topSpeed) car.speed = v.topSpeed;
    const spd = Math.abs(car.speed);
    const turn = steer * v.grip * dt * clamp(spd / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.heading += turn;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const pos = { x: nx, z: nz };
    G.city.resolveCollision(pos, v.len * 0.42);
    const moved = dist2d(pos.x, pos.z, car.x, car.z);
    if (moved < Math.abs(car.speed) * dt * 0.4 && spd > 6) {
      // Hit a wall: kill speed, thud, damage a little.
      if (car === sys.playerCar) {
        G.audio.crash();
        G.hud.shake(0.35);
        car.health -= 4;
        if (car.health <= 0) sys.explodeCar(car);
      }
      car.speed *= 0.3;
    }
    car.x = pos.x;
    car.z = pos.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Wheel spin + lean.
    const spin = car.speed * dt * 2;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    car.mesh.rotation.z = -steer * clamp(spd / v.topSpeed, 0, 1) * 0.06;
    // Damage smoke.
    const dmg = 1 - car.health / car.maxHealth;
    if (car.mesh.userData.smoke) {
      car.mesh.userData.smoke.material.opacity = dmg > 0.45 ? (dmg - 0.45) * 1.2 : 0;
      car.mesh.userData.smoke.position.y = 1.6 + Math.sin(G.time * 9 + car.id.length) * 0.15;
    }
    if (car.mesh.userData.lightBar) {
      const on = Math.sin(G.time * 14) > 0;
      car.mesh.userData.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x550000);
      car.mesh.userData.lightBar.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
    }
  }

  // Traffic AI: follow the street grid, turn at intersections, keep spacing.
  function stepTraffic(car, dt) {
    const ai = car.ai;
    if (ai.wait > 0) { ai.wait -= dt; return; }
    // Car ahead? brake.
    let blocked = false;
    for (const other of sys.list) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
      const side = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
      if (ahead > 0 && ahead < 13 && side < 3) { blocked = true; break; }
    }
    // Steer toward the current street line, then along it.
    const targetHeading = ai.axis === 'x'
      ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (ai.dir > 0 ? 0 : Math.PI);
    // Snap to the street: drift the car toward its street coordinate.
    const streetCoord = ai.axis === 'x' ? car.z : car.x;
    const drift = clamp((ai.street - streetCoord) * 0.12, -0.5, 0.5);
    let steer = clamp(wrapAngle(targetHeading - car.heading) * 1.6 + drift, -1, 1);
    // At an intersection, sometimes turn onto a crossing street.
    const onStreet = ai.axis === 'x'
      ? WORLD.streets.some((s) => Math.abs(car.x - s) < 4)
      : WORLD.streets.some((s) => Math.abs(car.z - s) < 4);
    if (onStreet && sys.rng() < dt * 0.25) {
      ai.axis = ai.axis === 'x' ? 'z' : 'x';
      ai.street = ai.axis === 'x' ? Math.round(car.z / 120) * 120 : Math.round(car.x / 120) * 120;
      ai.dir = sys.rng() < 0.5 ? 1 : -1;
      ai.wait = 0.4;
    }
    const throttle = blocked ? 0 : 0.55;
    stepCar(car, dt, steer, throttle, blocked);
    // Keep traffic inside the world.
    if (Math.abs(car.x) > 400 || Math.abs(car.z) > 400) {
      const s = pick(sys.rng, WORLD.streets);
      car.x = clamp(car.x, -390, 390);
      car.z = clamp(car.z, -390, 390);
      void s;
    }
  }

  // Player driving (called from player.js via G).
  function stepPlayerCar(dt, input) {
    const car = sys.playerCar;
    if (!car) return;
    const mv = input.moveVector();
    const steer = -mv.s; // A = left
    const throttle = mv.f;
    const brake = input.down('Space');
    stepCar(car, dt, steer, throttle, brake);
    G.audio.engine(Math.abs(car.speed) / VEHICLES[car.kind].topSpeed);
    // Hit-and-run: a ped within 2.6 m of a fast car dies and adds heat.
    if (Math.abs(car.speed) > 8) {
      const hit = G.peds.hitByCar(car.x, car.z, 2.6);
      if (hit) G.police.addCrime('hitAndRun', car.x, car.z);
    }
  }

  sys.spawnVehicle = spawnVehicle;
  sys.removeVehicle = removeVehicle;
  sys.stepCar = stepCar;
  sys.stepPlayerCar = stepPlayerCar;

  sys.spawnWorld = () => {
    // Mission target cars.
    sys.spawnVehicle('gt', G.city.points.missionCar.x, G.city.points.missionCar.z, Math.PI / 2, { parked: true, target: 'M1', color: 0xd81e1e });
    sys.spawnVehicle('van', G.city.points.vanSpot.x, G.city.points.vanSpot.z, 0, { parked: true, target: 'M2', color: 0xd8d8d8 });
    // Parked cars around the city (street parking, all stealable).
    const spots = [
      ['sedan', -240, 120, 0], // right by the spawn, for a quick first steal
      ['sedan', -360, 120, 0], ['sedan', -240, -300, Math.PI / 2], ['gt', 120, 240, Math.PI],
      ['truck', 240, -360, 0], ['van', 0, 360, Math.PI / 2], ['bike', -120, -360, 0],
      ['sedan', 360, -240, Math.PI / 2], ['sedan', 120, -120, 0], ['truck', -360, -240, Math.PI],
      ['bike', 240, 240, 0], ['sedan', -120, 120, Math.PI / 2], ['van', 360, 60, Math.PI],
    ];
    for (const [kind, x, z, h] of spots) sys.spawnVehicle(kind, x, z, h, { parked: true });
    // One police Interceptor parked at the CBPD station (block 60,60 front on street x=120).
    sys.spawnVehicle('police', 120, 60, Math.PI / 2, { parked: true });
    // Traffic.
    const kinds = Object.keys(VEHICLES).filter((k) => VEHICLES[k].traffic > 0);
    const bag = [];
    for (const k of kinds) {
      const n = Math.round(VEHICLES[k].traffic * TRAFFIC_COUNT);
      for (let i = 0; i < n; i += 1) bag.push(k);
    }
    while (bag.length < TRAFFIC_COUNT) bag.push('sedan');
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const s = pick(sys.rng, WORLD.streets);
      const t = pick(sys.rng, WORLD.streets);
      const axis = sys.rng() < 0.5 ? 'x' : 'z';
      const car = sys.spawnVehicle(bag[i % bag.length], axis === 'x' ? t : s, axis === 'x' ? s : t, 0, { traffic: true });
      car.ai.street = s;
      car.ai.axis = axis;
      car.ai.dir = sys.rng() < 0.5 ? 1 : -1;
    }
  };

  sys.update = (dt) => {
    for (const car of sys.traffic) {
      if (!car.dead && car !== sys.playerCar) stepTraffic(car, dt);
    }
    // Parked cars never move. Police pursuit cars are stepped by police.js.
  };

  // Nearest car that can actually be stored in the garage (not a police car,
  // not a mission target, not already player-owned). The plain nearest car can
  // be a pursuit Interceptor or the M1 GT parked on top of the car the player
  // means to store — and then E silently does something else instead.
  sys.nearestStorableCar = (x, z, maxDist) => {
    let best = null;
    let bestD = maxDist;
    for (const car of sys.list) {
      if (car.dead || car === sys.playerCar || car.isPolice || car.target || car.owner === 'player') continue;
      const d = dist2d(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  };

  // The mission's target car (e.g. the M1 Tempest GT) wins over any nearer car:
  // a pursuit car parked on top of the objective must not steal the E press.
  // (Round-13 fix: a 1-star pursuit car ended up closer to the player than the
  // GT, so E entered the police car instead of the mission car.)
  sys.nearestCar = (x, z, maxDist, preferTarget) => {
    if (preferTarget) {
      let best = null;
      let bestD = maxDist;
      for (const car of sys.list) {
        if (car.dead || car === sys.playerCar || car.target !== preferTarget) continue;
        const d = dist2d(x, z, car.x, car.z);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) return best;
    }
    let best = null;
    let bestD = maxDist;
    for (const car of sys.list) {
      if (car.dead || car === sys.playerCar) continue;
      const d = dist2d(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  };

  sys.explodeCar = (car) => {
    car.dead = true;
    car.health = 0;
    G.audio.crash();
    G.hud.shake(0.6);
    G.hud.toast(`${car.name} wrecked!`);
    if (car === sys.playerCar) {
      sys.playerCar = null;
      G.player.ejectFromWreck();
    }
    // A wreck stays as a burnt shell for a while, then is towed away.
    car.mesh.traverse((m) => { if (m.material && m.material.color) m.material.color.setHex(0x1a1a1a); });
    window.setTimeout(() => { if (!car.dead) return; sys.removeVehicle(car); }, 20000);
    if (car.target) G.missions.onTargetCarDestroyed(car);
  };

  sys.damageCar = (car, dmg) => {
    if (car.dead) return;
    car.health -= dmg;
    if (car.health <= 0) sys.explodeCar(car);
  };

  return sys;
}
