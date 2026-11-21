// VELORA HEAT — combat: 4 weapons, hitscan tracers, reload/switch, enemy fire,
// melee swing. Every shot in public is a crime incident (once per incident).
import { WEAPONS } from './config.js';
import { dist, clamp } from './random.js';

export function switchWeapon(G, idx) {
  const p = G.player;
  if (idx < 0 || idx > 3) return;
  if (!p.weapons[idx].owned) { G.hud.toast(`${WEAPONS[idx].name} is not unlocked yet.`); return; }
  if (p.inCar != null) return;
  p.weapon = idx;
  G.audio.click();
}

export function tryFire(G) {
  const p = G.player;
  if (p.inCar != null || G.mode !== 'play') return;
  const w = p.weapons[p.weapon];
  const def = WEAPONS[p.weapon];
  if (w.reloading || w.cooldown > 0) return;
  if (def.mag !== Infinity && w.mag <= 0) { reloadWeapon(G); return; }
  w.cooldown = def.rate;
  if (def.mag !== Infinity) w.mag--;
  const ox = p.x, oz = p.z;
  const base = Math.atan2(G.aim.z - oz, G.aim.x - ox);
  if (p.weapon === 0) {
    // Melee swing: arc in front, knockback.
    G.audio.shot('thud');
    G.meleeFlash = 0.18;
    let hitAny = false;
    for (const t of [...G.peds, ...G.enemies]) {
      if (t.hp <= 0) continue;
      const d = dist(ox, oz, t.x, t.z);
      if (d < def.range && Math.abs(((Math.atan2(t.z - oz, t.x - ox) - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1) {
        damageTarget(G, t, def.dmg, base);
        hitAny = true;
        if (t.hp > 0 && t.state !== undefined) { t.state = 'flee'; t.fleeT = 4; }
      }
    }
    if (hitAny) G.police.commitCrime('assault');
    return;
  }
  // Hitscan: one tracer per pellet, spread around the aim angle.
  for (let i = 0; i < def.pellets; i++) {
    const a = base + (G.rng() - 0.5) * 2 * def.spread;
    const ex = ox + Math.cos(a) * def.range, ez = oz + Math.sin(a) * def.range;
    let bestD = def.range, hit = null, hx = ex, hz = ez;
    for (const t of [...G.peds, ...G.enemies, ...G.police.officers]) {
      if (t.hp <= 0) continue;
      const d = dist(ox, oz, t.x, t.z);
      if (d > def.range) continue;
      const ta = Math.atan2(t.z - oz, t.x - ox);
      let da = ta - a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 0.09 && d < bestD) { bestD = d; hit = t; hx = t.x; hz = t.z; }
    }
    // Walls stop bullets.
    if (G.city.segHitsBuilding(ox, oz, hx, hz)) {
      // Shorten the tracer to the first wall hit (sampled).
      for (let s = 0.1; s <= 1; s += 0.05) {
        const wx = ox + (hx - ox) * s, wz = oz + (hz - oz) * s;
        if (G.city.clearance(wx, wz) < 0.5) { hx = wx; hz = wz; break; }
      }
      hit = null;
    }
    G.tracers.push({ x1: ox, z1: oz, x2: hx, z2: hz, t: 0.09 });
    if (hit) damageTarget(G, hit, def.dmg, a);
  }
  G.muzzle = 0.07;
  G.shake = Math.max(G.shake, p.weapon === 3 ? 0.4 : p.weapon === 2 ? 0.12 : 0.06);
  G.gunfireT = 0.5;
  G.audio.shot(def.sound);
  G.police.commitCrime('shotsFired');
  // Nearby peds react.
  for (const ped of G.peds) {
    if (ped.hp > 0 && dist(ox, oz, ped.x, ped.z) < 26 && ped.state !== 'flee' && ped.state !== 'call') {
      if (G.rng() < 0.3) { ped.state = 'call'; ped.callT = 2; }
      else { ped.state = 'flee'; ped.fleeT = 5; }
    }
  }
}

export function damageTarget(G, t, dmg, angle) {
  t.hp -= dmg;
  // Knockback a little.
  t.x += Math.cos(angle) * 0.4; t.z += Math.sin(angle) * 0.4;
  G.particles.push({ x: t.x, z: t.z, vx: 0, vz: 0, t: 0.3, color: '#ff5c5c', kind: 'hit' });
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.state !== undefined && t.kind === 'enemy') {
      G.mission.onEnemyKilled(t);
      // Ammo drop.
      const p = G.player;
      const w = p.weapons[p.weapon];
      if (w && w.mag !== Infinity) w.reserve += 6;
      G.hud.toast('Enemy down. +6 reserve ammo.');
    }
  }
}

export function reloadWeapon(G) {
  const p = G.player;
  const w = p.weapons[p.weapon];
  const def = WEAPONS[p.weapon];
  if (def.mag === Infinity || w.reloading || w.mag === def.mag) return;
  if (w.reserve <= 0) { G.hud.toast('No reserve ammo — buy more at Toko Jaya.'); return; }
  w.reloading = true; w.reloadT = def.reload;
  G.audio.reload();
}

export function updateWeapons(G, dt) {
  const p = G.player;
  for (const w of p.weapons) {
    if (w.cooldown > 0) w.cooldown -= dt;
    if (w.reloading) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) {
        w.reloading = false;
        const def = WEAPONS[p.weapons.indexOf(w)];
        const need = def.mag - w.mag;
        const take = Math.min(need, w.reserve);
        w.mag += take; w.reserve -= take;
      }
    }
  }
  if (G.muzzle > 0) G.muzzle -= dt;
  if (G.meleeFlash > 0) G.meleeFlash -= dt;
  if (G.gunfireT > 0) G.gunfireT -= dt;
  for (const t of G.tracers) t.t -= dt;
  G.tracers = G.tracers.filter((t) => t.t > 0);
}

// --- enemy shooters (M4 ambush / M6 waves) ----------------------------------
export function updateEnemies(G, dt) {
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    e.shootT -= dt;
    const p = G.player;
    const pc = G.cars.find((c) => c.id === p.inCar);
    const tx = pc ? pc.x : p.x, tz = pc ? pc.z : p.z;
    const d = dist(e.x, e.z, tx, tz);
    if (d > 18) {
      // Close in.
      const a = Math.atan2(tz - e.z, tx - e.x);
      e.x += Math.cos(a) * 3.4 * dt; e.z += Math.sin(a) * 3.4 * dt;
      e.angle = a;
      G.city.pushOutCircle(e, 0.5);
    } else if (e.shootT <= 0 && !G.city.segHitsBuilding(e.x, e.z, tx, tz)) {
      e.shootT = e.weapon === 'smg' ? 0.55 : 0.95;
      e.angle = Math.atan2(tz - e.z, tx - e.x);
      const hitChance = e.weapon === 'smg' ? 0.22 : 0.3;
      G.tracers.push({ x1: e.x, z1: e.z, x2: tx + (G.rng() - 0.5) * 3, z2: tz + (G.rng() - 0.5) * 3, t: 0.09, enemy: true });
      G.audio.shot('enemy');
      if (G.rng() < hitChance) {
        if (pc) { pc.hp -= e.weapon === 'smg' ? 4 : 8; G.shake = Math.max(G.shake, 0.3); }
        else { p.hp -= e.weapon === 'smg' ? 6 : 11; G.shake = Math.max(G.shake, 0.3); }
      }
    }
  }
  G.enemies = G.enemies.filter((e) => e.hp > 0 || e.deadT < 3);
  for (const e of G.enemies) if (e.hp <= 0) e.deadT = (e.deadT || 0) + dt;
}

export function spawnEnemy(G, x, z, weapon = 'pistol') {
  const e = { kind: 'enemy', x, z, angle: 0, hp: 60, weapon, shootT: 0.8 + G.rng(), state: 'fight', deadT: 0 };
  G.enemies.push(e);
  return e;
}
