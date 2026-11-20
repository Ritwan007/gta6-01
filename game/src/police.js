// Wanted / heat — the CBPD response. Every crime feeds one system, and the escape is
// always possible: pursuit top speed is capped below the Interceptor and the GT, rams are
// one-time impacts (never a damage hose), attention crimes floor at 1 star and never stack,
// and hideouts genuinely conceal you.
import { HEAT, CITY } from './config.js';

export function createPolice(G) {
  const units = [];   // pursuit Interceptors
  const officers = []; // foot officers
  const crimeLog = [];
  const S = {
    wanted: 0, searching: false, unseenT: 0, bustT: 0,
    lastSeen: null, units, officers, crimeLog,
  };
  G.police = {
    crime, reportWitness, update, spawnPursuit, setWanted, inHideout, anyOfficerSeesPlayer,
    units, officers, crimeLog,
    get wanted() { return S.wanted; },
    get searching() { return S.searching; },
    get unseenT() { return S.unseenT; },
  };

  function inHideout(x, z) {
    for (const key of ['hideout1', 'hideout2']) {
      const p = CITY.points[key];
      if (Math.hypot(x - p.x, z - p.z) < p.r) return true;
    }
    return false;
  }

  function anyOfficerSeesPlayer() {
    const P = G.player;
    if (inHideout(P.x, P.z)) return false; // concealed inside a hideout
    for (const u of units) {
      const d = Math.hypot(u.x - P.x, u.z - P.z);
      if (d < 12) return true;
      if (d < 70 && !G.city.losBlocked(u.x, u.z, P.x, P.z)) return true;
    }
    for (const o of officers) {
      const d = Math.hypot(o.x - P.x, o.z - P.z);
      if (d < 12) return true;
      if (d < 40 && !G.city.losBlocked(o.x, o.z, P.x, P.z)) return true;
    }
    return false;
  }

  function setWanted(w, reason) {
    const before = S.wanted;
    S.wanted = Math.max(0, Math.min(HEAT.maxStars, w));
    if (S.wanted !== before) {
      crimeLog.push({ type: reason || 'set', from: before, to: S.wanted });
      S.unseenT = 0; S.searching = false;
      G.hud.setStars(S.wanted);
      if (S.wanted > 0) G.hud.feed(`Wanted level ${S.wanted} — CBPD is responding.`);
    }
    syncPursuit();
  }

  // Crime intake. opts: {set, attention}. Witness rule: a pedestrian with line of sight
  // within 25 m (handled by peds.witnessCrime, reported back via reportWitness), or any
  // officer within 12 m regardless.
  function crime(type, x, z, opts = {}) {
    if (opts.set !== undefined) { setWanted(opts.set, type); return; }
    if (opts.attention) {
      // Attention crimes (hit-and-run, shots fired) floor at 1 star, never stack.
      if (S.wanted === 0) setWanted(1, type);
      crimeLog.push({ type, from: S.wanted, to: S.wanted });
      return;
    }
    const officerNear = officers.some((o) => Math.hypot(o.x - x, o.z - z) < 12);
    if (officerNear) {
      // An officer nearby knows instantly — no witness needed.
      setWanted(S.wanted + 1, type);
      return;
    }
    // Otherwise the heat only lands when a witness finishes a 2 s call (reportWitness).
    const witnessed = G.peds.witnessCrime({ type, x, z, reported: false });
    if (!witnessed) crimeLog.push({ type, from: S.wanted, to: S.wanted, unwitnessed: true });
  }

  // A pedestrian finished a 2 s call about a crime: apply it once.
  function reportWitness(crimeObj) {
    if (!crimeObj || crimeObj.reported) return;
    crimeObj.reported = true;
    setWanted(S.wanted + 1, crimeObj.type);
  }

  function spawnPointNearPlayer(dist) {
    const P = G.player;
    const streets = CITY.streets;
    for (let tries = 0; tries < 12; tries++) {
      const s = streets[Math.floor(G.rng.next() * streets.length)];
      const along = (G.rng.chance(0.5) ? -1 : 1) * dist + (G.rng.chance(0.5) ? P.x : P.z);
      const x = G.rng.chance(0.5) ? s : Math.max(-400, Math.min(400, along));
      const z = G.rng.chance(0.5) ? Math.max(-400, Math.min(400, along)) : s;
      if (Math.hypot(x - P.x, z - P.z) > 55 && !G.city.collides(x, z, 3)) return { x, z };
    }
    return { x: P.x + 80, z: P.z };
  }

  function spawnPursuit() {
    const at = spawnPointNearPlayer(90);
    const car = G.vehicles.spawn('pursuit', at.x, at.z, 0, { pursuit: true, parked: false, traffic: false });
    car.contactWith = new Set();
    units.push(car);
    return car;
  }

  function syncPursuit() {
    const want = Math.min(S.wanted, 5);
    while (units.length < want) spawnPursuit();
    while (units.length > want) {
      const car = units.pop();
      G.vehicles.remove(car);
    }
  }

  function spawnOfficer() {
    const st = CITY.points.station;
    const x = st.x + G.rng.range(-30, 30), z = st.z + G.rng.range(-30, 30);
    const o = { x, z, heading: 0, bustT: 0 };
    officers.push(o);
    return o;
  }

  function update(dt) {
    const P = G.player;
    G.audio.setSiren(S.wanted > 0, dt);
    if (S.wanted > 0) {
      if (officers.length < 2 && S.wanted <= 2) spawnOfficer();
      const seen = anyOfficerSeesPlayer();
      if (seen) {
        S.unseenT = 0; S.searching = false;
        S.lastSeen = { x: P.x, z: P.z };
      } else {
        S.unseenT += dt;
        if (S.unseenT > HEAT.searchAfter) S.searching = true;
        const clearIn = HEAT.clearAfter * (inHideout(P.x, P.z) ? 0.5 : 1);
        if (S.unseenT > HEAT.searchAfter + clearIn) {
          setWanted(0, 'cooled');
          G.hud.feed('You lost them. The heat is off.');
        }
      }
      // Pursuit driving: chase the live position when seen, the last-seen spot when not.
      const target = seen ? { x: P.x, z: P.z } : (S.lastSeen || { x: P.x, z: P.z });
      for (const car of [...units]) {
        if (car.isPlayer) continue; // a stolen pursuit car is skipped by the AI
        if (car.wrecked) continue;
        const d = Math.hypot(target.x - car.x, target.z - car.z);
        if (!P.inCar && d < 7) {
          // On foot: pull up and hold ~7 m short, outside the 5 m interact radius.
          car.speed = Math.max(0, car.speed - 20 * dt);
        } else {
          G.vehicles.driveToward(car, target.x, target.z, dt, HEAT.pursuitTop(S.wanted) / car.def.top);
        }
        // One-time ram impacts on contact transition (never a damage hose).
        const pd = P.inCar && P.car ? Math.hypot(car.x - P.car.x, car.z - P.car.z) : Infinity;
        if (pd < 4.5) {
          if (!car.contactWith.has('player')) {
            car.contactWith.add('player');
            const lump = Math.min(8, 4 + Math.abs(car.speed - P.car.speed) * 0.5) * (S.wanted >= 3 ? 1.5 : 1);
            P.car.hp -= lump;
            car.speed *= 0.55;
            P.car.speed *= 0.92;
            G.audio.thud();
            if (P.car.hp <= 0) G.missions.onCarWrecked(P.car);
          }
        } else if (pd > 6) {
          car.contactWith.delete('player');
        }
        // Foot officers in the car path get shoved aside, not run over silently.
        if (P.inCar && P.car && Math.abs(P.car.speed) > 8) {
          for (const ped of G.peds.list) {
            const dd = Math.hypot(ped.x - P.car.x, ped.z - P.car.z);
            if (dd < 2.2 && ped.state === 'walk') {
              ped.state = 'flee'; ped.fleeFrom = { x: P.car.x, z: P.car.z }; ped.stateT = 0;
              crime('hitAndRun', ped.x, ped.z, { attention: true });
            }
          }
        }
      }
      // Foot officers converge on foot at low heat; a 3 s touch means BUSTED.
      for (const o of officers) {
        const d = Math.hypot(P.x - o.x, P.z - o.z);
        if (!P.inCar && S.wanted > 0 && d < 90) {
          const dx = (P.x - o.x) / (d || 1), dz = (P.z - o.z) / (d || 1);
          o.x += dx * 4.5 * dt; o.z += dz * 4.5 * dt;
          G.city.resolveCircle(o, 0.5);
        }
        if (!P.inCar && d < 2) {
          o.bustT += dt;
          if (o.bustT > HEAT.bustSeconds) G.missions.onBusted();
        } else o.bustT = 0;
      }
    } else {
      // No heat: pursuit cars drift off and despawn; officers return to the station.
      for (const car of [...units]) {
        car.speed = Math.max(0, car.speed - 10 * dt);
        G.vehicles.stepCar(car, dt);
      }
      if (units.length > 0) syncPursuit();
    }
  }

  return G.police;
}
