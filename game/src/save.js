// Save / Continue via localStorage. The save holds cash, weapons + ammo, mission
// progress, the player's position, and the garage's owned vehicles as FULL records
// (kind, colour, garage slot) — on load those vehicles are re-spawned in the world,
// so a stored car survives a reload (the round-10 bug: the id list round-tripped
// exactly while the cars themselves never came back).
export const SAVE_KEY = 'sunset-heist-caldera-bay-v1';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      cash: G.cash,
      shardsTaken: G.shardsTaken,
      shardIds: G.city.shards.filter((s) => s.taken).map((s) => s.id),
      player: {
        x: G.player.x, z: G.player.z, heading: G.player.heading,
        health: G.player.health, inCar: false,
      },
      weapons: {
        index: G.weapons.index,
        mag: G.weapons.mag,
        reserve: G.weapons.reserve,
        unlocked: G.weapons.unlocked,
      },
      missions: G.missions.saveState(),
      wanted: 0,
      ownedVehicles: G.ownedVehicles.map((v) => ({ kind: v.kind, color: v.color, slot: v.slot })),
      time: G.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function hasSave() {
  return loadSave() !== null;
}
