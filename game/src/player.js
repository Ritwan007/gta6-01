// VELORA HEAT — the player on foot: movement, health, entering/exiting cars,
// weapon state. Driving itself lives in vehicles.js.
import { PLAYER_HP, WEAPONS, WEAPON_ORDER, START_CASH } from './config.js';
import { clamp } from './random.js';

export function createPlayer(G) {
  const weapons = {};
  for (const key of WEAPON_ORDER) {
    const w = WEAPONS[key];
    weapons[key] = { mag: w.mag, reserve: w.reserve, unlocked: key === 'fists' };
  }
  return {
    x: -214, z: 52, angle: -Math.PI / 2, hp: PLAYER_HP, cash: START_CASH,
    inCar: null, weapon: 'fists', weapons,
    fireCd: 0, reloadT: 0, swingT: 0, aimAngle: -Math.PI / 2,
    bustedT: 0, invulnT: 0,
  };
}

export function stepPlayer(G, dt) {
  const p = G.player;
  if (p.inCar) return; // driving is stepped in vehicles.js
  const ax = G.input.axis();
  const sp = (G.input.run() ? 7.5 : 4.2);
  let mx = ax.x, mz = ax.z;
  if (mx !== 0 && mz !== 0) { mx *= 0.7071; mz *= 0.7071; }
  p.x += mx * sp * dt;
  p.z += mz * sp * dt;
  const H = 352;
  p.x = clamp(p.x, -H, H);
  p.z = clamp(p.z, -H, H);
  const fixed = G.city.resolveCircle(p.x, p.z, 0.7);
  p.x = fixed.x; p.z = fixed.z;
  if (mx !== 0 || mz !== 0) p.angle = Math.atan2(mz, mx);
  // Aim follows the mouse.
  const m = G.input.mouse();
  const cx = G.view.w / 2, cy = G.view.h / 2;
  p.aimAngle = Math.atan2(m.y - cy, m.x - cx);
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const w = p.weapons[p.weapon];
      const def = WEAPONS[p.weapon];
      const need = def.mag - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take; w.reserve -= take;
      G.feed(`${def.name} reloaded.`);
    }
  }
  if (p.swingT > 0) p.swingT -= dt;
  if (p.invulnT > 0) p.invulnT -= dt;
}

export function switchWeapon(G, key) {
  const p = G.player;
  if (!p.weapons[key] || !p.weapons[key].unlocked) {
    if (p.weapons[key]) G.feed(`${WEAPONS[key].name} is locked — finish more missions.`);
    return;
  }
  if (p.weapon === key) return;
  p.weapon = key;
  p.reloadT = 0;
  G.audio.click();
}

export function damagePlayer(G, dmg) {
  const p = G.player;
  if (p.invulnT > 0 || p.hp <= 0) return;
  p.hp -= dmg;
  p.invulnT = 0.25;
  G.shake = Math.max(G.shake, 0.15);
  if (p.hp <= 0) {
    p.hp = 0;
    G.gameOver('wasted');
  }
}
