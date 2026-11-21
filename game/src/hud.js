// VELORA HEAT — HUD (DOM) + minimap + full-city map (canvas).
import { MISSIONS, RACE_CHECKPOINTS, GARAGE, HIDEOUT, SHOP, CASA_BIRU, DROP_POINT, MARINA, WEAPONS, WORLD } from './config.js';

function el(id) { return document.getElementById(id); }

export function updateHUD(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  const ws = p.weapons[p.weapon];
  el('hud-hp').style.width = `${Math.max(0, p.hp)}%`;
  el('hud-hp').className = p.hp > 50 ? 'hp-good' : p.hp > 25 ? 'hp-mid' : 'hp-low';
  el('hud-cash').textContent = `$${p.cash}`;
  const stars = el('hud-stars');
  let s = '';
  for (let i = 1; i <= 5; i += 1) s += i <= G.wanted ? '★' : '☆';
  stars.textContent = s;
  stars.className = G.searching ? 'stars searching' : 'stars';
  el('hud-weapon').textContent = p.weapon === 'fists'
    ? `${w.name}`
    : `${w.name}  ${ws.mag === Infinity ? '∞' : ws.mag}/${ws.reserve === Infinity ? '∞' : ws.reserve}`;
  // Objective banner.
  const obj = el('hud-objective');
  if (G.mission.active) {
    const m = MISSIONS[G.mission.index];
    let step = m.steps[Math.min(G.mission.step, m.steps.length - 1)];
    if (G.mission.index === 4) step = `Checkpoint ${G.mission.playerCp}/12 — beat the racers!`;
    if (G.mission.index === 5 && G.mission.step === 0) {
      const alive = G.enemies.filter((e) => e.hp > 0).length;
      step = `Defend the garage — wave ${G.mission.wave + 1}/3, ${alive} crew left`;
    }
    obj.textContent = `${m.id} ${m.title} — ${step}`;
  } else if (G.mission.index >= MISSIONS.length) {
    obj.textContent = 'All missions complete — free roam. Velora Bay is yours.';
  } else {
    obj.textContent = `Next job: ${MISSIONS[G.mission.index].id} ${MISSIONS[G.mission.index].title} — go to Karsa Auto Works (V)`;
  }
  // Prompt line (context action).
  el('hud-prompt').textContent = G.prompt || '';
  // Feed.
  const feed = el('hud-feed');
  feed.innerHTML = G.feedItems.slice(-3).map((f) => `<div>${f}</div>`).join('');
  // Hold-up progress.
  const hp = el('hud-holdup');
  if (G.holdup) {
    hp.classList.remove('hidden');
    hp.firstElementChild.style.width = `${((8 - G.holdup.t) / 8) * 100}%`;
  } else hp.classList.add('hidden');
  drawMinimap(G);
}

function drawMapOn(ctx, G, size, withLabels) {
  const S = size / 704; // world -352..352 maps to the canvas
  const X = (x) => (x + 352) * S;
  const Z = (z) => (z + 352) * S;
  ctx.clearRect(0, 0, size, size);
  // Ground + water.
  ctx.fillStyle = '#8fa3a0';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#3f7fb8';
  ctx.fillRect(0, Z(330), size, size - Z(330));
  ctx.fillRect(X(330), 0, size - X(330), size);
  // Blocks.
  ctx.fillStyle = '#b5a67e';
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.landmark ? b.color : '#b5a67e';
    ctx.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * S, (b.z1 - b.z0) * S);
  }
  // Roads.
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = Math.max(1, 14 * S);
  for (const s of WORLD.streets) {
    ctx.beginPath(); ctx.moveTo(X(-352), Z(s)); ctx.lineTo(X(352), Z(s)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(s), Z(-352)); ctx.lineTo(X(s), Z(352)); ctx.stroke();
  }
  const blip = (x, z, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(X(x), Z(z), r, 0, Math.PI * 2); ctx.fill();
  };
  // Landmarks.
  blip(GARAGE.x, GARAGE.z, '#2fae5f', 5);
  blip(SHOP.x, SHOP.z, '#e8a13c', 4);
  blip(CASA_BIRU.x, CASA_BIRU.z, '#3f7fb8', 4);
  blip(HIDEOUT.x, HIDEOUT.z, '#2fae5f', 5);
  blip(MARINA.x, MARINA.z, '#3f7fb8', 4);
  // Race checkpoints.
  if (G.mission.active && G.mission.index === 4) {
    for (let i = 0; i < RACE_CHECKPOINTS.length; i += 1) {
      const [x, z] = RACE_CHECKPOINTS[i];
      blip(x, z, i === G.mission.playerCp ? '#ffd23f' : '#ffd23f88', i === G.mission.playerCp ? 6 : 3);
    }
  }
  // Current objective marker (gold diamond).
  const obj = currentObjective(G);
  if (obj) {
    ctx.fillStyle = '#ffd23f';
    ctx.save();
    ctx.translate(X(obj.x), Z(obj.z));
    ctx.rotate(Math.PI / 4);
    const r = 7;
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.restore();
  }
  // Police.
  for (const car of G.cars) {
    if (car.police && car.hp > 0) blip(car.x, car.z, '#4da3ff', 3.5);
  }
  // Player.
  const p = G.player;
  const pc = G.playerCar;
  const px = pc ? pc.x : p.x, pz = pc ? pc.z : p.z;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(X(px), Z(pz), 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(X(px), Z(pz), 5, 0, Math.PI * 2); ctx.stroke();
  if (withLabels) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('KARSA AUTO WORKS', X(GARAGE.x) + 8, Z(GARAGE.z) - 6);
    ctx.fillText('VELORA BAY', X(-300), Z(-330));
    ctx.fillText('PELANGIMART', X(SHOP.x) + 8, Z(SHOP.z) - 6);
    ctx.fillText('DERMAGA HIDEOUT', X(HIDEOUT.x) - 130, Z(HIDEOUT.z) + 20);
  }
  return { X, Z };
}

export function currentObjective(G) {
  if (!G.mission.active) return { x: GARAGE.x, z: GARAGE.z };
  const M = G.mission;
  if (M.index === 0) {
    if (M.step === 0) return { x: -220, z: 44 };
    if (M.step === 1) return { x: 220, z: 132 };
    return { x: GARAGE.x, z: GARAGE.z };
  }
  if (M.index === 1) {
    if (M.step <= 1) return { x: -44, z: 220 };
    return { x: CASA_BIRU.x, z: CASA_BIRU.z };
  }
  if (M.index === 2) return { x: HIDEOUT.x, z: HIDEOUT.z };
  if (M.index === 3) {
    if (M.step <= 1) return { x: SHOP.x, z: SHOP.z };
    return { x: DROP_POINT.x, z: DROP_POINT.z };
  }
  if (M.index === 4) {
    const cp = RACE_CHECKPOINTS[M.playerCp];
    return cp ? { x: cp[0], z: cp[1] } : { x: GARAGE.x, z: GARAGE.z };
  }
  if (M.index === 5) {
    return M.step === 0 ? { x: GARAGE.x, z: GARAGE.z } : { x: MARINA.x, z: MARINA.z };
  }
  return null;
}

let mmCtx = null;
export function drawMinimap(G) {
  const canvas = el('minimap');
  if (!canvas) return;
  if (!mmCtx) mmCtx = canvas.getContext('2d');
  drawMapOn(mmCtx, G, 180, false);
  // Search radius ring while SEARCHING.
  if (G.searching) {
    const S = 180 / 704;
    const p = G.player;
    const pc = G.playerCar;
    mmCtx.strokeStyle = '#ff5a4d';
    mmCtx.lineWidth = 1.5;
    mmCtx.beginPath();
    mmCtx.arc(( (pc ? pc.x : p.x) + 352) * S, ((pc ? pc.z : p.z) + 352) * S, 80 * S, 0, Math.PI * 2);
    mmCtx.stroke();
  }
}

let mapCtx = null;
export function drawFullMap(G) {
  const canvas = el('mapcanvas');
  if (!canvas) return;
  if (!mapCtx) mapCtx = canvas.getContext('2d');
  drawMapOn(mapCtx, G, 640, true);
}
