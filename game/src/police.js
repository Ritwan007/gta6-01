// VELORA HEAT — wanted / heat: crime intake with the witness rule, VBPD
// pursuit (Interceptor cars + foot officers), SEARCHING cool-down, hideouts,
// spray garage, BUSTED / WASTED.
// Witness rule (r13 lesson): a crime lands heat only when an officer is close
// (12 m, instant) or a witness FINISHES a 2 s phone call with line of sight.
// Hit-and-run and shots-fired floor at 1 star and never stack on their own.
import { CRIME, HIDEOUT_R, SEARCH_DELAY, CLEAR_DELAY, POINTS } from './config.js';
import { dist } from './random.js';
import { witnessesAt, officerNear, startWitnessCall } from './pedestrians.js';
import { makeCar, randomStreetPoint } from './vehicles.js';

export function createPolice(G) {
  const officers = [];
  let pending = null; // {add, set} waiting on a witness call

  function inHideout() {
    const p = G.player;
    return dist(p.x, p.z, POINTS.hideout1.x, POINTS.hideout1.z) < HIDEOUT_R ||
      dist(p.x, p.z, POINTS.hideout2.x, POINTS.hideout2.z) < HIDEOUT_R;
  }
  function anySeesPlayer() {
    if (G.wanted <= 0) return false;
    if (inHideout()) return false; // hideouts conceal (r13 lesson)
    const p = G.player;
    const pc = G.cars.find((c) => c.id === p.inCar);
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    for (const c of G.cars) {
      if (c.driver !== 'police') continue;
      if (dist(c.x, c.z, px, pz) < 70 && !G.city.segHitsBuilding(c.x, c.z, px, pz)) return true;
    }
    for (const o of officers) {
      if (dist(o.x, o.z, px, pz) < 40 && !G.city.segHitsBuilding(o.x, o.z, px, pz)) return true;
    }
    return false;
  }
  function applyHeat(add, set) {
    if (set != null) G.wanted = Math.max(G.wanted, set);
    else if (add) G.wanted = Math.min(5, G.wanted + add);
    if (G.wanted > 0) {
      G.unseenT = 0; G.searching = false;
      G.hud.updateStars();
      G.audio.siren(true, 0);
    }
  }
  function commitCrime(type) {
    const p = G.player;
    const pc = G.cars.find((c) => c.id === p.inCar);
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    if (type === 'stealPolice') { applyHeat(0, 3); G.hud.feed('VBPD radio: "Stolen unit! All cars, intercept!"', 'police'); return; }
    if (type === 'robbery') { applyHeat(0, 2); return; }
    if (type === 'hitPolice') { applyHeat(1, null); return; }
    // Witnessed crimes.
    const now = G.time;
    if (type === 'hitAndRun' || type === 'shotsFired') {
      // Floor at 1 star, never stack (r13 lesson).
      if (G.wanted >= 1) return;
      if (officerNear(G, px, pz, 12)) { applyHeat(0, 1); return; }
      const w = witnessesAt(G, px, pz);
      if (w.length) { pending = { add: 0, set: 1 }; startWitnessCall(G, w[0]); }
      return;
    }
    const add = CRIME[type] || 1;
    if (officerNear(G, px, pz, 12)) { applyHeat(add, null); return; }
    const w = witnessesAt(G, px, pz);
    if (w.length) { pending = { add, set: null }; startWitnessCall(G, w[0]); }
  }
  function witnessCall(ped) {
    // A witness finished their 2 s call: the pending crime lands now.
    if (pending) {
      applyHeat(pending.add, pending.set);
      G.hud.feed('VBPD radio: "Witness report — suspect spotted!"', 'police');
      pending = null;
    }
  }
  function clearWanted(reason) {
    G.wanted = 0; G.searching = false; G.unseenT = 0; pending = null;
    // Pursuit stands down.
    G.cars = G.cars.filter((c) => c.driver !== 'police');
    officers.length = 0;
    G.hud.updateStars();
    if (reason === 'escape') { G.hud.toast('You lost them. Heat cleared.'); G.hud.feed('VBPD radio: "Lost visual. Standing down."', 'police'); }
  }
  function spawnPursuit() {
    // One Interceptor per star, spawned 60-90 m away on a street.
    const want = Math.min(5, G.wanted);
    const have = G.cars.filter((c) => c.driver === 'police').length;
    for (let i = have; i < want; i++) {
      const p = G.player;
      let pt = null;
      for (let t = 0; t < 20; t++) {
        const cand = randomStreetPoint(G.rng);
        const d = dist(cand.x, cand.z, p.x, p.z);
        if (d > 60 && d < 110) { pt = cand; break; }
      }
      if (!pt) pt = randomStreetPoint(G.rng);
      const c = makeCar('police', pt.x, pt.z, Math.atan2(p.z - pt.z, p.x - pt.x), { driver: 'police' });
      G.cars.push(c);
    }
  }
  function spawnOfficers() {
    if (G.wanted < 1 || G.wanted > 2) return;
    if (officers.length >= 2) return;
    const p = G.player;
    officers.push({ kind: 'officer', x: POINTS.station.x + (G.rng() - 0.5) * 20, z: POINTS.station.z + (G.rng() - 0.5) * 20, angle: 0, hp: 60, bustT: 0, speed: 3.2 });
  }
  // Where a pursuit car should steer: the player when seen, else the last-seen
  // spot; null when it should hold (already at last-seen, player unseen).
  function pursuitTarget(car) {
    if (G.wanted <= 0) return null;
    const p = G.player;
    const pc = G.cars.find((c) => c.id === p.inCar);
    const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
    if (anySeesPlayer()) {
      G.lastSeen = { x: px, z: pz };
      return { x: px, z: pz };
    }
    const d = dist(car.x, car.z, G.lastSeen.x, G.lastSeen.z);
    if (d < 6) return null; // hold at the last-seen spot
    return { x: G.lastSeen.x, z: G.lastSeen.z };
  }
  function update(dt) {
    if (G.wanted > 0) {
      spawnPursuit();
      spawnOfficers();
      if (anySeesPlayer()) {
        G.unseenT = 0; G.searching = false;
        const p = G.player;
        const pc = G.cars.find((c) => c.id === p.inCar);
        G.lastSeen = { x: pc ? pc.x : p.x, z: pc ? pc.z : p.z };
      } else {
        G.unseenT += dt;
        if (G.unseenT > SEARCH_DELAY) G.searching = true;
        const limit = SEARCH_DELAY + CLEAR_DELAY * (inHideout() ? 0.5 : 1);
        if (G.unseenT > limit) clearWanted('escape');
      }
      G.hud.updateStars();
    }
    // Foot officers walk at the player; touching an on-foot player 3 s = BUSTED.
    const p = G.player;
    for (const o of officers) {
      if (o.hp <= 0) continue;
      const d = dist(o.x, o.z, p.x, p.z);
      if (p.inCar == null && d > 1.6) {
        const a = Math.atan2(p.z - o.z, p.x - o.x);
        o.x += Math.cos(a) * o.speed * dt; o.z += Math.sin(a) * o.speed * dt;
        o.angle = a;
        G.city.pushOutCircle(o, 0.5);
        o.bustT = 0;
      } else if (p.inCar == null && d <= 1.6) {
        o.bustT += dt;
        if (o.bustT >= 3) { G.events.busted = true; }
      }
    }
    for (let i = officers.length - 1; i >= 0; i--) if (officers[i].hp <= 0) officers.splice(i, 1);
  }
  return { officers, commitCrime, witnessCall, anySeesPlayer, clearWanted, pursuitTarget, update, inHideout };
}
