// Pedestrians: sidewalk walkers with a small state machine — walk, flee from gunfire
// and crashes, cower, and call the police (a completed call with line of sight adds
// heat). Witnesses feed the wanted system: a crime seen by a ped is a crime known.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { createRandom, pick, clamp, wrapAngle, dist2d } from './random.js';

const SHIRTS = [0xd8d8d8, 0x3a6fd8, 0xd83b3b, 0x3a8a5a, 0xd8a83b, 0x8a3ad8, 0x2ad8c9, 0xd86a1e];

function buildPedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), pants);
  legs.position.y = 0.28;
  group.add(body);
  group.add(head);
  group.add(legs);
  // Phone: shown while a ped is calling the police.
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.04), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  phone.position.set(0.3, 1.6, 0.1);
  phone.visible = false;
  group.add(phone);
  group.userData.phone = phone;
  // Call marker: a "!" billboard above the head while calling.
  return group;
}

export function createPedSys(G) {
  const sys = {
    list: [],
    rng: createRandom(4242),
  };

  function spawnPed(x, z) {
    const mesh = buildPedMesh(pick(sys.rng, SHIRTS));
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const ped = {
      mesh, x, z,
      heading: sys.rng() * Math.PI * 2,
      speed: 1.2 + sys.rng() * 0.8,
      state: 'walk',          // walk | flee | cower | call | dead
      stateT: 0,
      callT: 0,
      health: 100,
      target: null,
      walkAxis: sys.rng() < 0.5 ? 'x' : 'z',
      walkStreet: pick(sys.rng, WORLD.streets),
      dead: false,
    };
    sys.list.push(ped);
    return ped;
  }

  sys.spawnWorld = () => {
    for (let i = 0; i < 36; i += 1) {
      const s = pick(sys.rng, WORLD.streets);
      const t = pick(sys.rng, WORLD.streets);
      const onXStreet = sys.rng() < 0.5;
      spawnPed(onXStreet ? t : s + 11, onXStreet ? s + 11 : t);
    }
  };

  sys.update = (dt) => {
    const px = G.player.x;
    const pz = G.player.z;
    const firing = G.weapons.isFiring();
    for (const ped of sys.list) {
      if (ped.dead) continue;
      ped.stateT += dt;
      const dPlayer = dist2d(ped.x, ped.z, px, pz);
      // Gunfire nearby or a crash nearby -> flee. A ped that just saw a crime calls.
      if (ped.state === 'walk' && ((firing && dPlayer < 30) || G.weapons.lastShotNear(ped.x, ped.z, 25))) {
        ped.state = 'flee';
        ped.stateT = 0;
        ped.target = { x: px, z: pz };
      }
      if (ped.state === 'flee') {
        // Run away from the player.
        const away = Math.atan2(ped.x - px, ped.z - pz);
        ped.heading = away;
        const sp = 4.2;
        ped.x += Math.sin(away) * sp * dt;
        ped.z += Math.cos(away) * sp * dt;
        G.city.resolveCollision(ped, 0.5);
        if (ped.stateT > 4) { ped.state = 'walk'; ped.stateT = 0; }
      } else if (ped.state === 'cower') {
        if (ped.stateT > 5) { ped.state = 'walk'; ped.stateT = 0; }
      } else if (ped.state === 'call') {
        ped.callT += dt;
        ped.mesh.userData.phone.visible = true;
        // A completed call with line of sight to the player adds heat.
        if (ped.callT > 3) {
          ped.state = 'flee';
          ped.stateT = 0;
          ped.mesh.userData.phone.visible = false;
          if (!G.city.losBlocked(ped.x, ped.z, px, pz)) {
            G.police.addCrime('witnessCall', px, pz);
            G.hud.feed('A witness called the CBPD!', 'police');
          }
        }
      } else {
        // Walk along a sidewalk: drift along the current street, turn at intersections.
        const onStreet = WORLD.streets.some((s) => Math.abs((ped.walkAxis === 'x' ? ped.x : ped.z) - s) < 4);
        if (onStreet && sys.rng() < dt * 0.2) {
          ped.walkAxis = ped.walkAxis === 'x' ? 'z' : 'x';
          ped.walkStreet = ped.walkAxis === 'x'
            ? Math.round(ped.z / 120) * 120
            : Math.round(ped.x / 120) * 120;
        }
        const targetHeading = ped.walkAxis === 'x' ? Math.PI / 2 : 0;
        ped.heading += wrapAngle(targetHeading - ped.heading) * dt * 1.5;
        // Keep the ped on its sidewalk line.
        const streetCoord = ped.walkAxis === 'x' ? ped.z : ped.x;
        const drift = clamp((ped.walkStreet + 11 - streetCoord) * 0.2, -0.6, 0.6);
        ped.heading += drift * dt;
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        G.city.resolveCollision(ped, 0.5);
        ped.x = clamp(ped.x, -405, 405);
        ped.z = clamp(ped.z, -405, 405);
        // Sometimes a ped who saw a crime starts calling instead of walking.
        if (G.police.lastCrimeT < 2 && dPlayer < 22 && ped.stateT > 6 && sys.rng() < dt * 0.3) {
          ped.state = 'call';
          ped.callT = 0;
          ped.stateT = 0;
        }
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Walk bob.
      const bob = ped.state === 'walk' ? Math.sin(G.time * 8 + ped.x) * 0.05 : 0;
      ped.mesh.position.y = bob;
    }
  };

  // A ped within r of a fast car: hit-and-run. Returns the ped (or null).
  sys.hitByCar = (x, z, r) => {
    for (const ped of sys.list) {
      if (ped.dead) continue;
      if (dist2d(ped.x, ped.z, x, z) < r) {
        ped.dead = true;
        ped.health = 0;
        ped.mesh.visible = false;
        return ped;
      }
    }
    return null;
  };

  // Melee / bullet hit on a ped. Returns true when the ped dies.
  sys.damagePed = (ped, dmg, fromX, fromZ) => {
    if (ped.dead) return false;
    ped.health -= dmg;
    if (ped.health <= 0) {
      ped.dead = true;
      ped.mesh.visible = false;
      return true;
    }
    // A wounded ped flees and may call.
    ped.state = 'flee';
    ped.stateT = 0;
    ped.target = { x: fromX, z: fromZ };
    return false;
  };

  // Witness check: any living ped (or officer) with line of sight within r?
  sys.witnessNear = (x, z, r) => {
    for (const ped of sys.list) {
      if (ped.dead || ped.state === 'cower') continue;
      if (dist2d(ped.x, ped.z, x, z) < r && !G.city.losBlocked(ped.x, ped.z, x, z)) return ped;
    }
    return null;
  };

  sys.nearestPed = (x, z, maxDist) => {
    let best = null;
    let bestD = maxDist;
    for (const ped of sys.list) {
      if (ped.dead) continue;
      const d = dist2d(ped.x, ped.z, x, z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  };

  sys.countAlive = () => sys.list.filter((p) => !p.dead).length;

  return sys;
}
