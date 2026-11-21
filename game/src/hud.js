// VELORA HEAT — HUD (DOM) + live minimap + full-city map screen.
import { GARAGE, HIDEOUT, MART, MISSIONS, RACE_CPS, SHOPS, STREETS } from './config.js';
import { playerCar } from './player.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const mapCanvas = el('map-canvas');
  const mapCtx = mapCanvas.getContext('2d');
  const cache = {};
  function setText(id, v) {
    if (cache[id] !== v) { cache[id] = v; el(id).textContent = v; }
  }
  function setWidth(id, v) {
    if (cache[id] !== v) { cache[id] = v; el(id).style.width = v; }
  }
  function objectivePoint() {
    const M = G.mission;
    if (!M.active) return M.index < 6 ? { x: GARAGE.x, z: GARAGE.z } : null;
    const car = playerCar(G);
    const gt = G.cars.find((c) => c.mission === 'M1' && c.hp > 0);
    const van = G.cars.find((c) => c.mission === 'M2' && c.hp > 0);
    switch (M.index) {
      case 0: return M.step === 2 ? { x: GARAGE.x, z: GARAGE.z } : gt ? { x: gt.x, z: gt.z } : { x: GARAGE.x, z: GARAGE.z };
      case 1: return M.step === 2 ? { x: 132, z: -220 } : van ? { x: van.x, z: van.z } : { x: GARAGE.x, z: GARAGE.z };
      case 2: return { x: HIDEOUT.x, z: HIDEOUT.z };
      case 3: return M.step === 2 ? { x: -132, z: 308 } : { x: MART.x, z: MART.z };
      case 4: return M.playerCp < 12 ? { x: RACE_CPS[M.playerCp][0], z: RACE_CPS[M.playerCp][1] } : { x: GARAGE.x, z: GARAGE.z };
      case 5: return M.step === 1 ? { x: 308, z: 308 } : { x: GARAGE.x, z: GARAGE.z };
      default: return null;
    }
  }
  function drawMinimap() {
    const S = 190 / 704; // world 704 m -> 190 px
    const ox = 352 * S, oz = 352 * S;
    mctx.fillStyle = '#20261f';
    mctx.fillRect(0, 0, 190, 190);
    mctx.strokeStyle = '#3a3f38';
    mctx.lineWidth = 2;
    for (const s of STREETS) {
      mctx.beginPath(); mctx.moveTo((s + 352) * S, 0); mctx.lineTo((s + 352) * S, 190); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, (s + 352) * S); mctx.lineTo(190, (s + 352) * S); mctx.stroke();
    }
    mctx.fillStyle = '#5a6252';
    for (const b of G.city.buildings) {
      mctx.fillRect((b.x + 352) * S, (b.z + 352) * S, Math.max(1, b.w * S), Math.max(1, b.d * S));
    }
    // Garage + shops.
    mctx.fillStyle = '#2ecc71';
    mctx.fillRect((GARAGE.x + 352) * S - 3, (GARAGE.z + 352) * S - 3, 6, 6);
    mctx.fillStyle = '#f2c94c';
    for (const s of SHOPS) mctx.fillRect((s.x + 352) * S - 2, (s.z + 352) * S - 2, 4, 4);
    // Objective.
    const op = objectivePoint();
    if (op) {
      mctx.fillStyle = '#ffd700';
      const px = (op.x + 352) * S, pz = (op.z + 352) * S;
      mctx.beginPath(); mctx.moveTo(px, pz - 5); mctx.lineTo(px + 4, pz); mctx.lineTo(px, pz + 5); mctx.lineTo(px - 4, pz); mctx.fill();
    }
    // Police blips.
    mctx.fillStyle = '#e74c3c';
    for (const c of G.cars) {
      if (c.driver === 'police' && c.hp > 0) {
        mctx.beginPath(); mctx.arc((c.x + 352) * S, (c.z + 352) * S, 3, 0, Math.PI * 2); mctx.fill();
      }
    }
    // Player.
    const p = G.player;
    const car = playerCar(G);
    const px = (car ? car.x : p.x), pz = (car ? car.z : p.z);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.arc((px + 352) * S, (pz + 352) * S, 3.5, 0, Math.PI * 2); mctx.fill();
    mctx.strokeStyle = '#ffffff';
    mctx.beginPath(); mctx.arc((px + 352) * S, (pz + 352) * S, 6, 0, Math.PI * 2); mctx.stroke();
  }
  function drawFullMap() {
    const S = 640 / 704;
    mapCtx.fillStyle = '#20261f';
    mapCtx.fillRect(0, 0, 640, 640);
    mapCtx.strokeStyle = '#3a3f38';
    mapCtx.lineWidth = 4;
    for (const s of STREETS) {
      mapCtx.beginPath(); mapCtx.moveTo((s + 352) * S, 0); mapCtx.lineTo((s + 352) * S, 640); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, (s + 352) * S); mapCtx.lineTo(640, (s + 352) * S); mapCtx.stroke();
    }
    mapCtx.fillStyle = '#5a6252';
    for (const b of G.city.buildings) {
      mapCtx.fillRect((b.x + 352) * S, (b.z + 352) * S, Math.max(1, b.w * S), Math.max(1, b.d * S));
    }
    mapCtx.font = 'bold 15px system-ui, sans-serif';
    mapCtx.textAlign = 'left';
    const labels = [
      [GARAGE.x, GARAGE.z, 'Bengkel Sari (Garasi)', '#2ecc71'],
      [HIDEOUT.x, HIDEOUT.z, 'Gudang Pelabuhan', '#f2c94c'],
      [132, -220, 'Casa Biru', '#6ad0e8'],
      [MART.x, MART.z, 'PelangiMart', '#f2c94c'],
      [-132, 308, 'Titik Drop', '#f2c94c'],
      [308, 308, 'Marina Verde', '#6ad0e8'],
      [308, -308, 'Markas VBPD', '#e74c3c'],
    ];
    for (const [x, z, t, col] of labels) {
      mapCtx.fillStyle = col;
      mapCtx.beginPath(); mapCtx.arc((x + 352) * S, (z + 352) * S, 5, 0, Math.PI * 2); mapCtx.fill();
      mapCtx.fillText(t, (x + 352) * S + 9, (z + 352) * S + 5);
    }
    const op = objectivePoint();
    if (op) {
      mapCtx.fillStyle = '#ffd700';
      const px = (op.x + 352) * S, pz = (op.z + 352) * S;
      mapCtx.beginPath(); mapCtx.moveTo(px, pz - 9); mapCtx.lineTo(px + 7, pz); mapCtx.lineTo(px, pz + 9); mapCtx.lineTo(px - 7, pz); mapCtx.fill();
    }
    const p = G.player;
    const car = playerCar(G);
    const px = (car ? car.x : p.x), pz = (car ? car.z : p.z);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.arc((px + 352) * S, (pz + 352) * S, 6, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.strokeStyle = '#ffd700';
    mapCtx.beginPath(); mapCtx.arc((px + 352) * S, (pz + 352) * S, 11, 0, Math.PI * 2); mapCtx.stroke();
  }
  function update() {
    const p = G.player;
    setWidth('health-fill', Math.max(0, Math.round(p.hp)) + '%');
    setText('hud-cash', '$' + Math.floor(p.cash));
    const stars = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    setText('hud-stars', stars + (G.searching ? '  MENCARI…' : ''));
    const w = p.weapons[p.weapon];
    const ammo = w.mag === Infinity ? '—' : `${w.mag}/${w.reserve}`;
    setText('hud-weapon', `${w.name}  ${ammo}`);
    setText('hud-objective', G.missions.objectiveText());
    // Feed: last 4 messages.
    const feed = G.feedItems.slice(-4).join('\n');
    setText('hud-feed', feed);
    // Hold-up progress.
    const holdEl = el('hud-holdup');
    if (G.holdup) {
      holdEl.classList.remove('hidden');
      setText('hud-holdup-text', `Merampok... ${Math.ceil(G.holdup.dur - G.holdup.t)} dtk — jangan bergerak!`);
      setWidth('holdup-fill', Math.round((G.holdup.t / G.holdup.dur) * 100) + '%');
    } else holdEl.classList.add('hidden');
    // Wanted flash on the stars element.
    el('hud-stars').style.color = G.searching ? '#f2c94c' : '#ffd700';
    drawMinimap();
    if (G.mode === 'map') drawFullMap();
  }
  return { update, objectivePoint };
}
