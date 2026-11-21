// VELORA HEAT — the 6-mission story chain: cards, steps, timers, race, waves,
// rewards and unlocks. Steps are data in config.js; this file interprets them.
import { MISSIONS, POINTS, RACE_CPS, WEAPONS, GARAGE_SLOTS } from './config.js';
import { dist } from './random.js';
import { makeCar, playerCar } from './vehicles.js';
import { spawnEnemy } from './weapons.js';

export function createMission(G) {
  const M = {
    index: 0, active: false, step: 0, stepT: 0, timer: 0,
    completed: [false, false, false, false, false, false],
    raceCps: null, playerCp: 0, racers: [], wave: 0, waveSpawned: 0, waveAlive: 0,
    holdupDone: false,
  };
  function def() { return MISSIONS[M.index]; }
  function stepDef() { return M.active ? def().steps[M.step] : null; }
  function objectiveText() {
    if (!M.active) {
      if (M.index >= 6) return { title: 'FREE ROAM', text: 'All missions complete — Velora Bay is yours. Rob shops, steal cars, lose the heat.' };
      return { title: 'NEXT JOB', text: `Drive to the gold V at Lestari Motors — ${def().id} ${def().title} (E to start)` };
    }
    const s = stepDef();
    return { title: `${def().id} — ${def().title}`, text: s ? s.text : '', timer: M.timer > 0 ? M.timer : 0 };
  }
  function showCard(kicker, title, text, reward, cb) {
    G.hud.showCard(kicker, title, text, reward, cb);
    G.mode = 'card';
  }
  function startNext() {
    if (M.index >= 6 || M.active) return;
    const d = def();
    M.active = true; M.step = 0; M.stepT = 0; M.timer = d.timer || 0;
    M.raceCps = null; M.playerCp = 0; M.racers = []; M.wave = 0;
    if (d.startWanted) { G.wanted = d.startWanted; G.unseenT = 0; G.hud.updateStars(); }
    if (d.id === 'M5') setupRace();
    if (d.id === 'M6') { giveAmmo(); }    showCard(d.id + ' — NEW MISSION', d.title, d.intro, d.timer ? `Timer: ${Math.floor(d.timer / 60)}:${String(d.timer % 60).padStart(2, '0')}` : '', () => { G.mode = 'play'; });
    G.audio.stingGood();
  }
  function setupRace() {
    // The race runs clean: VBPD stands down for the event, so the challenge
    // is the two AI racers, not a 3-minute pursuit ramming the lent GT apart.
    G.police.clearWanted('race');
    // Sari lends you a GT: put the player in one at the start line.
    const p = G.player;
    if (p.inCar == null || playerCar(G).kind !== 'gt') {
      if (p.inCar != null) { const old = playerCar(G); old.driver = 'none'; old.parked = true; p.inCar = null; }
      const gt = makeCar('gt', POINTS.raceStart.x - 6, POINTS.raceStart.z, 0, { color: '#e01e2b' });
      G.cars.push(gt);
      p.x = gt.x; p.z = gt.z;
      // Enter directly (the lent car is not a steal — no crime for it).
      p.inCar = gt.id; gt.driver = 'player'; gt.parked = false;
    }
    M.raceCps = RACE_CPS;
    M.playerCp = 0;
    M.racers = [];
    for (let i = 0; i < 2; i++) {
      const r = makeCar('gt', POINTS.raceStart.x + 6 + i * 8, POINTS.raceStart.z + 6, 0, { driver: 'racer', color: i === 0 ? '#ffb020' : '#1ec8e0' });
      r.cp = 0;
      G.cars.push(r);
      M.racers.push(r);
    }
  }
  function giveAmmo() {
    const p = G.player;
    for (const w of p.weapons) if (w.owned && w.mag !== Infinity) { w.reserve += 60; if (w.mag < WEAPONS[p.weapons.indexOf(w)].mag) w.mag = WEAPONS[p.weapons.indexOf(w)].mag; }
  }
  function nextStep() {
    M.step++;
    M.stepT = 0;
    if (M.step >= def().steps.length) completeMission();
    else G.hud.toast(stepDef().text);
  }
  function completeMission() {
    const d = def();
    const p = G.player;
    p.cash += d.reward;
    if (d.unlock > 0) {
      p.weapons[d.unlock].owned = true;
      p.weapons[d.unlock].mag = WEAPONS[d.unlock].mag;
      p.weapons[d.unlock].reserve = 48;
      p.weapon = d.unlock;
    }
    if (d.unlock === -1) G.flags.robUnlocked = true;
    if (d.unlock === -2) {
      // A Falco GT now waits at the garage (first FREE slot, owned + visible).
      const used = new Set(G.owned.map((o) => o.slot));
      let idx = 0;
      while (idx < GARAGE_SLOTS.length && used.has(idx)) idx++;
      if (idx < GARAGE_SLOTS.length) {
        const slot = GARAGE_SLOTS[idx];
        const gt = makeCar('gt', slot.x, slot.z, 0, { parked: true, color: '#ffb020' });
        G.cars.push(gt);
        G.owned.push({ carId: gt.id, kind: 'gt', color: '#ffb020', hp: gt.hp, slot: idx, name: 'Falco GT' });
      }
    }
    if (d.unlock === -3) { /* ending handled below */ }
    M.completed[M.index] = true;
    M.index++;
    M.active = false;
    // The delivered target car stops being a mission target.
    for (const c of G.cars) if (c.target) c.target = false;
    // Job done — the pursuit breaks off. (M3 sets its own 3 HEAT at start, so
    // its escape still plays out; the heat only clears when a job completes.)
    G.police.clearWanted('mission');
    G.audio.chaChing(); G.audio.stingGood();
    G.save.save(G);
    if (d.id === 'M6') {
      showCard('MISSION COMPLETE', d.title, d.complete, `+$${d.reward}`, () => {
        G.mode = 'ending';
        document.getElementById('ending-stats').textContent = `Cash $${p.cash} · Missions 6/6 · Heat ${G.wanted}★`;
        G.hud.showEnding();
      });
      return;
    }
    showCard('MISSION COMPLETE', d.title, d.complete, `Reward: $${d.reward} · Cash now $${p.cash}`, () => { G.mode = 'play'; });
  }
  function failMission(reason) {
    const d = def();
    if (!M.active) return;
    M.active = false;
    // Racers stand down.
    for (const r of M.racers) { r.driver = 'none'; r.parked = true; }
    M.racers = [];
    G.audio.stingBad();
    showCard(d.id + ' — FAILED', d.title, reason + ' Drive back to Lestari Motors (gold V) to retry.', '', () => { G.mode = 'play'; });
  }
  function onEnterCar(car) {
    if (!M.active) return;
    const s = stepDef();
    if (!s) return;
    if (s.t === 'steal' && car.mission === 'M1') nextStep();
    else if (s.t === 'enter' && car.mission === 'M2') nextStep();
  }
  function onHoldupDone(wasMission) {
    if (!M.active) return;
    const s = stepDef();
    if (s && s.t === 'holdup' && wasMission) nextStep();
  }
  function onEnemyKilled(e) {
    if (!M.active) return;
    const s = stepDef();
    if (s && s.t === 'defend') M.waveAlive--;
  }
  function onStoreCar(car) { /* garage store is free-roam; nothing mission-bound */ }

  function spawnWave(n) {
    M.waveAlive = n;
    for (let i = 0; i < n; i++) {
      let x = POINTS.garage.x, z = POINTS.garage.z;
      for (let t = 0; t < 20; t++) {
        const cand = { x: POINTS.garage.x + (G.rng() - 0.5) * 90, z: POINTS.garage.z + (G.rng() - 0.5) * 90 };
        if (G.city.isOnStreet(cand.x, cand.z) && dist(cand.x, cand.z, POINTS.garage.x, POINTS.garage.z) > 18) { x = cand.x; z = cand.z; break; }
      }
      spawnEnemy(G, x, z, G.rng() < 0.5 ? 'pistol' : 'smg');
    }
    G.hud.feed(`Damar's crew attacks — wave ${M.wave + 1} of ${def().steps[0].waves.length}!`, 'bad');
  }
  function update(dt) {
    if (!M.active) return;
    const d = def();
    const s = stepDef();
    if (!s) return;
    if (M.timer > 0) {
      M.timer -= dt;
      if (M.timer <= 0) { failMission('Time ran out.'); return; }
    }
    const p = G.player;
    const pc = playerCar(G);
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    switch (s.t) {
      case 'goto':
      case 'reach':
      case 'getaway':
        if (dist(px, pz, s.x, s.z) < s.r) nextStep();
        break;
      case 'deliver': {
        const target = G.cars.find((c) => c.mission === (d.id === 'M1' ? 'M1' : 'M2'));
        if (pc && target && pc.id === target.id && dist(px, pz, s.x, s.z) < s.r) nextStep();
        // Target destroyed = fail.
        if (target && target.hp <= 0) failMission('The target car was destroyed.');
        break;
      }
      case 'wait': {
        const inZone = dist(px, pz, s.x, s.z) < s.r;
        if (inZone && (!s.needClear || G.wanted === 0)) {
          M.stepT += dt;
          if (M.stepT >= s.secs) nextStep();
        } else M.stepT = 0;
        break;
      }
      case 'race': {
        const cp = M.raceCps[M.playerCp];
        if (cp && dist(px, pz, cp.x, cp.z) < 10) {
          M.playerCp++;
          G.hud.toast(`Checkpoint ${M.playerCp}/12`);
          if (M.playerCp >= M.raceCps.length) {
            const beaten = M.racers.some((r) => r.finished);
            if (beaten) failMission('A racer finished ahead of you.');
            else completeMission();
          }
        }
        // A racer finishing first ends the race as a loss.
        if (M.racers.some((r) => r.finished) && M.playerCp < M.raceCps.length) {
          failMission('A racer finished ahead of you.');
        }
        break;
      }
      case 'defend': {
        if (M.wave === 0 && M.waveAlive === 0) { spawnWave(d.steps[0].waves[0]); M.wave = 1; }
        else if (M.waveAlive <= 0 && M.wave > 0) {
          if (M.wave >= d.steps[0].waves.length) nextStep();
          else { spawnWave(d.steps[0].waves[M.wave]); M.wave++; }
        }
        break;
      }
      default: break;
    }
  }
  return Object.assign(M, {
    def, stepDef, objectiveText, startNext, update,
    onEnterCar, onHoldupDone, onEnemyKilled, onStoreCar, failMission, completeMission,
  });
}
