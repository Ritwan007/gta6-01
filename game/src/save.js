// VELORA HEAT — save / continue (localStorage). Owned garage vehicles are saved
// as FULL records (carId, kind, color, hp, slot) and re-spawned exactly at their
// slots on Continue — the r10 F1 fix: a stored car must survive a reload.
import { GARAGE_SLOTS, POINTS } from './config.js';
import { makeCar, playerCar } from './vehicles.js';

export const SAVE_KEY = 'velora-heat-save-v1';

export function createSave(G) {
  function snapshot() {
    const p = G.player;
    // If the player saves while driving, the car becomes owned (parked at a free
    // slot) so Continue can restore it exactly.
    let inCar = null;
    const pc = playerCar(G);
    if (pc) {
      const used = new Set(G.owned.map((o) => o.slot));
      let slot = -1;
      for (let i = 0; i < GARAGE_SLOTS.length; i++) if (!used.has(i)) { slot = i; break; }
      if (slot >= 0 && !G.owned.some((o) => o.carId === pc.id)) {
        G.owned.push({ carId: pc.id, kind: pc.kind, color: pc.color, hp: pc.hp, slot, name: pc.name });
      }
      inCar = pc.id;
    }
    return {
      v: 1, cash: p.cash, hp: p.hp, weapon: p.weapon,
      weapons: p.weapons.map((w) => ({ owned: w.owned, mag: w.mag, reserve: w.reserve })),
      missionIndex: G.mission.index, completed: G.mission.completed.slice(),
      owned: G.owned.map((o) => ({ ...o })),
      coins: [...G.coinsTaken],
      px: p.x, pz: p.z, angle: p.angle, inCar,
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
    // Re-spawn every owned vehicle at its slot, with its saved id (exact restore).
    for (const o of G.owned) {
      const slot = GARAGE_SLOTS[o.slot];
      if (!slot) continue;
      const c = makeCar(o.kind, slot.x, slot.z, 0, { id: o.carId, parked: true, color: o.color });
      c.hp = o.hp;
      G.cars.push(c);
    }
    p.x = data.px; p.z = data.pz; p.angle = data.angle;
    if (data.inCar != null) {
      const c = G.cars.find((cc) => cc.id === data.inCar);
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
