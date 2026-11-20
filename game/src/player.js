// Milo Voss, on foot: camera-relative WASD movement, sprint, jump, and the enter/exit
// car flow. The camera orbits with mouse drag; on foot it stays put (no auto-drift —
// the round-12 fix: drift fought walk steering), while driving it eases behind the car.
import * as THREE from 'three';
import { WORLD, CRIME } from './config.js';
import { clamp, wrapAngle, dist2d } from './random.js';

function buildPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd86a1e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1e2a3a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), jacket);
  body.position.y = 1.08;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  cap.position.y = 2.02;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.32), pants);
  legs.position.y = 0.29;
  // A simple gun in the right hand when a firearm is equipped (shown by weapons.js).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.15, 0.35);
  gun.visible = false;
  group.add(body);
  group.add(head);
  group.add(cap);
  group.add(legs);
  group.add(gun);
  group.userData.gun = gun;
  return group;
}

export function createPlayer(G) {
  const mesh = buildPlayerMesh();
  G.scene.add(mesh);

  const p = {
    mesh,
    x: WORLD.spawn.x,
    z: WORLD.spawn.z,
    heading: WORLD.spawn.heading,
    camYaw: WORLD.spawn.heading,
    camPitch: 0.42,
    camDist: 9,
    vy: 0,
    y: 0,
    grounded: true,
    health: 100,
    maxHealth: 100,
    inCar: false,
    car: null,
    speed: 0,
    invuln: 0,
    jumpCount: 0,
  };

  p.reset = (x, z, heading) => {
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.camYaw = heading;
    p.vy = 0;
    p.y = 0;
    p.grounded = true;
    p.health = p.maxHealth;
    p.inCar = false;
    p.car = null;
    p.invuln = 0;
    mesh.visible = true;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
  };

  p.ejectFromWreck = () => {
    p.inCar = false;
    p.car = null;
    mesh.visible = true;
    mesh.position.set(p.x, 0, p.z);
  };

  // Enter a car. Stealing a parked/traffic car the player does not own is a crime
  // when a witness sees it; stealing the parked police Interceptor is always 3 stars.
  p.enterCar = (car) => {
    if (p.inCar || !car || car.dead) return false;
    const seen = G.peds.witnessNear(car.x, car.z, 25);
    if (car.isPolice && car.isParked) {
      G.police.addCrime('stealPoliceCar', car.x, car.z);
      G.hud.feed('You stole a CBPD Pursuit! 3 stars!', 'police');
    } else if (car.owner !== 'player') {
      if (seen) {
        G.police.addCrime('stealSeen', car.x, car.z);
        G.hud.feed('A witness saw you steal that car!', 'police');
      }
    }
    car.isParked = false;
    car.isTraffic = false;
    G.vehicles.traffic = G.vehicles.traffic.filter((c) => c !== car);
    G.vehicles.parked = G.vehicles.parked.filter((c) => c !== car);
    p.inCar = true;
    p.car = car;
    G.vehicles.playerCar = car;
    mesh.visible = false;
    G.audio.engine(0.1);
    G.hud.feed(`Driving the ${car.name}.`);
    G.missions.onEnterCar(car);
    return true;
  };

  p.exitCar = () => {
    if (!p.inCar || !p.car) return false;
    const car = p.car;
    // Step out to the car's left side, clear of the body.
    const sx = car.x + Math.cos(car.heading) * -2.2;
    const sz = car.z - Math.sin(car.heading) * -2.2;
    const pos = { x: sx, z: sz };
    G.city.resolveCollision(pos, 0.6);
    p.x = pos.x;
    p.z = pos.z;
    p.heading = car.heading;
    p.inCar = false;
    p.car = null;
    G.vehicles.playerCar = null;
    mesh.visible = true;
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading;
    G.audio.engineOff();
    return true;
  };

  p.damage = (dmg, source) => {
    if (p.invuln > 0 || G.screen !== 'play') return;
    p.health -= dmg;
    p.invuln = 0.4;
    G.hud.shake(0.3);
    if (p.health <= 0) {
      p.health = 0;
      G.onWasted(source);
    }
  };

  p.heal = (amount) => {
    p.health = Math.min(p.maxHealth, p.health + amount);
  };

  p.update = (dt, input) => {
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.inCar) {
      if (p.car) {
        p.x = p.car.x;
        p.z = p.car.z;
        p.heading = p.car.heading;
        p.speed = p.car.speed;
      }
      return;
    }
    // On-foot movement, camera-relative.
    const drag = input.takeDrag();
    p.camYaw -= drag.dx * 0.004;
    p.camPitch = clamp(p.camPitch + drag.dy * 0.003, 0.12, 1.1);
    const mv = input.moveVector();
    const run = mv.sprint ? 8.5 : 5.0;
    const fx = Math.sin(p.camYaw);
    const fz = Math.cos(p.camYaw);
    const rx = Math.cos(p.camYaw);
    const rz = -Math.sin(p.camYaw);
    let mx = fx * mv.f + rx * mv.s;
    let mz = fz * mv.f + rz * mv.s;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const pos = { x: p.x + mx * run * dt, z: p.z + mz * run * dt };
      G.city.resolveCollision(pos, 0.55);
      p.x = pos.x;
      p.z = pos.z;
      p.heading = Math.atan2(mx, mz);
      p.speed = run;
    } else {
      p.speed = 0;
    }
    // Jump.
    if (input.take('Space') && p.grounded) {
      p.vy = 6.2;
      p.grounded = false;
      p.jumpCount += 1;
    }
    if (!p.grounded) {
      p.vy -= 18 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
      }
    }
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = p.heading;
    // Walk bob.
    const bob = p.speed > 0.1 ? Math.sin(G.time * 11) * 0.04 : 0;
    mesh.position.y = p.y + bob;
  };

  // Third-person camera: behind the player on foot, easing behind the car while driving.
  p.updateCamera = (camera, dt) => {
    if (p.inCar && p.car) {
      const targetYaw = p.car.heading;
      p.camYaw += wrapAngle(targetYaw - p.camYaw) * Math.min(1, dt * 2.2);
      const dist = 13;
      const cx = p.car.x - Math.sin(p.camYaw) * dist;
      const cz = p.car.z - Math.cos(p.camYaw) * dist;
      const cy = 6.5 + Math.abs(p.car.speed) * 0.04;
      camera.position.set(cx, cy, cz);
      camera.lookAt(p.car.x, 1.6, p.car.z);
    } else {
      const dist = p.camDist;
      const cx = p.x - Math.sin(p.camYaw) * dist * Math.cos(p.camPitch);
      const cz = p.z - Math.cos(p.camYaw) * dist * Math.cos(p.camPitch);
      const cy = 2 + dist * Math.sin(p.camPitch);
      camera.position.set(cx, cy, cz);
      camera.lookAt(p.x, 1.7, p.z);
    }
  };

  p.distanceTo = (x, z) => dist2d(p.x, p.z, x, z);

  return p;
}
