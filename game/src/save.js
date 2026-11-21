// VELORA HEAT — save / continue via localStorage. Owned garage cars are
// stored as records and RESPAWNED in the world at their slots on load —
// the round-10 bug (a stored car vanishing on reload) must never come back.
import { SAVE_KEY, GARAGE_SLOTS, WEAPONS, WEAPON_ORDER } from './config.js';
import { createCar, ensureCarId } from './vehicles.js';

export function saveGame(G) {
  const p = G.player;
  const data = {
    v: 1,
    cash: p.cash, hp: p.hp, x: p.x, z: p.z, angle: p.angle,
    weapon: p.weapon,
    weapons: Object.fromEntries(WEAPON_ORDER.map((k) => [k, {
      mag: p.weapons[k].mag, reserve: p.weapons[k].reserve, unlocked: p.weapons[k].unlocked,
    }])),
    missionIndex: G.mission.index,
    completed: G.mission.completed.slice(),
    owned: G.owned.map((o) => ({ carId: o.carId, kind: o.kind, slot: o.slot })),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function applySave(G, data) {
  const p = G.player;
  p.cash = data.cash;
  p.hp = data.hp;
  p.x = data.x; p.z = data.z; p.angle = data.angle;
  p.weapon = data.weapon || 'fists';
  for (const k of WEAPON_ORDER) {
    if (data.weapons[k]) {
      p.weapons[k].mag = data.weapons[k].mag;
      p.weapons[k].reserve = data.weapons[k].reserve;
      p.weapons[k].unlocked = !!data.weapons[k].unlocked;
    }
  }
  G.mission.index = data.missionIndex;
  G.mission.completed = data.completed.slice();
  G.mission.active = false;
  G.mission.step = 0;
  G.mission.playerCp = 0;
  G.wanted = 0;
  G.searching = false;
  // Respawn every owned garage car at its slot, with its saved id.
  // The stored car IS the world car with that id (e.g. the M1 GT): move that
  // car to its slot instead of duplicating it — two cars sharing one id
  // would make every later lookup point at the wrong one.
  G.owned = [];
  for (const o of data.owned || []) {
    const slot = GARAGE_SLOTS[o.slot] || GARAGE_SLOTS[0];
    let car = G.cars.find((c) => c.id === o.carId);
    if (car) {
      car.x = slot.x; car.z = slot.z; car.angle = 0; car.speed = 0;
      car.parked = true; car.hp = car.maxHp; car.wrecked = false;
      car.driver = false;
    } else {
      car = createCar(o.kind, slot.x, slot.z, 0, { parked: true });
      car.id = o.carId;
      ensureCarId(o.carId);
      car.hp = car.maxHp;
      G.cars.push(car);
    }
    G.owned.push({ carId: o.carId, kind: o.kind, slot: o.slot });
  }
  // The player continues on foot at the save spot.
  if (p.inCar) { p.inCar = null; G.playerCar = null; }
}
