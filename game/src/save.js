// VELORA HEAT — save / continue via localStorage. Owned garage cars respawn
// at their slots with the SAME car id after a reload.
import { GARAGE_SLOTS, WEAPON_ORDER } from './config.js';
import { reserveId, spawnCar } from './vehicles.js';

export const SAVE_KEY = 'velora-heat-save-v1';

export function saveGame(G) {
  const p = G.player;
  const data = {
    cash: Math.floor(p.cash),
    index: G.mission.index,
    completed: G.mission.completed.slice(),
    weapon: p.weapon,
    weapons: {},
    owned: G.owned.map((o) => ({ ...o })),
    x: +p.x.toFixed(1),
    z: +p.z.toFixed(1),
  };
  for (const k of WEAPON_ORDER) {
    const w = p.weapons[k];
    data.weapons[k] = { unlocked: w.unlocked, mag: w.mag === Infinity ? -1 : w.mag, reserve: w.reserve === Infinity ? -1 : w.reserve };
  }
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
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
  p.weapon = data.weapon || 'fists';
  for (const k of WEAPON_ORDER) {
    const w = data.weapons[k];
    if (!w) continue;
    p.weapons[k].unlocked = !!w.unlocked;
    p.weapons[k].mag = w.mag < 0 ? Infinity : w.mag;
    p.weapons[k].reserve = w.reserve < 0 ? Infinity : w.reserve;
  }
  G.mission.index = data.index;
  G.mission.completed = data.completed.slice();
  G.mission.active = false;
  G.mission.step = 0;
  p.x = data.x; p.z = data.z; p.inCar = null; p.hp = 100;
  G.cam.x = p.x; G.cam.z = p.z;
  G.wanted = 0; G.searching = false;
  // Owned cars respawn at their slots, keeping their original ids.
  G.owned = [];
  for (const rec of data.owned || []) {
    const [sx, sz] = GARAGE_SLOTS[rec.slot] || GARAGE_SLOTS[0];
    const car = spawnCar(G, rec.kind, sx, sz, Math.PI / 2, { parked: true, owned: true, slot: rec.slot });
    car.id = rec.carId;
    reserveId(rec.carId);
    car.hp = car.maxHp;
    G.owned.push({ carId: rec.carId, kind: rec.kind, slot: rec.slot });
  }
}
