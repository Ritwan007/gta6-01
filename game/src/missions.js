// The 6-mission story chain: intro cards, objective steps with a beacon + minimap
// marker, timers, success/fail states, cash rewards and weapon unlocks. Free-roam
// crime stays available between missions; the next mission starts at the gold V
// marker at Sorren Motors. Every step is data from config.js; this file runs it.
import { MISSIONS, POINTS, HEAT } from './config.js';
import { dist2d, wrapAngle, clamp } from './random.js';

export function createMissionSys(G) {
  const sys = {
    index: 0,                 // current mission 0..5
    done: [false, false, false, false, false, false],
    active: false,
    step: 0,
    timer: 0,
    robT: 0,
    waitT: 0,
    race: null,
    defend: null,
    freeRob: null,
    targetCar: null,
    finishedAll: false,
  };

  sys.mission = () => MISSIONS[sys.index];
  sys.hasNext = () => sys.index < MISSIONS.length && !sys.finishedAll;
  sys.isActive = () => sys.active;

  sys.currentStep = () => {
    if (!sys.active) return null;
    return sys.mission().steps[sys.step] || null;
  };

  sys.objectiveText = () => {
    if (!sys.active) {
      if (sys.finishedAll) return 'Free roam — Caldera Bay is yours. Garage, shops and streets are open.';
      return `${sys.mission().id} ${sys.mission().title} — go to Sorren Motors (gold V) to start`;
    }
    const m = sys.mission();
    const s = sys.currentStep();
    const t = sys.timer > 0 ? ` · ${Math.ceil(sys.timer)}s` : '';
    return `${m.id} ${m.title} — ${s ? s.text : ''}${t}`;
  };

  // Where the beacon + minimap marker point right now.
  sys.objectivePoint = () => {
    if (sys.freeRob) return { x: 120, z: -60, radius: 10 };
    if (!sys.active) return { x: POINTS.garage.x, z: POINTS.garage.z, radius: POINTS.garage.radius };
    const s = sys.currentStep();
    if (!s) return { x: POINTS.garage.x, z: POINTS.garage.z, radius: 14 };
    if (s.type === 'race' && sys.race) {
      const cp = G.city.racePoints[sys.race.playerCp] || G.city.racePoints[0];
      return { x: cp[0], z: cp[1], radius: 12 };
    }
    const pt = POINTS[s.point];
    if (pt) return pt;
    if (s.point === 'sunmart') return { x: 120, z: -60, radius: 10 };
    return { x: POINTS.garage.x, z: POINTS.garage.z, radius: 14 };
  };

  function showIntro(m) {
    G.hud.showMissionCard(`${m.id} — ${m.title}`, `${m.intro}\n\nReward: $${m.reward} · Time limit: ${Math.floor(m.time / 60)}:${String(m.time % 60).padStart(2, '0')}`, 'START JOB');
  }

  sys.startMission = (i) => {
    sys.index = i;
    sys.active = true;
    sys.step = 0;
    sys.timer = MISSIONS[i].time;
    sys.robT = 0;
    sys.waitT = 0;
    sys.race = null;
    sys.defend = null;
    const m = MISSIONS[i];
    showIntro(m);
    G.audio.sting('mission');
    if (m.id === 'M3') {
      G.police.setWanted(3);
      G.hud.feed('The drop went wrong — 3 stars!', 'police');
    }
    if (m.id === 'M5') {
      sys.race = { playerCp: 0, racerCp: [0, 0], racerT: [0, 0], started: false, cars: [] };
      // Two rival racers in Tempest GTs, waiting at the start line.
      sys.race.cars = [
        G.vehicles.spawnVehicle('gt', -8, -6, 0, { color: 0x1e90d8 }),
        G.vehicles.spawnVehicle('gt', 8, -6, 0, { color: 0xffb300 }),
      ];
    }
    if (m.id === 'M6') {
      sys.defend = { wave: 0, spawned: 0, alive: 0 };
      sys.startDefendWave();
    }
    G.city.setBeacon(sys.objectivePoint().x, sys.objectivePoint().z, true);
    G.saveGame();
  };

  sys.startNextMission = () => {
    if (!sys.hasNext()) return false;
    sys.startMission(sys.index);
    return true;
  };

  sys.startDefendWave = () => {
    const d = sys.defend;
    d.wave += 1;
    d.spawned = 0;
    const count = 2 + d.wave; // waves of 3, 4, 5
    const g = POINTS.garage;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + Math.random();
      const x = g.x + Math.sin(a) * (42 + Math.random() * 14);
      const z = g.z + Math.cos(a) * (42 + Math.random() * 14);
      G.weapons.spawnEnemy(x, z, 60);
      d.spawned += 1;
    }
    d.alive = count;
    G.hud.feed(`Wave ${d.wave} of 3 — Hale's crew is coming!`, 'police');
    G.audio.sting('mission');
  };

  sys.onEnemyDown = (e) => {
    if (!sys.active || !sys.defend) return;
    const d = sys.defend;
    d.alive -= 1;
    if (d.alive <= 0) {
      if (d.wave < 3) {
        sys.advanceStep();
        sys.startDefendWave();
      } else {
        sys.advanceStep(); // to the getaway deliver step
      }
    }
  };

  sys.onEnterCar = (car) => {
    if (!sys.active) return;
    const s = sys.currentStep();
    if (!s || s.type !== 'steal') return;
    const want = sys.mission().id === 'M1' ? 'M1' : sys.mission().id === 'M2' ? 'M2' : null;
    if (want && car.target === want) {
      sys.advanceStep();
      G.hud.feed(`Got the ${car.name} — now deliver it!`, 'good');
    }
  };

  sys.onTargetCarDestroyed = (car) => {
    if (!sys.active) return;
    const s = sys.currentStep();
    if (!s) return;
    if ((s.type === 'steal' || s.type === 'deliver') && car.target === sys.mission().id) {
      sys.failMission('The target car was destroyed.');
    }
  };

  sys.advanceStep = () => {
    sys.step += 1;
    sys.robT = 0;
    sys.waitT = 0;
    const m = sys.mission();
    if (sys.step >= m.steps.length) {
      sys.completeMission();
      return;
    }
    const pt = sys.objectivePoint();
    G.city.setBeacon(pt.x, pt.z, true);
    G.audio.click();
  };

  sys.completeMission = () => {
    const m = sys.mission();
    sys.done[sys.index] = true;
    sys.active = false;
    G.cash += m.reward;
    G.weapons.unlock(sys.index);
    G.audio.sting('complete');
    G.audio.chaChing();
    G.hud.showMissionCard(`${m.id} COMPLETE — ${m.title}`, `Ivy pays out $${m.reward}. Cash is now $${G.cash}.\n${sys.index === 0 ? 'Unlocked: Sorren 9 pistol (press 2).' : sys.index === 1 ? 'Unlocked: Hornet SMG (press 3).' : sys.index === 2 ? 'Unlocked: Thunder 12 shotgun (press 4).' : sys.index === 4 ? 'A Tempest GT now waits at Sorren Motors.' : ''}`, 'CONTINUE');
    if (sys.index === 4) {
      // M5 reward: a Tempest GT spawns at the garage.
      G.vehicles.spawnVehicle('gt', -300, 132, Math.PI, { parked: true, owner: 'player', color: 0xffb300 });
    }
    sys.index += 1;
    if (sys.index >= MISSIONS.length) {
      sys.finishedAll = true;
      G.hud.showEnding();
    }
    G.city.setBeacon(POINTS.garage.x, POINTS.garage.z, true);
    G.saveGame();
  };

  sys.failMission = (why) => {
    if (!sys.active) return;
    const m = sys.mission();
    sys.active = false;
    sys.race = null;
    if (sys.defend) {
      for (const e of G.weapons.enemies) if (!e.dead) { e.dead = true; e.mesh.visible = false; }
      sys.defend = null;
    }
    G.audio.sting('fail');
    G.hud.showMissionCard(`${m.id} FAILED — ${m.title}`, `${why}\n\nThe job is still open. Return to Sorren Motors (gold V) to try again.`, 'BACK TO THE GARAGE');
    G.city.setBeacon(POINTS.garage.x, POINTS.garage.z, true);
  };

  sys.restartMission = () => {
    if (sys.index < MISSIONS.length && !sys.finishedAll) sys.startMission(sys.index);
  };

  // Free-roam SunMart robbery (unlocked after M4): hold the zone for 8 s.
  sys.startFreeRob = () => {
    if (!sys.done[3]) return false;
    sys.freeRob = { t: 0, need: 8 };
    G.hud.feed('Hold the till — stay at the counter!', 'police');
    return true;
  };

  sys.update = (dt) => {
    // Free-roam robbery progress.
    if (sys.freeRob) {
      const p = G.player;
      if (!p.inCar && dist2d(p.x, p.z, 120, -60) < 10) {
        sys.freeRob.t += dt;
        if (sys.freeRob.t >= sys.freeRob.need) {
          G.cash += 450;
          G.audio.chaChing();
          G.hud.toast('Robbed SunMart: +$450');
          G.police.addCrime('robbery', p.x, p.z);
          sys.freeRob = null;
        }
      } else {
        sys.freeRob.t = Math.max(0, sys.freeRob.t - dt * 2);
        if (dist2d(p.x, p.z, 120, -60) > 16) sys.freeRob = null;
      }
      return;
    }
    if (!sys.active) return;
    const m = sys.mission();
    const s = sys.currentStep();
    if (!s) return;
    sys.timer -= dt;
    if (sys.timer <= 0) {
      sys.failMission('Out of time.');
      return;
    }
    const p = G.player;
    const pt = sys.objectivePoint();

    if (s.type === 'goto') {
      if (dist2d(p.x, p.z, pt.x, pt.z) < pt.radius) sys.advanceStep();
    } else if (s.type === 'steal') {
      // Advance happens in onEnterCar; nothing to poll here.
    } else if (s.type === 'deliver') {
      const want = m.id === 'M1' ? 'M1' : m.id === 'M2' ? 'M2' : null;
      const inTarget = p.inCar && p.car && (!want || p.car.target === want);
      if (inTarget && dist2d(p.x, p.z, pt.x, pt.z) < pt.radius) sys.advanceStep();
    } else if (s.type === 'escape') {
      if (dist2d(p.x, p.z, pt.x, pt.z) < pt.radius) sys.advanceStep();
    } else if (s.type === 'wait') {
      if (G.police.wanted === 0) {
        sys.advanceStep();
      } else if (dist2d(p.x, p.z, pt.x, pt.z) < pt.radius) {
        sys.waitT += dt;
        if (sys.waitT >= (s.seconds || 8) && G.police.searching) {
          // Waiting hidden while SEARCHING also counts: the heat is already fading.
          sys.advanceStep();
        }
      } else {
        sys.waitT = 0;
      }
    } else if (s.type === 'rob') {
      if (!p.inCar && dist2d(p.x, p.z, 120, -60) < 10) {
        sys.robT += dt;
        if (sys.robT >= 8) {
          G.cash += 450;
          G.audio.chaChing();
          G.hud.toast('Till emptied: +$450');
          G.police.addCrime('robbery', p.x, p.z);
          sys.advanceStep();
        }
      } else {
        sys.robT = Math.max(0, sys.robT - dt * 2);
      }
    } else if (s.type === 'race' && sys.race) {
      const r = sys.race;
      const cps = G.city.racePoints;
      // Player progress.
      if (r.playerCp < cps.length) {
        const cp = cps[r.playerCp];
        if (dist2d(p.x, p.z, cp[0], cp[1]) < 12) {
          r.playerCp += 1;
          if (r.playerCp === 1) {
            r.started = true;
            G.hud.feed('GO! Beat both racers to the finish!', 'good');
          } else if (r.playerCp >= cps.length) {
            sys.completeMission();
            return;
          } else {
            G.hud.feed(`Checkpoint ${r.playerCp}/${cps.length - 1}`);
          }
        }
      }
      // Rivals DRIVE the route (same physics as the player) instead of teleporting
      // between checkpoints: each one steers toward its next checkpoint at a fixed
      // pace, so the race is a real drive, not a timer.
      if (r.started) {
        for (let i = 0; i < 2; i += 1) {
          const car = r.cars[i];
          if (!car || car.dead || r.racerCp[i] >= cps.length) continue;
          const cp = cps[r.racerCp[i]];
          if (dist2d(car.x, car.z, cp[0], cp[1]) < 12) {
            r.racerCp[i] += 1;
            if (r.racerCp[i] >= cps.length) {
              sys.failMission('A rival finished first. The Row saw everything.');
              return;
            }
            continue;
          }
          const bearing = Math.atan2(cp[0] - car.x, cp[1] - car.z);
          const err = wrapAngle(bearing - car.heading);
          G.vehicles.stepCar(car, dt, clamp(err * 1.6, -1, 1), 0.55, false);
        }
      }
    } else if (s.type === 'defend') {
      // Wave progress is driven by onEnemyDown; nothing to poll.
    }

    // Keep the beacon on the current objective.
    const cur = sys.objectivePoint();
    G.city.setBeacon(cur.x, cur.z, true);
  };

  sys.saveState = () => ({ index: sys.index, done: sys.done, finishedAll: sys.finishedAll });
  sys.loadState = (st) => {
    if (!st) return;
    sys.index = st.index ?? 0;
    sys.done = st.done ?? sys.done;
    sys.finishedAll = !!st.finishedAll;
    sys.active = false;
  };

  return sys;
}
