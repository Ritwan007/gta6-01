// The six-mission story chain — data-driven steps (steal / take / deliver / escape /
// rob / race / defend), each with a live objective, a timer, and a fail state.
// A step only advances on a real in-game event; nothing completes by standing still.
import { MISSIONS, CITY, VEHICLES } from './config.js';

export function createMissions(G) {
  const S = {
    index: 0, active: false, stepIdx: 0, timer: 0, targetCar: null, targetCarId: null,
    robT: 0, robbed: false, raceCp: 0, racers: [], raceDone: false,
    wave: 0, waveLeft: 0, clerk: null, countdown: 0, finished: false,
  };
  G.missions = { current, start, update, onEnterCar, onEnemyDown, onWasted, onBusted, onCarWrecked, state: S };

  function def() { return MISSIONS[S.index] || null; }
  function step() { const d = def(); return d ? d.steps[S.stepIdx] : null; }
  function current() {
    const d = def();
    if (!d) return null;
    return { def: d, active: S.active, step: step(), stepIdx: S.stepIdx, index: S.index, targetCarId: S.targetCarId };
  }

  function start() {
    const d = def();
    if (!d || S.active || S.finished) return;
    S.active = true; S.stepIdx = 0; S.timer = d.timer; S.robT = 0; S.robbed = false;
    S.raceCp = 0; S.racers = []; S.wave = 0; S.waveLeft = 0;
    if (d.id === 6) G.weapons.refillAmmo(); // Ivy stocks you up for the finale
    if (d.startWanted) G.police.setWanted(d.startWanted, 'mission-start');
    // Spawn the mission's target vehicle.
    const st = step();
    if (st && st.type === 'steal') {
      const p = CITY.points[st.target];
      S.targetCar = G.vehicles.spawn(st.car, p.x, p.z, 0, { target: true, parked: true });
      S.targetCarId = S.targetCar.id;
    } else if (st && st.type === 'take') {
      const p = CITY.points[st.point];
      S.targetCar = G.vehicles.spawn(st.car, p.x, p.z, 0, { target: true, parked: true });
      S.targetCarId = S.targetCar.id;
    } else if (st && st.type === 'race') {
      beginRace();
    } else if (st && st.type === 'defend') {
      beginWave(1);
    } else if (st && st.type === 'rob') {
      spawnClerk();
    }
    G.screens.showCard(d.title, d.card, () => {});
    G.hud.setObjective(`${d.title} — ${step().label}`);
    moveBeacon();
    G.audio.sting('go');
  }

  function fail(reason) {
    if (!S.active) return;
    S.active = false;
    G.audio.sting('bad');
    G.screens.showCard('MISSION FAILED', `${def().title}\n${reason}\nDrive back to Sorren Motors to try again.`, () => {});
    G.hud.setObjective('');
    G.city.beacon.visible = false;
    S.targetCar = null; S.targetCarId = null;
    for (const r of S.racers) G.vehicles.remove(r.car);
    S.racers = [];
  }

  function complete() {
    const d = def();
    S.active = false;
    G.player.cash += d.reward;
    G.player.completed.push(d.id);
    G.audio.chaChing(); G.audio.sting('good');
    let unlockText = '';
    if (d.unlock === 'gt-garage') {
      const p = CITY.points.garage;
      G.vehicles.spawn('gt', p.x - 20, p.z + 8, 0, { parked: true });
      unlockText = '\nA Tempest GT is waiting at the garage.';
    } else if (d.unlock && d.unlock !== 'finale') {
      G.weapons.unlock(d.unlock);
      unlockText = `\nUnlocked the ${d.unlock === 'pistol' ? 'Sorren 9 pistol' : d.unlock === 'smg' ? 'Hornet SMG' : 'Thunder 12 shotgun'}.`;
    }
    G.screens.showCard(`${d.title} — COMPLETE`, `+$${d.reward}.${unlockText}\n${d.id === 6 ? 'Viktor Hale is finished. The marina is yours, Milo — roll credits.' : 'Next job waits at Sorren Motors.'}`, () => {});
    G.hud.feed(`${d.title} complete — +$${d.reward}.`);
    S.index++;
    if (S.index >= MISSIONS.length) { S.finished = true; G.hud.setObjective('Caldera Bay is yours — free roam.'); }
    else G.hud.setObjective(`Next job: ${MISSIONS[S.index].title} — start at Sorren Motors.`);
    G.city.beacon.visible = false;
    S.targetCar = null; S.targetCarId = null;
    G.save.write();
  }

  function advanceStep() {
    S.stepIdx++;
    const d = def();
    if (S.stepIdx >= d.steps.length) { complete(); return; }
    const st = step();
    G.hud.setObjective(`${d.title} — ${st.label}`);
    if (st.type === 'race') beginRace();
    if (st.type === 'defend') beginWave(1);
    if (st.type === 'rob') spawnClerk();
    moveBeacon();
  }

  function moveBeacon() {
    const st = step();
    if (!st) { G.city.beacon.visible = false; return; }
    let p = null;
    if (st.point) p = CITY.points[st.point];
    else if (st.target) p = CITY.points[st.target];
    else if (st.type === 'race') p = { x: CITY.raceRoute[0][0], z: CITY.raceRoute[0][1] };
    else if (st.type === 'defend') p = CITY.points.garage;
    if (p) { G.city.beacon.position.set(p.x, 35, p.z); G.city.beacon.visible = true; }
  }

  function spawnClerk() {
    const p = CITY.points.sunmart;
    // The clerk stands at the shop front, between the street point and the shop building.
    const clerk = G.peds.spawn(p.x + 12, p.z);
    clerk.state = 'cower';
    S.clerk = clerk;
  }

  function beginRace() {
    const P = G.player;
    const [sx, sz] = CITY.raceRoute[0];
    // Line the player up at the start line. A race needs a fast car: if the player
    // arrives in a slow one, Ivy leaves a Tempest GT at the line for them.
    let car = P.car;
    const fast = ['gt', 'pursuit', 'bike'];
    if (!car || !fast.includes(car.variant)) {
      if (car) { car.isPlayer = false; }
      car = G.vehicles.spawn('gt', sx, sz, Math.atan2(CITY.raceRoute[1][0] - sx, CITY.raceRoute[1][1] - sz), { parked: false });
      P.inCar = true; P.car = car; car.isPlayer = true;
    } else {
      car.x = sx; car.z = sz; car.speed = 0;
      car.heading = Math.atan2(CITY.raceRoute[1][0] - sx, CITY.raceRoute[1][1] - sz);
      car.mesh.position.set(sx, 0, sz);
    }
    P.x = car.x; P.z = car.z;
    S.raceCp = 0; S.countdown = 3;
    S.racers = [];
    for (let i = 0; i < 2; i++) {
      const rc = G.vehicles.spawn('gt', sx + (i === 0 ? -6 : 6), sz + 4, car.heading, { parked: false, traffic: false });
      rc.color = i === 0 ? 0x2a2ac2 : 0xc2a02a;
      rc.mesh.children[0].material = rc.mesh.children[0].material.clone();
      rc.mesh.children[0].material.color.setHex(rc.color);
      S.racers.push({ car: rc, cp: 0, finished: false });
    }
    G.hud.feed('Race starts in 3… 2… 1…');
  }

  function beginWave(n) {
    S.wave = n;
    const count = 2 + n; // 3, 4, 5 enemies per wave
    S.waveLeft = count;
    const g = CITY.points.garage;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + n;
      const x = g.x + Math.cos(a) * 55, z = g.z + Math.sin(a) * 55;
      G.weapons.spawnEnemy(Math.max(-410, Math.min(410, x)), Math.max(-410, Math.min(410, z)), 60);
    }
    const st = step();
    G.hud.setObjective(`${def().title} — Defend Sorren Motors · wave ${n} of ${st.waves} (${S.waveLeft} left)`);
    G.audio.sting('bad');
  }

  function onEnterCar(car) {
    if (!S.active) return;
    const st = step();
    if (!st) return;
    if ((st.type === 'steal' || st.type === 'take') && car.id === S.targetCarId) {
      G.hud.feed(`Got the ${car.def.name}. Now deliver it.`);
      advanceStep();
    }
  }

  function onEnemyDown() {
    if (!S.active) return;
    const st = step();
    if (!st || st.type !== 'defend') return;
    S.waveLeft--;
    if (S.waveLeft <= 0) {
      if (S.wave < st.waves) {
        beginWave(S.wave + 1);
      } else {
        G.hud.feed('The garage is safe. Now run for the marina.');
        advanceStep();
      }
    } else {
      G.hud.setObjective(`${def().title} — Defend Sorren Motors · wave ${S.wave} of ${st.waves} (${S.waveLeft} left)`);
    }
  }

  function onWasted() {
    G.player.hp = 100;
    G.player.cash = Math.max(0, G.player.cash - 150);
    G.player.dead = false;
    const c = CITY.points.clinic;
    G.player.place(c.x, c.z, 0);
    G.player.inCar = false; G.player.car = null;
    if (S.active) fail('WASTED — you woke up at Casa Palma, $150 lighter.');
    else G.screens.showCard('WASTED', 'You woke up at Casa Palma, $150 lighter.', () => {});
  }

  function onBusted() {
    G.player.cash = Math.max(0, G.player.cash - 250);
    G.police.setWanted(0, 'busted');
    const s = CITY.points.station;
    G.player.place(s.x - 20, s.z, 0);
    G.player.inCar = false; G.player.car = null;
    if (S.active) fail('BUSTED — CBPD dropped you at the station, $250 lighter.');
    else G.screens.showCard('BUSTED', 'CBPD dropped you at the station, $250 lighter.', () => {});
  }

  function onCarWrecked(car) {
    const P = G.player;
    if (P.car === car) {
      P.inCar = false; P.car = null; car.isPlayer = false;
      const side = { x: car.x + 3, z: car.z + 3 };
      P.x = side.x; P.z = side.z;
      G.audio.thud();
    }
    if (S.active && S.targetCar === car) fail('The target car is wrecked.');
  }

  function update(dt) {
    if (!S.active) return;
    const d = def(), st = step();
    if (!st) return;
    S.timer -= dt;
    if (S.timer <= 0) { fail('Out of time.'); return; }
    const P = G.player;
    if (S.countdown > 0) {
      S.countdown -= dt;
      if (S.countdown <= 0) G.hud.feed('GO!');
      return; // racers and player hold during the countdown
    }
    const dist = (p) => Math.hypot(P.x - p.x, P.z - p.z);
    if (st.type === 'deliver') {
      const p = CITY.points[st.point];
      const inRightCar = !S.targetCar || (P.car && P.car.id === S.targetCarId);
      const here = P.inCar ? Math.hypot(P.car.x - p.x, P.car.z - p.z) : dist(p);
      if (here < p.r && inRightCar) {
        if (S.targetCar && P.car) {
          // Hand the car over: it becomes garage stock.
          P.inCar = false; P.car = null;
          G.player.owned.push({ variant: S.targetCar.variant, color: S.targetCar.color, hp: S.targetCar.hp, id: S.targetCar.id });
          G.vehicles.remove(S.targetCar);
          P.x = p.x + 4; P.z = p.z + 4;
        }
        advanceStep();
      }
    } else if (st.type === 'escape') {
      const p = CITY.points[st.point];
      if (dist(p) < p.r && G.police.wanted === 0) {
        G.hud.feed('Clean. Nobody saw you slip away.');
        advanceStep();
      }
    } else if (st.type === 'rob') {
      const p = CITY.points[st.point];
      if (!S.robbed && dist(p) < p.r + 6 && S.clerk) {
        // Hold the clerk covered: camera facing the clerk, within 16 m.
        const dx = S.clerk.x - P.x, dz = S.clerk.z - P.z;
        const dd = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let err = want - P.camYaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        if (dd < 16 && Math.abs(err) < 0.5 && !P.inCar) {
          S.robT += dt;
          G.hud.setObjective(`${d.title} — Hold up SunMart… ${Math.ceil(st.hold - S.robT)}s`);
          if (S.robT >= st.hold) {
            S.robbed = true;
            P.cash += 250;
            G.police.crime('robbery', P.x, P.z, { set: 2 });
            G.audio.chaChing();
            G.hud.feed('Till emptied — $250. Now run!');
            advanceStep();
          }
        } else S.robT = Math.max(0, S.robT - dt * 2);
      }
    } else if (st.type === 'race') {
      const route = CITY.raceRoute;
      const px = P.inCar ? P.car.x : P.x, pz = P.inCar ? P.car.z : P.z;
      if (S.raceCp < route.length) {
        const [cx, cz] = route[S.raceCp];
        if (Math.hypot(px - cx, pz - cz) < 12) {
          S.raceCp++;
          G.hud.setObjective(`${d.title} — Checkpoint ${Math.min(S.raceCp, route.length)}/${route.length}`);
          if (S.raceCp >= route.length) {
            const place = S.racers.some((r) => r.finished) ? 2 : 1;
            if (place === 1) { G.hud.feed('You won the Neon Mile Run!'); advanceStep(); }
            else fail('Second place. The racers were faster this time.');
            return;
          }
        }
      }
      // Racers drive the route at 0.6x top speed; the player can outrun them.
      for (const r of S.racers) {
        if (r.finished) continue;
        if (r.cp < route.length) {
          const [cx, cz] = route[r.cp];
          const left = G.vehicles.driveToward(r.car, cx, cz, dt, 0.6);
          if (left < 10) r.cp++;
          if (r.cp >= route.length) r.finished = true;
        }
      }
    } else if (st.type === 'defend') {
      // Waves resolve through onEnemyDown; the step ends there.
    }
  }

  return G.missions;
}
