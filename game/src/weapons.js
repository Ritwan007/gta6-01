// Combat: one shared system for all four weapons (melee / pistol / SMG / shotgun).
// Hitscan with tracers and impact puffs, per-class rate / spread / sound / shake,
// ammo + reload + switching, and enemy shooters for the mission waves. Aiming raises
// NPC reactions: peds near a shot flee, and one may call the police.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, dist2d } from './random.js';

export function createWeaponSys(G) {
  const sys = {
    index: 0,               // current weapon slot 0..3
    mag: [Infinity, 12, 30, 6],
    reserve: [Infinity, 48, 90, 24],
    cooldown: 0,
    reloading: 0,
    firing: false,
    lastShotT: -99,
    lastShotX: 0,
    lastShotZ: 0,
    unlocked: [true, false, false, false],
    tracers: [],
    enemies: [],            // mission shooters (M6 waves, M4 ambush)
  };

  const tracerGeo = new THREE.BufferGeometry();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 });
  const puffGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.85 });

  sys.weapon = () => WEAPONS[sys.index];
  sys.isFiring = () => G.time - sys.lastShotT < 0.6;
  sys.lastShotNear = (x, z, r) => G.time - sys.lastShotT < 1.2 && dist2d(x, z, sys.lastShotX, sys.lastShotZ) < r;

  sys.unlock = (missionIndex) => {
    // Mission n unlocks weapon n+1 (M1 -> pistol, M2 -> SMG, M3 -> shotgun).
    const w = WEAPONS[missionIndex + 1];
    if (w && !sys.unlocked[w.slot - 1]) {
      sys.unlocked[w.slot - 1] = true;
      sys.reserve[w.slot - 1] += w.mag * 2;
      G.hud.feed(`Unlocked: ${w.name}!`, 'good');
    }
  };

  sys.switchTo = (slot) => {
    const i = slot - 1;
    if (i < 0 || i > 3 || !sys.unlocked[i]) return;
    if (sys.index !== i) {
      sys.index = i;
      sys.reloading = 0;
      sys.cooldown = 0.15;
      G.audio.click();
    }
  };

  sys.reload = () => {
    const w = sys.weapon();
    if (!Number.isFinite(w.mag) || sys.reloading > 0) return;
    if (sys.mag[sys.index] >= w.mag || sys.reserve[sys.index] <= 0) return;
    sys.reloading = w.reload;
    G.audio.reload();
  };

  function spawnTracer(from, to) {
    const pts = [new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, tracerMat);
    G.scene.add(line);
    sys.tracers.push({ line, t: 0.09 });
  }

  function spawnPuff(x, y, z) {
    const m = new THREE.Mesh(puffGeo, puffMat);
    m.position.set(x, y, z);
    G.scene.add(m);
    sys.tracers.push({ line: m, t: 0.12, puff: true });
  }

  function muzzleFlash(x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    m.position.set(x, y, z);
    G.scene.add(m);
    sys.tracers.push({ line: m, t: 0.05, puff: true });
  }

  // Fire one shot (or one melee swing) toward the screen centre, with aim assist:
  // the nearest living ped / enemy / police inside the aim cone takes the hit.
  sys.fire = () => {
    const w = sys.weapon();
    if (sys.cooldown > 0 || sys.reloading > 0 || G.screen !== 'play') return;
    const p = G.player;
    if (p.inCar) return; // no drive-by shooting; get out and fight
    if (Number.isFinite(w.mag) && sys.mag[sys.index] <= 0) {
      sys.reload();
      return;
    }
    sys.cooldown = w.rate;
    if (Number.isFinite(w.mag)) sys.mag[sys.index] -= 1;
    sys.lastShotT = G.time;
    sys.lastShotX = p.x;
    sys.lastShotZ = p.z;

    const origin = { x: p.x, y: 1.5, z: p.z };
    const dir = { x: Math.sin(p.camYaw), z: Math.cos(p.camYaw) };
    G.audio.shot(w.sound);
    muzzleFlash(origin.x + dir.x * 0.8, 1.5, origin.z + dir.z * 0.8);

    if (w.id === 'fists') {
      // Melee arc in front.
      const victim = G.peds.nearestPed(p.x + dir.x * 1.6, p.z + dir.z * 1.6, 2.4);
      if (victim) {
        const died = G.peds.damagePed(victim, w.damage, p.x, p.z);
        if (died) G.police.addCrime('assaultSeen', p.x, p.z);
        else if (G.peds.witnessNear(p.x, p.z, 25)) G.police.addCrime('assaultSeen', p.x, p.z);
      }
      G.hud.shake(0.08);
      return;
    }

    // Hitscan: one ray per pellet, small spread, aim assist toward the best target.
    for (let pellet = 0; pellet < w.pellets; pellet += 1) {
      const spread = (Math.random() - 0.5) * 2 * w.spread;
      const dx = dir.x + Math.cos(p.camYaw) * spread;
      const dz = dir.z - Math.sin(p.camYaw) * spread;
      const len = Math.hypot(dx, dz) || 1;
      const ndx = dx / len;
      const ndz = dz / len;
      // Best target: nearest living ped/enemy/police within the cone and range.
      let best = null;
      let bestD = w.range;
      const consider = (tx, tz, obj, kind) => {
        const vx = tx - p.x;
        const vz = tz - p.z;
        const d = Math.hypot(vx, vz);
        if (d > w.range || d < 0.5) return;
        const dot = (vx * ndx + vz * ndz) / d;
        if (dot < 0.985) return; // ~10 degree cone
        if (G.city.losBlocked(p.x, p.z, tx, tz)) return;
        if (d < bestD) { bestD = d; best = { obj, kind, x: tx, z: tz }; }
      };
      for (const ped of G.peds.list) if (!ped.dead) consider(ped.x, ped.z, ped, 'ped');
      for (const e of sys.enemies) if (!e.dead) consider(e.x, e.z, e, 'enemy');
      for (const car of G.vehicles.list) {
        if (car.dead || car === G.vehicles.playerCar) continue;
        consider(car.x, car.z, car, 'car');
      }
      for (const cop of G.police.officers) if (!cop.dead) consider(cop.x, cop.z, cop, 'officer');

      const endX = best ? best.x : p.x + ndx * w.range;
      const endZ = best ? best.z : p.z + ndz * w.range;
      spawnTracer(origin, { x: endX, y: 1.4, z: endZ });
      if (best) {
        spawnPuff(endX, 1.4, endZ);
        if (best.kind === 'ped') {
          const died = G.peds.damagePed(best.obj, w.damage, p.x, p.z);
          if (died) G.police.addCrime('assaultSeen', p.x, p.z);
          G.hud.hitMarker();
        } else if (best.kind === 'enemy') {
          sys.damageEnemy(best.obj, w.damage);
          G.hud.hitMarker();
        } else if (best.kind === 'car') {
          G.vehicles.damageCar(best.obj, w.damage);
          G.police.addCrime('hitPoliceCar', p.x, p.z);
          G.hud.hitMarker();
        } else if (best.kind === 'officer') {
          G.police.damageOfficer(best.obj, w.damage);
          G.hud.hitMarker();
        }
      }
    }
    // Firing in public is a crime the first time per incident.
    if (G.peds.witnessNear(p.x, p.z, 25) || G.police.officers.length > 0) {
      G.police.addCrime('shotsFired', p.x, p.z);
    }
    G.hud.shake(w.id === 'shotgun' ? 0.35 : w.id === 'smg' ? 0.12 : 0.15);
  };

  // --- Enemy shooters (mission waves) -------------------------------------
  sys.spawnEnemy = (x, z, hp) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), new THREE.MeshLambertMaterial({ color: 0x3a1e3a }));
    body.position.y = 1.08;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a06a }));
    head.position.y = 1.85;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.42, 1.15, 0.35);
    group.add(body);
    group.add(head);
    group.add(gun);
    group.position.set(x, 0, z);
    G.scene.add(group);
    const e = { mesh: group, x, z, health: hp || 60, dead: false, shootT: 1 + Math.random() * 2, heading: 0 };
    sys.enemies.push(e);
    return e;
  };

  sys.damageEnemy = (e, dmg) => {
    if (e.dead) return;
    e.health -= dmg;
    if (e.health <= 0) {
      e.dead = true;
      e.mesh.visible = false;
      G.hud.feed('Crew member down.', 'good');
      G.audio.chaChing();
      G.cash += 50;
      G.missions.onEnemyDown(e);
    }
  };

  sys.updateEnemies = (dt) => {
    const p = G.player;
    for (const e of sys.enemies) {
      if (e.dead) continue;
      e.shootT -= dt;
      const d = dist2d(e.x, e.z, p.x, p.z);
      // Creep toward the player until in range, then shoot with cover pauses.
      if (d > 26) {
        const a = Math.atan2(p.x - e.x, p.z - e.z);
        e.heading = a;
        e.x += Math.sin(a) * 3.4 * dt;
        e.z += Math.cos(a) * 3.4 * dt;
        G.city.resolveCollision(e, 0.5);
      } else if (e.shootT <= 0 && !G.city.losBlocked(e.x, e.z, p.x, p.z)) {
        e.shootT = 1.1 + Math.random() * 0.9;
        spawnTracer({ x: e.x, y: 1.5, z: e.z }, { x: p.x, y: 1.4, z: p.z });
        G.audio.shot('pistol');
        if (Math.random() < 0.45) p.damage(9, 'crew');
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
    }
  };

  sys.update = (dt, input) => {
    sys.cooldown = Math.max(0, sys.cooldown - dt);
    if (sys.reloading > 0) {
      sys.reloading -= dt;
      if (sys.reloading <= 0) {
        const w = sys.weapon();
        const need = w.mag - sys.mag[sys.index];
        const take = Math.min(need, sys.reserve[sys.index]);
        sys.mag[sys.index] += take;
        sys.reserve[sys.index] -= take;
      }
    }
    // Weapon switching.
    for (let s = 1; s <= 4; s += 1) if (input.take(`Digit${s}`)) sys.switchTo(s);
    if (input.take('KeyR')) sys.reload();
    // Fire: click (semi-auto) or held mouse (auto weapons).
    const w = sys.weapon();
    if (w.auto ? input.mouseDown() : input.takeMouseDown()) sys.fire();
    sys.firing = input.mouseDown();
    // Show the gun in the player's hand when a firearm is equipped.
    G.player.mesh.userData.gun.visible = sys.index > 0 && !G.player.inCar;
    // Tracers fade fast.
    for (let i = sys.tracers.length - 1; i >= 0; i -= 1) {
      const t = sys.tracers[i];
      t.t -= dt;
      if (t.t <= 0) {
        G.scene.remove(t.line);
        if (t.line.geometry) t.line.geometry.dispose();
        sys.tracers.splice(i, 1);
      }
    }
    sys.updateEnemies(dt);
  };

  return sys;
}
