// VELORA HEAT — save / continue (localStorage). Owned garage vehicles are saved
// as FULL records (carId, kind, color, hp, slot) and re-spawned exactly at their
// slots on Continue — the r10 F1 fix: a stored car must survive a reload.
import { GARAGE_SLOTS, POINTS } from './config.js';
import { makeCar, playerCar } from './vehicles.js';

export const SAVE_KEY = 'velora-heat-save-v1';

export function createSave(G) {
  function snapshot() {
    const p = G.player;
    // If the player saves while driving a car that is already garage-owned,
    // Continue restores them inside that car at its slot (via the id map).
    // A car NOT in owned is NEVER added to owned here: claiming it silently
    // broke the garage store (the car counted as "already owned", so E
    // re-entered it instead of storing it). It is recorded separately as
    // inCarData and respawned at the saved position on Continue.
    let inCar = null, inCarData = null;
    const pc = playerCar(G);
    if (pc) {
      inCar = pc.id;
      if (!G.owned.some((o) => o.carId === pc.id)) {
        inCarData = { kind: pc.kind, color: pc.color, hp: pc.hp, name: pc.name };
      }
    }
    return {
      v: 1, cash: p.cash, hp: p.hp, weapon: p.weapon,
      weapons: p.weapons.map((w) => ({ owned: w.owned, mag: w.mag, reserve: w.reserve })),
      missionIndex: G.mission.index, completed: G.mission.completed.slice(),
      owned: G.owned.map((o) => ({ ...o })),
      coins: [...G.coinsTaken],
      px: pc ? pc.x : p.x, pz: pc ? pc.z : p.z, angle: p.angle, inCar, inCarData,
      flags: { robUnlocked: !!G.flags.robUnlocked },
    };
  }
  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
      return true;
    } catch { return false; }
  }
  function hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
  }
  function load() {
    let data = null;
    try { data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
    if (!data || data.v !== 1) return false;
    const p = G.player;
    p.cash = data.cash; p.hp = data.hp; p.weapon = data.weapon;
    data.weapons.forEach((w, i) => { if (p.weapons[i]) Object.assign(p.weapons[i], w); });
    G.mission.index = data.missionIndex;
    G.mission.completed = data.completed.slice();
    G.owned = data.owned.map((o) => ({ ...o }));
    G.coinsTaken = new Set(data.coins || []);
    G.flags.robUnlocked = !!(data.flags && data.flags.robUnlocked);
    // Re-spawn every owned vehicle at its slot. Fresh ids are assigned (the
    // world was rebuilt with new ids, so a saved id could collide with a fresh
    // car or miss entirely); the owned record and the saved inCar are remapped.
    const idMap = new Map();
    for (const o of G.owned) {
      const slot = GARAGE_SLOTS[o.slot];
      if (!slot) continue;
      const c = makeCar(o.kind, slot.x, slot.z, 0, { parked: true, color: o.color });
      c.hp = o.hp;
      idMap.set(o.carId, c.id);
      o.carId = c.id;
      G.cars.push(c);
    }
    p.x = data.px; p.z = data.pz; p.angle = data.angle;
    if (data.inCarData) {
      // A car the player was driving (not garage-owned) respawns at the saved
      // position; the player stays inside it.
      const c = makeCar(data.inCarData.kind, data.px, data.pz, data.angle, { color: data.inCarData.color });
      c.hp = data.inCarData.hp;
      G.cars.push(c);
      p.inCar = c.id; c.driver = 'player'; c.parked = false;
      p.x = c.x; p.z = c.z;
    } else if (data.inCar != null) {
      const newId = idMap.get(data.inCar);
      const c = newId != null ? G.cars.find((cc) => cc.id === newId) : null;
      if (c) {
        p.inCar = c.id; c.driver = 'player'; c.parked = false;
        p.x = c.x; p.z = c.z;
      } else p.inCar = null;
    } else p.inCar = null;
    G.wanted = 0; G.searching = false; G.unseenT = 0;
    return true;
  }
  function clear() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  return { save, hasSave, load, clear };
}
