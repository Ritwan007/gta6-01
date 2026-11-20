// The wanted system: every crime feeds one heat state (0–5 stars). Police Interceptors
// spawn and pursue with per-star escalation; foot officers join near the station and
// can BUST the player on foot. Break line of sight to go SEARCHING, stay unseen and
// the heat clears. The spray garage and the hideouts clear heat for cash or patience.
import * as THREE from 'three';
import { HEAT, CRIME, WORLD } from './config.js';
import { clamp, wrapAngle, dist2d } from './random.js';

function buildOfficerMesh() {
  const group = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: 0x1e3a6e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), uni);
  body.position.y = 1.08;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.85;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x0e1e3a }));
  cap.position.y = 2.02;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.32), new THREE.MeshLambertMaterial({ color: 0x14161e }));
  legs.position.y = 0.29;
  group.add(body);
  group.add(head);
  group.add(cap);
  group.add(legs);
  return group;
}

export function createPoliceSys(G) {
  const sys = {
    wanted: 0,
    searching: false,
    unseenT: 0,
    clearT: 0,
    lastCrimeT: 99,
    lastCrimeAt: null,
    pursuit: [],      // police cars chasing the player
    officers: [],     // foot officers
    bustT: 0,
    lastSeenAt: null, // last position where an officer had eyes on the player
    sprayCooldown: 0,
  };

  function radio(msg) {
    G.hud.feed(`CBPD: ${msg}`, 'police');
  }

  sys.addCrime = (type, x, z) => {
    const now = G.time;
    // Rate-limit repeat crimes of the same kind (shots fired = one incident).
    if (type === 'shotsFired' && now - (sys._lastShotCrime || -99) < 4) return;
    if (type === 'shotsFired') sys._lastShotCrime = now;
    if (type === 'hitAndRun' && now - (sys._lastHitRun || -99) < 3) return;
    if (type === 'hitAndRun') sys._lastHitRun = now;
    const delta = CRIME[type] ?? 0;
    // Debug log: which crime fired, and the wanted level it produced.
    (G.crimeLog ??= []).push({ t: Math.round(now), type, wantedBefore: sys.wanted });
    sys.lastCrimeT = 0;
    sys.lastCrimeAt = { x, z };
    if (type === 'stealPoliceCar') sys.wanted = Math.max(sys.wanted, 3);
    else if (type === 'robbery') sys.wanted = Math.max(sys.wanted, 2);
    // Attention crimes (running someone over, firing a gun in public) get the
    // cops looking (1 star) but do not stack to 5 stars by themselves — a drive
    // through a crowd used to escalate a 3-star escape to an unsurvivable 5.
    else if (type === 'hitAndRun' || type === 'shotsFired') sys.wanted = Math.max(sys.wanted, 1);
    else sys.wanted = clamp(sys.wanted + delta, 0, HEAT.maxStars);
    sys.searching = false;
    sys.unseenT = 0;
    sys.clearT = 0;
    if (sys.wanted > 0) {
      sys.syncPursuit();
      if (delta > 0 || type === 'robbery' || type === 'stealPoliceCar') {
        radio(sys.wanted >= 3 ? 'All units, suspect is dangerous. Pursue!' : 'Unit responding to a crime in progress.');
      }
    }
    G.hud.setStars(sys.wanted, sys.searching);
  };

  sys.setWanted = (n) => {
    sys.wanted = clamp(n, 0, HEAT.maxStars);
    sys.searching = false;
    sys.unseenT = 0;
    sys.clearT = 0;
    sys.syncPursuit();
    G.hud.setStars(sys.wanted, sys.searching);
  };

  sys.clearHeat = (why) => {
    sys.wanted = 0;
    sys.searching = false;
    sys.unseenT = 0;
    sys.clearT = 0;
    sys.despawnPursuit();
    G.hud.setStars(0, false);
    G.hud.toast(`Heat cleared — ${why}`);
    G.hud.feed('You lost them. Heat cleared.', 'good');
  };

  // Spawn / despawn pursuit cars to match the wanted level.
  sys.syncPursuit = () => {
    const want = HEAT.policeCount(sys.wanted);
    while (sys.pursuit.length < want) {
      const p = G.player;
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 60;
      const s = WORLD.streets[Math.floor(Math.random() * WORLD.streets.length)];
      // Spawn on a street near the player.
      const x = clamp(p.x + Math.sin(a) * d, -390, 390);
      const z = clamp(p.z + Math.cos(a) * d, -390, 390);
      const car = G.vehicles.spawnVehicle('police', Math.abs(x - s) < Math.abs(z - s) ? s : x, Math.abs(x - s) < Math.abs(z - s) ? z : s, Math.atan2(p.x - x, p.z - z));
      sys.pursuit.push(car);
    }
    while (sys.pursuit.length > want) {
      const car = sys.pursuit.pop();
      G.vehicles.removeVehicle(car);
    }
  };

  sys.despawnPursuit = () => {
    for (const car of sys.pursuit) {
      if (car !== G.vehicles.playerCar) G.vehicles.removeVehicle(car);
    }
    sys.pursuit = [];
    for (const o of sys.officers) G.scene.remove(o.mesh);
    sys.officers = [];
  };

  sys.spawnOfficer = (x, z) => {
    const mesh = buildOfficerMesh();
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const o = { mesh, x, z, heading: 0, dead: false, touchT: 0 };
    sys.officers.push(o);
    return o;
  };

  sys.damageOfficer = (o, dmg) => {
    if (o.dead) return;
    o.dead = true;
    o.mesh.visible = false;
    sys.addCrime('hitOfficer', o.x, o.z);
  };

  // The spray garage: $300, instant clear, only while no officer can see you.
  sys.trySpray = () => {
    if (sys.wanted <= 0) return false;
    if (G.cash < HEAT.sprayPrice) {
      G.hud.toast('Spray job costs $300 — not enough cash.');
      return false;
    }
    if (sys.anyOfficerSeesPlayer()) {
      G.hud.toast('Too hot — lose line of sight first!');
      return false;
    }
    G.cash -= HEAT.sprayPrice;
    sys.clearHeat('spray job at Sorren Motors');
    G.audio.chaChing();
    return true;
  };

  // A hideout is a concealed spot: standing inside one, no officer can see you,
  // even if a pursuit car is on the same street. (Round-13 fix: without this,
  // pursuit cars camped the hideout and the heat could never clear.)
  sys.inHideout = () => {
    const p = G.player;
    return dist2d(p.x, p.z, G.city.points.hideout1.x, G.city.points.hideout1.z) < G.city.points.hideout1.radius
      || dist2d(p.x, p.z, G.city.points.hideout2.x, G.city.points.hideout2.z) < G.city.points.hideout2.radius;
  };

  sys.anyOfficerSeesPlayer = () => {
    if (sys.inHideout()) return false;
    const p = G.player;
    for (const car of sys.pursuit) {
      if (dist2d(car.x, car.z, p.x, p.z) < 70 && !G.city.losBlocked(car.x, car.z, p.x, p.z)) return true;
    }
    for (const o of sys.officers) {
      if (!o.dead && dist2d(o.x, o.z, p.x, p.z) < 40 && !G.city.losBlocked(o.x, o.z, p.x, p.z)) return true;
    }
    return false;
  };

  sys.update = (dt) => {
    sys.lastCrimeT += dt;
    sys.sprayCooldown = Math.max(0, sys.sprayCooldown - dt);
    const p = G.player;
    if (sys.wanted <= 0) {
      G.audio.siren(dt, 0);
      return;
    }
    G.audio.siren(dt, sys.wanted);

    // Line of sight, computed once per step: while the player is seen, the
    // police know exactly where they are; once unseen they drive to the last
    // seen position and search there instead of homing in on the live spot.
    const seen = sys.anyOfficerSeesPlayer();
    if (seen) sys.lastSeenAt = { x: p.x, z: p.z };
    const huntX = seen || !sys.lastSeenAt ? p.x : sys.lastSeenAt.x;
    const huntZ = seen || !sys.lastSeenAt ? p.z : sys.lastSeenAt.z;

    // Foot officers near the CBPD station join at 1–2 stars.
    if (sys.wanted <= 2 && sys.officers.length < sys.wanted && Math.random() < dt * 0.5) {
      sys.spawnOfficer(120 + (Math.random() - 0.5) * 20, 60 + (Math.random() - 0.5) * 20);
    }

    // Pursuit driving: steer at the player (or their last seen spot), ram at 3+ stars.
    const top = HEAT.policeTopSpeed(sys.wanted);
    for (const car of sys.pursuit) {
      if (car.dead) continue;
      if (car === G.vehicles.playerCar) continue; // the player stole this one — the AI must not drive it too
      const d = dist2d(car.x, car.z, p.x, p.z);
      const dHunt = dist2d(car.x, car.z, huntX, huntZ);
      const targetHeading = Math.atan2(huntX - car.x, huntZ - car.z);
      const steer = clamp(wrapAngle(targetHeading - car.heading) * 1.8, -1, 1);
      // On foot, a pursuit car pulls up and holds ~7 m short instead of parking
      // on top of the player: it was blocking the E prompt for the parked car the
      // player actually wants (sedan 2, round-10 failure). It still sees them, so
      // the heat does not clear — the player must break line of sight.
      const onFootClose = !p.inCar && d < 40;
      const throttle = dHunt > 12 ? 1 : (seen ? 0.4 : 0);
      const holdFoot = !p.inCar && dHunt < 7;
      // Police cars use the same physics but a higher top speed per star.
      const v = car.speed;
      G.vehicles.stepCar(car, dt, steer, holdFoot ? 0 : throttle, false);
      if (car.speed > top) car.speed = top;
      if (onFootClose) car.speed = Math.min(car.speed, Math.max(5, d * 0.7));
      if (v > 0 && car.speed < v * 0.2) car.speed = v * 0.5; // don't stall on walls
      // Ram: a pursuit car hitting the player's car is an IMPACT, not a grind.
      // Damage lands once, on the transition into contact, and the rammer
      // bounces off (speed x0.55) so the next hit has to be earned by catching
      // up again. (Round-13 fix: continuous dps while glued in contact destroyed
      // the player's car in seconds — the escape drive ended with the Interceptor
      // wrecked 32 m from the steal, M3 uncompletable.)
      if (p.inCar && p.car && d < 4.2) {
        if (!car._rammed) {
          const closing = car.speed - p.car.speed;
          if (closing > 2) {
            G.vehicles.damageCar(p.car, Math.min(closing * 0.6, 8) * (sys.wanted >= 3 ? 1.5 : 1));
            G.hud.shake(0.35);
          }
          car.speed *= 0.55;
          p.car.speed *= 0.92;
        }
        car._rammed = true;
      } else {
        car._rammed = false;
      }
      // Contact on foot: an officer touching the player for 3 s busts them —
      // only when the officer can actually see the player (not while hidden).
      if (seen && !p.inCar && d < 2.2) {
        sys.bustT += dt;
        if (sys.bustT > 3) {
          sys.bustT = 0;
          G.onBusted();
          return;
        }
      }
    }
    // Foot officers chase on foot (toward the last seen spot when unseen).
    for (const o of sys.officers) {
      if (o.dead) continue;
      const d = dist2d(o.x, o.z, p.x, p.z);
      const dHunt = dist2d(o.x, o.z, huntX, huntZ);
      if (dHunt > 2.2) {
        const a = Math.atan2(huntX - o.x, huntZ - o.z);
        o.heading = a;
        const sp = p.inCar ? 0 : 4.6;
        o.x += Math.sin(a) * sp * dt;
        o.z += Math.cos(a) * sp * dt;
        G.city.resolveCollision(o, 0.5);
      } else if (seen && !p.inCar) {
        sys.bustT += dt;
        if (sys.bustT > 3) {
          sys.bustT = 0;
          G.onBusted();
          return;
        }
      }
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
    }
    if (sys.bustT > 0 && !seen) sys.bustT = 0;

    // Line-of-sight cool-down: unseen for 6 s -> SEARCHING, 8 s more -> clear.
    // Hiding in a hideout while SEARCHING clears heat twice as fast.
    if (!seen) {
      sys.unseenT += dt;
      if (!sys.searching && sys.unseenT >= HEAT.coolUnseenSeconds) {
        sys.searching = true;
        G.hud.setStars(sys.wanted, true);
        radio('Lost visual. Searching the area.');
      }
      if (sys.searching) {
        sys.clearT += dt * (sys.inHideout() ? 2 : 1);
        if (sys.clearT >= HEAT.clearSeconds) sys.clearHeat(sys.inHideout() ? 'hideout' : 'lost them');
      }
    } else {
      sys.unseenT = 0;
      sys.clearT = 0;
      if (sys.searching) {
        sys.searching = false;
        G.hud.setStars(sys.wanted, false);
        radio('Visual re-acquired. Pursuit continues.');
      }
    }
  };

  return sys;
}
