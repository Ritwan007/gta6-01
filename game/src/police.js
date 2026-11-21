// VELORA HEAT — the wanted system: crime intake, heat stars 1-5, Interceptor
// pursuit spawning, SEARCHING cool-down by line of sight, hideouts, the spray
// garage, and the BUSTED flow when an officer touches the player on foot.
import { dist, clamp } from './random.js';
import { createCar } from './vehicles.js';

export function createPolice(G) {
  const state = {
    unseenT: 0, // seconds with no officer line of sight
    bustedT: 0,
    officers: [], // foot officers near the station
  };

  function losToPlayer(x, z, maxD) {
    const p = G.player;
    const pc = G.playerCar;
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    if (dist(x, z, px, pz) > maxD) return false;
    return !G.city.segBlocked(x, z, px, pz);
  }
  function anyOfficerSees(px, pz, maxD) {
    for (const car of G.cars) {
      if (!car.police || car.hp <= 0) continue;
      if (dist(car.x, car.z, px, pz) <= maxD && !G.city.segBlocked(car.x, car.z, px, pz)) return true;
    }
    for (const o of state.officers) {
      if (dist(o.x, o.z, px, pz) <= maxD && !G.city.segBlocked(o.x, o.z, px, pz)) return true;
    }
    return false;
  }
  function inHideout() {
    const p = G.player;
    const pc = G.playerCar;
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    return dist(px, pz, G.hideout.x, G.hideout.z) < G.hideout.r;
  }

  function addWanted(n, reason) {
    if (G.wanted >= 5) return;
    const before = G.wanted;
    G.wanted = clamp(G.wanted + n, 0, 5);
    if (G.wanted !== before) {
      G.searching = false;
      state.unseenT = 0;
      G.feed(`${'★'.repeat(G.wanted)} VBPD heat ${G.wanted} — ${reason}.`);
    }
  }
  function setWanted(n, reason) {
    if (G.wanted === n) return;
    G.wanted = clamp(n, 0, 5);
    G.searching = false;
    state.unseenT = 0;
    G.feed(`${'★'.repeat(Math.max(1, G.wanted))} VBPD heat ${G.wanted} — ${reason}.`);
  }
  function clearWanted(reason) {
    if (G.wanted === 0) return;
    G.wanted = 0;
    G.searching = false;
    state.unseenT = 0;
    G.feed(reason || 'You lost them. Heat cleared.');
    G.audio.stingGood();
  }

  function spawnPolice() {
    const want = Math.min(G.wanted, 5);
    const have = G.cars.filter((c) => c.police && c.hp > 0).length;
    const p = G.player;
    const pc = G.playerCar;
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    for (let i = have; i < want; i += 1) {
      // Spawn on a street 70-110 m away, off the player's screen.
      const ang = G.rng() * Math.PI * 2;
      let x = px + Math.cos(ang) * (70 + G.rng() * 40);
      let z = pz + Math.sin(ang) * (70 + G.rng() * 40);
      x = G.city.nearestStreet(x); z = clamp(z, -340, 340);
      if (G.rng() < 0.5) { z = G.city.nearestStreet(z); x = clamp(x, -340, 340); }
      const car = createCar('police', x, z, G.rng() * Math.PI * 2, { parked: false, driver: true });
      car.speed = 8;
      G.cars.push(car);
    }
    // Foot officers near the station at heat 1-2.
    if (G.wanted >= 1 && G.wanted <= 2 && state.officers.length < 2) {
      state.officers.push({ x: 220 + (G.rng() - 0.5) * 20, z: -220 + (G.rng() - 0.5) * 20, speed: 4.2 });
    }
  }

  function step(dt) {
    if (G.wanted > 0) {
      spawnPolice();
      // Cool-down: unseen for 6 s -> SEARCHING; 8 more unseen seconds -> clear.
      const p = G.player;
      const pc = G.playerCar;
      const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
      const seen = inHideout() ? false : anyOfficerSees(px, pz, 80);
      if (seen) { state.unseenT = 0; G.searching = false; }
      else {
        state.unseenT += dt;
        if (state.unseenT > 6) G.searching = true;
        if (state.unseenT > 14) clearWanted();
      }
      G.audio.siren(true);
    } else {
      G.audio.siren(false);
    }
    // Despawn police cars that fell far behind once the heat is gone.
    if (G.wanted === 0) {
      const p = G.player;
      for (let i = G.cars.length - 1; i >= 0; i -= 1) {
        const car = G.cars[i];
        if (car.police && car !== G.playerCar && dist(car.x, car.z, p.x, p.z) > 160) G.cars.splice(i, 1);
      }
      state.officers.length = 0;
    }
    // Foot officers chase the player on foot; touch for 3 s -> BUSTED.
    const p = G.player;
    if (G.wanted > 0 && !p.inCar && p.hp > 0) {
      let touching = false;
      for (const o of state.officers) {
        const d = dist(o.x, o.z, p.x, p.z);
        if (d > 2) {
          const a = Math.atan2(p.z - o.z, p.x - o.x);
          o.x += Math.cos(a) * o.speed * dt;
          o.z += Math.sin(a) * o.speed * dt;
          const fixed = G.city.resolveCircle(o.x, o.z, 0.7);
          o.x = fixed.x; o.z = fixed.z;
        } else touching = true;
        // A police car parked on top of the player also counts.
        for (const car of G.cars) {
          if (car.police && car.hp > 0 && dist(car.x, car.z, p.x, p.z) < 3 && Math.abs(car.speed) < 1) touching = true;
        }
      }
      if (touching) {
        state.bustedT += dt;
        if (state.bustedT > 1) G.feed('VBPD is grabbing you — run!');
        if (state.bustedT >= 3) { state.bustedT = 0; G.gameOver('busted'); }
      } else state.bustedT = Math.max(0, state.bustedT - dt * 2);
    } else state.bustedT = 0;
  }

  return { addWanted, setWanted, clearWanted, anyOfficerSees, losToPlayer, inHideout, step, state };
}
