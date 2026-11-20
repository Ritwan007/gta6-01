// Combat — four weapons, one shared system: hitscan with tracers, ammo/reload/switch,
// muzzle flash, aim assist (the shot snaps to the nearest enemy inside a 25-degree cone),
// and enemy shooters for the M4 ambush and M6 waves.
import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER } from './config.js';

export function createWeapons(G) {
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.9 });
  const enemies = [];
  G.weapons = { enemies };

  function muzzleWorldPos() {
    const P = G.player;
    const fx = Math.sin(P.camYaw), fz = Math.cos(P.camYaw);
    return { x: P.x + fx * 1.2, y: 1.4, z: P.z + fz * 1.2, fx, fz };
  }

  function spawnTracer(from, to) {
    const dx = to.x - from.x, dy = (to.y ?? 1.2) - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), tracerMat);
    mesh.position.set((from.x + to.x) / 2, (from.y + (to.y ?? 1.2)) / 2, (from.z + to.z) / 2);
    mesh.lookAt(to.x, to.y ?? 1.2, to.z);
    G.scene.add(mesh);
    tracers.push({ mesh, t: 0.09 });
  }

  function flashAt(p) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), flashMat);
    m.position.set(p.x, p.y, p.z); G.scene.add(m);
    tracers.push({ mesh: m, t: 0.06 });
  }

  // Aim assist: nearest enemy within a 25-degree cone of the camera facing, inside range.
  function assistTarget(range) {
    const P = G.player;
    const fx = Math.sin(P.camYaw), fz = Math.cos(P.camYaw);
    let best = null, bd = range;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - P.x, dz = e.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot > Math.cos(0.44)) { if (d < bd) { bd = d; best = e; } }
    }
    return best;
  }

  function shoot() {
    const P = G.player;
    if (P.inCar || P.reloadT > 0 || P.fireCooldown > 0) return;
    const def = WEAPONS[P.weapon];
    const slot = P.weapons[P.weapon];
    if (def.mag !== Infinity && slot.ammo <= 0) { reload(); return; }
    P.fireCooldown = def.rate;
    if (def.mag !== Infinity) slot.ammo--;
    const m = muzzleWorldPos();
    G.audio.shot(def.sound);
    flashAt(m);
    const pellets = def.pellets || 1;
    let hitSomething = false;
    for (let i = 0; i < pellets; i++) {
      const target = assistTarget(def.range);
      let tx, ty, tz;
      if (target) {
        tx = target.x; ty = 1.2; tz = target.z;
      } else {
        const spread = (G.rng.next() - 0.5) * 2 * def.spread;
        const a = P.camYaw + spread;
        tx = P.x + Math.sin(a) * def.range; ty = 1.2; tz = P.z + Math.cos(a) * def.range;
      }
      spawnTracer(m, { x: tx, y: ty, z: tz });
      if (target) {
        target.hp -= def.dmg;
        hitSomething = true;
        if (target.hp <= 0) {
          G.hud.feed('Crew member down.');
          G.audio.chaChing();
          G.missions.onEnemyDown(target);
        }
      } else {
        // A shot at a pedestrian in the line of fire counts as an assault.
        for (const ped of G.peds.list) {
          const d = Math.hypot(ped.x - P.x, ped.z - P.z);
          if (d < def.range && Math.abs(Math.atan2(ped.x - P.x, ped.z - P.z) - P.camYaw) < 0.12) {
            ped.state = 'flee'; ped.fleeFrom = { x: P.x, z: P.z };
          }
        }
      }
    }
    if (!hitSomething && P.weapon !== 'fists') G.police.crime('shotsFired', P.x, P.z, { attention: true });
    P.aiming = true;
  }

  function reload() {
    const P = G.player;
    const def = WEAPONS[P.weapon];
    const slot = P.weapons[P.weapon];
    if (def.mag === Infinity || slot.ammo === def.mag || slot.reserve <= 0 || P.reloadT > 0) return;
    P.reloadT = def.reload;
    const need = def.mag - slot.ammo;
    const take = Math.min(need, slot.reserve);
    slot.ammo += take; slot.reserve -= take;
    G.audio.click();
  }

  function switchTo(key) {
    const P = G.player;
    if (!P.unlocked.includes(key) || P.weapon === key) return;
    P.weapon = key; P.reloadT = 0;
    G.audio.click();
  }

  function cycle(dir) {
    const idx = WEAPON_ORDER.indexOf(G.player.weapon);
    for (let i = 1; i <= WEAPON_ORDER.length; i++) {
      const key = WEAPON_ORDER[(idx + dir * i + WEAPON_ORDER.length * 2) % WEAPON_ORDER.length];
      if (G.player.unlocked.includes(key)) { switchTo(key); return; }
    }
  }

  function unlock(key, reserveAmmo = 48) {
    const P = G.player;
    if (P.unlocked.includes(key)) return;
    P.unlocked.push(key);
    P.weapons[key] = { ammo: WEAPONS[key].mag, reserve: reserveAmmo };
    G.hud.feed(`Unlocked the ${WEAPONS[key].name}.`);
  }

  function refillAmmo() {
    const P = G.player;
    for (const key of P.unlocked) {
      if (WEAPONS[key].mag === Infinity) continue;
      P.weapons[key].reserve = Math.max(P.weapons[key].reserve, 96);
    }
  }

  // Enemy crew: simple cover-and-shoot AI. They walk toward the player and fire with
  // deliberately poor accuracy; their shots can hurt the player.
  function spawnEnemy(x, z, hp = 60) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x4a2a2a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.8, 0.36), shirt);
    torso.position.y = 1.22; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc2906a }));
    head.position.y = 1.82; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), new THREE.MeshLambertMaterial({ color: 0x222226 }));
    legs.position.y = 0.42; g.add(legs);
    g.position.set(x, 0, z);
    G.scene.add(g);
    const e = { x, z, hp, maxHp: hp, mesh: g, shootT: 1 + G.rng.next() * 1.5, speed: 3.2 };
    enemies.push(e);
    return e;
  }

  function updateEnemies(dt) {
    const P = G.player;
    for (const e of [...enemies]) {
      if (e.hp <= 0) {
        G.scene.remove(e.mesh);
        enemies.splice(enemies.indexOf(e), 1);
        continue;
      }
      const d = Math.hypot(P.x - e.x, P.z - e.z);
      if (d > 3) {
        const dx = (P.x - e.x) / d, dz = (P.z - e.z) / d;
        e.x += dx * e.speed * dt; e.z += dz * e.speed * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = Math.atan2(dx, dz);
      }
      G.city.resolveCircle(e, 0.5);
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 34 && !G.city.losBlocked(e.x, e.z, P.x, P.z)) {
        e.shootT = 1.1 + G.rng.next() * 0.9;
        G.audio.shot('pistol');
        spawnTracer({ x: e.x, y: 1.4, z: e.z }, { x: P.x + (G.rng.next() - 0.5) * 2, y: 1.2, z: P.z + (G.rng.next() - 0.5) * 2 });
        if (G.rng.next() < 0.3 && !P.inCar) {
          P.hp -= 6;
          G.hud.flashDamage();
          if (P.hp <= 0) G.missions.onWasted();
        }
      }
    }
  }

  function update(dt) {
    const P = G.player;
    const input = G.input;
    if (!P.inCar && !P.dead) {
      const fireHeld = input.mouse.held && WEAPONS[P.weapon].auto;
      const fireEdge = input.takeFireEdge();
      if (fireHeld || fireEdge) shoot();
      if (input.down('KeyR')) reload();
    }
    for (const t of [...tracers]) {
      t.t -= dt;
      if (t.t <= 0) { G.scene.remove(t.mesh); tracers.splice(tracers.indexOf(t), 1); }
    }
    updateEnemies(dt);
  }

  return { shoot, reload, switchTo, cycle, unlock, refillAmmo, spawnEnemy, update, enemies };
}
