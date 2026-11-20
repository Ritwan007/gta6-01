// Save / Continue — localStorage. Cash, weapons/ammo, mission progress, position, and
// owned garage vehicles as FULL records, respawned exactly at their garage slots on load.
import { SAVE_KEY } from './config.js';

export function createSave(G) {
  function write() {
    const P = G.player;
    const data = {
      cash: P.cash, weapon: P.weapon, unlocked: P.unlocked,
      weapons: P.weapons, owned: P.owned, missionIndex: G.missions.state.index,
      completed: P.completed, x: P.x, z: P.z, hp: P.hp,
      inCar: P.inCar, carVariant: P.car ? P.car.variant : null, carHp: P.car ? P.car.hp : null,
    };
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage off */ }
    return data;
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function hasSave() { return !!read(); }

  // Apply a save to a fresh world: respawn owned garage vehicles exactly, restore the
  // player (and their car, if they saved in one) at the saved position.
  function apply(data) {
    const P = G.player;
    P.cash = data.cash; P.weapon = data.weapon; P.unlocked = data.unlocked;
    P.weapons = data.weapons; P.completed = data.completed || [];
    P.hp = data.hp ?? 100;
    G.missions.state.index = data.missionIndex || 0;
    // Owned vehicles respawn at garage slots, full records. Slots sit ON street z=120
    // (clear of buildings by construction) beside the garage point.
    const slots = [[-320, 120], [-280, 120], [-340, 120], [-260, 120]];
    P.owned = [];
    (data.owned || []).forEach((rec, i) => {
      const slot = slots[i % slots.length];
      const car = G.vehicles.spawn(rec.variant, slot[0], slot[1], 0, { parked: true, color: rec.color });
      car.hp = rec.hp;
      P.owned.push({ variant: rec.variant, color: rec.color, hp: rec.hp, id: car.id });
    });
    if (data.inCar && data.carVariant) {
      const car = G.vehicles.spawn(data.carVariant, data.x + 3, data.z, 0, { parked: false });
      car.hp = data.carHp ?? car.def.hp;
      car.isPlayer = true; P.inCar = true; P.car = car;
    }
    P.x = data.x; P.z = data.z;
    G.playerApi.place(data.x, data.z, 0);
    G.hud.feed('Save loaded — welcome back to Caldera Bay.');
  }

  return { write, read, hasSave, apply };
}
