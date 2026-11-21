// VELORA HEAT — combat: hitscan weapons with tracers, reload, enemy shooting.
import { WEAPONS } from './config.js';
import { witnessCrime } from './pedestrians.js';

function rayHit(G, x1, z1, angle, range) {
  // Returns the first hit along the ray: {kind, obj, dist} or null.
  const step = 1.5;
  let best = null;
  const steps = Math.floor(range / step);
  for (let i = 1; i <= steps; i++) {
    const d = i * step;
    const x = x1 + Math.cos(angle) * d, z = z1 + Math.sin(angle) * d;
    if (G.city.circleHitsBuilding(x, z, 0.4)) return { kind: 'wall', dist: d };
    for (const e of G.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - x, e.z - z) < 1.2) return { kind: 'enemy', obj: e, dist: d };
    }
    for (const ped of G.peds) {
      if (ped.hp > 0 && Math.hypot(ped.x - x, ped.z - z) < 0.9) return { kind: 'ped', obj: ped, dist: d };
    }
    for (const c of G.cars) {
      if (c.hp > 0 && Math.hypot(c.x - x, c.z - z) < c.radius) return { kind: 'car', obj: c, dist: d };
    }
    if (best === null && d >= range) break;
  }
  return null;
}

export function tryFire(G, dt) {
  const p = G.player;
  if (p.inCar != null || G.mode !== 'play') return;
  const w = p.weapons[p.weapon];
  const def = WEAPONS[p.weapon];
  p.fireCd = Math.max(0, (p.fireCd || 0) - dt);
  const wantFire = def.auto ? G.input.mouse.down : G.input.mouse.down && !p.mouseWasDown;
  p.mouseWasDown = G.input.mouse.down;
  if (!wantFire || p.fireCd > 0) return;
  if (w.mag <= 0) {
    reload(G);
    return;
  }
  // Aim: mouse position in world space; a click dead-centre keeps facing.
  const mdx = G.input.mouse.x - window.innerWidth / 2;
  const mdy = G.input.mouse.y - window.innerHeight / 2;
  if (Math.hypot(mdx, mdy) > 5) p.angle = Math.atan2(mdy, mdx);
  p.fireCd = def.rate;
  w.mag -= 1;
  const ox = p.x + Math.cos(p.angle) * 1.2, oz = p.z + Math.sin(p.angle) * 1.2;
  for (let pellet = 0; pellet < def.pellets; pellet++) {
    const a = p.angle + (G.rng() - 0.5) * 2 * def.spread;
    const hit = rayHit(G, ox, oz, a, def.range);
    const endD = hit ? hit.dist : def.range;
    G.tracers.push({ x1: ox, z1: oz, x2: ox + Math.cos(a) * endD, z2: oz + Math.sin(a) * endD, life: 0.09 });
    if (!hit) continue;
    if (hit.kind === 'enemy') {
      hit.obj.hp -= def.dmg;
      G.feed(hit.obj.hp > 0 ? 'Kena!' : 'Musuh tumbang!');
      if (hit.obj.hp <= 0) G.audio.chaChing();
    } else if (hit.kind === 'ped') {
      hit.obj.hp = 0; hit.obj.state = 'flee';
      if (witnessCrime(G, hit.obj.x, hit.obj.z)) G.pendingCrime = 1;
      else G.police.addHeat(1, 'assault');
      G.feed('Warga tertembak! Saksi melihatmu.');
    } else if (hit.kind === 'car') {
      hit.obj.hp = Math.max(0, hit.obj.hp - def.dmg);
      if (hit.obj.driver === 'police') G.police.addHeat(1, 'shot police car');
    }
  }
  G.audio.shot(def.sound);
  G.muzzle = 0.06;
  // Firing in public is a crime if anyone sees it.
  if (p.weapon !== 'fists' && !G.shotsReported) {
    G.shotsReported = true;
    if (witnessCrime(G, p.x, p.z)) G.pendingCrime = 1;
    G.shotsFiredNear = 1;
    setTimeout(() => { G.shotsReported = false; }, 4000);
  }
}

export function reload(G) {
  const p = G.player;
  const w = p.weapons[p.weapon];
  const def = WEAPONS[p.weapon];
  if (w.mag >= def.mag || w.reserve <= 0 || w.mag === Infinity) return;
  const need = def.mag - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take; w.reserve -= take;
  G.audio.click();
  G.feed(`${def.name} diisi ulang.`);
}

export function meleeSwing(G) {
  // Fists: a short arc in front of the player (on foot only).
  const p = G.player;
  if (p.inCar != null || G.mode !== 'play') return;
  const def = WEAPONS.fists;
  p.fireCd = Math.max(0, (p.fireCd || 0) - 1 / 60);
  if (p.fireCd > 0 || !G.input.mouse.down || p.mouseWasDown) { p.mouseWasDown = G.input.mouse.down; return; }
  p.mouseWasDown = true;
  p.fireCd = def.rate;
  const ox = p.x + Math.cos(p.angle) * 1.4, oz = p.z + Math.sin(p.angle) * 1.4;
  for (const e of G.enemies) {
    if (e.hp > 0 && Math.hypot(e.x - ox, e.z - oz) < 2.2) { e.hp -= def.dmg; G.audio.thud(); }
  }
  for (const ped of G.peds) {
    if (ped.hp > 0 && Math.hypot(ped.x - ox, ped.z - oz) < 2.2) {
      ped.hp = 0; ped.state = 'flee';
      if (witnessCrime(G, ped.x, ped.z)) G.pendingCrime = 1;
    }
  }
}

// Enemy shooting: each living enemy fires at the player with low accuracy.
export function updateEnemies(G, dt) {
  const p = G.player;
  const pc = p.inCar != null ? G.cars.find((c) => c.id === p.inCar) : null;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - px, e.z - pz);
    // Close to 14-20 m and shoot; never closer than 8 m.
    const want = Math.atan2(pz - e.z, px - e.x);
    e.angle = want;
    if (d > 20) {
      e.x += Math.cos(want) * 3.2 * dt;
      e.z += Math.sin(want) * 3.2 * dt;
    } else if (d < 8) {
      e.x -= Math.cos(want) * 2 * dt;
      e.z -= Math.sin(want) * 2 * dt;
    }
    const fixed = G.city.resolveCircle(e.x, e.z, 0.7);
    e.x = fixed.x; e.z = fixed.z;
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 42 && !G.city.segmentBlocked(e.x, e.z, px, pz)) {
      e.shootCd = 1.3 + G.rng() * 0.9;
      const a = want + (G.rng() - 0.5) * 0.35;
      G.tracers.push({ x1: e.x, z1: e.z, x2: e.x + Math.cos(a) * 30, z2: e.z + Math.sin(a) * 30, life: 0.09, enemy: true });
      G.audio.shot('pistol');
      // ~28% of shots land while the player is on foot and exposed.
      if (!pc && G.rng() < 0.28) {
        p.hp = Math.max(0, p.hp - 5);
        G.feed('Kena tembak! -5 HP');
        if (p.hp <= 0) G.wasted();
      } else if (pc && G.rng() < 0.2) {
        pc.hp = Math.max(0, pc.hp - 4);
      }
    }
  }
  // Drop dead enemies out of the live list view (kept for the count check).
  G.enemies = G.enemies.filter((e) => e.hp > 0 || e.deadT < 5);
  for (const e of G.enemies) if (e.hp <= 0) e.deadT = (e.deadT || 0) + dt;
}
