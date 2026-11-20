// The player on foot: third-person controller (walk/sprint/jump), orbit camera, health,
// and the E interactions — enter/steal a car, start a mission, store a car at the garage.
import * as THREE from 'three';
import { CITY, START_CASH } from './config.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd2a080 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), new THREE.MeshLambertMaterial({ color: 0x222226 }));
  legs.position.y = 0.42; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.8, 0.36), jacket);
  torso.position.y = 1.22; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.82; g.add(head);
  // Milo's sunset-orange cap, so the player reads at a glance.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xff7a2a }));
  cap.position.y = 2.02; g.add(cap);
  G.scene.add(g);

  const P = {
    x: CITY.points.spawn.x, z: CITY.points.spawn.z, y: 0, vy: 0,
    heading: 0, camYaw: 0, hp: 100, maxHp: 100, cash: START_CASH,
    inCar: false, car: null, mesh: g,
    weapons: { fists: { ammo: Infinity, reserve: Infinity } },
    weapon: 'fists', aiming: false, fireCooldown: 0, reloadT: 0,
    owned: [], missionIndex: 0, completed: [], unlocked: ['fists'],
    interactCalls: 0, eEdge: 0, dead: false, bustT: 0,
  };
  G.player = P;

  function place(x, z, heading = 0) {
    P.x = x; P.z = z; P.heading = heading; P.camYaw = heading;
    g.position.set(x, 0, z); g.rotation.y = heading;
  }

  // Camera: third person behind the player/car, mouse drag orbits (yaw offset).
  function updateCamera(dt) {
    const look = G.input.takeLook();
    P.camYaw += look.dx * 0.005;
    const target = P.inCar && P.car ? { x: P.car.x, z: P.car.z, h: P.car.heading } : { x: P.x, z: P.z, h: P.heading };
    // Camera eases back behind the facing direction unless the player dragged it.
    const camH = P.inCar ? P.car.heading + (P.camYaw - P.car.heading) * 0.9 : P.camYaw;
    const dist = P.inCar ? 13 : 8.5;
    const height = P.inCar ? 6.5 : 4.5;
    const cx = target.x - Math.sin(camH) * dist;
    const cz = target.z - Math.cos(camH) * dist;
    G.camera.position.set(cx, height, cz);
    G.camera.lookAt(target.x, 1.4, target.z);
    // Keep the camera out of buildings (simple: raise it if blocked).
    if (G.city.collides(cx, cz, 1)) G.camera.position.y = height + 5;
  }

  function update(dt) {
    if (P.dead) return;
    P.fireCooldown = Math.max(0, P.fireCooldown - dt);
    if (P.reloadT > 0) P.reloadT -= dt;
    if (P.inCar) { updateCamera(dt); return; }
    const input = G.input;
    const fwd = input.throttle(); // W/S
    const strafe = input.steer(); // A/D
    const sprint = input.sprint() ? 1.7 : 1;
    const speed = 5.2 * sprint;
    // Movement is camera-relative: W walks away from the camera.
    const cy = P.camYaw;
    let mx = Math.sin(cy) * fwd + Math.cos(cy) * strafe;
    let mz = Math.cos(cy) * fwd - Math.sin(cy) * strafe;
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      P.x += mx * speed * dt; P.z += mz * speed * dt;
      P.heading = Math.atan2(mx, mz);
    }
    // Jump.
    if (input.down('Space') && P.y <= 0.01) P.vy = 7.5;
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (P.y <= 0) { P.y = 0; P.vy = 0; }
    G.city.resolveCircle(P, 0.55);
    P.x = Math.max(-415, Math.min(415, P.x));
    P.z = Math.max(-415, Math.min(415, P.z));
    g.position.set(P.x, P.y, P.z);
    g.rotation.y = P.heading;
    updateCamera(dt);
  }

  // What E does right now, and what the prompt line should say.
  function interactTarget() {
    const mission = G.missions.current();
    const garageP = CITY.points.garage;
    const gd = Math.hypot(P.x - garageP.x, P.z - garageP.z);
    if (P.inCar) {
      if (gd < garageP.r) {
        // Store the car you are driving (if it is storable), else a storable car nearby.
        const mine = P.car && !P.car.isPursuit && !P.car.target ? P.car : null;
        const near = mine || G.vehicles.nearestStorableCar(P.car.x, P.car.z, 10);
        if (near && G.player.owned.length < 4) return { action: 'store', label: `E — Store the ${near.def.name} at Sorren Motors` };
        // Spray job: fresh paint clears the heat for $300 (only if not seen entering —
        // the police cool-down handles the seen case elsewhere).
        if (G.police.wanted > 0 && P.cash >= 300) return { action: 'spray', label: 'E — Spray job $300 (clear the heat)' };
      }
      return { action: 'exit', label: 'E — Get out' };
    }
    // On foot: mission start at the garage marker.
    if (mission && gd < garageP.r && !mission.active) return { action: 'start-mission', label: `E — Start ${mission.def.title}` };
    // Mission target car wins the E press over any nearer car.
    const prefer = mission && mission.active && mission.step && mission.step.type === 'steal' ? mission.targetCarId : null;
    const car = G.vehicles.nearestCar(P.x, P.z, 5, prefer);
    if (car) {
      if (car.target) return { action: 'steal-target', car, label: `E — Steal the ${car.def.name}` };
      if (car.isPursuit) return { action: 'steal-police', car, label: 'E — Steal the CBPD Pursuit' };
      return { action: 'enter', car, label: `E — ${car.isParked ? 'Steal' : 'Take'} the ${car.def.name}` };
    }
    return null;
  }

  function doInteract() {
    P.interactCalls++;
    const t = interactTarget();
    if (!t) return false;
    if (t.action === 'exit') {
      const car = P.car;
      P.inCar = false; P.car = null; car.isPlayer = false;
      const side = { x: car.x + Math.cos(car.heading) * 3, z: car.z - Math.sin(car.heading) * 3 };
      place(side.x, side.z, car.heading);
      G.audio.setEngine(0, false);
      return true;
    }
    if (t.action === 'store') {
      let car = P.car;
      if (!car || car.isPursuit || car.target) car = G.vehicles.nearestStorableCar(P.car ? P.car.x : P.x, P.car ? P.car.z : P.z, 10);
      if (car && !car.isPursuit && !car.target) {
        // Already garage stock (same id)? Just get out — never store a duplicate record.
        if (G.player.owned.some((o) => o.id === car.id)) {
          const wasPlayerCar = car === P.car;
          if (wasPlayerCar) {
            P.inCar = false; P.car = null; car.isPlayer = false;
            const side = { x: car.x + 3, z: car.z + 3 };
            place(side.x, side.z, car.heading);
          }
          return true;
        }
        G.player.owned.push({ variant: car.variant, color: car.color, hp: car.hp, id: car.id });
        const wasPlayerCar = car === P.car;
        if (wasPlayerCar) { P.inCar = false; P.car = null; }
        G.vehicles.remove(car);
        place(CITY.points.garage.x + 4, CITY.points.garage.z + 4, 0);
        G.hud.feed(`Stored the ${car.def.name} — ${G.player.owned.length}/4 in the garage.`);
        G.audio.chaChing();
        return true;
      }
      return false;
    }
    if (t.action === 'start-mission') {
      G.missions.start();
      return true;
    }
    if (t.action === 'spray') {
      P.cash -= 300;
      G.police.setWanted(0, 'spray');
      G.hud.feed('Fresh paint — the heat is off. -$300.');
      G.audio.chaChing();
      return true;
    }
    // Enter / steal a car.
    const car = t.car;
    const wasParked = car.isParked;
    car.isParked = false; car.isTraffic = false; car.isPlayer = true;
    P.inCar = true; P.car = car;
    G.audio.setEngine(0, true);
    if (t.action === 'steal-police') G.police.crime('stealPoliceCar', car.x, car.z, { set: 3 });
    else if (wasParked) G.police.crime('steal', car.x, car.z, {});
    G.missions.onEnterCar(car);
    return true;
  }

  return { place, update, interactTarget, doInteract, state: P };
}
