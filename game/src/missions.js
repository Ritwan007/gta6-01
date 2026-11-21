// VELORA HEAT — the 6-mission story chain: intro cards, objectives, timers
// (none are fail timers — heat and police supply the pressure), rewards,
// unlocks, the M5 race and the M6 wave defence + finale getaway.
import { MISSIONS, RACE_CHECKPOINTS, GARAGE, HIDEOUT, SHOP, CASA_BIRU, DROP_POINT, MARINA, WEAPONS } from './config.js';
import { dist } from './random.js';
import { createCar } from './vehicles.js';

const M6_WAVES = [2, 2, 3];
const M6_SPAWNS = [
  [[-176, -44], [-264, -44]],
  [[-132, -44], [-220, -132]],
  [[-308, -44], [-220, 44], [-176, -44]],
];

export function createMissionState() {
  return { index: 0, active: false, step: 0, completed: [false, false, false, false, false, false], playerCp: 0 };
}

function showCard(G, title, body, button, onDone) {
  G.card = { title, body, button, onDone };
  G.mode = 'card';
  G.audio.stingGood();
}

export function startNext(G) {
  const idx = G.mission.index;
  if (idx >= MISSIONS.length) { G.feed('All missions complete — Velora Bay is yours. Free roam!'); return false; }
  const m = MISSIONS[idx];
  G.mission.active = true;
  G.mission.step = 0;
  G.mission.playerCp = 0;
  if (idx === 2) {
    G.police.setWanted(3, 'the drop went wrong');
  }
  if (idx === 4) {
    G.police.clearWanted();
    // Two AI racers + a lent Falco GT for the player.
    const r1 = createCar('gt', -190, -44, 0, { racer: true });
    const r2 = createCar('gt', -176, -44, 0, { racer: true });
    r1.speed = 5; r2.speed = 5;
    G.cars.push(r1, r2);
    const lent = createCar('gt', -206, -44, 0, { parked: false });
    lent.wasDriven = true;
    G.cars.push(lent);
    G.player.enterCar(lent);
    G.feed('Race GT ready — beat Damar\'s drivers to all 12 checkpoints!');
  }
  if (idx === 5) {
    G.mission.wave = 0;
    spawnWave(G, 0);
  }
  showCard(G, `${m.id} — ${m.title}`, m.intro, 'Start mission', () => { G.mode = 'play'; });
  return true;
}

function spawnWave(G, wave) {
  const spots = M6_SPAWNS[wave];
  for (const [x, z] of spots) {
    G.enemies.push({ x, z, hp: 45, speed: 3.4, fireT: 1 + G.rng() });
  }
  G.feed(`Wave ${wave + 1} of ${M6_WAVES.length} — Damar's crew is here!`);
  G.audio.stingBad();
}

function completeMission(G) {
  const idx = G.mission.index;
  const m = MISSIONS[idx];
  G.mission.completed[idx] = true;
  G.mission.active = false;
  G.player.cash += m.reward;
  if (m.unlock) {
    const w = G.player.weapons[m.unlock];
    w.unlocked = true;
    w.mag = WEAPONS[m.unlock].mag;
    w.reserve = WEAPONS[m.unlock].reserve;
    G.feed(`Unlocked: ${WEAPONS[m.unlock].name}!`);
  }
  G.police.clearWanted('Mission complete — heat cleared.');
  G.audio.chaChing();
  G.mission.index = idx + 1;
  const last = idx === MISSIONS.length - 1;
  showCard(G, `${m.id} COMPLETE — $${m.reward}`, `${m.complete} Cash is now $${G.player.cash}.`, last ? 'See the ending' : 'Continue', () => {
    if (last) { G.mode = 'ending'; }
    else G.mode = 'play';
  });
}

export function failMission(G, reason) {
  if (!G.mission.active) return;
  G.mission.active = false;
  const m = MISSIONS[G.mission.index];
  showCard(G, `${m.id} FAILED`, `${reason} The job is still waiting at Karsa Auto Works.`, 'Back to the city', () => { G.mode = 'play'; });
}

export function stepMissions(G, dt) {
  const M = G.mission;
  if (!M.active) return;
  const p = G.player;
  const pc = G.playerCar;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  const idx = M.index;

  if (idx === 0) {
    if (M.step === 0 && pc) M.step = pc.mission === 'M1' ? 2 : 1;
    else if (M.step === 1 && pc && pc.mission === 'M1') M.step = 2;
    else if (M.step === 2 && pc && dist(pc.x, pc.z, GARAGE.x, GARAGE.z) < 16) completeMission(G);
  } else if (idx === 1) {
    if (M.step === 0 && pc) M.step = pc.mission === 'M2' ? 2 : 1;
    else if (M.step === 1 && pc && pc.mission === 'M2') M.step = 2;
    else if (M.step === 2 && pc && pc.mission === 'M2' && dist(pc.x, pc.z, CASA_BIRU.x, CASA_BIRU.z) < 14) completeMission(G);
  } else if (idx === 2) {
    if (M.step === 0 && dist(px, pz, HIDEOUT.x, HIDEOUT.z) < HIDEOUT.r) {
      M.step = 1;
      G.feed('Hidden at the Dermaga hideout — stay out of sight until the heat dies.');
    } else if (M.step === 1 && G.wanted === 0) completeMission(G);
  } else if (idx === 3) {
    if (M.step === 0 && dist(px, pz, SHOP.x, SHOP.z) < 16) {
      M.step = 1;
      G.feed('You are at PelangiMart. Gun drawn, press E to hold up the till.');
    } else if (M.step === 1 && G.holdup) {
      G.holdup.t -= dt;
      if (G.holdup.t <= 0) {
        G.holdup = null;
        M.step = 2;
        G.police.setWanted(2, 'PelangiMart robbery');
        G.feed('Cash bag grabbed! Lose the heat and reach the drop point.');
      }
    } else if (M.step === 2 && dist(px, pz, DROP_POINT.x, DROP_POINT.z) < 14) completeMission(G);
  } else if (idx === 4) {
    const cp = RACE_CHECKPOINTS[M.playerCp];
    if (cp && dist(px, pz, cp[0], cp[1]) < 11) {
      M.playerCp += 1;
      G.feed(`Checkpoint ${M.playerCp}/12!`);
      G.audio.click();
      if (M.playerCp >= 12) completeMission(G);
    }
  } else if (idx === 5) {
    if (M.step === 0) {
      const alive = G.enemies.filter((e) => e.hp > 0).length;
      if (alive === 0) {
        if (M.wave < M6_WAVES.length - 1) {
          M.wave += 1;
          spawnWave(G, M.wave);
        } else {
          M.step = 1;
          G.police.clearWanted('Garage defended — the heat backs off for the getaway.');
          // The crew patches the garage rides: the getaway car is always usable.
          for (const o of G.owned) {
            const c = G.cars.find((x) => x.id === o.carId);
            if (c) { c.hp = c.maxHp; c.wrecked = false; }
          }
          G.feed('Garage defended! Get to the Marina Velora — now!');
        }
      }
    } else if (M.step === 1 && dist(px, pz, MARINA.x, MARINA.z) < 14) completeMission(G);
  }
}
