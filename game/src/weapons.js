// VELORA HEAT — combat: one shared hitscan system for the player and the
// mission enemies. Tracers, muzzle flashes, hit feedback, reload, ammo.
import { WEAPONS } from './config.js';
import { angDiff, dist, clamp } from './random.js';
import { witnessCrime } from './pedestrians.js';
import { damagePlayer } from './player.js';

// Ray vs building rects: distance to first wall, or Infinity.
function rayWall(G, x, z, angle, maxD) {
  let best = maxD;
  const dx = Math.cos(angle), dz = Math.sin(angle);
  for (const b of G.city.buildings) {
    let t0 = 0, t1 = best;
    let ok = true;
    for (const [p, q] of [[-dx, x - b.x0], [dx, b.x1 - x], [-dz, z - b.z0], [dz, b.z1 - z]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) { ok = false; break; } }
      else {
        const t = q / p;
        if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
        else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
      }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}

// One hitscan pellet from (x,z) along `angle`. Returns the hit point.
export function firePellet(G, x, z, angle, range, dmg, fromPlayer) {
  const wallD = rayWall(G, x, z, angle, range);
  let bestD = wallD, hitKind = 'wall', hitObj = null;
  const targets = [];
  for (const e of G.enemies) if (e.hp > 0) targets.push({ x: e.x, z: e.z, r: 1.0, kind: 'enemy', obj: e });
  for (const ped of G.peds) if (ped.hp > 0) targets.push({ x: ped.x, z: ped.z, r: 0.8, kind: 'ped', obj: ped });
  for (const car of G.cars) {
    if (car.hp <= 0) continue;
    if (fromPlayer && G.playerCar === car) continue;
    targets.push({ x: car.x, z: car.z, r: 2.2, kind: 'car', obj: car });
  }
  if (!fromPlayer) {
    const p = G.player;
    if (p.hp > 0 && !p.inCar) targets.push({ x: p.x, z: p.z, r: 0.9, kind: 'player', obj: p });
  }
  for (const t of targets) {
    const dx = t.x - x, dz = t.z - z;
    const along = dx * Math.cos(angle) + dz * Math.sin(angle);
    if (along <= 0 || along > bestD) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dz * Math.cos(angle));
    if (perp < t.r) { bestD = along; hitKind = t.kind; hitObj = t.obj; }
  }
  const hx = x + Math.cos(angle) * bestD, hz = z + Math.sin(angle) * bestD;
  if (hitObj) {
    if (hitKind === 'enemy') {
      hitObj.hp -= dmg;
      if (hitObj.hp <= 0) { G.feed('Crew member down.'); G.player.cash += 25; }
    } else if (hitKind === 'ped') {
      hitObj.hp -= dmg;
      if (hitObj.hp <= 0) { hitObj.dead = true; G.police.addWanted(1, 'assault'); }
      else { hitObj.state = 'flee'; hitObj.fleeT = 3; hitObj.targetX = hitObj.x + (hitObj.x - x) * 2; hitObj.targetZ = hitObj.z + (hitObj.z - z) * 2; }
    } else if (hitKind === 'car') {
      hitObj.hp -= dmg;
      if (hitObj.police) G.police.addWanted(1, 'shot a police car');
    } else if (hitKind === 'player') {
      damagePlayer(G, dmg);
    }
  }
  G.tracers.push({ x1: x, z1: z, x2: hx, z2: hz, t: 0.09, hit: hitKind !== 'wall' });
  return { hx, hz, hitKind };
}

export function playerShoot(G, held) {
  const p = G.player;
  if (p.inCar || p.reloadT > 0 || p.fireCd > 0) return;
  const def = WEAPONS[p.weapon];
  const w = p.weapons[p.weapon];
  if (p.weapon === 'fists') {
    if (!held) return;
    p.fireCd = def.rate; p.swingT = 0.25;
    G.audio.melee();
    // Melee arc in front of the player.
    let hitAny = false;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(p.x, p.z, e.x, e.z);
      if (d < def.range && Math.abs(angDiff(Math.atan2(e.z - p.z, e.x - p.x), p.aimAngle)) < 0.9) {
        e.hp -= def.dmg; hitAny = true;
      }
    }
    for (const ped of G.peds) {
      if (ped.hp <= 0) continue;
      const d = dist(p.x, p.z, ped.x, ped.z);
      if (d < def.range && Math.abs(angDiff(Math.atan2(ped.z - p.z, ped.x - p.x), p.aimAngle)) < 0.9) {
        ped.hp -= def.dmg; hitAny = true;
        if (ped.hp <= 0) { ped.dead = true; witnessCrime(G, p.x, p.z, 'assault'); }
        else { ped.state = 'flee'; ped.fleeT = 3; }
      }
    }
    if (hitAny) G.audio.shot('fists');
    return;
  }
  if (!held && !def.auto) return;
  if (w.mag <= 0) {
    if (w.reserve > 0) startReload(G);
    else if (held) G.feed(`${def.name} is dry — no reserve ammo.`);
    p.fireCd = 0.25;
    return;
  }
  w.mag -= 1;
  p.fireCd = def.rate;
  G.muzzle = 0.06;
  G.audio.shot(p.weapon);
  G.shake = Math.max(G.shake, p.weapon === 'shotgun' ? 0.3 : p.weapon === 'smg' ? 0.08 : 0.12);
  for (let i = 0; i < def.pellets; i += 1) {
    const a = p.aimAngle + (G.rng() - 0.5) * 2 * def.spread;
    firePellet(G, p.x, p.z, a, def.range, def.dmg, true);
  }
  if (G.shotIncidentT <= 0) {
    G.shotIncidentT = 10;
    witnessCrime(G, p.x, p.z, 'shot');
    // The M6 garage shootout is a gang war, not a public crime spree:
    // it must not bury the player in heat before the getaway.
    if (!(G.mission.active && G.mission.index === 5)) G.police.addWanted(1, 'shots fired');
  }
}

export function startReload(G) {
  const p = G.player;
  const def = WEAPONS[p.weapon];
  const w = p.weapons[p.weapon];
  if (p.reloadT > 0 || w.reserve <= 0 || w.mag >= def.mag || p.weapon === 'fists') return;
  p.reloadT = def.reload;
  G.audio.click();
}

export function stepWeapons(G, dt) {
  if (G.shotIncidentT > 0) G.shotIncidentT -= dt;
  if (G.muzzle > 0) G.muzzle -= dt;
  // Mission enemies shoot back: cover-and-fire with a deliberately modest
  // hit rate so the defence stays winnable on foot.
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    e.fireT -= dt;
    const p = G.player;
    const d = dist(e.x, e.z, p.x, p.z);
    if (e.fireT <= 0 && d < 42 && p.hp > 0 && !G.city.segBlocked(e.x, e.z, p.x, p.z)) {
      e.fireT = 2.0;
      const aim = Math.atan2(p.z - e.z, p.x - e.x) + (G.rng() - 0.5) * 0.5;
      const hitChance = clamp(0.34 - d * 0.006, 0.10, 0.34);
      if (G.rng() < hitChance) {
        firePellet(G, e.x, e.z, aim, 42, 4, false);
      } else {
        const miss = aim + (G.rng() < 0.5 ? 1 : -1) * 0.35;
        firePellet(G, e.x, e.z, miss, 42, 4, false);
      }
      G.audio.shot('pistol');
    }
    // Enemies close to a firing position, then hold and shoot.
    if (d > 24) {
      const a = Math.atan2(p.z - e.z, p.x - e.x);
      e.x += Math.cos(a) * e.speed * dt;
      e.z += Math.sin(a) * e.speed * dt;
      const fixed = G.city.resolveCircle(e.x, e.z, 0.8);
      e.x = fixed.x; e.z = fixed.z;
    }
  }
}
