// VELORA HEAT — the player on foot: movement, aim, health, and the E key.
// Interact priority (fixed order — the r10/r11 lessons):
//   1. in a car -> EXIT (exit always wins over the spray garage)
//   2. mission-target car nearby -> enter / steal it
//   3. any car nearby -> enter / steal it
//   4. garage + storable car within 8 m -> store it (police + mission cars excluded)
//   5. garage + wanted + unseen -> spray garage ($300, clears heat)
//   6. shop nearby -> open the shop (or start a hold-up at PelangiMart)
//   7. garage + next mission waiting -> start the next mission
import { POINTS, GARAGE_SLOTS, SPRAY_COST, SHOPS, WEAPONS } from './config.js';
import { dist, clamp } from './random.js';
import { nearestCar, nearestStorableCar, enterCar, exitCar, playerCar } from './vehicles.js';

export function newPlayerState() {
  return {
    x: POINTS.spawn.x, z: POINTS.spawn.z, angle: 0, hp: 100, maxHp: 100,
    cash: 250, inCar: null, weapon: 0,
    weapons: WEAPONS.map((w, i) => ({
      owned: i === 0, mag: w.mag === Infinity ? Infinity : 0, reserve: 0,
      reloading: false, reloadT: 0, cooldown: 0,
    })),
    walkSpeed: 5, sprintSpeed: 8.5,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.inCar != null) return; // driving is handled in vehicles.js
  const ax = G.input.axis();
  const sp = G.input.sprint() ? p.sprintSpeed : p.walkSpeed;
  const len = Math.hypot(ax.x, ax.z);
  if (len > 0) {
    p.x += (ax.x / len) * sp * dt;
    p.z += (ax.z / len) * sp * dt;
    G.city.pushOutCircle(p, 0.6);
  }
  // Aim: face the mouse when a gun is out, else face the movement direction.
  const aim = G.aim;
  if (p.weapon > 0) p.angle = Math.atan2(aim.z - p.z, aim.x - p.x);
  else if (len > 0) p.angle = Math.atan2(ax.z, ax.x);
  if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1.2 * dt); // slow regen
}

export function tryInteract(G) {
  const p = G.player;
  if (G.mode !== 'play') return;
  // 1. Exit the car (always first — spray never eats the exit press).
  if (p.inCar != null) { exitCar(G); G.hud.toast('You step out.'); return; }
  const dGarage = dist(p.x, p.z, POINTS.garage.x, POINTS.garage.z);
  // 2/3. Enter / steal a car.
  const car = nearestCar(G, p.x, p.z, 5);
  if (car) { stealOrEnter(G, car); return; }
  // 4. Store a car in the garage.
  if (dGarage < 14) {
    const storable = nearestStorableCar(G, p.x, p.z, 8);
    if (storable) { storeCar(G, storable); return; }
    // 5. Spray garage (on foot only, unseen only).
    if (G.wanted > 0 && !G.police.anySeesPlayer() && p.cash >= SPRAY_COST) {
      p.cash -= SPRAY_COST;
      G.police.clearWanted('spray');
      G.audio.chaChing();
      G.hud.toast(`Spray job done — heat cleared ($${SPRAY_COST}).`);
      G.hud.feed('Sari: "Fresh paint, clean record. Don\'t make a habit of it."', 'good');
      return;
    }
    if (G.wanted > 0 && p.cash < SPRAY_COST) { G.hud.toast(`Spray costs $${SPRAY_COST} — you have $${p.cash}.`); return; }
  }
  // 6. Shops.
  for (const s of SHOPS) {
    if (dist(p.x, p.z, s.x, s.z) < s.r) {
      if (s.kind === 'rob') { startHoldup(G, s); return; }
      G.hud.showShop(G, s);
      return;
    }
  }
  // 7. Start the next mission at the garage V marker.
  if (dGarage < 14 && G.mission.index < 6 && !G.mission.active) {
    G.mission.startNext(G);
    return;
  }
  G.hud.toast('Nothing to interact with here.');
}

function stealOrEnter(G, car) {
  const p = G.player;
  const wasParked = car.parked;
  const isPolice = car.kind === 'police';
  // Taking an owned (garage-stored) car out removes it from the owned list.
  G.owned = G.owned.filter((o) => o.carId !== car.id);
  enterCar(G, car);
  if (isPolice) {
    G.police.commitCrime('stealPolice', car);
    G.hud.toast('You stole a VBPD Interceptor! 3 HEAT!');
    G.hud.feed('VBPD radio: "Unit stolen! All cars, intercept!"', 'police');
  } else if (wasParked || car.driver === 'traffic') {
    G.police.commitCrime(car.driver === 'traffic' ? 'carjack' : 'stealParked', car);
    G.hud.toast(`You took the ${car.name}.`);
  } else {
    G.hud.toast(`You hop into the ${car.name}.`);
  }
  // Mission step hooks (steal/enter steps complete on entry).
  G.mission.onEnterCar(G, car);
}

export function storeCar(G, car) {
  const p = G.player;
  const used = new Set(G.owned.map((o) => o.slot));
  let idx = -1;
  for (let i = 0; i < GARAGE_SLOTS.length; i++) if (!used.has(i)) { idx = i; break; }
  if (idx < 0) { G.hud.toast('Garage is full (4 cars).'); return; }
  // Park it at the slot (visible in the world) AND record it as owned, so the
  // full record respawns it exactly after a reload (r10 F1 fix).
  const slot = GARAGE_SLOTS[idx];
  car.x = slot.x; car.z = slot.z; car.angle = 0; car.speed = 0;
  car.driver = 'none'; car.parked = true;
  G.owned.push({ carId: car.id, kind: car.kind, color: car.color, hp: car.hp, slot: idx, name: car.name });
  G.audio.chaChing();
  G.hud.toast(`Stored the ${car.name} in your garage.`);
  G.hud.feed(`Bimo: "Nice. ${car.name} is safe in the garage now."`, 'good');
  if (G.mission.onStoreCar) G.mission.onStoreCar(G, car);
}

// PelangiMart hold-up: stand in the shop, keep your aim up for 8 s.
export function startHoldup(G, shop) {
  if (G.holdup) { G.hud.toast('Hold-up already in progress.'); return; }
  if (G.mission.active && G.mission.stepDef(G) && G.mission.stepDef(G).t === 'holdup') {
    G.holdup = { x: shop.x, z: shop.z, t: 0, secs: 8, mission: true };
    G.hud.toast('Hold up the clerk — stay in the shop!');
  } else if (G.mission.completed[3]) {
    G.holdup = { x: shop.x, z: shop.z, t: 0, secs: 8, mission: false };
    G.hud.toast('Hold up the clerk — stay in the shop!');
  } else {
    G.hud.toast('Sari: "Not yet — the PelangiMart job is M4. Come back after."');
  }
}

export function updateHoldup(G, dt) {
  const h = G.holdup;
  if (!h) return;
  const p = G.player;
  const inside = dist(p.x, p.z, h.x, h.z) < 10 && p.inCar == null;
  const aiming = p.weapon > 0;
  if (!inside) { G.holdup = null; G.hud.toast('Hold-up aborted — you left the shop.'); return; }
  if (!aiming) { G.hud.toast('Keep your weapon aimed at the clerk!'); return; }
  h.t += dt;
  if (h.t >= h.secs) {
    G.holdup = null;
    const bag = h.mission ? 0 : 800; // mission reward lands via the mission itself
    if (bag > 0) { p.cash += bag; G.audio.chaChing(); G.hud.toast(`Cash bag grabbed: +$${bag}!`); }
    G.police.commitCrime('robbery');
    G.hud.feed('VBPD radio: "Robbery in progress at PelangiMart!"', 'police');
    G.mission.onHoldupDone(G, h.mission);
  }
}
